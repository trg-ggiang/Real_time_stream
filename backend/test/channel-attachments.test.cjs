const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { WorkspaceChannels } = require('../dist/workspace/workspace-channels.service');
const { WorkspaceChannelsController } = require('../dist/workspace/workspace-channels.controller');
const { JwtAuthGuard } = require('../dist/auth/jwt-auth.guard');
const { CompleteProfileGuard } = require('../dist/users/complete-profile.guard');
const { configureApp } = require('../dist/configure-app');

const club = randomUUID(), channel = randomUUID(), message = randomUUID();
const user = randomUUID(), membership = randomUUID(), clientMessageId = randomUUID();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6n0AAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.7\n%%EOF\n');
const file = { buffer: png, originalname: 'Ảnh.png', mimetype: 'image/png' };

function fixture({ allowed = true, deleted = false } = {}) {
  const uploads = [], signCalls = [], rpc = [], objects = new Set();
  let metadata = [];
  const client = createClient('https://test.example', 'fake', { auth: { persistSession: false }, global: { fetch: async (input, options) => {
    const url = new URL(input);
    const table = url.pathname.split('/').at(-1);
    switch (table) {
      case 'club_memberships': return Response.json([{ membership_id: membership }]);
      case 'clubs': return Response.json([{ club_id: club }]);
      case 'club_channels': return Response.json([{ channel_id: channel, club_id: club }]);
      case 'clubspace_can_read_channel': return Response.json(allowed);
      case 'clubspace_send_channel_message_with_attachments': {
        const body = JSON.parse(options.body);
        rpc.push(body);
        metadata = body.p_attachments.map((item, position) => ({ ...item, position: position + 1 }));
        return Response.json(message);
      }
      case 'channel_messages': return Response.json({
        message_id: message, sender_membership_id: membership, content: rpc.at(-1)?.p_content ?? '',
        deleted_at: deleted ? '2026-11-20T00:00:00Z' : null, attachments: metadata,
      });
      case 'channel_message_attachments': {
        assert.equal(url.searchParams.get('channel_messages.channel_id'), 'eq.' + channel);
        assert.equal(url.searchParams.get('channel_messages.deleted_at'), 'is.null');
        return Response.json(deleted ? [] : [{ object_path: channel + '/object', original_name: 'Ảnh.png', mime_type: 'image/png' }]);
      }
      default: throw Error('Unexpected test route ' + table);
    }
  } } });
  Object.defineProperty(client, 'storage', { value: { from: name => {
    assert.equal(name, 'club-chat-attachments');
    return {
      async upload(path, bytes, options) {
        uploads.push({ path, bytes, options });
        if (objects.has(path)) return { error: { statusCode: 'Duplicate' } };
        objects.add(path);
        return { error: null };
      },
      async createSignedUrl(path, ttl, options) {
        signCalls.push({ path, ttl, options });
        return { data: { signedUrl: 'https://storage.example/signed' } };
      },
    };
  } } });
  return { service: new WorkspaceChannels(new WorkspaceAccess({ client })), uploads, signCalls, rpc };
}

test('multipart attachment message accepts empty content, two formats and a UTF-8 filename', async t => {
  const f = fixture();
  const module = await Test.createTestingModule({
    controllers: [WorkspaceChannelsController],
    providers: [
      { provide: WorkspaceChannels, useValue: f.service },
      { provide: ConfigService, useValue: { getOrThrow: () => 'http://localhost:5173' } },
    ],
  }).overrideGuard(JwtAuthGuard).useValue({ canActivate(context) {
    context.switchToHttp().getRequest().user = { userId: user };
    return true;
  } }).overrideGuard(CompleteProfileGuard).useValue({ canActivate: () => true }).compile();
  const app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const url = (await app.getUrl()) + `/api/workspace/${club}/channels/${channel}/messages/attachments`;
  const form = new FormData();
  form.append('client_message_id', clientMessageId);
  form.append('content', '');
  form.append('files', new Blob([png], { type: 'image/png' }), 'Ảnh.png');
  form.append('files', new Blob([pdf], { type: 'application/pdf' }), 'Kế hoạch.pdf');
  const response = await fetch(url, { method: 'POST', body: form });
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  assert.equal(result.item.content, '');
  assert.deepEqual(result.item.attachments.map(a => a.original_name), ['Ảnh.png', 'Kế hoạch.pdf']);
  assert.equal(f.rpc[0].p_actor, user);
  assert.equal(f.rpc[0].p_client_message_id, clientMessageId);
});

test('same attachment retry reuses paths and checks file content before uploading', async () => {
  const f = fixture();
  const body = { content: 'Chú thích', client_message_id: clientMessageId };
  await f.service.sendWithAttachments(user, club, channel, body, [file]);
  await f.service.sendWithAttachments(user, club, channel, body, [file]);
  assert.equal(f.uploads[0].path, f.uploads[1].path);
  assert.ok(f.uploads.every(upload => !upload.options.upsert));
  assert.deepEqual(f.rpc[0], f.rpc[1]);
  await assert.rejects(f.service.sendWithAttachments(user, club, channel, body,
    [{ ...file, buffer: Buffer.from('not an image') }]), e => e.getStatus() === 400);
  assert.equal(f.uploads.length, 2);
});

test('attachment links require current channel access and a visible parent message', async () => {
  const id = randomUUID();
  const denied = fixture({ allowed: false });
  await assert.rejects(denied.service.attachmentUrl(user, club, channel, id, true), e => e.getStatus() === 403);
  await assert.rejects(denied.service.sendWithAttachments(user, club, channel, { content: '', client_message_id: clientMessageId }, [file]), e => e.getStatus() === 403);
  assert.equal(denied.signCalls.length + denied.uploads.length, 0);
  const deleted = fixture({ deleted: true });
  await assert.rejects(deleted.service.attachmentUrl(user, club, channel, id, false), e => e.getStatus() === 404);
  const f = fixture();
  await f.service.attachmentUrl(user, club, channel, id, true);
  await f.service.attachmentUrl(user, club, channel, id, false);
  assert.equal(f.signCalls[0].ttl, 120);
  assert.equal(f.signCalls[0].options, undefined);
  assert.deepEqual(f.signCalls[1].options, { download: 'Ảnh.png' });
});
