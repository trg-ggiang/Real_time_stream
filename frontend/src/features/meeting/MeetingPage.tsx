import { lazy, Suspense, useEffect, useState } from 'react';
import { useMeetingSession } from './hooks/use-meeting-session';

const MeetingRoom = lazy(() =>
  import('./components/MeetingRoom').then((module) => ({
    default: module.MeetingRoom,
  })),
);

export function MeetingPage({ accessToken, displayName, onLogout }: { accessToken: string; displayName: string; onLogout: () => void }) {
  const session = useMeetingSession(accessToken, onLogout);
  const [options, setOptions] = useState<{ sessionId: string; title: string; roomName: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
    void fetch(`${base}/api/meeting-sessions`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) { onLogout(); throw new Error('Phiên đăng nhập hết hạn.'); }
        if (!response.ok) throw new Error('Không tải được danh sách phiên họp. Bạn vẫn có thể dùng phòng PoC không có chat.');
        const data = await response.json();
        if (!Array.isArray(data) || !data.every(row => typeof row?.sessionId === 'string' && typeof row?.title === 'string')) throw new Error('Danh sách phiên họp không hợp lệ.');
        if (!controller.signal.aborted) { setOptions(data); setSelectedSession(data[0]?.sessionId ?? ''); }
      }).catch(cause => { if (!controller.signal.aborted) setSessionsError(cause instanceof Error ? cause.message : 'Không tải được phiên họp.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSessions(false); });
    return () => controller.abort();
  }, [accessToken, onLogout]);
  return (
    <main>
      <header>
        <div className="room-heading"><span>{displayName}</span><button className="secondary" onClick={() => { session.leave(); onLogout(); }}>Đăng xuất</button></div>
        <p className="eyebrow">MEETING / MODULE 01</p>
        <h1>Cùng gặp nhau, từ bất cứ đâu.</h1>
        <p className="subtitle">
          Phòng thử nghiệm âm thanh và hình ảnh trực tiếp.
        </p>
      </header>
      {session.credentials ? (
        <Suspense fallback={<p role="status">Đang tải phòng họp…</p>}>
          <MeetingRoom
            credentials={session.credentials}
            accessToken={accessToken}
            onLeave={session.leave}
            onEnded={session.endSession}
          />
        </Suspense>
      ) : (
        <section className="join-card" aria-label="Tham gia phòng thử nghiệm">
          <span className="badge">{selectedSession ? 'Phiên họp có chat' : 'Phòng thử nghiệm chung'}</span>
          <h2>Sẵn sàng kết nối?</h2>
          <p>
            Cho phép truy cập camera và microphone khi trình duyệt hỏi. Mở cùng
            trang này trên thiết bị thứ hai để gặp nhau.
          </p>
          <p className="hint">
            Dùng tai nghe để tránh tiếng vọng. Chọn cùng phiên họp với những
            người bạn muốn gặp và trò chuyện.
          </p>
          <div className="meeting-session-picker"><label htmlFor="meeting-session-select">Phiên họp</label>
            <select id="meeting-session-select" value={selectedSession} onChange={event => setSelectedSession(event.target.value)} disabled={loadingSessions || session.isJoining}>
              <option value="">Phòng PoC — media, không có lịch sử chat</option>
              {options.map(option => <option key={option.sessionId} value={option.sessionId}>{option.title} · {option.roomName}</option>)}
            </select>
          </div>
          <p className="hint">Chat dùng cho phiên đang diễn ra mà bạn đã được chấp nhận vào. Mọi người cần chọn cùng phiên.</p>
          {sessionsError && <p role="status">{sessionsError}</p>}
          {session.error && (
            <p className="notice error" role="alert">
              {session.error}
            </p>
          )}
          <div className="join-actions">
            <button
              disabled={session.isJoining || loadingSessions}
              onClick={() => void session.join(selectedSession || undefined)}
            >
              {session.isJoining ? 'Đang chuẩn bị…' : 'Tham gia phòng'}
            </button>
            {session.isJoining && (
              <button className="secondary" onClick={session.leave}>
                Hủy
              </button>
            )}
          </div>
        </section>
      )}
      <footer>
        Chỉ dùng cho thử nghiệm • Phòng chung sau đăng nhập
      </footer>
    </main>
  );
}
