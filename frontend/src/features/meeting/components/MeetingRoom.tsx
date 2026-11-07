import { useCallback, useState } from 'react';
import {
  ControlBar,
  DisconnectButton,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useLocalParticipant,
  useParticipantAttribute,
  useParticipants,
  useTrackRefContext,
  useTracks,
} from '@livekit/components-react';
import {
  ConnectionState,
  DisconnectReason,
  Track,
  VideoPresets,
  type RoomOptions,
} from 'livekit-client';
import type { JoinCredentials } from '../types';

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
  const raised =
    useParticipantAttribute(handRaisedAttribute, { participant: localParticipant }) === 'true';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleHand() {
    if (!connected || pending) return;
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
        className="lk-button"
        disabled={!connected || pending}
        onClick={() => void toggleHand()}
      >
        <span aria-hidden="true">✋</span> {raised ? 'Hạ tay' : 'Giơ tay'}
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
      {raised && <span className="raised-hand-badge" role="img" aria-label="Đang giơ tay">✋</span>}
    </div>
  );
}

function RoomContent({ onDeviceError }: { onDeviceError: () => void }) {
  const state = useConnectionState();
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);
  return (
    <>
      <div className="room-status" role="status" aria-live="polite">
        <span>{connectionLabels[state]}</span>
        <span>{participants.length} người trong phòng</span>
      </div>
      <div className="video-grid">
        <GridLayout tracks={tracks}>
          <MeetingParticipantTile />
        </GridLayout>
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Bật âm thanh từ phòng" />
      <div className="meeting-controls">
        <ControlBar
          variation="verbose"
          saveUserChoices={false}
          onDeviceError={onDeviceError}
          controls={{
            microphone: true,
            camera: true,
            screenShare: false,
            chat: false,
            leave: false,
          }}
        />
        <RaiseHandButton connected={state === ConnectionState.Connected} />
        <DisconnectButton>Leave</DisconnectButton>
      </div>
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
  const handleConnectionError = useCallback(() => {
    setError(
      'Kết nối hoặc thiết bị gặp lỗi. Hãy kiểm tra mạng, quyền camera/microphone; thử bật lại thiết bị hoặc rời phòng và tham gia lại.',
    );
  }, []);
  const handleDeviceError = useCallback(() => {
    setError(
      'Không mở được camera hoặc microphone. Kiểm tra quyền truy cập và thiết bị, rồi thử bật lại bằng thanh điều khiển.',
    );
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
        audio
        video
        options={roomOptions}
        onDisconnected={handleDisconnected}
        onError={handleConnectionError}
        onMediaDeviceFailure={handleDeviceError}
        data-lk-theme="default"
      >
        <div className="room-heading">
          <span>Phòng: {credentials.roomName}</span>
          <button className="secondary" onClick={onLeave}>
            Rời phòng
          </button>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <RoomContent onDeviceError={handleDeviceError} />
      </LiveKitRoom>
    </section>
  );
}
