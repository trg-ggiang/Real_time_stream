import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useMeetingSession } from './hooks/use-meeting-session';
import { approveWaitingParticipant, getWaitingParticipants, type WaitingParticipant } from './services/room-api';
import './MeetingPage.css';

const MeetingRoom = lazy(() =>
  import('./components/MeetingRoom').then((module) => ({
    default: module.MeetingRoom,
  })),
);

type MeetingPageProps = {
  roomId: string;
  onUnauthorized: () => void;
  embedded?: boolean;
  onLeaveHome?: () => void;
};

export function MeetingPage({ roomId, onUnauthorized, embedded = false, onLeaveHome }: MeetingPageProps) {
  const session = useMeetingSession(roomId, onUnauthorized);
  const [hasLeft, setHasLeft] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('');
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([]);
  const [approvalError, setApprovalError] = useState('');

  const leaveRoom = useCallback(() => {
    setHasLeft(true);
    session.leave();
    if (embedded) onLeaveHome?.();
    else window.location.assign('/');
  }, [embedded, onLeaveHome, session.leave]);

  const retryJoin = useCallback(() => {
    setHasLeft(false);
    void session.join();
  }, [session.join]);

  const handleEnded = useCallback((message?: string) => {
    setHasLeft(false);
    session.endSession(message);
  }, [session.endSession]);

  useEffect(() => {
    void session.join();
  }, [session.join]);

  useEffect(() => {
    if (!session.waiting) return;
    const timer = window.setInterval(() => void session.join(), 8000);
    return () => window.clearInterval(timer);
  }, [session.waiting, session.join]);

  const isHost = session.credentials?.isHost === true;
  useEffect(() => {
    if (!isHost || !session.credentials?.settings.waitingRoom) return;
    const controller = new AbortController();
    const refresh = () => {
      void getWaitingParticipants(roomId, controller.signal)
        .then(setWaitingParticipants)
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [isHost, roomId, session.credentials?.settings.waitingRoom]);

  async function approveParticipant(participant: WaitingParticipant) {
    setApprovalError('');
    try {
      await approveWaitingParticipant(roomId, participant.userId);
      setWaitingParticipants((current) => current.filter((entry) => entry.userId !== participant.userId));
    } catch (cause) {
      setApprovalError(cause instanceof Error ? cause.message : 'Không thể duyệt người tham gia.');
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meeting/${roomId}`);
      setInviteStatus('Đã sao chép link');
    } catch {
      setInviteStatus('Không thể sao chép link');
    }
    window.setTimeout(() => setInviteStatus(''), 2000);
  }

  return (
    <main className={`meeting-page${embedded ? ' is-embedded' : ''}`}>
      <header className="meeting-page-header">
        <a className="meeting-brand" href="/" aria-label="Real-time Stream — Home">
          <img src="/icon/video-camera.svg" alt="" aria-hidden="true" />
          <span>REAL-TIME STREAM</span>
        </a>
        <div className="meeting-room-identity">
          <span>PHÒNG HỌP</span>
          <strong>{roomId}</strong>
        </div>
        {embedded && (
          <button className="meeting-invite-copy" type="button" onClick={() => void copyInviteLink()}>
            {inviteStatus || 'Sao chép link mời'}
          </button>
        )}
      </header>

      <section className="meeting-stage" aria-label="Cuộc họp">
        {session.credentials ? (
          <Suspense fallback={<p className="meeting-feedback" role="status">Đang mở phòng họp…</p>}>
            <MeetingRoom
              credentials={session.credentials}
              onLeave={leaveRoom}
              onEnded={handleEnded}
            />
          </Suspense>
        ) : (
          <div className="meeting-waiting">
            <span className="meeting-live-indicator" aria-hidden="true" />
            {session.waiting && <p className="meeting-feedback" role="status">Đang chờ chủ phòng duyệt. Trang sẽ tự vào phòng khi được chấp thuận.</p>}
            <h1>
              {session.error
                ? 'Chưa thể vào phòng'
                : hasLeft
                  ? 'Bạn đã rời phòng'
                  : 'Đang kết nối phòng họp'}
            </h1>
            <p className="meeting-feedback" role={session.error ? 'alert' : 'status'}>
              {session.error ??
                (hasLeft
                  ? 'Bạn có thể đóng tab này hoặc tham gia lại phòng.'
                  : 'Đang chuẩn bị camera, microphone và kết nối…')}
            </p>
            {(session.error || hasLeft) && (
              <button
                type="button"
                className="meeting-retry"
                disabled={session.isJoining}
                onClick={retryJoin}
              >
                {session.isJoining ? 'Đang thử lại…' : hasLeft ? 'Tham gia lại' : 'Thử kết nối lại'}
              </button>
            )}
          </div>
        )}
      </section>
      {isHost && session.credentials?.settings.waitingRoom && (
        <aside className="meeting-waiting-approvals" aria-label="Người chờ vào phòng">
          <h2>Chờ duyệt ({waitingParticipants.length})</h2>
          {approvalError && <p role="alert">{approvalError}</p>}
          {waitingParticipants.length === 0 ? <p>Chưa có ai đang chờ.</p> : waitingParticipants.map((participant) => (
            <div className="meeting-waiting-person" key={participant.userId}>
              <span>{participant.displayName}</span>
              <button type="button" onClick={() => void approveParticipant(participant)}>Cho vào</button>
            </div>
          ))}
        </aside>
      )}
      <footer className="meeting-page-footer">
        Chỉ người đăng nhập mới có thể tham gia phòng này.
      </footer>
    </main>
  );
}
