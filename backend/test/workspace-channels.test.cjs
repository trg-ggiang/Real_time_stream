const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
require('reflect-metadata');
const { WorkspaceChannels } = require('../dist/workspace/workspace-channels.service');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { MeetingsService } = require('../dist/meetings/meetings.service');

function fixture({ allowed = true, role = 'chairperson', outsider = false, duplicate = false } = {}) {
  const calls = [];
  const row = { message_id: 'message', channel_id: 'channel', sender_membership_id: 'membership',
    client_message_id: 'client-key', content: 'Hello', created_at: '2026-11-19T00:00:00Z', deleted_at: null,
    club_memberships: { users: { display_name: 'Name', avatar_url: null } } };
  const client = createClient('https://test.example', 'fake', { auth: { persistSession: false }, global: { fetch: async (input, options) => {
    const url = new URL(input), table = url.pathname.split('/').at(-1);
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ table, body, method: options.method, query: url.searchParams });
    if (table === 'club_memberships') return Response.json(outsider ? [] : [{ membership_id: 'membership', user_id: 'actor', role }]);
    if (table === 'clubs') return Response.json([{ club_id: 'club' }]);
    if (table === 'club_channels') return Response.json([{ channel_id: 'channel', club_id: 'club', kind: 'general', name: 'Chung' }]);
    if (table === 'clubspace_can_read_channel') return Response.json(allowed);
    if (table === 'channel_messages') {
      if (options.method === 'POST') return duplicate ? Response.json({ code: '23505' }, { status: 409 }) : Response.json(row);
      if (url.searchParams.has('client_message_id')) return Response.json([row]);
      return Response.json([row, { ...row, message_id: 'deleted', content: 'SECRET DELETED', deleted_at: '2026-11-19T00:01:00Z', sender_membership_id: 'another' }]);
    }
    if (table === 'meetings') return Response.json({ ...body, meeting_id: 'meeting' });
    if (table === 'meeting_members') return Response.json([]);
    throw new Error('Unexpected fake request ' + table);
  } } });
  const access = new WorkspaceAccess({ client });
  return { service: new WorkspaceChannels(access), client, calls, row };
}

test('channel list uses the DB permission function, including for chairperson', async () => {
  const denied = fixture({ allowed: false });
  assert.deepEqual(await denied.service.list('actor', 'club'), { items: [] });
  const allowed = fixture();
  assert.equal((await allowed.service.list('actor', 'club')).items.length, 1);
  const check = allowed.calls.find(c => c.table === 'clubspace_can_read_channel');
  assert.deepEqual(check.body, { p_actor: 'actor', p_channel: 'channel' });
});

test('outsiders and private-channel denials cannot load or send messages', async () => {
  for (const options of [{ outsider: true }, { allowed: false }]) {
    const f = fixture(options);
    await assert.rejects(f.service.history('actor', 'club', 'channel'), e => e.getStatus() === 403);
    await assert.rejects(f.service.send('actor', 'club', 'channel', { content: 'Hello', client_message_id: 'client-key' }), e => e.getStatus() === 403);
    assert.equal(f.calls.some(c => c.table === 'channel_messages'), false);
  }
});

test('history masks deleted text and other senders retry keys; requires complete cursor', async () => {
  const f = fixture();
  const result = await f.service.history('actor', 'club', 'channel');
  const deleted = result.items.find(x => x.message_id === 'deleted');
  assert.equal(deleted.content, '');
  assert.equal(deleted.client_message_id, undefined);
  assert.equal(result.items.find(x => x.message_id === 'message').sender, 'Name');
  await assert.rejects(f.service.history('actor', 'club', 'channel', '2026-11-19T00:00:00Z'), e => e.getStatus() === 400);
  await f.service.history('actor', 'club', 'channel', '2026-11-19T00:00:00Z', '00000000-0000-4000-8000-000000000000');
  const q = f.calls.filter(c => c.table === 'channel_messages').at(-1).query;
  assert.equal(q.get('channel_id'), 'eq.channel');
  assert.equal(q.get('limit'), '51');
  assert.match(q.get('or'), /created_at\.lt/);
});

test('send binds actor membership and preserves retry identity without overwriting', async () => {
  const f = fixture();
  await f.service.send('actor', 'club', 'channel', { content: ' Hello ', client_message_id: 'client-key' });
  const write = f.calls.find(c => c.table === 'channel_messages' && c.method === 'POST');
  assert.deepEqual(write.body, { channel_id: 'channel', sender_membership_id: 'membership', client_message_id: 'client-key', content: 'Hello', updated_by: 'actor' });
  const duplicate = fixture({ duplicate: true });
  assert.equal((await duplicate.service.send('actor', 'club', 'channel', { content: 'Hello', client_message_id: 'client-key' })).item.message_id, 'message');
  await assert.rejects(duplicate.service.send('actor', 'club', 'channel', { content: 'Changed', client_message_id: 'client-key' }), e => e.getStatus() === 409);
  assert.equal(duplicate.calls.some(c => c.method === 'PATCH'), false);
});

test('blank messages never reach insert', async () => {
  const f = fixture();
  await assert.rejects(f.service.send('actor', 'club', 'channel', { content: '  ', client_message_id: 'key' }), e => e.getStatus() === 400);
  assert.equal(f.calls.some(c => c.table === 'channel_messages'), false);
});

test('meeting creation binds club only after active membership validation', async () => {
  const f = fixture();
  const meetings = new MeetingsService({}, { client: f.client });
  await meetings.createMeeting({ userId: 'actor' }, { title: 'CLB', clubId: 'club' });
  assert.equal(f.calls.find(c => c.table === 'meetings' && c.method === 'POST').body.club_id, 'club');
  const denied = fixture({ outsider: true });
  await assert.rejects(new MeetingsService({}, { client: denied.client }).createMeeting({ userId: 'actor' }, { title: 'CLB', clubId: 'club' }), e => e.getStatus() === 403);
  assert.equal(denied.calls.some(c => c.table === 'meetings'), false);
});
