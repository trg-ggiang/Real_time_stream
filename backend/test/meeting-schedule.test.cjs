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
  return { service, writes };
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
  const result = await service.listSessions('ABCDEFGHIJ');
  assert.equal(result.meeting.recurrenceRule,null);
  assert.equal(result.meeting.waitingRoomEnabled,true);
});
