// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DisconnectReason, MediaDeviceFailure } from 'livekit-client';
import { MeetingRoom } from './MeetingRoom';

const localParticipant = vi.hoisted(() => ({
  setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
  setCameraEnabled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({children,onMediaDeviceFailure,onConnected,onDisconnected,audio,video}: any) => <div data-testid="livekit-room" data-audio={String(audio)} data-video={String(video)}>{children}
    <button onClick={() => onConnected?.()}>Connected</button>
    <button onClick={() => onDisconnected?.(DisconnectReason.PARTICIPANT_REMOVED)}>Removed by LiveKit</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.PermissionDenied, undefined)}>Screen cancelled</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.DeviceInUse, 'videoinput')}>Camera busy</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.PermissionDenied, 'audioinput')}>Mic denied</button>
  </div>,
  useConnectionState: () => 'connected', useParticipants: () => [],
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
it('places the meeting title inside the room and shows pending approvals while management is closed', () => {
  const onShare = vi.fn();
  render(<MeetingRoom accessToken="test" credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}}
    onLeave={vi.fn()} onEnded={vi.fn()} onShare={onShare} management={{
      accessToken: 'test', overview: { meeting: { meetingId: 'm', meetingCode: 'ABCDEFGHIJ', title: 'Sinh hoạt CLB' }, sessions: [] },
      knownMembers: [], onMembersChanged: vi.fn(), onChanged: vi.fn(), onError: vi.fn(), onSessionEnded: vi.fn(),
    }} />);
  expect(screen.getByRole('heading', { name: 'Sinh hoạt CLB' }).closest('.meeting-room')).toBeTruthy();
  expect(screen.queryByText('Đã kết nối')).toBeNull();
  const control = screen.getByRole('button', { name: 'Quản lý cuộc họp, 2 người chờ duyệt' });
  expect(control.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByText('Management content').parentElement?.hidden).toBe(true);
  fireEvent.click(control);
  expect(screen.getByText('Management content').parentElement?.hidden).toBe(false);
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
