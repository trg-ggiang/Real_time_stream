const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
require('reflect-metadata');
const { WorkspaceChannels } = require('../dist/workspace/workspace-channels.service');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { MeetingsService } = require('../dist/meetings/meetings.service');

function fixture({ allowed = true, role = 'chairperson', outsider = false, duplicate = false, expired = false } = {}) {
  const calls = [];
  const events = [];
  const hides = new Set();
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
    if (table === 'clubspace_mark_channel_read') return Response.json(null);
    if (table === 'channel_messages') {
      if (options.method === 'POST') return duplicate ? Response.json({ code: '23505' }, { status: 409 }) : Response.json(row);
      if (options.method === 'PATCH') {
        if (expired && !body.deleted_at) return Response.json({ code: 'PT409' }, { status: 409 });
        Object.assign(row, body.deleted_at ? { deleted_at: body.deleted_at } : { content: body.content, edited_at: new Date().toISOString() });
        return Response.json([row]);
      }
      if (url.searchParams.has('client_message_id')) return Response.json([row]);
      const rows = [{ ...row, hides: hides.has(url.searchParams.get('hides.user_id')) ? [{ message_id: row.message_id }] : [] },
        { ...row, message_id: 'deleted', content: 'SECRET DELETED', deleted_at: '2026-11-19T00:01:00Z', sender_membership_id: 'another' }];
      return Response.json(rows.filter(item => !url.searchParams.has('message_id') || url.searchParams.get('message_id') === 'eq.' + item.message_id));
    }
    if (table === 'channel_message_hides') { hides.add('eq.' + body.user_id); return new Response(null, { status: 201 }); }
    if (table === 'meetings') return Response.json({ ...body, meeting_id: 'meeting' });
    if (table === 'meeting_members') return Response.json([]);
    throw new Error('Unexpected fake request ' + table);
  } } });
  const access = new WorkspaceAccess({ client });
  return { service: new WorkspaceChannels(access, { publish: event => events.push(event) }), client, calls, events };
}

test('personal hides survive history reads and remain private to the actor', async () => {
  const f = fixture();
  const { item } = await f.service.changeMessage('actor', 'club', 'channel', 'message', { action: 'hide' });
  assert.equal(item.hidden, true);
  assert.equal(item.content, '');
  assert.deepEqual(f.events, []);
  assert.equal((await f.service.history('actor', 'club', 'channel')).items.find(x => x.message_id === 'message').hidden, true);
  assert.equal((await f.service.history('other', 'club', 'channel')).items.find(x => x.message_id === 'message').content, 'Hello');
});

test('edit and recall require the sender; the database cutoff rejects late edits but allows recall', async () => {
  const f = fixture();
  for (const action of ['edit', 'recall']) {
    await assert.rejects(f.service.changeMessage('actor', 'club', 'channel', 'deleted', { action, content: 'x' }), e => e.getStatus() === 403);
  }
  assert.equal(f.calls.some(c => c.method === 'PATCH'), false);
  const edited = await f.service.changeMessage('actor', 'club', 'channel', 'message', { action: 'edit', content: ' New text ' });
  assert.equal(edited.item.content, 'New text');
  const update = f.calls.find(c => c.method === 'PATCH');
  assert.equal(update.query.get('sender_membership_id'), 'eq.membership');
  assert.equal(update.query.get('deleted_at'), 'is.null');
  assert.equal(f.events[0].message.content, 'New text');
  const late = fixture({ expired: true });
  await assert.rejects(late.service.changeMessage('actor', 'club', 'channel', 'message', { action: 'edit', content: 'x' }), e => e.getStatus() === 409);
  const recalled = await late.service.changeMessage('actor', 'club', 'channel', 'message', { action: 'recall' });
  assert.ok(recalled.item.deleted_at);
  assert.equal(recalled.item.content, '');
  assert.deepEqual(recalled.item.attachments, []);
  assert.equal(late.events[0].message.content, '');
});

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

test('mark read checks channel access and binds the authenticated actor', async () => {
  const f = fixture();
  await f.service.markRead('actor', 'club', 'channel', 'message');
  assert.deepEqual(f.calls.find(c => c.table === 'clubspace_mark_channel_read').body,
    { p_actor: 'actor', p_channel: 'channel', p_message: 'message' });
  const denied = fixture({ allowed: false });
  await assert.rejects(denied.service.markRead('actor', 'club', 'channel', 'message'), e => e.getStatus() === 403);
  assert.equal(denied.calls.some(c => c.table === 'clubspace_mark_channel_read'), false);
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
