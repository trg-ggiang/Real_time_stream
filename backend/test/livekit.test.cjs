const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');

// Synthetic signing credentials: tests never call LiveKit or read real secrets.
Object.assign(process.env, {
  NODE_ENV: 'test',
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
const { LivekitService } = require('../dist/livekit/livekit.service');
const { validateEnvironment } = require('../dist/config/environment');

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
    assert.throws(() => validateEnvironment(values));
  }
  assert.equal(validateEnvironment({}).POC_ENABLED, false);
});

test('token API enforces room, identity, permissions, expiry and rate limit', async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  t.after(async () => {
    await app.close();
  });
  const base = await app.getUrl();
  const requestToken = () =>
    fetch(`${base}/api/livekit/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
  assert.equal(a.roomName, 'media-test-room');
  assert.equal(b.roomName, a.roomName);
  assert.equal(a.serverUrl, process.env.LIVEKIT_URL);
  const verified = await new TokenVerifier(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  ).verify(a.token);
  assert.equal(verified.sub, a.participantIdentity);
  assert.equal(verified.video.room, 'media-test-room');
  assert.equal(verified.video.roomJoin, true);
  assert.equal(verified.video.canPublish, true);
  assert.equal(verified.video.canSubscribe, true);
  assert.equal(verified.video.canPublishData, false);
  assert.deepEqual(verified.video.canPublishSources, ['camera', 'microphone']);
  assert.notEqual(verified.video.roomAdmin, true);
  assert.notEqual(verified.video.roomCreate, true);
  const remainingSeconds = verified.exp - Math.floor(Date.now() / 1000);
  assert.ok(remainingSeconds > 290 && remainingSeconds <= 300);
  await assert.rejects(
    new TokenVerifier('wrong-key', 'wrong-secret').verify(a.token),
  );

  for (let i = 0; i < 8; i++) assert.equal((await requestToken()).status, 200);
  const limited = await requestToken();
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));

  const config = app.get(ConfigService);
  const service = app.get(LivekitService);
  config.set('LIVEKIT_API_SECRET', '');
  await assert.rejects(
    service.createJoinCredentials(),
    (error) => error.getStatus() === 503,
  );
  config.set('LIVEKIT_API_SECRET', process.env.LIVEKIT_API_SECRET);
  config.set('POC_ENABLED', false);
  await assert.rejects(
    service.createJoinCredentials(),
    (error) => error.getStatus() === 503,
  );
});
