import { useCallback, useState } from 'react';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/dist/csr/MicrophoneSlash';
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import {
  ConnectionState,
  DisconnectReason,
  MediaDeviceFailure,
  Track,
  VideoPresets,
  type RoomOptions,
} from 'livekit-client';
import type { JoinCredentials } from '../types';
import {
  getMediaDeviceErrorFromException,
  getMediaDeviceErrorMessage,
} from '../services/media-device-error';
import { muteParticipantMicrophone } from '../services/room-api';

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

function RoomContent({
  isHost,
  allowMic,
  onMuteMicrophone,
}: {
  isHost: boolean;
  allowMic: boolean;
  onMuteMicrophone: (participantIdentity: string, muted: boolean) => Promise<void>;
}) {
  const state = useConnectionState();
  const participants = useParticipants();
  const [mutingIdentities, setMutingIdentities] = useState<Set<string>>(() => new Set());
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);
  return (
    <>
      <div className="meeting-screen">
        <div className="room-status" role="status" aria-live="polite">
          <span className="meeting-connection-state">
            <span className="meeting-live-indicator" aria-hidden="true" />
            {connectionLabels[state]}
          </span>
          <span>{participants.length} thành viên</span>
        </div>
        <div className="video-grid">
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        </div>
        <aside className="meeting-member-panel" aria-label="Danh sách thành viên">
          <header className="meeting-member-header">
            <strong>Thành viên</strong>
            <span>{participants.length}</span>
          </header>
          <div className="meeting-member-list">
            {participants.map((participant) => {
              const displayName = participant.name || participant.identity;
              const canControlMic = isHost && allowMic && !participant.isLocal;
              const isMutating = mutingIdentities.has(participant.identity);
              async function toggleMicrophone() {
                setMutingIdentities((current) => new Set(current).add(participant.identity));
                try {
                  await onMuteMicrophone(participant.identity, participant.isMicrophoneEnabled);
                } finally {
                  setMutingIdentities((current) => {
                    const next = new Set(current);
                    next.delete(participant.identity);
                    return next;
                  });
                }
              }
              return (
                <div className="meeting-member-row" key={participant.identity}>
                  <span className="meeting-member-avatar" aria-hidden="true">
                    {displayName.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="meeting-member-info">
                    <strong title={displayName}>{displayName}</strong>
                    <small className="meeting-member-role">{participant.isLocal ? (isHost ? 'Chủ phòng' : 'Bạn') : 'Thành viên'}</small>
                    <small className={`meeting-member-mic-state${participant.isMicrophoneEnabled ? ' is-on' : ''}`}>
                      {participant.isMicrophoneEnabled ? 'Mic đang bật' : 'Mic đang tắt'}
                    </small>
                  </span>
                  <button
                    className="meeting-member-mic"
                    type="button"
                    aria-label={participant.isMicrophoneEnabled ? `Tắt mic ${displayName}` : `Cho phép ${displayName} bật mic`}
                    title={!allowMic ? 'Mic bị tắt theo cài đặt phòng' : participant.isMicrophoneEnabled ? 'Tắt mic thành viên' : 'Cho phép thành viên bật mic'}
                    disabled={!canControlMic || isMutating}
                    onClick={() => void toggleMicrophone()}
                  >
                    {participant.isMicrophoneEnabled
                      ? <Microphone size={18} weight="fill" aria-hidden="true" />
                      : <MicrophoneSlash size={18} weight="fill" aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Bật âm thanh từ phòng" />
    </>
  );
}
export function MeetingRoom({
  credentials,
  onLeave,
  onEnded,
}: {
  credentials: JoinCredentials;
  onLeave: () => void;
  onEnded: (message?: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Stable callbacks prevent the SDK connection effect restarting on UI updates.
  const handleConnectionError = useCallback((error: Error) => {
    setError(getMediaDeviceErrorFromException(error));
  }, []);
  const handleDeviceFailure = useCallback(
    (failure: MediaDeviceFailure | undefined, kind?: MediaDeviceKind) => {
      setError(getMediaDeviceErrorMessage(failure, kind));
    },
    [],
  );
  const handleToggleDeviceError = useCallback(
    ({ source, error }: { source: Track.Source; error: Error }) => {
      const kind: MediaDeviceKind | undefined =
        source === Track.Source.Camera
          ? 'videoinput'
          : source === Track.Source.Microphone
            ? 'audioinput'
            : undefined;
      setError(getMediaDeviceErrorFromException(error, kind));
    },
    [],
  );
  const handleConnected = useCallback(() => {
    setError(null);
  }, []);
  const handleMuteMicrophone = useCallback(async (participantIdentity: string, muted: boolean) => {
    try {
      await muteParticipantMicrophone(credentials.roomName, participantIdentity, muted);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tắt mic người tham gia.');
    }
  }, [credentials.roomName]);
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
        audio={credentials.settings.allowMic}
        video={credentials.settings.allowVideo}
        options={roomOptions}
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onError={handleConnectionError}
        onMediaDeviceFailure={handleDeviceFailure}
        data-lk-theme="default"
      >
        {error && (
          <p className="meeting-device-error notice error" role="alert">
            {error}
          </p>
        )}
        <RoomContent
          isHost={credentials.isHost}
          allowMic={credentials.settings.allowMic}
          onMuteMicrophone={handleMuteMicrophone}
        />
        <div className="meeting-controls">
          <ControlBar
            variation="verbose"
            saveUserChoices={false}
            onDeviceError={handleToggleDeviceError}
            controls={{
              microphone: credentials.settings.allowMic,
              camera: credentials.settings.allowVideo,
              screenShare: false,
              chat: false,
              leave: false,
            }}
          />
          <button className="meeting-leave" onClick={onLeave}>
            Rời phòng
          </button>
        </div>
      </LiveKitRoom>
    </section>
  );
}
