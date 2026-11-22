const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { MeetingsService } = require('../dist/meetings/meetings.service');

test('meeting creation uses the schema host role for the creator membership', async () => {
  const writes = [];
  const client = { from(table) {
    return { insert(values) {
      writes.push({ table, values });
      if (table === 'meetings') return { select: () => ({ single: async () => ({ data: values, error: null }) }) };
      return Promise.resolve({ error: null });
    } };
  } };
  const service = new MeetingsService({}, { client });
  const meeting = await service.createMeeting({ userId: 'creator' }, { title: ' Team ' });
  assert.equal(meeting.title, 'Team');
  assert.equal(writes[1].table, 'meeting_members');
  assert.equal(writes[1].values.role, 'host');
  assert.equal(writes[1].values.user_id, 'creator');
  assert.equal(writes[1].values.meeting_id, meeting.meeting_id);
});

test('quick meetings insert an ongoing session using the schema status', async () => {
  const writes = [];
  const client = { from(table) { return { insert(values) {
    writes.push({ table, values });
    return table === 'meeting_members' ? Promise.resolve({error:null})
      : {select:()=>({single:async()=>({data:values,error:null})})};
  } }; } };
  const service = new MeetingsService({}, {client});
  const result = await service.createQuickMeeting({userId:'creator'}, {title:'Quick meeting'});
  assert.equal(writes.find(write=>write.table==='meeting_members').values.role,'host');
  assert.equal(writes.find(write=>write.table==='meeting_sessions').values.status,'ongoing');
  assert.equal(result.session.status,'ongoing');
  assert.equal(result.session.meeting_id,result.meeting_id);
});

test('scheduled sessions transition to ongoing and ongoing sessions remain joinable', async () => {
  const session={session_id:'session',meeting_id:'meeting',status:'scheduled',scheduled_start_at:new Date(Date.now()-1000).toISOString()};
  let update;
  const query={update(values){update=values;return query;},eq(){return query;},select(){return query;},async maybeSingle(){return {data:{...session,...update},error:null};}};
  const service=new MeetingsService({}, {client:{from:()=>query}});
  const activated=await service.activateSession(session);
  assert.equal(activated.status,'ongoing');
  assert.equal(update.status,'ongoing');
  assert.equal(await service.activateSession(activated),activated);
});

function serviceForMember(role, invitedAt = null) {
  const member = { meeting_member_id:'member',user_id:'user',role,admission_status:'admitted',invited_at:invitedAt };
  const query = {};
  for (const method of ['select','eq','is','order','limit']) query[method] = () => query;
  query.maybeSingle = async () => ({ data: member, error: null });
  return new MeetingsService({}, { client: { from: () => query } });
}

test('host and moderator pass moderation checks; ordinary participants do not', async () => {
  for (const role of ['host', 'moderator']) {
    const service = serviceForMember(role);
    assert.equal((await service.requireModerator('meeting','user')).role, role);
  }
  await assert.rejects(() => serviceForMember('participant').requireModerator('meeting','user'), /permission is required/);
});

for (const role of ['moderator', 'participant']) {
  for (const [action, invoke] of [
    ['mute', service => service.mute({ userId: 'user' }, 'meeting', 'session', 'target')],
    ['kick', service => service.removeMember({ userId: 'user' }, 'meeting', 'target', 'session')],
    ['end', service => service.endSession({ userId: 'user' }, 'meeting', 'session')],
  ]) {
    test(`${role} cannot ${action} through the API`, async () => {
      const service = serviceForMember(role, '2026-11-22');
      service.getSession = service.getMemberById = async () => assert.fail('Must check the actor first');
      await assert.rejects(() => invoke(service), error => error.getStatus?.() === 403 && /owner/.test(error.message));
    });
  }
}

test('hosts cannot mute themselves or an owner; session-only guests cannot manage sessions', async () => {
  const service = serviceForMember('host');
  service.getSession = async () => ({ status:'ongoing' });
  service.getMemberById = async () => ({ role:'host',user_id:'host-user',admission_status:'admitted' });
  await assert.rejects(() => service.mute({userId:'moderator-user'}, 'meeting','session','host-member'), /owner cannot be muted/);
  await assert.rejects(() => service.mute({userId:'host-user'}, 'meeting','session','host-member'), /your own microphone/);
  await assert.rejects(() => serviceForMember('participant').requireMeetingMember('meeting','user'), /session-only guest/);
  assert.equal((await serviceForMember('host').requireMeetingMember('meeting','user')).role, 'host');
});

test('a host target cannot be removed or demoted', async () => {
  const service = serviceForMember('host');
  await assert.rejects(() => service.removeMember({userId:'actor'}, 'meeting', 'member'), /owner cannot be removed/);
  service.getMeetingById = async () => ({ created_by:'actor' });
  await assert.rejects(() => service.setModerator({userId:'actor'}, 'meeting', 'member', false), /Owner role cannot be changed/);
});

test('kick disconnects only the selected session and preserves meeting membership', async () => {
  const writes = [], filters = [], disconnected = [];
  const query = {
    select() { return this; }, not() { return this; }, is() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    update(value) { writes.push(value); return this; },
    then(resolve) { return Promise.resolve({ data: [{ attendance_id: 'a', session_id: 'session', livekit_identity: 'device' }], error: null }).then(resolve); },
  };
  const service = new MeetingsService({}, { client: { from(table) { assert.equal(table, 'attendances'); return query; } } });
  service.requireHost = async () => {};
  service.getMemberById = async () => ({ role: 'participant' });
  service.getSession = async () => ({ status: 'ongoing', livekit_room_name: 'room' });
  service.disconnectIfPresent = async (...args) => { disconnected.push(args); };
  await service.removeMember({ userId: 'host' }, 'meeting', 'member', 'session');
  assert.ok(filters.some(([key, value]) => key === 'session_id' && value === 'session'));
  assert.deepEqual(disconnected, [['room', 'device']]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].leave_reason, 'removed');
});

test('a kicked member requests and receives approval again for the same session', async () => {
  const rows = [
    { attendance_id: 'a', meeting_member_id: 'member', session_id: 'session', leave_reason: 'removed' },
    { attendance_id: 'b', meeting_member_id: 'member', session_id: 'other', leave_reason: 'client_left' },
  ];
  const config = { get: key => ({ LIVEKIT_URL: 'wss://unit.invalid', LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'synthetic-secret-for-unit-test' })[key], getOrThrow: () => 300 };
  const service = new MeetingsService(config, { client: { from(table) {
    assert.equal(table, 'attendances');
    let matches = rows, patch;
    return {
      insert(value) { assert.equal(value.meeting_member_id, 'member'); return this; },
      async single() { return { data: { attendance_id: 'new-attendance' }, error: null }; },
      update(value) { patch = value; return this; },
      select() { return this; },
      eq(key, value) { matches = matches.filter(row => row[key] === value); return this; },
      in(key, values) { matches = matches.filter(row => values.includes(row[key])); return this; },
      limit(count) { matches = matches.slice(0, count); return this; },
      then(resolve) {
        matches.forEach(row => Object.assign(row, patch));
        return Promise.resolve({ data: matches, error: null }).then(resolve);
      },
    };
  } } });
  const member = { meeting_member_id: 'member', role: 'participant', admission_status: 'admitted', invited_at: '2026-11-22' };
  service.getMeetingByCode = async () => ({ meeting_id: 'meeting', waiting_room_enabled: true });
  service.requireClubMeetingAccess = async () => {};
  service.getSession = async () => ({ status: 'ongoing', session_id: 'session', livekit_room_name: 'room' });
  service.getMember = service.getMemberById = async () => member;
  service.requireModerator = async () => ({ role: 'host' });

  assert.equal((await service.join({ userId: 'guest' }, 'code', 'session')).status, 'pending');
  assert.equal(rows[0].leave_reason, 'rejoin_pending');
  assert.equal((await service.approve({ userId: 'host' }, 'meeting', 'session', 'member')).admission_status, 'admitted');
  assert.equal(await service.requestReentry('member', 'session'), false);
  const joined = await service.join({ userId: 'guest' }, 'code', 'session', 'add');
  assert.equal(joined.status, 'admitted');
  assert.equal(joined.attendanceId, 'new-attendance');
  assert.equal(rows[1].leave_reason, 'client_left');
  assert.equal(member.admission_status, 'admitted');
});

test('only the host can load session moderation targets, deduplicated across devices', async () => {
  for (const role of ['participant', 'moderator']) {
    const service = serviceForMember(role);
    service.getSession = async () => assert.fail('Must check the actor first');
    await assert.rejects(() => service.sessionMembers({ userId: 'user' }, 'meeting', 'session'), /owner permission/);
  }
  const member = { meeting_member_id: 'member', user_id: 'user', role: 'participant', users: { display_name: 'Bình' } };
  const filters = [];
  const query = {
    select() { return this; },
    eq(...args) { filters.push(args); return this; },
    not(...args) { filters.push(args); return this; },
    is(...args) { filters.push(args); return this; },
    then(resolve) {
      return Promise.resolve({ data: [{ meeting_members: member }, { meeting_members: member }], error: null }).then(resolve);
    },
  };
  const service = new MeetingsService({}, { client: { from(table) { assert.equal(table, 'attendances'); return query; } } });
  service.requireHost = async () => {};
  service.getSession = async (meetingId, sessionId) => assert.deepEqual([meetingId, sessionId], ['meeting', 'session']);
  assert.deepEqual(await service.sessionMembers({ userId: 'host' }, 'meeting', 'session'), [member]);
  assert.ok(filters.some(([key, value]) => key === 'session_id' && value === 'session'));
  assert.ok(filters.some(([key, value]) => key === 'left_at' && value === null));
});
