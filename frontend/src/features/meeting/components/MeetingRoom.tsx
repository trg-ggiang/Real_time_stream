import { useCallback, useMemo, useState } from 'react';
import { Hand } from '@phosphor-icons/react/dist/csr/Hand';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { ChatCircleText } from '@phosphor-icons/react/dist/csr/ChatCircleText';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/dist/csr/MicrophoneSlash';
import { VideoCameraSlash } from '@phosphor-icons/react/dist/csr/VideoCameraSlash';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { Headphones } from '@phosphor-icons/react/dist/csr/Headphones';
import {
  MediaDeviceMenu,
  TrackToggle,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useParticipantAttribute,
  useParticipants,
  useTrackRefContext,
} from '@livekit/components-react';
import {
  ConnectionState,
  DisconnectReason,
  VideoPresets,
  Track,
  LocalAudioTrack,
  MediaDeviceFailure,
  type RoomOptions,
} from 'livekit-client';
import type { JoinCredentials } from '../types';
import { deviceErrorMessage, isCaptureError } from '../services/device-errors';
import { readMediaPreferences, saveMediaPreference } from '../services/media-preferences';
import { ScreenShareButton } from './ScreenShareButton';
import { ScreenShareRequests } from './ScreenShareRequests';
import { MeetingMediaLayout } from './MeetingMediaLayout';
import { MeetingChat } from '../chat/components/MeetingChat';
import { MeetingManagement } from './MeetingManagement';
import type { ComponentProps } from 'react';
type ManagementProps = Omit<ComponentProps<typeof MeetingManagement>, 'onlineUsers'>;

const connectionLabels: Record<ConnectionState, string> = {
  [ConnectionState.Disconnected]: 'Đã ngắt kết nối',
  [ConnectionState.Connecting]: 'Đang kết nối',
  [ConnectionState.Connected]: 'Đã kết nối',
  [ConnectionState.Reconnecting]: 'Đang kết nối lại',
  [ConnectionState.SignalReconnecting]: 'Đang khôi phục kết nối',
};

const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: { ...VideoPresets.h360.resolution, frameRate: 15 },
  },
};

const handRaisedAttribute = 'handRaised';

function RaiseHandButton({ connected }: { connected: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const permissions = useLocalParticipantPermissions();
  const allowed = permissions?.canUpdateMetadata === true;
  const raised =
    useParticipantAttribute(handRaisedAttribute, { participant: localParticipant }) === 'true';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleHand() {
    if (!connected || pending || !allowed) return;
    setPending(true);
    setError(null);
    try {
      await localParticipant.setAttributes({ [handRaisedAttribute]: raised ? '' : 'true' });
    } catch {
      setError('Không thể cập nhật trạng thái giơ tay. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="lk-button meeting-control-icon"
        aria-pressed={raised}
        aria-label={raised ? 'Hạ tay' : 'Giơ tay'}
        title={!allowed ? 'Máy chủ chưa cấp quyền giơ tay' : raised ? 'Hạ tay' : 'Giơ tay'}
        disabled={!connected || pending || !allowed}
        onClick={() => void toggleHand()}
      >
        <Hand size={23} weight={raised ? 'fill' : 'regular'} aria-hidden="true" />
      </button>
      {error && <p className="notice error raise-hand-error" role="alert">{error}</p>}
    </>
  );
}

function MeetingParticipantTile() {
  const { participant } = useTrackRefContext();
  const raised = useParticipantAttribute(handRaisedAttribute, { participant }) === 'true';

  return (
    <div className="meeting-participant-tile">
      <ParticipantTile />
      {raised && <span className="raised-hand-badge" role="img" aria-label="Đang giơ tay"><Hand size={22} weight="fill" aria-hidden="true" /></span>}
    </div>
  );
}

function RoomContent({ onDeviceError, onDeviceEnabled, onLeave, management, isHost, credentials, accessToken }: { credentials: JoinCredentials; accessToken: string; onDeviceError: (failure: MediaDeviceFailure | undefined, kind?: MediaDeviceKind) => void; onDeviceEnabled: (kind: MediaDeviceKind) => void; onLeave: () => void; management?: ManagementProps; isHost: boolean }) {
  const state = useConnectionState();
  const participants = useParticipants();
  const { isMicrophoneEnabled, isCameraEnabled, microphoneTrack } = useLocalParticipant();
  const [audioMuted, setAudioMuted] = useState(false);
  const canSelectOutput = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  const [showManagement, setShowManagement] = useState(false);
  const [chatOpen, setChatOpen] = useState(false), [chatUnread, setChatUnread] = useState(0);
  const onlineUsers = useMemo(() => new Set(participants.map(participant => participant.identity.split(':')[0])), [participants]);
  const connected = state === ConnectionState.Connected;
  const microphoneLabel = isMicrophoneEnabled ? 'Tắt microphone' : 'Bật microphone';
  const cameraLabel = isCameraEnabled ? 'Tắt camera' : 'Bật camera';
  return (
    <>
      <div className="room-status" role="status" aria-live="polite">
        <span className="meeting-connection" data-connected={state === ConnectionState.Connected}>{connectionLabels[state]}</span>
        <span className="meeting-participant-count"><Users size={17} aria-hidden="true" />{participants.length} người trong phòng</span>
      </div>
      <MeetingChat credentials={credentials} accessToken={accessToken} open={chatOpen} onUnreadChange={setChatUnread}>
        <MeetingMediaLayout><MeetingParticipantTile /></MeetingMediaLayout>
      </MeetingChat>
      {isHost && management?.sessionId ? <ScreenShareRequests accessToken={management.accessToken} meetingId={management.overview.meeting.meetingId} sessionId={management.sessionId} /> : null}
      <RoomAudioRenderer volume={audioMuted ? 0 : 1} />
      <StartAudio label="Bật âm thanh từ phòng" />
      <div className="meeting-controls">
        <fieldset className="meeting-device-controls" disabled={!connected} aria-label="Thiết bị">
        <div className="meeting-device-group">
        <TrackToggle source={Track.Source.Microphone} showIcon={false} onDeviceError={error => onDeviceError(MediaDeviceFailure.getFailure(error), 'audioinput')} onChange={(enabled, userInitiated) => { if (enabled) onDeviceEnabled('audioinput'); if (userInitiated) saveMediaPreference('audioinput', enabled); }} disabled={!connected}
          className="lk-button meeting-control-icon" aria-label={microphoneLabel} title={microphoneLabel}>
          {isMicrophoneEnabled ? <Microphone size={23} aria-hidden="true" /> : <MicrophoneSlash size={23} aria-hidden="true" />}
        </TrackToggle>
        <MediaDeviceMenu kind="audioinput" disabled={!connected} className="lk-button meeting-control-icon meeting-device-arrow" aria-label="Chọn microphone" title="Chọn microphone"
          tracks={{ audioinput: microphoneTrack?.track instanceof LocalAudioTrack ? microphoneTrack.track : undefined }}><CaretDown size={14} aria-hidden="true" /></MediaDeviceMenu>
        </div>
        <div className="meeting-device-group">
          <button type="button" className="lk-button meeting-control-icon" disabled={!connected} data-lk-enabled={!audioMuted} aria-label={audioMuted ? 'Bật âm thanh phòng' : 'Tắt âm thanh phòng'} title={audioMuted ? 'Bật âm thanh phòng' : 'Tắt âm thanh phòng'} onClick={() => setAudioMuted(value => !value)}><Headphones size={23} aria-hidden="true" /></button>
          <MediaDeviceMenu kind="audiooutput" disabled={!connected || !canSelectOutput} className="lk-button meeting-control-icon meeting-device-arrow" aria-label="Chọn loa hoặc tai nghe" title={canSelectOutput ? 'Chọn loa hoặc tai nghe' : 'Trình duyệt chưa hỗ trợ chọn đầu ra; hãy chọn trong cài đặt âm thanh hệ điều hành'}><CaretDown size={14} aria-hidden="true" /></MediaDeviceMenu>
        </div>
        <TrackToggle source={Track.Source.Camera} showIcon={false} onDeviceError={error => onDeviceError(MediaDeviceFailure.getFailure(error), 'videoinput')} onChange={(enabled, userInitiated) => { if (enabled) onDeviceEnabled('videoinput'); if (userInitiated) saveMediaPreference('videoinput', enabled); }} disabled={!connected}
          className="lk-button meeting-control-icon" aria-label={cameraLabel} title={cameraLabel}>
          {isCameraEnabled ? <VideoCamera size={23} aria-hidden="true" /> : <VideoCameraSlash size={23} aria-hidden="true" />}
        </TrackToggle>

        </fieldset>
        <RaiseHandButton connected={state === ConnectionState.Connected} />
        <ScreenShareButton />
        {credentials.sessionId ? <button type="button" className="lk-button meeting-control-icon meeting-chat-toggle" aria-label={`${chatOpen ? 'Đóng chat' : 'Mở chat'}${!chatOpen && chatUnread ? `, ${chatUnread} tin chưa đọc` : ''}`} title={chatOpen ? 'Đóng chat' : 'Mở chat'} aria-controls="meeting-chat-panel" aria-expanded={chatOpen} aria-pressed={chatOpen} onClick={() => setChatOpen(value => !value)}>
          <ChatCircleText size={23} weight={chatOpen ? 'fill' : 'regular'} aria-hidden="true" />
          {!chatOpen && chatUnread > 0 ? <span className="meeting-chat-unread" aria-hidden="true">{chatUnread > 99 ? '99+' : chatUnread}</span> : null}
        </button> : null}
        {management ? <button type="button" className="lk-button meeting-control-icon" aria-label="Quản lý cuộc họp" title="Quản lý cuộc họp" aria-expanded={showManagement} aria-pressed={showManagement} onClick={() => setShowManagement(value => !value)}><Users size={23} aria-hidden="true" /></button> : null}
        <button type="button" className="lk-button meeting-control-icon meeting-control-leave" aria-label="Rời phòng" title="Rời phòng" onClick={onLeave}><SignOut size={23} aria-hidden="true" /></button>
      </div>
      {showManagement && management ? <MeetingManagement {...management} onlineUsers={onlineUsers} /> : null}
    </>
  );
}

export function MeetingRoom({
  credentials,
  accessToken,
  onLeave,
  onEnded,
  management,
}: {
  credentials: JoinCredentials;
  accessToken: string;
  onLeave: () => void;
  onEnded: (message?: string) => void;
  management?: ManagementProps;
}) {
  const [error, setError] = useState<string | null>(null);
  const [initialMedia] = useState(readMediaPreferences);
  const [deviceErrors, setDeviceErrors] = useState<Partial<Record<MediaDeviceKind, string>>>({});
  // Stable callbacks prevent the SDK connection effect restarting on UI updates.
  const handleConnectionError = useCallback((cause: Error) => {
    // Capture failures already arrive with the correct source via MediaDevicesError.
    if (isCaptureError(cause)) return;
    setError(
      'Kết nối hoặc thiết bị gặp lỗi. Hãy kiểm tra mạng, quyền camera/microphone; thử bật lại thiết bị hoặc rời phòng và tham gia lại.',
    );
  }, []);
  const handleDeviceError = useCallback((failure: MediaDeviceFailure | undefined, kind?: MediaDeviceKind) => {
    // Screen capture emits kind=undefined; ScreenShareButton handles its own errors/cancellation.
    if (kind !== 'audioinput' && kind !== 'videoinput') return;
    setDeviceErrors(previous => ({ ...previous, [kind]: deviceErrorMessage(failure, kind) }));
  }, []);
  const handleDeviceEnabled = useCallback((kind: MediaDeviceKind) => {
    setDeviceErrors(previous => previous[kind] ? { ...previous, [kind]: undefined } : previous);
  }, []);
  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      onEnded(
        reason === DisconnectReason.CLIENT_INITIATED
          ? undefined
          : 'Kết nối phòng đã kết thúc. Hãy kiểm tra mạng và thử tham gia lại.',
      );
    },
    [onEnded],
  );
  return (
    <section aria-label="Phòng họp" className="meeting-room">
      <LiveKitRoom
        token={credentials.token}
        serverUrl={credentials.serverUrl}
        connect
        audio={initialMedia.audio}
        video={initialMedia.video}
        options={roomOptions}
        onDisconnected={handleDisconnected}
        onError={handleConnectionError}
        onMediaDeviceFailure={handleDeviceError}
        data-lk-theme="default"
      >
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {Object.entries(deviceErrors).map(([kind, message]) => message ? <p className="notice error" role="alert" key={kind}>{message}</p> : null)}
        <RoomContent credentials={credentials} accessToken={accessToken} onDeviceError={handleDeviceError} onDeviceEnabled={handleDeviceEnabled} onLeave={onLeave} management={management} isHost={credentials.role === 'host'} />
      </LiveKitRoom>
    </section>
  );
}
