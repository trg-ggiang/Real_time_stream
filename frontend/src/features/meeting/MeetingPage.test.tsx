// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingPage } from './MeetingPage';

vi.mock('./components/MeetingRoom', () => ({ MeetingRoom: ({ credentials, accessToken, audioSelection, onConnected, onEnded }: any) =>
  <div data-testid="joined-room" data-session={credentials.sessionId} data-auth={accessToken}
    data-microphone={audioSelection?.microphone} data-camera={audioSelection?.camera}>
    <button onClick={() => onConnected?.()}>Connected</button>
    <button onClick={() => onEnded?.('Thiết bị này đã bị ngắt khỏi phòng họp.', true)}>Server removed</button>
  </div> }));
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState(null,'','/'); vi.unstubAllGlobals(); });

it('opens an existing room directly without the removed overview and joins with chat authentication', async () => {
  vi.stubGlobal('isSecureContext',true);
  Object.defineProperty(navigator,'mediaDevices',{value:{},configurable:true});
  const fetch = vi.fn().mockImplementation(async (url: string) => ({ok:true,status:200,json:async()=> url.endsWith('/join-requests') ? [] : url.endsWith('/join')
    ? {status:'admitted',meetingId:'m',sessionId:'s',attendanceId:'a',role:'host',token:'room-jwt',serverUrl:'wss://unit.invalid',participantIdentity:'user:connection',roomName:'room'}
    : {meeting:{meetingId:'m',meetingCode:'ABCDEFGHIJ',title:'Team',recurrenceRule:null,waitingRoomEnabled:true},sessions:[{session_id:'s',status:'ongoing'}]}}));
  vi.stubGlobal('fetch',fetch);
  history.replaceState(null, '', '/?view=meeting&meeting=ABCDEFGHIJ&session=s');
  render(<MeetingPage accessToken="app-jwt" displayName="Tester" onLogout={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Đăng xuất|Cài đặt tài khoản/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Giao diện tối' }));
  expect(screen.getByRole('button', { name: 'Giao diện tối' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Giao diện sáng' }));
  expect(screen.getByRole('button', { name: 'Giao diện sáng' }).getAttribute('aria-pressed')).toBe('true');
  const join = await screen.findByRole('button',{name:/^Tham gia$/});
  await act(async()=>fireEvent.click(join));
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/join'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/join'))).toBe(false);
  fireEvent.click(join);
  fireEvent.click(screen.getByRole('button', { name: 'Micro trước khi vào phòng' }));
  expect(screen.queryByRole('button', { name: 'Loa trước khi vào phòng' })).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tham gia' })));
  const room=await screen.findByTestId('joined-room');
  expect(room.getAttribute('data-session')).toBe('s');
  expect(room.getAttribute('data-auth')).toBe('app-jwt');
  expect(JSON.parse(sessionStorage.getItem('rts.meeting-devices.v1') || '{}').audio).toBe(false);
  expect(sessionStorage.getItem('rts.meeting-speaker.v1')).toBe('on');
  expect(fetch.mock.calls.some(([url])=>url.includes('/meeting-sessions')||url.includes('/livekit/token'))).toBe(false);
});

it('keeps the invited session and copies a canonical link for the chosen row', async () => {
  const origin = window.location.origin;
  const writeText = vi.fn().mockResolvedValue(undefined);
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({
      meeting: { meetingId: 'm', meetingCode: 'ABCDEFGHIJ', title: 'Team' },
      membership: { role: 'participant', invitedAt: null },
      sessions: [{ session_id: 'a', status: 'ongoing' }, { session_id: 'b', status: 'ongoing' }],
    }),
  }));
  try {
    history.replaceState(null, '', '/?view=meeting&meeting=ABCDEFGHIJ&session=b');
    render(<MeetingPage accessToken="app-jwt" displayName="Tester" onLogout={vi.fn()} />);
    const copyButtons = await screen.findAllByRole('button', { name: 'Sao chép link buổi' });
    expect(new URLSearchParams(window.location.search).get('session')).toBe('b');
    expect(copyButtons[1].closest('article')?.getAttribute('data-selected')).toBe('true');
    await act(async () => fireEvent.click(copyButtons[0]));
    expect(writeText).toHaveBeenCalledWith(origin + '/?view=meeting&meeting=ABCDEFGHIJ&session=a');
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it.each([
  { choice: 'Chuyển sang thiết bị này', mode: 'transfer', resumed: false },
  { choice: 'Dùng cả hai thiết bị', mode: 'add', resumed: false },
  { choice: 'Hủy', mode: undefined, resumed: false },
  { choice: 'Chuyển sang thiết bị này', mode: 'transfer', resumed: true },
])('keeps media choices for "$choice" (resumed: $resumed)', async ({ choice, mode, resumed }) => {
  vi.stubGlobal('isSecureContext', true);
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  const joinBodies: Array<{ sessionId: string; deviceMode?: string }> = [];
  const fetch = vi.fn(async (url: string, options?: RequestInit) => ({
    ok: true,
    json: async () => {
      if (url.endsWith('/join')) {
        const body = JSON.parse(String(options?.body));
        joinBodies.push(body);
        if (!body.deviceMode) return { status: 'device_choice_required', meetingId: 'm', sessionId: 's' };
        return {
          status: 'admitted', meetingId: 'm', sessionId: 's', attendanceId: 'a', token: 'room-jwt',
          serverUrl: 'wss://unit.invalid', participantIdentity: 'user:connection', roomName: 'room',
          transferAfterConnect: body.deviceMode === 'transfer',
        };
      }
      if (url.endsWith('/device-transfer')) return { transferred: true };
      if (url.endsWith('/leave')) return { status: 'left' };
      return {
        meeting: { meetingId: 'm', meetingCode: 'ABCDEFGHIJ', title: 'Team' },
        membership: { role: 'participant', invitedAt: null },
        sessions: [{ session_id: 's', status: 'ongoing' }],
      };
    },
  }));
  vi.stubGlobal('fetch', fetch);
  history.replaceState(null, '', '/?view=meeting&meeting=ABCDEFGHIJ&session=s');
  const accessToken = resumed ? `header.${btoa(JSON.stringify({ sub: 'user' }))}.signature` : 'app-jwt';
  if (resumed) sessionStorage.setItem('rts.active-meeting.v1', JSON.stringify({
    owner: 'user', code: 'ABCDEFGHIJ', meetingId: 'm', sessionId: 's', attendanceId: 'other-device', savedAt: Date.now(),
  }));
  render(<MeetingPage accessToken={accessToken} displayName="Tester" onLogout={vi.fn()} />);
  async function continueWithMicOff() {
    fireEvent.click(screen.getByRole('button', { name: 'Micro trước khi vào phòng' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Tiếp tục tham gia' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tham gia' }));
  }
  if (!resumed) {
    fireEvent.click(await screen.findByRole('button', { name: 'Tham gia' }));
    await continueWithMicOff();
  }
  await screen.findByRole('dialog', { name: 'Bạn đang họp trên thiết bị khác' });
  expect(joinBodies).toEqual([{ sessionId: 's' }]);
  fireEvent.click(screen.getByRole('button', { name: choice }));
  if (resumed) {
    expect(joinBodies).toHaveLength(1);
    await continueWithMicOff();
  }
  if (!mode) {
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('joined-room')).toBeNull();
    expect(joinBodies).toHaveLength(1);
    return;
  }
  const room = await screen.findByTestId('joined-room');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(room.getAttribute('data-microphone')).toBe('false');
  expect(room.getAttribute('data-camera')).toBe('true');
  expect(joinBodies).toEqual([{ sessionId: 's' }, { sessionId: 's', deviceMode: mode }]);
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/device-transfer'))).toBe(false);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Connected' })));
  const transfers = fetch.mock.calls.filter(([url]) => url.endsWith('/device-transfer'));
  expect(transfers).toHaveLength(mode === 'transfer' ? 1 : 0);
});

it.each([{ status: 403, removed: false }, { status: 403, removed: true }, { status: 503, removed: false }])('handles revoked overview access and server removal, but not transient errors ($status, $removed)', async ({ status, removed }) => {
  vi.useFakeTimers();
  const hidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  let rejected = false;
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/join')) return { ok: true, status: 200, json: async () => ({
      status: 'admitted', meetingId: 'm', sessionId: 's', attendanceId: 'a', role: 'participant',
      token: 'room-jwt', serverUrl: 'wss://unit.invalid', participantIdentity: 'user:connection', roomName: 'room',
    }) };
    if (rejected) return { ok: false, status, json: async () => ({ message: 'Access failed' }) };
    return { ok: true, status: 200, json: async () => ({
      meeting: { meetingId: 'm', meetingCode: 'ABCDEFGHIJ', title: 'Team' },
      membership: { userId: 'user', role: 'participant', invitedAt: null },
      sessions: [{ session_id: 's', meeting_id: 'm', status: 'ongoing' }],
    }) };
  });
  vi.stubGlobal('fetch', fetch); vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  history.replaceState(null, '', '/?view=meeting&meeting=ABCDEFGHIJ&session=s');
  try {
    render(<MeetingPage accessToken="app-jwt" displayName="Tester" onLogout={vi.fn()} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /^Tham gia$/ }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tham gia' })));
    expect(screen.queryByTestId('joined-room')).not.toBeNull();
    rejected = true;
    await act(async () => {
      if (removed) fireEvent.click(screen.getByRole('button', { name: 'Server removed' }));
      else await vi.advanceTimersByTimeAsync(6000);
    });
    expect(screen.queryByTestId('joined-room') === null).toBe(status === 403);
    if (status === 403) {
      expect(screen.getByRole('alert').textContent).toContain('Quyền tham gia cuộc họp đã kết thúc');
      expect(sessionStorage.getItem('rts.active-meeting.v1')).toBeNull();
      expect(fetch.mock.calls.some(([url]) => url.endsWith('/leave'))).toBe(false);
    }
  } finally {
    cleanup(); vi.useRealTimers();
    if (hidden) Object.defineProperty(document, 'hidden', hidden);
    else Reflect.deleteProperty(document, 'hidden');
  }
});
