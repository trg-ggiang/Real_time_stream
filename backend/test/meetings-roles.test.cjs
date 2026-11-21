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

test('moderators cannot mute a host; session-only guests cannot manage sessions', async () => {
  const service = serviceForMember('moderator');
  service.getSession = async () => ({ status:'ongoing' });
  service.getMemberById = async () => ({ role:'host',user_id:'host-user',admission_status:'admitted' });
  await assert.rejects(() => service.mute({userId:'moderator-user'}, 'meeting','session','host-member'), /rank or lower/);
  await assert.rejects(() => serviceForMember('participant').requireMeetingMember('meeting','user'), /session-only guest/);
  assert.equal((await serviceForMember('host').requireMeetingMember('meeting','user')).role, 'host');
});

test('a host target cannot be removed or demoted', async () => {
  const service = serviceForMember('host');
  await assert.rejects(() => service.removeMember({userId:'actor'}, 'meeting', 'member'), /owner cannot be removed/);
  service.getMeetingById = async () => ({ created_by:'actor' });
  await assert.rejects(() => service.setModerator({userId:'actor'}, 'meeting', 'member', false), /Owner role cannot be changed/);
});
