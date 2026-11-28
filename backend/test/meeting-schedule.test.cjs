const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { MeetingsService } = require('../dist/meetings/meetings.service');

function fixture({ count = 0 } = {}) {
  const writes = [];
  const query = { select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; },
    insert(rows) { writes.push(...rows); return this; },
    then(resolve, reject) { return Promise.resolve({ data: writes.length ? writes : [], count, error: null }).then(resolve, reject); } };
  const service = new MeetingsService({}, { client: { from: () => query } });
  service.requireMeetingMember = async () => ({ role: 'host' });
  const meeting = { meeting_id:'m',meeting_code:'ABCDEFGHIJ',title:'Meeting',recurrence_rule:null,waiting_room_enabled:true };
  service.getMeetingById = service.getMeetingByCode = async () => meeting;
  return { service, writes, meeting };
}
const times = () => ({ scheduledStartAt:new Date(Date.now()+3600000).toISOString(), scheduledEndAt:new Date(Date.now()+7200000).toISOString() });

test('future first appointment succeeds for a nonrecurring meeting', async () => {
  const { service, writes } = fixture();
  const result = await service.createSession({userId:'host'},'m',times());
  assert.equal(result.sessions.length,1);
  assert.equal(writes[0].status,'scheduled');
});

test('existing single session and invalid times produce distinct actionable codes without inserts', async () => {
  const existing = fixture({count:1});
  await assert.rejects(()=>existing.service.createSession({userId:'host'},'m',times()), error => error.getResponse().code === 'SINGLE_SESSION_EXISTS');
  assert.equal(existing.writes.length,0);
  const invalid = fixture();
  await assert.rejects(()=>invalid.service.createSession({userId:'host'},'m',{...times(),scheduledStartAt:new Date(Date.now()-60000).toISOString()}), error => error.getResponse().code === 'INVALID_SCHEDULE_TIME');
  assert.equal(invalid.writes.length,0);
});

test('session overview exposes recurrence and waiting settings after reload', async () => {
  const { service } = fixture({count:1});
  service.getMember = async () => ({ meeting_member_id: 'member', user_id: 'host', role: 'host', admission_status: 'admitted', invited_at: null });
  const result = await service.listSessions({userId:'host'}, 'ABCDEFGHIJ');
  assert.deepEqual(result.membership, { meetingMemberId: 'member', userId: 'host', role: 'host', invitedAt: null });
  assert.equal(result.meeting.recurrenceRule,null);
  assert.equal(result.meeting.waitingRoomEnabled,true);
});

test('weekly recurrence without BYDAY keeps the first session weekday', async () => {
  const { service, writes, meeting } = fixture();
  meeting.recurrence_rule = 'FREQ=WEEKLY;COUNT=4';
  const result = await service.createSession({userId:'host'}, 'm', times());
  assert.equal(result.sessions.length, 4);
  assert.equal(writes.length, 4);
  for (let index = 1; index < writes.length; index++) {
    assert.equal(new Date(writes[index].scheduled_start_at).getTime() - new Date(writes[index - 1].scheduled_start_at).getTime(), 7 * 86400000);
  }
});

test('weekly recurrence accepts selected weekdays until the end date', async () => {
  const { service, writes, meeting } = fixture();
  const start = new Date(Date.now() + 7 * 86400000);
  const end = new Date(start.getTime() + 3600000);
  const until = new Date(start.getTime() + 14 * 86400000);
  until.setUTCHours(23, 59, 59, 0);
  const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const first = start.getUTCDay();
  const second = (first + 2) % 7;
  meeting.recurrence_rule = `FREQ=WEEKLY;UNTIL=${until.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')};BYDAY=${codes[first]},${codes[second]}`;
  await service.createSession({userId:'host'}, 'm', { scheduledStartAt: start.toISOString(), scheduledEndAt: end.toISOString() });
  assert.equal(writes.length, 5);
  assert.deepEqual(writes.map(row => new Date(row.scheduled_start_at).getUTCDay()), [first, second, first, second, first]);
  assert.ok(writes.every(row => new Date(row.scheduled_end_at).getTime() - new Date(row.scheduled_start_at).getTime() === 3600000));
});
