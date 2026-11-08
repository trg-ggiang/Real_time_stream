const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
Object.assign(process.env, {
  NODE_ENV: 'test',
  POC_ENABLED: 'true',
  LIVEKIT_URL: 'wss://unit-test.livekit.cloud',
  LIVEKIT_API_KEY: 'synthetic-key',
  LIVEKIT_API_SECRET: 'synthetic-livekit-signing-secret',
  SUPABASE_URL: 'https://unit-test.supabase.co',
  SUPABASE_SECRET_KEY: 'synthetic-key',
  JWT_SECRET: 'synthetic-test-jwt-secret-longer-than-32-characters',
});
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module');
const { UsersService } = require('../dist/users/users.service');
const { configureApp } = require('../dist/configure-app');

test('HTTP auth validates users and uses HttpOnly cookie sessions', async (t) => {
  let stored;
  const users = {
    findByEmail: async (email) => stored?.email === email ? stored : null,
    findByEmailWithPassword: async (email) => stored?.email === email ? stored : null,
    findById: async (id) => stored?.userId === id ? { ...stored, passwordHash: undefined } : null,
    create: async (input) => (stored = { ...input, userId: 'test-user', avatarUrl: null }),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(UsersService).useValue(users).compile();
  const app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());

  const base = await app.getUrl();
  const post = (route, body, headers = {}) => fetch(`${base}/api/auth/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  assert.equal((await post('register', { email: 'bad', password: 'short' })).status, 400);
  assert.equal((await post('register', {
    email: 'a@test.dev',
    password: 'password123',
    displayName: 'A B',
    role: 'admin',
  })).status, 400);
  assert.equal((await post('register', {
    email: 'a@test.dev',
    password: '界'.repeat(25),
    displayName: 'A B',
  })).status, 400);

  const input = { email: ' A@Test.dev ', password: 'password123', displayName: ' A B ' };
  const response = await post('register', input);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const session = await response.json();
  assert.equal(session.user.email, 'a@test.dev');
  assert.equal(session.user.displayName, 'A B');
  assert.equal(session.user.passwordHash, undefined);
  assert.equal(session.access_token, undefined);
  assert.notEqual(stored.passwordHash, input.password);
  assert.ok(stored.passwordHash.startsWith('$2'));

  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  const cookie = setCookie.split(';', 1)[0];
  assert.equal((await post('register', input)).status, 409);

  assert.equal((await post('login', {
    email: input.email,
    password: 'wrong',
  })).status, 401);
  const login = await post('login', {
    email: input.email,
    password: input.password,
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).access_token, undefined);

  const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).passwordHash, undefined);
  assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);

  const room = await fetch(`${base}/api/livekit/token`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(room.status, 200);
  assert.ok((await room.json()).participantIdentity.startsWith('test-user:'));

  const logout = await post('logout', {});
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);

  for (let i = 0; i < 8; i++) {
    assert.equal((await post('login', {
      email: input.email,
      password: 'wrong',
    })).status, 401);
  }
  assert.equal((await post('login', {
    email: input.email,
    password: 'wrong',
  })).status, 429);
});
