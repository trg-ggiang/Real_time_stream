import { lazy, Suspense } from 'react';
import { useMeetingSession } from './hooks/use-meeting-session';

const MeetingRoom = lazy(() =>
  import('./components/MeetingRoom').then((module) => ({
    default: module.MeetingRoom,
  })),
);

export function MeetingPage() {
  const session = useMeetingSession();
  return (
    <main>
      <header>
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
            onLeave={session.leave}
            onEnded={session.endSession}
          />
        </Suspense>
      ) : (
        <section className="join-card" aria-label="Tham gia phòng thử nghiệm">
          <span className="badge">Phòng thử nghiệm chung</span>
          <h2>Sẵn sàng kết nối?</h2>
          <p>
            Cho phép truy cập camera và microphone khi trình duyệt hỏi. Mở cùng
            trang này trên thiết bị thứ hai để gặp nhau.
          </p>
          <p className="hint">
            Dùng tai nghe để tránh tiếng vọng. Tất cả người tham gia sẽ vào cùng
            một phòng thử nghiệm.
          </p>
          {session.error && (
            <p className="notice error" role="alert">
              {session.error}
            </p>
          )}
          <div className="join-actions">
            <button
              disabled={session.isJoining}
              onClick={() => void session.join()}
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
        Chỉ dùng cho thử nghiệm • Chưa có đăng nhập hoặc phòng riêng tư
      </footer>
    </main>
  );
}
