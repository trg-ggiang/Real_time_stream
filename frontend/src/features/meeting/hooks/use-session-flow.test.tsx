// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSessionFlow } from './use-session-flow';
import { StrictMode, type ReactNode } from 'react';

const credentials = { status: 'admitted', meetingId: 'meeting', sessionId: 'session', attendanceId: 'attendance', token: 'synthetic-token', serverUrl: 'wss://test.invalid', roomName: 'session-room', participantIdentity: 'user:connection' };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('polls admission without submitting duplicate join requests, then joins once on approval', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(response({ status: 'pending', meetingId: 'meeting', sessionId: 'session' }))
    .mockResolvedValueOnce(response({ status: 'pending' })).mockResolvedValueOnce(response({ status: 'admitted' }))
    .mockResolvedValue(response(credentials));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useSessionFlow('jwt', vi.fn()));
  await act(async () => { await result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  expect(result.current.waiting?.status).toBe('pending');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(result.current.active?.attendanceId).toBe('attendance');
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(2);
});

it('stops polling after denial and retains retry information without auto requesting again', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(response({ status: 'pending', meetingId: 'meeting', sessionId: 'session' }))
    .mockResolvedValue(response({ status: 'denied', remainingAttempts: 0, retryAt: '2099-01-01T00:00:00Z' }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useSessionFlow('jwt', vi.fn()));
  await act(async () => { await result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.waiting?.remainingAttempts).toBe(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('records the exact attendance on leave and retries an unconfirmed departure before any new join', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(credentials)).mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({ status: 'left' })).mockResolvedValue(response(credentials));
  vi.stubGlobal('fetch', fetch);
  const logout = vi.fn();
  const { result } = renderHook(() => useSessionFlow('jwt', logout));
  await act(async () => { await result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  await act(async () => { await result.current.leave(); });
  expect(result.current.active).toBeNull();
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ attendanceId: 'attendance' });
  await act(async () => { await result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  expect(fetch.mock.calls[2][0]).toContain('/sessions/session/leave');
  expect(fetch.mock.calls[3][0]).toContain('/ABCDEFGHIJ/join');
  expect(logout).not.toHaveBeenCalled();
});

it('aborts a pending join and ignores its late result', async () => {
  let resolve!: (value: unknown) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useSessionFlow('jwt', vi.fn()));
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  await act(async () => { await result.current.leave(); });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { resolve(response(credentials)); await pending; });
  expect(result.current.active).toBeNull();
});

it('logs out on expired JWT and does not open malformed room credentials', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({}, 401)).mockResolvedValue(response({ ...credentials, serverUrl: 'https://unsafe.invalid' }));
  vi.stubGlobal('fetch', fetch);
  const logout = vi.fn();
  const { result } = renderHook(() => useSessionFlow('jwt', logout));
  await act(async () => { await result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  expect(logout).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.join('ABCDEFGHIJ', 'meeting', 'session'); });
  expect(result.current.active).toBeNull();
  expect(result.current.error).toContain('không hợp lệ');
});

it('reload resumes the same session with fresh credentials after closing old attendance', async () => {
  vi.useFakeTimers();
  const jwt = `header.${btoa(JSON.stringify({sub:'user'}))}.signature`;
  window.history.replaceState(null, '', '/?meeting=ABCDEFGHIJ&session=session');
  const fetch = vi.fn().mockResolvedValue(response(credentials));
  vi.stubGlobal('fetch', fetch);
  const first = renderHook(() => useSessionFlow(jwt, vi.fn()));
  await act(async () => { await first.result.current.join('ABCDEFGHIJ','meeting','session'); });
  const saved = sessionStorage.getItem('rts.active-meeting.v1')!;
  expect(saved).not.toContain('synthetic-token');
  first.unmount();
  fetch.mockClear();
  const second = renderHook(() => useSessionFlow(jwt, vi.fn()));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetch.mock.calls[0][0]).toContain('/sessions/session/leave');
  expect(fetch.mock.calls[1][0]).toContain('/ABCDEFGHIJ/join');
  expect(second.result.current.active?.sessionId).toBe('session');
  await act(async () => { await second.result.current.leave(); });
  expect(sessionStorage.getItem('rts.active-meeting.v1')).toBeNull();
});

it('never resumes another user or another meeting URL', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
  sessionStorage.setItem('rts.active-meeting.v1',JSON.stringify({owner:'other-user',code:'ABCDEFGHIJ',meetingId:'meeting',sessionId:'session',attendanceId:'old',savedAt:Date.now()}));
  window.history.replaceState(null,'','/?meeting=ABCDEFGHIJ&session=session');
  renderHook(() => useSessionFlow(`header.${btoa(JSON.stringify({sub:'user'}))}.signature`,vi.fn()));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetch).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('rts.active-meeting.v1')).toBeNull();
});

it('resumes only once under StrictMode and does not revive a session after explicit leave', async () => {
  vi.useFakeTimers();
  const jwt=`header.${btoa(JSON.stringify({sub:'user'}))}.signature`;
  sessionStorage.setItem('rts.active-meeting.v1',JSON.stringify({owner:'user',code:'ABCDEFGHIJ',meetingId:'meeting',sessionId:'session',attendanceId:'old',savedAt:Date.now()}));
  window.history.replaceState(null,'','/?meeting=ABCDEFGHIJ&session=session');
  const fetch=vi.fn().mockResolvedValue(response(credentials)); vi.stubGlobal('fetch',fetch);
  const hook=renderHook(()=>useSessionFlow(jwt,vi.fn()),{wrapper:({children}:{children:ReactNode})=><StrictMode>{children}</StrictMode>});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(fetch.mock.calls.filter(([url])=>url.endsWith('/join'))).toHaveLength(1);
  await act(async()=>{await hook.result.current.leave();});
  hook.unmount(); fetch.mockClear();
  renderHook(()=>useSessionFlow(jwt,vi.fn()));
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(fetch).not.toHaveBeenCalled();
});
