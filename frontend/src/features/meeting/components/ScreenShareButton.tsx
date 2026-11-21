import { useRef, useState } from 'react';
import { MonitorArrowUp } from '@phosphor-icons/react/dist/csr/MonitorArrowUp';
import { useConnectionState, useLocalParticipant, useLocalParticipantPermissions, useParticipantAttribute } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';

export function ScreenShareButton() {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const permissions = useLocalParticipantPermissions();
  const connected = useConnectionState() === ConnectionState.Connected;
  const request = useParticipantAttribute('screenShareRequest', { participant: localParticipant });
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = window.isSecureContext && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const sources = permissions?.canPublishSources ?? [];
  const allowed = !!permissions?.canPublish &&
    (sources.length === 0 || sources.includes(Track.sourceToProto(Track.Source.ScreenShare)));
  const audioAllowed = sources.length === 0 || sources.includes(Track.sourceToProto(Track.Source.ScreenShareAudio));
  const label = pending ? 'Đang xử lý chia sẻ…' : isScreenShareEnabled ? 'Dừng chia sẻ màn hình' : allowed ? 'Chia sẻ màn hình' : request === 'pending' ? 'Hủy yêu cầu chia sẻ' : 'Xin chia sẻ màn hình';

  async function requestShare() {
    if (busy.current || !connected) return;
    busy.current = true; setPending(true); setError(null);
    try { await localParticipant.setAttributes({ screenShareRequest: request === 'pending' ? '' : 'pending' }); }
    catch { setError('Không gửi được yêu cầu. Hãy thử lại.'); }
    finally { busy.current = false; setPending(false); }
  }

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
      // Closing the browser picker is a normal cancellation, not a failed camera/mic.
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        setError('Không thể chia sẻ màn hình. Kiểm tra quyền trình duyệt và thử lại.');
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <>
    <button type="button" className="lk-button meeting-control-icon" aria-pressed={isScreenShareEnabled}
      aria-label={label}
      title={label}
      disabled={!connected || pending || (!isScreenShareEnabled && !supported)}
      onClick={() => void (allowed || isScreenShareEnabled ? toggleShare() : requestShare())}>
      <MonitorArrowUp size={23} aria-hidden="true" />
    </button>
    {!supported && <p className="screen-share-message" role="status">Chia sẻ màn hình cần trình duyệt hỗ trợ và HTTPS hoặc localhost.</p>}
    {!allowed && request === 'pending' && <p className="screen-share-message" role="status">Đang chờ chủ phòng duyệt chia sẻ.</p>}
    {!allowed && request === 'denied' && <p className="screen-share-message" role="status">Chủ phòng đã từ chối yêu cầu chia sẻ.</p>}
    {error && <p className="notice error screen-share-message" role="alert">{error}</p>}
  </>;
}
