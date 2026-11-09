// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MediaDeviceFailure } from 'livekit-client';
import { MeetingRoom } from './MeetingRoom';

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({children,onMediaDeviceFailure}: any) => <div>{children}
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.PermissionDenied, undefined)}>Screen cancelled</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.DeviceInUse, 'videoinput')}>Camera busy</button>
    <button onClick={() => onMediaDeviceFailure(MediaDeviceFailure.PermissionDenied, 'audioinput')}>Mic denied</button>
  </div>,
  useConnectionState: () => 'connected', useParticipants: () => [],
  useLocalParticipant: () => ({localParticipant:{},isCameraEnabled:false,isMicrophoneEnabled:false}),
  useLocalParticipantPermissions: () => ({canUpdateMetadata:true}), useParticipantAttribute: () => '',
  TrackToggle: ({source,onChange,children}: any) => <button onClick={() => onChange(true,true)} aria-label={`enable-${source}`}>{children}</button>,
  MediaDeviceMenu: () => null, RoomAudioRenderer: () => null, StartAudio: () => null,
}));
vi.mock('./MeetingMediaLayout', () => ({MeetingMediaLayout: () => <div>Media</div>}));
vi.mock('./ScreenShareButton', () => ({ScreenShareButton: () => null}));
vi.mock('./ScreenShareRequests', () => ({ScreenShareRequests: () => null}));
vi.mock('./MeetingManagement', () => ({MeetingManagement: () => null}));
afterEach(() => { cleanup(); sessionStorage.clear(); });

it('ignores screen picker cancellation and isolates camera/mic failures, clearing only recovered devices', () => {
  render(<MeetingRoom credentials={{token:'test',serverUrl:'wss://unit.invalid',roomName:'test',participantIdentity:'u'}} onLeave={vi.fn()} onEnded={vi.fn()} />);
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
