// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMeetingChat } from './use-meeting-chat';

const mocks = vi.hoisted(() => ({ create: vi.fn(), request: vi.fn() }));
vi.mock('../services/chat-socket', () => ({ createChatSocket: mocks.create, chatRequest: mocks.request }));

class FakeSocket {
  connected = false;
  handlers = new Map<string, (...args: any[]) => void>();
  on(event: string, handler: (...args: any[]) => void) { this.handlers.set(event, handler); return this; }
  receive(event: string, ...args: unknown[]) { this.handlers.get(event)?.(...args); }
  connect() { this.connected = true; this.receive('connect'); return this; }
  disconnect() { this.connected = false; this.receive('disconnect'); return this; }
  removeAllListeners() { this.handlers.clear(); }
}
let sockets: FakeSocket[];
const message = (sessionId = 'room-a', id = 'm1', senderId = 'other') => ({
  id, sessionId, senderId, senderName: 'Member', content: 'Hello', clientMessageId: id,
  createdAt: '2026-11-21T01:00:00.000001Z',
});

beforeEach(() => {
  sockets = []; mocks.create.mockReset(); mocks.request.mockReset();
  mocks.create.mockImplementation(() => { const socket = new FakeSocket(); sockets.push(socket); return socket; });
  mocks.request.mockResolvedValue({ messages: [], hasMore: false });
});
afterEach(cleanup);

it('retries immediately after reconnect and ignores a stale failed attempt using the same message key', async () => {
  let rejectFirst!: (cause: Error) => void;
  let resolveRetry!: (value: unknown) => void;
  let sends = 0;
  mocks.request.mockImplementation((_socket, event) => {
    if (event !== 'chat:send') return Promise.resolve({ messages: [], hasMore: false });
    sends++;
    return sends === 1 ? new Promise((_resolve, reject) => { rejectFirst = reject; })
      : new Promise(resolve => { resolveRetry = resolve; });
  });
  const { result } = renderHook(() => useMeetingChat('token', 'room-a', 'me:device', true, true));
  await waitFor(() => expect(result.current.syncing).toBe(false));
  let first!: Promise<boolean>, retry!: Promise<boolean>;
  act(() => { first = result.current.send('Hello', 'client-id'); });
  act(() => sockets[0].disconnect());
  expect(result.current.outbox[0].status).toBe('failed');
  act(() => result.current.reconnect());
  await waitFor(() => expect(result.current.syncing).toBe(false));
  act(() => { retry = result.current.send('Hello', 'client-id'); });
  expect(sends).toBe(2);
  await act(async () => { rejectFirst(new Error('Old timeout')); await first; });
  expect(result.current.outbox[0].status).toBe('sending');
  expect(result.current.error).toBeNull();
  let extra!: boolean;
  await act(async () => { extra = await result.current.send('Another message', 'another-id'); });
  expect(extra).toBe(false);
  await act(async () => { resolveRetry({ ...message('room-a', 'saved', 'me'), clientMessageId: 'client-id' }); await retry; });
  expect(result.current.outbox).toHaveLength(0);
  expect(result.current.messages).toHaveLength(1);
});

it('receives messages from many participants while the panel is closed and deduplicates rebroadcasts', async () => {
  const { result, rerender } = renderHook(({ open }) => useMeetingChat('token', 'room-a', 'me:device', true, open), {
    initialProps: { open: false },
  });
  await waitFor(() => expect(result.current.syncing).toBe(false));
  act(() => {
    for (let index = 0; index < 12; index++) {
      const item = message('room-a', 'message-' + index, 'member-' + index);
      sockets[0].receive('chat:message', item);
      sockets[0].receive('chat:message', item);
    }
    sockets[0].receive('chat:message', message('different-room', 'unrelated'));
  });
  expect(result.current.messages).toHaveLength(12);
  expect(result.current.unread).toBe(12);
  rerender({ open: true });
  expect(result.current.unread).toBe(0);
  expect(result.current.messages).toHaveLength(12);
});

it('recovers every missed page on reconnect without duplicating live or latest-page messages', async () => {
  const items = Array.from({ length: 126 }, (_, index) => ({
    ...message('room-a', 'message-' + index),
    createdAt: `2026-11-21T01:00:00.${String(index).padStart(6, '0')}Z`,
  }));
  mocks.request.mockResolvedValueOnce({ messages: items.slice(0, 1), hasMore: false });
  const { result } = renderHook(() => useMeetingChat('token', 'room-a', 'me:device', true, true));
  await waitFor(() => expect(result.current.messages).toHaveLength(1));
  act(() => sockets[0].disconnect());
  mocks.request.mockImplementation((_socket, _event, payload) => {
    const start = payload.after ? items.findIndex(item => item.id === payload.after.id) + 1 : 76;
    const page = items.slice(start, start + 50);
    return Promise.resolve({ messages: page, hasMore: payload.after ? start + 50 < items.length : true });
  });
  act(() => result.current.reconnect());
  await waitFor(() => expect(result.current.messages).toHaveLength(126));
  expect(result.current.messages.map(item => item.id)).toEqual(items.map(item => item.id));
  expect(result.current.error).toBeNull();
  expect(mocks.request.mock.calls.filter(([, , payload]) => payload.after)).toHaveLength(3);
});

it('supports reconnecting after a connection error and synchronizes history again', async () => {
  const { result } = renderHook(() => useMeetingChat('token', 'room-a', 'me:device', true, true));
  await waitFor(() => expect(result.current.syncing).toBe(false));
  act(() => { sockets[0].disconnect(); sockets[0].receive('connect_error', new Error('Presence unavailable')); });
  expect(result.current.status).toBe('offline');
  mocks.request.mockResolvedValue({ messages: [message()], hasMore: false });
  act(() => result.current.reconnect());
  await waitFor(() => expect(result.current.messages).toHaveLength(1));
  expect(result.current.error).toBeNull();
  expect(result.current.status).toBe('connected');
});

it('does not mark a broadcast-confirmed message as failed when its acknowledgement times out', async () => {
  let rejectSend!: (cause: Error) => void;
  mocks.request.mockImplementation((_socket, event) => event === 'chat:send'
    ? new Promise((_resolve, reject) => { rejectSend = reject; })
    : Promise.resolve({ messages: [], hasMore: false }));
  const { result } = renderHook(() => useMeetingChat('token', 'room-a', 'me:device', true, true));
  await waitFor(() => expect(result.current.syncing).toBe(false));
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.send('Hello', 'client-id'); });
  expect(result.current.outbox).toHaveLength(1);
  act(() => sockets[0].receive('chat:message', { ...message('room-a', 'saved', 'me'), clientMessageId: 'client-id' }));
  expect(result.current.outbox).toHaveLength(0);
  await act(async () => { rejectSend(new Error('timeout')); await pending; });
  expect(result.current.error).toBeNull();
  expect(result.current.messages).toHaveLength(1);
});

it('clears room history and ignores a late send acknowledgement after switching rooms', async () => {
  let resolveSend!: (value: unknown) => void;
  mocks.request.mockImplementation((_socket, event) => event === 'chat:send'
    ? new Promise(resolve => { resolveSend = resolve; })
    : Promise.resolve({ messages: [], hasMore: false }));
  const { result, rerender } = renderHook(({ room }) => useMeetingChat('token', room, 'me:device', true, true), {
    initialProps: { room: 'room-a' },
  });
  await waitFor(() => expect(result.current.syncing).toBe(false));
  act(() => sockets[0].receive('chat:message', message()));
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.send('Hello', 'client-id'); });
  rerender({ room: 'room-b' });
  await waitFor(() => expect(result.current.syncing).toBe(false));
  expect(result.current.messages).toHaveLength(0);
  expect(result.current.outbox).toHaveLength(0);
  await act(async () => { resolveSend(message('room-a', 'client-id', 'me')); await pending; });
  expect(result.current.messages).toHaveLength(0);
  expect(mocks.request.mock.calls.filter(([, event, payload]) => event === 'chat:history' && payload.after)).toHaveLength(0);
});

it('clears cached history on revoked access and ignores subsequent live messages', async () => {
  let resolveSend!: (value: unknown) => void;
  mocks.request.mockImplementation((_socket, event) => event === 'chat:send'
    ? new Promise(resolve => { resolveSend = resolve; })
    : Promise.resolve({ messages: [], hasMore: false }));
  const { result } = renderHook(() => useMeetingChat('token', 'room-a', 'me:device', true, false));
  await waitFor(() => expect(result.current.syncing).toBe(false));
  act(() => sockets[0].receive('chat:message', message()));
  expect(result.current.unread).toBe(1);
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.send('Hello', 'client-id'); });
  act(() => sockets[0].receive('chat:revoked'));
  expect(result.current.messages).toHaveLength(0);
  expect(result.current.unread).toBe(0);
  expect(result.current.status).toBe('offline');
  act(() => sockets[0].receive('chat:message', message()));
  await act(async () => { resolveSend(message('room-a', 'client-id', 'me')); await pending; });
  expect(result.current.messages).toHaveLength(0);
});
