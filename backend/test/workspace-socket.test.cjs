const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ForbiddenException } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('socket.io-client');
const { WorkspaceChannelGateway } = require('../dist/workspace/workspace-channel.gateway');
const { WorkspaceChannelEvents } = require('../dist/workspace/workspace-channel-events');
const { WorkspaceChannels } = require('../dist/workspace/workspace-channels.service');
const { UsersService } = require('../dist/users/users.service');
const { ChatGateway } = require('../dist/chat/chat.gateway');

const clubId = '11111111-1111-4111-8111-111111111111';
const channelId = '22222222-2222-4222-8222-222222222222';
const otherChannel = '33333333-3333-4333-8333-333333333333';
const key = '44444444-4444-4444-8444-444444444444';
const nextEvent = (socket, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('Missing ' + event)); }, 5000);
  const handler = value => { clearTimeout(timer); resolve(value); };
  socket.once(event, handler);
});

test('channel socket authenticates, sends once, isolates channels and rechecks recipients before delivery', async () => {
  const events = new WorkspaceChannelEvents();
  const jwt = new JwtService({ secret: 'test-channel-secret' });
  const revoked = new Set();
  const records = new Map();
  const channels = {
    async requireChannel(userId, club, channel) {
      if (club !== clubId || ![channelId, otherChannel].includes(channel) || userId === 'outsider' || revoked.has(userId)) throw new ForbiddenException();
      return { membership: { membership_id: userId } };
    },
    async send(userId, club, channel, body) {
      await this.requireChannel(userId, club, channel);
      const id = userId + body.client_message_id;
      if (!records.has(id)) records.set(id, { message_id: key, channel_id: channel, sender_membership_id: userId,
        client_message_id: body.client_message_id, content: body.content, sender: userId, mine: true, created_at: new Date().toISOString() });
      const item = records.get(id);
      events.publish({ clubId: club, channelId: channel, message: item });
      return { item };
    },
  };
  const module = await Test.createTestingModule({ providers: [WorkspaceChannelGateway,
    { provide: WorkspaceChannels, useValue: channels }, { provide: WorkspaceChannelEvents, useValue: events },
    { provide: JwtService, useValue: jwt }, { provide: ConfigService, useValue: { getOrThrow: () => 'test-channel-secret' } },
    { provide: UsersService, useValue: { findById: async userId => ({ userId }), getProfile: async () => ({ full_name: 'Name', student_code: '123', school_or_faculty: 'School', major: 'Major', cohort: 'K70' }) } },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  const sockets = [];
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const connect = async (user, channel = channelId, bad = false) => {
      const socket = io(base + '/workspace-chat', { autoConnect: false, forceNew: true, transports: ['websocket'], reconnection: false,
        auth: { token: bad ? 'invalid' : jwt.sign({ sub: user }, { expiresIn: '5m' }), clubId, channelId: channel } });
      sockets.push(socket);
      const result = nextEvent(socket, bad || user === 'outsider' ? 'connect_error' : 'connect');
      socket.connect(); await result; return socket;
    };
    const denied = await connect('outsider'); assert.equal(denied.connected, false);
    const bad = await connect('bad', channelId, true); assert.equal(bad.connected, false);
    const sender = await connect('sender');
    const receiver = await connect('receiver');
    const elsewhere = await connect('elsewhere', otherChannel);
    let leaked = 0; elsewhere.on('channel:message', () => leaked++);
    const received = nextEvent(receiver, 'channel:message');
    const own = nextEvent(sender, 'channel:message');
    const payload = { client_message_id: key, content: 'Hello realtime' };
    const ack = await sender.timeout(5000).emitWithAck('channel:send', payload);
    assert.equal(ack.ok, true);
    assert.equal((await own).mine, true);
    const message = await received;
    assert.equal(message.content, 'Hello realtime'); assert.equal(message.mine, false);
    assert.equal(Object.hasOwn(message, 'client_message_id'), false);
    await sender.timeout(5000).emitWithAck('channel:send', payload);
    assert.equal(records.size, 1);
    const invalid = await sender.timeout(5000).emitWithAck('channel:send', { ...payload, sender_membership_id: 'spoof' });
    assert.equal(invalid.ok, false); assert.equal(invalid.code, 400);
    revoked.add('receiver');
    const revocation = nextEvent(receiver, 'channel:revoked');
    events.publish({ clubId, channelId, message: { ...ack.data.item, content: 'From HTTP attachment save', attachments: [{ attachment_id: key }] } });
    await revocation;
    assert.equal(leaked, 0);
  } finally { for (const socket of sockets) socket.disconnect(); await app.close(); }
});

test('meeting chat confirms persisted sends without waiting on a slow recipient', async () => {
  let release;
  const permission = new Promise(resolve => { release = resolve; });
  const peer = { connected: true, data: { identity: { sessionId: 's' } }, emit() {} };
  const gateway = new ChatGateway({ requireAccess: async () => permission }, { send: async () => ({ id: 'saved' }) });
  gateway.server = { sockets: new Map([['peer', peer]]) };
  try {
    const result = await Promise.race([gateway.send({ data: { identity: { sessionId: 's' } } }, {}),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Ack waited for recipient')), 200); timer.unref(); })]);
    assert.equal(result.ok, true); assert.equal(result.data.id, 'saved');
  } finally { release(); gateway.onModuleDestroy(); }
});
