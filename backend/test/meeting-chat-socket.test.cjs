const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ForbiddenException } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('socket.io-client');
const { ChatGateway } = require('../dist/chat/chat.gateway');
const { ChatService } = require('../dist/chat/chat.service');
const { ChatRepository } = require('../dist/chat/chat.repository');
const { ChatAccessService, LivekitPresenceService } = require('../dist/chat/chat-access.service');
const { MeetingSessionsService } = require('../dist/meeting-sessions/meeting-sessions.service');
const { UsersService } = require('../dist/users/users.service');

const event = (socket, name) => new Promise((resolve, reject) => {
  const handler = value => { clearTimeout(timer); resolve(value); };
  const timer = setTimeout(() => { socket.off(name, handler); reject(new Error('Missing ' + name)); }, 3000);
  socket.once(name, handler);
});

test('meeting chat broadcasts to all 12 room participants, isolates rooms and recovers offline history', async () => {
  const secret = 'meeting-chat-test-only';
  const jwt = new JwtService({ secret });
  const session = randomUUID(), otherSession = randomUUID();
  const revoked = new Set();
  const records = [];
  let presenceChecks = 0;
  const repository = {
    async insert(sessionId, senderId, clientMessageId, content) {
      const old = records.find(item => item.sessionId === sessionId && item.senderId === senderId && item.clientMessageId === clientMessageId);
      if (old) return old;
      const item = { id: randomUUID(), sessionId, senderId, clientMessageId, content,
        senderName: senderId, createdAt: new Date().toISOString() };
      records.push(item); return item;
    },
    async history(sessionId, cursor, direction) {
      let items = records.filter(item => item.sessionId === sessionId);
      if (cursor) {
        const index = items.findIndex(item => item.id === cursor.id);
        items = direction === 'after' ? items.slice(index + 1) : items.slice(0, index);
      }
      return { messages: items, hasMore: false };
    },
  };
  const module = await Test.createTestingModule({ providers: [ChatGateway, ChatService, ChatAccessService,
    { provide: ChatRepository, useValue: repository },
    { provide: ConfigService, useValue: { getOrThrow: () => secret } },
    { provide: JwtService, useValue: jwt },
    { provide: UsersService, useValue: { findById: async userId => ({ userId }) } },
    { provide: MeetingSessionsService, useValue: { requireAccess: async (userId, sessionId) => {
      if (revoked.has(userId)) throw new ForbiddenException('Removed');
      return { livekit_room_name: sessionId };
    } } },
    { provide: LivekitPresenceService, useValue: { requireParticipant: async () => { presenceChecks++; } } },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  const sockets = [];
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const connect = async (user, sessionId = session) => {
      const socket = io(base + '/chat', { autoConnect: false, forceNew: true, transports: ['websocket'], reconnection: false,
        auth: { token: jwt.sign({ sub: user }, { expiresIn: '5m' }), sessionId, participantIdentity: user + ':device' } });
      sockets.push(socket);
      const ready = event(socket, 'connect'); socket.connect(); await ready; return socket;
    };
    const alice = await connect('alice'), bob = await connect('bob'), elsewhere = await connect('elsewhere', otherSession);
    const others = await Promise.all(Array.from({ length: 10 }, (_, index) => connect('member-' + index)));
    const receivedByBob = [], receivedElsewhere = [];
    bob.on('chat:message', item => receivedByBob.push(item));
    elsewhere.on('chat:message', item => receivedElsewhere.push(item));
    const payload = { content: 'Hello Bob', clientMessageId: randomUUID() };
    const everyoneReceives = others.map(socket => event(socket, 'chat:message'));
    const bobEvent = event(bob, 'chat:message'), aliceEvent = event(alice, 'chat:message');
    const saved = await alice.timeout(3000).emitWithAck('chat:send', payload);
    assert.equal(saved.ok, true);
    assert.deepEqual(await bobEvent, saved.data);
    assert.deepEqual(await aliceEvent, saved.data);
    assert.deepEqual((await Promise.all(everyoneReceives)).map(item => item.id), Array(10).fill(saved.data.id));
    const aliceReply = event(alice, 'chat:message');
    const everyoneReceivesReply = others.map(socket => event(socket, 'chat:message'));
    const reply = await bob.timeout(3000).emitWithAck('chat:send', { content: 'Hello Alice', clientMessageId: randomUUID() });
    assert.equal((await aliceReply).id, reply.data.id);
    assert.equal(reply.data.senderId, 'bob');
    assert.deepEqual((await Promise.all(everyoneReceivesReply)).map(item => item.id), Array(10).fill(reply.data.id));
    const participants = [alice, bob, ...others];
    const burst = participants.map((_, index) => ({ content: 'Concurrent member ' + index, clientMessageId: randomUUID() }));
    const expected = new Set(burst.map(item => item.clientMessageId));
    const deliveries = participants.map(socket => new Promise((resolve, reject) => {
      const found = new Set();
      const handler = item => {
        if (expected.has(item.clientMessageId)) found.add(item.clientMessageId);
        if (found.size === participants.length) { clearTimeout(timer); socket.off('chat:message', handler); resolve(found.size); }
      };
      const timer = setTimeout(() => { socket.off('chat:message', handler); reject(new Error('Incomplete group delivery: ' + found.size)); }, 3000);
      socket.on('chat:message', handler);
    }));
    const sentTogether = await Promise.all(participants.map((socket, index) => socket.timeout(3000).emitWithAck('chat:send', burst[index])));
    assert.ok(sentTogether.every(result => result.ok));
    assert.deepEqual(await Promise.all(deliveries), Array(12).fill(12));
    const replayed = event(bob, 'chat:message');
    const retry = await alice.timeout(3000).emitWithAck('chat:send', payload);
    await replayed;
    assert.equal(retry.data.id, saved.data.id);
    assert.equal(records.length, 14);
    const invalid = await alice.timeout(3000).emitWithAck('chat:send', { ...payload, senderId: 'bob' });
    assert.equal(invalid.ok, false); assert.equal(invalid.code, 400);
    const lastSeen = records.at(-1);
    const cursor = { id: lastSeen.id, createdAt: lastSeen.createdAt };
    bob.disconnect();
    const missed = await alice.timeout(3000).emitWithAck('chat:send', { content: 'While Bob is offline', clientMessageId: randomUUID() });
    assert.equal(missed.ok, true);
    const ready = event(bob, 'connect'); bob.connect(); await ready;
    const history = await bob.timeout(3000).emitWithAck('chat:history', { after: cursor });
    assert.equal(history.ok, true);
    assert.deepEqual(history.data.messages.map(item => item.id), [missed.data.id]);
    revoked.add('bob');
    const revokedEvent = event(bob, 'chat:revoked');
    const remainingReceive = others.map(socket => event(socket, 'chat:message'));
    const receivedBeforeRevocation = receivedByBob.length;
    const final = await alice.timeout(3000).emitWithAck('chat:send', { content: 'After removal', clientMessageId: randomUUID() });
    assert.equal(final.ok, true);
    await revokedEvent;
    assert.deepEqual((await Promise.all(remainingReceive)).map(item => item.id), Array(10).fill(final.data.id));
    assert.equal(receivedByBob.length, receivedBeforeRevocation);
    assert.equal(receivedElsewhere.length, 0);
    assert.ok(presenceChecks > 5);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await app.close();
  }
});
