const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { MeetingsService } = require('../dist/meetings/meetings.service');
const { TrackSource } = require('livekit-server-sdk');

function fixture(role = 'host') {
  const writes = [];
  const query = { select() { return this; }, eq() { return this; }, is() { return this; },
    async maybeSingle() { return { data: { meeting_member_id: 'guest' }, error: null }; } };
  const service = new MeetingsService({ get() {}, getOrThrow() {} }, { client: { from() { return query; } } });
  service.getMeetingById = async () => ({ created_by: 'owner' });
  service.requireMeetingMember = async () => ({ role });
  service.getSession = async () => ({ status: 'ongoing', livekit_room_name: 'room' });
  service.getMemberById = async () => ({ admission_status: 'admitted', removed_at: null });
  service.livekitRoomService = {
    getParticipant: async () => ({ attributes: { screenShareRequest: 'pending' }, permission: { canSubscribe: true } }),
    updateParticipant: async (...args) => { writes.push(args); },
  };
  return { service, writes };
}

test('only the actual meeting host approves sharing, never moderators or participants', async () => {
  for (const role of ['moderator', 'participant']) {
    const { service, writes } = fixture(role);
    await assert.rejects(() => service.decideScreenShare({ userId: 'owner' }, 'm', 's', 'guest', true), /Only the host/);
    assert.equal(writes.length, 0);
  }
  const { service } = fixture();
  await assert.rejects(() => service.decideScreenShare({ userId: 'other' }, 'm', 's', 'guest', true), /Only the host/);
});

test('approval enables screen and audio sources on the exact connected identity', async () => {
  const { service, writes } = fixture();
  await service.decideScreenShare({ userId: 'owner' }, 'm', 's', 'guest:connection', true);
  assert.equal(writes[0][0], 'room');
  assert.equal(writes[0][1], 'guest:connection');
  assert.ok(writes[0][2].permission.canPublishSources.includes(TrackSource.SCREEN_SHARE));
  assert.ok(writes[0][2].permission.canPublishSources.includes(TrackSource.SCREEN_SHARE_AUDIO));
  assert.equal(writes[0][2].attributes.screenShareRequest, '');
});

test('denial grants no sharing sources and reports the decision', async () => {
  const { service, writes } = fixture();
  await service.decideScreenShare({ userId: 'owner' }, 'm', 's', 'guest', false);
  assert.deepEqual(writes[0][2].permission.canPublishSources, [TrackSource.MICROPHONE, TrackSource.CAMERA]);
  assert.equal(writes[0][2].attributes.screenShareRequest, 'denied');
});

test('ended sessions, removed members and cancelled requests cannot be approved', async () => {
  for (const change of [
    s => { s.getSession = async () => ({ status: 'ended' }); },
    s => { s.getMemberById = async () => ({ admission_status: 'admitted', removed_at: 'now' }); },
    s => { s.livekitRoomService.getParticipant = async () => ({ attributes: {} }); },
  ]) {
    const { service, writes } = fixture(); change(service);
    await assert.rejects(() => service.decideScreenShare({ userId: 'owner' }, 'm', 's', 'guest', true));
    assert.equal(writes.length, 0);
  }
});
