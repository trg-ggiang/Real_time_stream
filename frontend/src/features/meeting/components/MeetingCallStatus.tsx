import { ArrowUUpLeft } from '@phosphor-icons/react/dist/csr/ArrowUUpLeft';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import './meeting-call-status.css';

export function MeetingCallStatus({ title, reconnecting, onExpand, onLeave }: {
  title?: string;
  reconnecting: boolean;
  onExpand: () => void;
  onLeave: () => void;
}) {
  return <section className="meeting-call-status" aria-label="Trạng thái cuộc họp">
    <div className="meeting-call-status-detail">
      <VideoCamera size={18} weight="duotone" aria-hidden="true" />
      <strong role="status">{reconnecting ? 'Đang kết nối lại…' : 'Đang trong cuộc họp'}</strong>
      {title && <span className="meeting-call-status-title" title={title}>{title}</span>}
    </div>
    <div className="meeting-call-status-actions">
      <button type="button" onClick={onExpand}><ArrowUUpLeft size={16} aria-hidden="true" />Mở lại phòng</button>
      <button type="button" className="meeting-call-status-leave" aria-label="Rời cuộc họp" title="Rời cuộc họp" onClick={onLeave}>
        <SignOut size={17} aria-hidden="true" /><span>Rời cuộc họp</span>
      </button>
    </div>
  </section>;
}
