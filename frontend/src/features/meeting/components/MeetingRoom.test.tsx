// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DisconnectReason, MediaDeviceFailure } from 'livekit-client';
import { MeetingRoom } from './MeetingRoom';

const roster = vi.hoisted(() => ({ people: [] as { identity: string; name?: string }[] }));
const localParticipant = vi.hoisted(() => ({
  setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
  setCameraEnabled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({children,onMediaDeviceFailure,onConnected,onDisconnected,audio,video}: any) => <div data-testid="livekit-room" data-audio={String(audio)} data-video={String(video)}>{children}
    <button onClick={() => onConnected?.()}>Connected</button>
    <button onClick={() => onDisconnected?.(DisconnectReason.SIGNAL_CLOSE)}>Signaling lost</button>
    <button onClick={() => onDisconnected?.(DisconnectReason.USER_REJECTED)}>Signal rejected</button>
    <button onClick={() => onDisconnected?.(DisconnectReason.ROOM_DELETED)}>Room deleted</button>
    <button onClick={() => onDisconnected?.(DisconnectReason.PARTICIPANT_REMOVED)}>Removed by LiveKit</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.PermissionDenied, undefined)}>Screen cancelled</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.DeviceInUse, 'videoinput')}>Camera busy</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.PermissionDenied, 'audioinput')}>Mic denied</button>
  </div>,
  useConnectionState: () => 'connected', useParticipants: () => roster.people,
  useLocalParticipant: () => ({localParticipant,isCameraEnabled:false,isMicrophoneEnabled:false}),
  useLocalParticipantPermissions: () => ({canUpdateMetadata:true}), useParticipantAttribute: () => '',
  TrackToggle: ({source,onChange,children}: any) => <button onClick={() => onChange(true,true)} aria-label={`enable-${source}`}>{children}</button>,
  MediaDeviceMenu: ({kind,children,...props}: any) => <button {...props} data-kind={kind}>{children}</button>,
  RoomAudioRenderer: ({volume}: any) => <div data-testid="room-volume" data-volume={volume} />, StartAudio: () => null,
}));
vi.mock('./MeetingMediaLayout', () => ({MeetingMediaLayout: () => <div>Media</div>}));
vi.mock('./ScreenShareButton', () => ({ScreenShareButton: () => null}));
vi.mock('./ScreenShareRequests', () => ({ScreenShareRequests: () => null}));
vi.mock('./MeetingManagement', async () => {
  const { useEffect } = await import('react');
  return { MeetingManagement: ({ onPendingCountChange }: any) => {
    useEffect(() => { onPendingCountChange?.(2); }, [onPendingCountChange]);
    return <div>Management content</div>;
  } };
});
vi.mock('../chat/components/MeetingChat', () => ({MeetingChat: ({credentials,accessToken,children,open}: any) => <div data-testid="chat-wrapper" data-session={credentials.sessionId} data-auth={accessToken} data-open={String(open)}>{children}</div>}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  roster.people = [];
  sessionStorage.clear();
  localParticipant.setMicrophoneEnabled.mockClear();
  localParticipant.setCameraEnabled.mockClear();
});

it('applies muted microphone and speakers from the pre-join selection', () => {
  render(<MeetingRoom accessToken="test" credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}} audioSelection={{microphone:false,speaker:false}} onLeave={vi.fn()} onEnded={vi.fn()} />);
  expect(screen.getByTestId('livekit-room').getAttribute('data-audio')).toBe('false');
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('0');
  fireEvent.click(screen.getByLabelText('Bật âm thanh phòng'));
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('1');
  expect(sessionStorage.getItem('rts.meeting-speaker.v1')).toBe('on');
});
it('shows the participant and management sidebar by default and lets people toggle it', () => {
  const onShare = vi.fn();
  render(<MeetingRoom accessToken="test" credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u',role:'host'}}
    onLeave={vi.fn()} onEnded={vi.fn()} onShare={onShare} management={{
      accessToken: 'test', overview: { meeting: { meetingId: 'm', meetingCode: 'ABCDEFGHIJ', title: 'Sinh hoạt CLB' }, sessions: [] },
      knownMembers: [], onMembersChanged: vi.fn(), onChanged: vi.fn(), onError: vi.fn(), onSessionEnded: vi.fn(),
    }} />);
  expect(screen.getByRole('heading', { name: 'Thành viên (0)' }).closest('.meeting-sidebar')).toBeTruthy();
  expect(screen.queryByText('Đã kết nối')).toBeNull();
  const control = screen.getByRole('button', { name: 'Mọi người, 2 người chờ duyệt' });
  expect(control.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Management content')).toBeTruthy();
  fireEvent.click(control);
  expect(screen.queryByText('Management content')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ đường dẫn' }));
  expect(onShare).toHaveBeenCalledOnce();
});

it('provides separate input/output pickers and lets headphones mute received audio', () => {
  render(<MeetingRoom accessToken="test" credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}} onLeave={vi.fn()} onEnded={vi.fn()} />);
  expect(screen.getByLabelText('Chọn microphone').getAttribute('data-kind')).toBe('audioinput');
  expect(screen.getByLabelText('Chọn loa hoặc tai nghe').getAttribute('data-kind')).toBe('audiooutput');
  expect(screen.queryByLabelText('Cài đặt thiết bị')).toBeNull();
  fireEvent.click(screen.getByLabelText('Tắt âm thanh phòng'));
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('0');
  fireEvent.click(screen.getByLabelText('Bật âm thanh phòng'));
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('1');
});

it('renders the modern media area once and passes the active session to chat', () => {
  render(<MeetingRoom accessToken="app-jwt" credentials={{token:'room-jwt',sessionId:'active-session',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}} onLeave={vi.fn()} onEnded={vi.fn()} />);
  expect(screen.getAllByText('Media')).toHaveLength(1);
  expect(screen.getByTestId('chat-wrapper').getAttribute('data-session')).toBe('active-session');
  expect(screen.getByTestId('chat-wrapper').getAttribute('data-auth')).toBe('app-jwt');
  expect(screen.getAllByLabelText('Rời phòng')).toHaveLength(1);
  const toggle = screen.getByRole('button', { name:'Mở chat' });
  expect(toggle.closest('.meeting-controls')).toBeTruthy();
  fireEvent.click(toggle);
  expect(screen.getByTestId('chat-wrapper').getAttribute('data-open')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name:'Đóng chat'}));
  expect(screen.getByTestId('chat-wrapper').getAttribute('data-open')).toBe('false');
});

it('ignores screen picker cancellation and isolates camera/mic failures, clearing only recovered devices', () => {
  render(<MeetingRoom accessToken="test" credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}} onLeave={vi.fn()} onEnded={vi.fn()} />);
  fireEvent.click(screen.getByText('Screen cancelled'));
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByText('Camera busy'));
  fireEvent.click(screen.getByText('Mic denied'));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.getByText(/Camera đang được ứng dụng khác/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('enable-camera'));
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByText(/Microphone đang bị chặn/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('enable-microphone'));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('holds local capture and received audio until a transfer has completed', async () => {
  const onConnected = vi.fn(), onEnded = vi.fn();
  const props = {
    accessToken: 'test',
    credentials: { token: 'room', serverUrl: 'wss://unit.invalid', roomName: 'test', participantIdentity: 'u', transferAfterConnect: true },
    onConnected, onLeave: vi.fn(), onEnded,
  };
  const { rerender } = render(<MeetingRoom {...props} transferStatus="pending" />);
  expect(screen.getByTestId('livekit-room').getAttribute('data-audio')).toBe('false');
  expect(screen.getByTestId('livekit-room').getAttribute('data-video')).toBe('false');
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('0');
  fireEvent.click(screen.getByText('Connected'));
  expect(onConnected).toHaveBeenCalledOnce();
  expect(localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  expect(localParticipant.setCameraEnabled).not.toHaveBeenCalled();
  rerender(<MeetingRoom {...props} transferStatus={null} />);
  await waitFor(() => expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true));
  expect(localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('1');
  fireEvent.click(screen.getByText('Removed by LiveKit'));
  expect(onEnded).toHaveBeenCalledWith('Thiết bị này đã bị ngắt khỏi phòng họp.', true);
});

it('restores the selected camera after transfer while keeping the selected mic and speaker off', async () => {
  const props = {
    accessToken: 'test',
    credentials: { token: 'room', serverUrl: 'wss://unit.invalid', roomName: 'test', participantIdentity: 'u', transferAfterConnect: true },
    audioSelection: { microphone: false, camera: true, speaker: false },
    onLeave: vi.fn(), onEnded: vi.fn(),
  };
  const { rerender } = render(<MeetingRoom {...props} transferStatus="pending" />);
  expect(screen.getByTestId('livekit-room').getAttribute('data-video')).toBe('false');
  expect(localParticipant.setCameraEnabled).not.toHaveBeenCalled();
  rerender(<MeetingRoom {...props} transferStatus={null} />);
  await waitFor(() => expect(localParticipant.setCameraEnabled).toHaveBeenCalledWith(true));
  expect(screen.getByTestId('livekit-room').getAttribute('data-audio')).toBe('false');
  expect(localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  expect(screen.getByTestId('room-volume').getAttribute('data-volume')).toBe('0');
});

it.each(['participant', 'moderator', undefined] as const)('shows a live, read-only roster for role %s', role => {
  roster.people = Array.from({ length: 10 }, (_, index) => ({ identity: `u${index}:device`, name: `Person ${index}` }));
  const props = {
    accessToken: 'test', credentials: { token: 'test', serverUrl: 'wss://unit.invalid', roomName: 'test', participantIdentity: 'u1:device', role },
    onLeave: vi.fn(), onEnded: vi.fn(), management: {
      accessToken: 'test', overview: { meeting: { meetingId: 'm', meetingCode: 'ABCDEFGHIJ', title: 'Meeting' }, sessions: [] },
      knownMembers: [], onMembersChanged: vi.fn(), onChanged: vi.fn(), onError: vi.fn(), onSessionEnded: vi.fn(),
    },
  };
  const { rerender } = render(<MeetingRoom {...props} />);
  const control = screen.getByRole('button', { name: 'Mọi người' });
  expect(control.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getAllByRole('listitem')).toHaveLength(10);
  expect(screen.getByText('Person 9')).toBeTruthy();
  expect(screen.queryByText('Management content')).toBeNull();
  roster.people = [...roster.people.slice(0, 9), { identity: 'new:device', name: 'New arrival' }];
  rerender(<MeetingRoom {...props} />);
  expect(screen.queryByText('Person 9')).toBeNull();
  expect(screen.getByText('New arrival')).toBeTruthy();
  fireEvent.click(control);
  expect(control.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('list')).toBeNull();
});

it('requests reconnection after signaling loss and ends the call after server removal or room deletion', () => {
  const onEnded = vi.fn(), onReconnect = vi.fn();
  render(<MeetingRoom accessToken="test" credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}}
    onLeave={vi.fn()} onEnded={onEnded} onReconnect={onReconnect} />);
  fireEvent.click(screen.getByText('Signaling lost'));
  expect(onReconnect).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText('Signal rejected'));
  expect(onReconnect).toHaveBeenCalledTimes(2);
  expect(onEnded).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Removed by LiveKit'));
  expect(onEnded).toHaveBeenLastCalledWith(expect.any(String), true);
  fireEvent.click(screen.getByText('Room deleted'));
  expect(onEnded).toHaveBeenCalledTimes(2);
  expect(onReconnect).toHaveBeenCalledTimes(2);
});

it('shows the original LiveKit token warning only during its last minute', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-22T05:00:00Z'));
  const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 120 }))}.signature`;
  render(<MeetingRoom accessToken="test" credentials={{token,serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}}
    onLeave={vi.fn()} onEnded={vi.fn()} />);
  const warning = 'Token vào phòng LiveKit ban đầu sắp hết hạn.';
  act(() => { vi.advanceTimersByTime(59_999); });
  expect(screen.queryByText(warning)).toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByText(warning).getAttribute('role')).toBe('status');
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(screen.queryByText(warning)).toBeNull();
});
