import { useRef, useState } from 'react';
import { useConnectionState, useLocalParticipant, useLocalParticipantPermissions } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';

export function ScreenShareButton() {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const permissions = useLocalParticipantPermissions();
  const connected = useConnectionState() === ConnectionState.Connected;
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = window.isSecureContext && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const sources = permissions?.canPublishSources ?? [];
  const allowed = !!permissions?.canPublish &&
    (sources.length === 0 || sources.includes(Track.sourceToProto(Track.Source.ScreenShare)));
  const audioAllowed = sources.length === 0 || sources.includes(Track.sourceToProto(Track.Source.ScreenShareAudio));

  async function toggleShare() {
    if (busy.current || !connected || (!isScreenShareEnabled && (!supported || !allowed))) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      // Invoke directly from the click, preserving the browser's user activation.
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: audioAllowed });
    } catch (cause) {
      const name = cause && typeof cause === 'object' && 'name' in cause ? cause.name : '';
      setError(name === 'NotAllowedError' || name === 'AbortError'
        ? 'Chưa chia sẻ màn hình. Bạn có thể thử lại và chọn nguồn cần chia sẻ.'
        : 'Không thể chia sẻ màn hình. Kiểm tra quyền trình duyệt và thử lại.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <>
    <button type="button" className="lk-button" aria-pressed={isScreenShareEnabled}
      disabled={!connected || pending || (!isScreenShareEnabled && (!supported || !allowed))}
      onClick={() => void toggleShare()}>
      {pending ? 'Đang xử lý…' : isScreenShareEnabled ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
    </button>
    {!supported && <p className="screen-share-message" role="status">Chia sẻ màn hình cần trình duyệt hỗ trợ và HTTPS hoặc localhost.</p>}
    {supported && permissions && !allowed && <p className="screen-share-message" role="status">Bạn chưa có quyền chia sẻ màn hình.</p>}
    {error && <p className="notice error screen-share-message" role="alert">{error}</p>}
  </>;
}
