const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { ServerError } = require('livekit-server-sdk');
const { MeetingsService } = require('../dist/meetings/meetings.service');
const { WorkspacePeople } = require('../dist/workspace/workspace-people.service');
const { MeetingSessionsService } = require('../dist/meeting-sessions/meeting-sessions.service');

function fixture() {
  const tables = {
    meetings: [{ meeting_id: 'a', club_id: 'club-a' }, { meeting_id: 'b', club_id: 'club-b' }, { meeting_id: 'personal', club_id: null }],
    clubs: [{ club_id: 'club-a', status: 'published' }],
    club_memberships: [{ membership_id: 'club-member', club_id: 'club-a', user_id: 'student', role: 'member', status: 'active' }],
    meeting_members: ['a', 'b', 'personal'].map(id => ({ meeting_member_id: 'member-' + id, meeting_id: id,
      user_id: 'student', role: 'participant', invited_at: '2026-11-21T00:00:00Z', admission_status: 'admitted', removed_at: null })),
    meeting_sessions: ['a', 'b', 'personal'].map(id => ({ session_id: 'session-' + id, meeting_id: id, livekit_room_name: 'room-' + id, status: 'ongoing' })),
    attendances: ['a', 'a', 'b', 'personal'].map((id, index) => ({ attendance_id: 'attendance-' + index,
      meeting_member_id: 'member-' + id, session_id: 'session-' + id, livekit_identity: 'student:' + index,
      joined_at: '2026-11-21T00:00:00Z', left_at: null })),
  };
  const removals = [];
  const client = { from(table) {
    const predicates = []; let values;
    const query = {
      select() { return query; }, order() { return query; }, limit() { return query; },
      eq(key, value) { predicates.push(row => row[key] === value); return query; },
      neq(key, value) { predicates.push(row => row[key] !== value); return query; },
      is(key, value) { predicates.push(row => row[key] === value); return query; },
      not(key, op, value) { assert.equal(op, 'is'); predicates.push(row => row[key] !== value); return query; },
      in(key, list) { predicates.push(row => list.includes(row[key])); return query; },
      update(next) { values = next; return query; },
      maybeSingle: async () => ({ data: execute()[0] ?? null, error: null }),
      then(resolve, reject) { return Promise.resolve({ data: execute(), error: null }).then(resolve, reject); },
    };
    function execute() {
      const rows = (tables[table] ?? []).filter(row => predicates.every(predicate => predicate(row)));
      if (values) rows.forEach(row => Object.assign(row, values));
      return rows;
    }
    return query;
  } };
  const service = new MeetingsService({}, { client });
  service.livekitRoomService = { removeParticipant: async (room, identity) => { removals.push([room, identity]); } };
  return { service, client, tables, removals };
}

test('permanent invitation cannot end a session; host and moderator can', async () => {
  const f = fixture();
  await assert.rejects(f.service.endSession({ userId: 'student' }, 'a', 'session-a'), error => error.getStatus() === 403);
  assert.equal(f.tables.meeting_sessions[0].status, 'ongoing');
  assert.deepEqual(f.removals, []);
  for (const role of ['host', 'moderator']) {
    const allowed = fixture(); allowed.tables.meeting_members[0].role = role;
    const result = await allowed.service.endSession({ userId: 'student' }, 'a', 'session-a');
    assert.equal(result.status, 'ended');
    assert.equal(allowed.tables.meeting_sessions[0].status, 'ended');
    assert.equal(allowed.removals.length, 2);
  }
});

test('club revocation removes every device and durable meeting access only in that club', async () => {
  const f = fixture();
  await f.service.revokeClubMember('club-a', 'student');
  assert.deepEqual(f.removals, [['room-a', 'student:0'], ['room-a', 'student:1']]);
  assert.ok(f.tables.meeting_members[0].removed_at);
  assert.equal(f.tables.meeting_members[1].removed_at, null);
  assert.equal(f.tables.meeting_members[2].removed_at, null);
  assert.ok(f.tables.attendances.slice(0, 2).every(row => row.left_at && row.leave_reason === 'club_membership_removed'));
  assert.ok(f.tables.attendances.slice(2).every(row => row.left_at === null));
  assert.ok(f.tables.meeting_sessions.every(row => row.status === 'ongoing'));
});

test('partial LiveKit failure still removes other devices and cleanup can be retried', async () => {
  const f = fixture(); let fail = true;
  f.service.livekitRoomService.removeParticipant = async (room, identity) => {
    f.removals.push([room, identity]);
    if (identity === 'student:0' && fail) { fail = false; throw Error('network timeout'); }
  };
  await assert.rejects(f.service.revokeClubMember('club-a', 'student'), /Retry removal/);
  assert.ok(f.tables.meeting_members[0].removed_at);
  assert.equal(f.tables.attendances[0].left_at, null);
  assert.ok(f.tables.attendances[1].left_at);
  await f.service.revokeClubMember('club-a', 'student');
  assert.ok(f.tables.attendances[0].left_at);
  assert.deepEqual(f.removals.map(row => row[1]), ['student:0', 'student:1', 'student:0']);
});

test('already absent LiveKit rooms still close attendance and repeated cleanup is harmless', async () => {
  const f = fixture();
  f.service.livekitRoomService.removeParticipant = async () => { throw new ServerError('Not Found', 'missing room', 404, 'not_found'); };
  await f.service.revokeClubMember('club-a', 'student');
  await f.service.revokeClubMember('club-a', 'student');
  assert.ok(f.tables.attendances.slice(0, 2).every(row => row.left_at));
});

test('workspace removal revokes meetings after membership changes and supports retry', async () => {
  const f = fixture(); const events = [];
  const access = { supabase: { client: f.client }, check: error => { if (error) throw error; },
    require: async (actor, club, chair) => { assert.equal(actor, 'chair'); assert.equal(club, 'club-a'); assert.equal(chair, true); } };
  const people = new WorkspacePeople(access, { revokeClubMember: async (club, user) => {
    events.push([club, user]); assert.equal(f.tables.club_memberships[0].status, 'removed');
    if (events.length === 1) throw Error('temporary cleanup failure');
    await f.service.revokeClubMember(club, user);
  } });
  await assert.rejects(people.remove('chair', 'club-a', 'club-member'), /temporary cleanup failure/);
  assert.equal((await people.remove('chair', 'club-a', 'club-member')).item.membership_id, 'club-member');
  assert.deepEqual(events, [['club-a', 'student'], ['club-a', 'student']]);
  assert.equal(f.removals.length, 2);
});

test('unauthorized removal and chairperson removal never revoke meeting connections', async () => {
  for (const denied of [true, false]) {
    const f = fixture(); if (!denied) f.tables.club_memberships[0].role = 'chairperson';
    const people = new WorkspacePeople({ supabase: { client: f.client }, check() {},
      require: async () => { if (denied) throw Error('forbidden'); } }, f.service);
    await assert.rejects(people.remove('outsider', 'club-a', 'club-member'));
    assert.equal(f.tables.club_memberships[0].status, 'active');
    assert.deepEqual(f.removals, []);
  }
});

test('meeting chat denies removed club membership even when its durable meeting membership remains', async () => {
  const f = fixture(); const sessions = new MeetingSessionsService({ client: f.client });
  assert.equal((await sessions.requireAccess('student', 'session-a')).session_id, 'session-a');
  f.tables.club_memberships[0].status = 'removed';
  await assert.rejects(sessions.requireAccess('student', 'session-a'), error => error.getStatus() === 403);
  assert.equal((await sessions.requireAccess('student', 'session-personal')).session_id, 'session-personal');
});
