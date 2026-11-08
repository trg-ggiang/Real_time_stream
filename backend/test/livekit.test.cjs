const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');

// Synthetic signing credentials: tests never call LiveKit or read real secrets.
Object.assign(process.env, {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://unit-test.supabase.co',
  SUPABASE_SECRET_KEY: 'synthetic-supabase-key',
  JWT_SECRET: 'synthetic-jwt-secret-at-least-32-characters',
  POC_ENABLED: 'true',
  LIVEKIT_URL: 'wss://unit-test.livekit.cloud',
  LIVEKIT_API_KEY: 'unit-test-api-key',
  LIVEKIT_API_SECRET: 'unit-test-signing-secret-only-not-a-real-credential',
  LIVEKIT_ROOM_NAME: 'media-test-room',
  LIVEKIT_TOKEN_TTL_SECONDS: '300',
  FRONTEND_URL: 'http://localhost:5173',
});

const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { TokenVerifier } = require('livekit-server-sdk');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');
const { configureFrontend } = require('../dist/configure-frontend');
const { LivekitService } = require('../dist/livekit/livekit.service');
const { validateEnvironment } = require('../dist/config/environment');
const { resolve } = require('node:path');

function makeLivekitConfig() {
  const values = {
    LIVEKIT_URL: 'wss://unit-test.livekit.cloud',
    LIVEKIT_API_KEY: 'unit-test-api-key',
    LIVEKIT_API_SECRET: 'unit-test-signing-secret-only-not-a-real-credential',
    LIVEKIT_TOKEN_TTL_SECONDS: 300,
    POC_ENABLED: true,
  };
  return {
    get: (key) => values[key],
    getOrThrow: (key) => values[key],
  };
}

test('waiting room blocks guests until the owner approves their app user ID', async () => {
  const host = { userId: 'host-user', email: 'host@example.test', displayName: 'Host' };
  const guest = { userId: 'guest-user', email: 'guest@example.test', displayName: 'Guest' };
  const roomId = '377f21cc-25b6-4396-b2e4-9b386c6f013b';
  const service = new LivekitService(makeLivekitConfig());
  await service.createRoom(host, roomId, { allowMic: true, allowVideo: true, waitingRoom: false });

  assert.deepEqual(await service.createJoinCredentials(guest, roomId), { waiting: true });
  assert.deepEqual(service.getWaitingParticipants(host, roomId), [
    { userId: guest.userId, displayName: guest.displayName },
  ]);
  assert.throws(() => service.getWaitingParticipants(guest, roomId), (error) => error.getStatus() === 403);
  assert.throws(() => service.approveParticipant(guest, roomId, guest.userId), (error) => error.getStatus() === 403);

  service.approveParticipant(host, roomId, guest.userId);
  const credentials = await service.createJoinCredentials(guest, roomId);
  assert.equal(credentials.waiting, undefined);
  assert.equal(credentials.isHost, false);
  assert.equal(credentials.roomName, roomId);
});

test('host microphone control mutes a published track and restores publish permission', async (t) => {
  const { RoomServiceClient } = require('livekit-server-sdk');
  const host = { userId: 'host-user', email: 'host@example.test', displayName: 'Host' };
  const guest = { userId: 'guest-user', email: 'guest@example.test', displayName: 'Guest' };
  const roomId = '377f21cc-25b6-4396-b2e4-9b386c6f013b';
  const participantIdentity = `${guest.userId}:participant-session`;
  const participant = {
    identity: participantIdentity,
    permission: { canSubscribe: true, canPublishData: false },
    tracks: [{ sid: 'TR_microphone', type: 0, source: 2, muted: false }],
  };
  const muteTrack = t.mock.method(RoomServiceClient.prototype, 'mutePublishedTrack', async () => ({}));
  const updateParticipant = t.mock.method(RoomServiceClient.prototype, 'updateParticipant', async () => participant);
  t.mock.method(RoomServiceClient.prototype, 'listParticipants', async () => [participant]);

  const service = new LivekitService(makeLivekitConfig());
  await service.createRoom(host, roomId, { allowMic: true, allowVideo: true, waitingRoom: false });
  await assert.rejects(
    service.muteParticipantMicrophone(guest, roomId, participantIdentity, true),
    (error) => error.getStatus() === 403,
  );
  await assert.rejects(
    service.muteParticipantMicrophone(host, roomId, `${host.userId}:host-session`, true),
    (error) => error.getStatus() === 403,
  );

  await service.muteParticipantMicrophone(host, roomId, participantIdentity, true);
  assert.deepEqual(muteTrack.mock.calls[0].arguments, [roomId, participantIdentity, 'TR_microphone', true]);
  assert.deepEqual(updateParticipant.mock.calls[0].arguments[2].permission.canPublishSources, [1]);
  const muted = await service.createJoinCredentials(guest, roomId);
  assert.deepEqual(
    (await new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).verify(muted.token)).video.canPublishSources,
    ['camera'],
  );

  await service.muteParticipantMicrophone(host, roomId, participantIdentity, false);
  assert.deepEqual(updateParticipant.mock.calls[1].arguments[2].permission.canPublishSources, [1, 2]);
  const unlocked = await service.createJoinCredentials(guest, roomId);
  assert.deepEqual(
    (await new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).verify(unlocked.token)).video.canPublishSources,
    ['camera', 'microphone'],
  );
  assert.equal(muteTrack.mock.calls.length, 1);
});

test('configuration rejects invalid values and production PoC token issuance', () => {
  for (const values of [
    { PORT: 'not-a-port' },
    { PORT: '70000' },
    { FRONTEND_URL: 'http://localhost:5173/path' },
    { LIVEKIT_URL: 'https://example.com' },
    { LIVEKIT_ROOM_NAME: '../other-room' },
    { LIVEKIT_TOKEN_TTL_SECONDS: '3600' },
    { NODE_ENV: 'production', POC_ENABLED: 'true' },
  ]) {
    assert.throws(() => validateEnvironment({ ...process.env, ...values }));
  }
  assert.equal(validateEnvironment({ ...process.env, POC_ENABLED: undefined }).POC_ENABLED, false);
  for (const key of ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY']) {
    assert.throws(() => validateEnvironment({ ...process.env, [key]: '' }));
  }
  assert.throws(() => validateEnvironment({ ...process.env, JWT_SECRET: 'short' }));
});

test('token API enforces room, identity, permissions, expiry and rate limit', async (t) => {
  const { Test } = require('@nestjs/testing');
  const { UsersService } = require('../dist/users/users.service');
  const { JwtService } = require('@nestjs/jwt');
  const user = { userId: 'test-user', email: 'test@example.test', displayName: 'Tester', avatarUrl: null };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(UsersService).useValue({ findById: async id => id === user.userId ? user : null }).compile();
  const app = module.createNestApplication({ logger: false });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const accessToken = jwt.sign({ sub: user.userId });
  const roomId = '377f21cc-25b6-4396-b2e4-9b386c6f013b';
  configureApp(app);
  configureFrontend(
    app,
    { get: (key) => key === 'NODE_ENV' ? 'production' : undefined },
    resolve(__dirname, 'fixtures/frontend'),
  );
  await app.listen(0, '127.0.0.1');
  t.after(async () => {
    await app.close();
  });
  const base = await app.getUrl();
  const requestToken = () =>
    fetch(`${base}/api/livekit/rooms/${roomId}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        roomName: 'unauthorized-room',
        identity: 'spoofed',
        roomAdmin: true,
      }),
    });

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const meetingPage = await fetch(`${base}/meeting`, {
    headers: { Accept: 'text/html' },
  });
  assert.equal(meetingPage.status, 200);
  assert.match(await meetingPage.text(), /meeting-route-fallback/);

  assert.equal((await fetch(base + '/api/livekit/token', { method: 'POST' })).status, 401);
  assert.equal((await fetch(base + '/api/livekit/token', { method: 'POST', headers: { Authorization: 'Bearer invalid' } })).status, 401);
  const expired = jwt.sign({ sub: user.userId }, { expiresIn: -1 });
  assert.equal((await fetch(base + '/api/livekit/token', { method: 'POST', headers: { Authorization: 'Bearer ' + expired } })).status, 401);
  const createRoomResponse = await fetch(`${base}/api/livekit/rooms/${roomId}/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ allowMic: true, allowVideo: true, waitingRoom: false }),
  });
  assert.equal(createRoomResponse.status, 201);
  const first = await requestToken();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.equal(
    first.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  const a = await first.json();
  const b = await (await requestToken()).json();
  assert.notEqual(a.participantIdentity, b.participantIdentity);
  assert.equal(a.roomName, roomId);
  assert.equal(b.roomName, a.roomName);
  assert.equal(a.serverUrl, process.env.LIVEKIT_URL);
  const verified = await new TokenVerifier(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  ).verify(a.token);
  assert.equal(verified.sub, a.participantIdentity);
  assert.ok(a.participantIdentity.startsWith(user.userId + ':'));
  assert.equal(verified.name, user.displayName);
  assert.equal(verified.video.room, roomId);
  assert.equal(verified.video.roomJoin, true);
  assert.equal(verified.video.canPublish, true);
  assert.equal(verified.video.canSubscribe, true);
  assert.equal(verified.video.canPublishData, false);
  assert.deepEqual(verified.video.canPublishSources, [
    'camera',
    'microphone',
  ]);
  assert.notEqual(verified.video.roomAdmin, true);
  assert.notEqual(verified.video.roomCreate, true);
  const remainingSeconds = verified.exp - Math.floor(Date.now() / 1000);
  assert.ok(remainingSeconds > 290 && remainingSeconds <= 300);
  await assert.rejects(
    new TokenVerifier('wrong-key', 'wrong-secret').verify(a.token),
  );

  const unregisteredRoomId = '477f21cc-25b6-4396-b2e4-9b386c6f013b';
  const unregisteredRoomResponse = await fetch(
    `${base}/api/livekit/rooms/${unregisteredRoomId}/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  assert.equal(unregisteredRoomResponse.status, 404);
  assert.equal(
    (
      await fetch(`${base}/api/livekit/rooms/not-a-uuid/token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    ).status,
    400,
  );

  for (let i = 0; i < 8; i++) assert.equal((await requestToken()).status, 200);
  const limited = await requestToken();
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));

  const config = app.get(ConfigService);
  const service = app.get(LivekitService);
  config.set('LIVEKIT_API_SECRET', '');
  await assert.rejects(
    service.createJoinCredentials(user),
    (error) => error.getStatus() === 503,
  );
  config.set('LIVEKIT_API_SECRET', process.env.LIVEKIT_API_SECRET);
  config.set('POC_ENABLED', false);
  await assert.rejects(
    service.createJoinCredentials(user),
    (error) => error.getStatus() === 503,
  );
});
