// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingPage } from './MeetingPage';

vi.mock('./components/MeetingRoom', () => ({ MeetingRoom: ({ credentials, accessToken }: any) =>
  <div data-testid="joined-room" data-session={credentials.sessionId} data-auth={accessToken}>Joined</div> }));
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState(null,'','/'); vi.unstubAllGlobals(); });

it('keeps the modern lobby and joins through the current meeting flow with chat authentication', async () => {
  vi.stubGlobal('isSecureContext',true);
  Object.defineProperty(navigator,'mediaDevices',{value:{},configurable:true});
  const fetch = vi.fn().mockImplementation(async (url: string) => ({ok:true,status:200,json:async()=> url.endsWith('/join-requests') ? [] : url.endsWith('/join')
    ? {status:'admitted',meetingId:'m',sessionId:'s',attendanceId:'a',role:'host',token:'room-jwt',serverUrl:'wss://unit.invalid',participantIdentity:'user:connection',roomName:'room'}
    : {meeting:{meetingId:'m',meetingCode:'ABCDEFGHIJ',title:'Team',recurrenceRule:null,waitingRoomEnabled:true},sessions:[{session_id:'s',status:'ongoing'}]}}));
  vi.stubGlobal('fetch',fetch);
  render(<MeetingPage accessToken="app-jwt" displayName="Tester" onLogout={vi.fn()} />);
  expect(screen.getByRole('heading',{name:'Bạn muốn gặp ai hôm nay?'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Mã hoặc đường dẫn mời'),{target:{value:'ABCDEFGHIJ'}});
  fireEvent.click(screen.getByRole('button',{name:'Mở cuộc họp'}));
  const join = await screen.findByRole('button',{name:/^Tham gia$/});
  await act(async()=>fireEvent.click(join));
  const room=await screen.findByTestId('joined-room');
  expect(room.getAttribute('data-session')).toBe('s');
  expect(room.getAttribute('data-auth')).toBe('app-jwt');
  expect(fetch.mock.calls.some(([url])=>url.includes('/meeting-sessions')||url.includes('/livekit/token'))).toBe(false);
});

it('keeps the invited session when pasting a link and copies a canonical link for the chosen row', async () => {
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
    render(<MeetingPage accessToken="app-jwt" displayName="Tester" onLogout={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mã hoặc đường dẫn mời'), {
      target: { value: 'https://public.example/?view=meeting&meeting=ABCDEFGHIJ&session=b' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mở cuộc họp' }));
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
