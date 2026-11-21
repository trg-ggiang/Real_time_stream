// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingPage } from './MeetingPage';

vi.mock('./components/MeetingRoom', () => ({ MeetingRoom: ({ credentials, accessToken }: any) =>
  <div data-testid="joined-room" data-session={credentials.sessionId} data-auth={accessToken}>Joined</div> }));
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
