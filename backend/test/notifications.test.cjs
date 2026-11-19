const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { createClient } = require('@supabase/supabase-js');
const { JwtService } = require('@nestjs/jwt');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { NotificationsGateway } = require('../dist/notifications/notifications.gateway');
const { EventEmitter } = require('node:events');
const secret = 'synthetic-test-secret-only-123456789';
test('inbox reads and unread counts are always scoped to the authenticated recipient', async () => {
  const queries = [];
  const client = createClient('https://test.invalid', 'synthetic', { global: { fetch: async input => { queries.push(new URL(input)); return Response.json([], { headers: { 'content-range': '0-0/0' } }); } } });
  const result = await new NotificationsService({ client }).list('actor-id', 2, true);
  assert.equal(queries.length, 2);
  for (const query of queries) { assert.equal(query.searchParams.get('recipient_id'), 'eq.actor-id'); assert.equal(query.searchParams.get('read_at'), 'is.null'); }
  assert.equal(queries[0].searchParams.get('offset'), '20');
  assert.equal(result.unread_count, 0);
});
test('marking read passes only server actor and notification id, then invalidates that inbox', async () => {
  let args, changed;
  const service = new NotificationsService({ client: { rpc: async (name, input) => { args = { name, input }; return { data: { updated: 0 }, error: null }; } } });
  service.events.on('changed', actor => { changed = actor; });
  assert.deepEqual(await service.read('actor', 'someone-elses-notification'), { updated: 0 });
  assert.deepEqual(args, { name: 'recruitment_read_notifications', input: { p_actor: 'actor', p_id: 'someone-elses-notification' } });
  assert.equal(changed, 'actor');
});
test('delivery cannot overlap locally and emits only committed recipient invalidations', async () => {
  let resolve, calls = 0; const recipients = [];
  const service = new NotificationsService({ client: { rpc: () => { calls++; return new Promise(r => { resolve = r; }); } } });
  service.events.on('changed', id => recipients.push(id));
  const first = service.deliver(); await service.deliver(); assert.equal(calls, 1);
  resolve({ data: { recipient_ids: ['one', 'two'] } }); await first;
  assert.deepEqual(recipients, ['one', 'two']);
});
test('delivery failures release the local lock and do not leak database errors', async () => {
  let calls = 0;
  const service = new NotificationsService({ client: { rpc: async () => { calls++; return { error: { message: 'private SQL secret' } }; } } });
  for (let i = 0; i < 2; i++) await assert.rejects(service.deliver(), error => error.getStatus() === 503 && !error.message.includes('secret'));
  assert.equal(calls, 2);
});
test('notification sockets verify signature, expiry and user existence; caller userId is ignored', async () => {
  const jwt = new JwtService();
  const gateway = new NotificationsGateway({ getOrThrow: () => secret }, jwt, { findById: async id => id === 'real-user' ? {} : null }, { events: new EventEmitter() });
  const token = jwt.sign({ sub: 'real-user' }, { secret, expiresIn: '1h' });
  assert.equal((await gateway.authenticate({ token, userId: 'victim' })).userId, 'real-user');
  for (const invalid of [{ token: 'fake' }, { token: jwt.sign({ sub: 'real-user' }, { secret, expiresIn: -1 }) }, { token: jwt.sign({ sub: 'missing-user' }, { secret, expiresIn: '1h' }) }, { token: jwt.sign({ sub: 'real-user' }, { secret: 'wrong-signature', expiresIn: '1h' }) }, {}]) await assert.rejects(gateway.authenticate(invalid));
});
