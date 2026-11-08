import { useState } from 'react';
import { MeetingPage } from '../meeting/MeetingPage';
import { RoomPermissionForm, type RoomPermissions } from './RoomPermissionForm';
import { saveRoomPermissions } from './room-settings-api';
import './home.css';

export function HomePage({ onMeetingCreated, activeRoomId, onLeaveRoom, onUnauthorized, onLogout }: {
  onMeetingCreated: (meetingId: string) => void;
  activeRoomId: string | null;
  onLeaveRoom: () => void;
  onUnauthorized: () => void;
  onLogout?: () => void;
}) {
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');

  async function saveSettings(settings: RoomPermissions) {
    setSavingSettings(true);
    setError('');
    const roomId = crypto.randomUUID();
    try {
      await saveRoomPermissions(roomId, settings);
      onMeetingCreated(roomId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu thiết lập phòng.');
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className={`home-dashboard${activeRoomId ? '' : ' home-landing'}`}>
      {activeRoomId ? (
        <MeetingPage roomId={activeRoomId} onUnauthorized={onUnauthorized} embedded onLeaveHome={onLeaveRoom} />
      ) : <>
      <button className="home-logout" type="button" onClick={() => onLogout?.()}>Đăng xuất</button>
      <section className="home-intro home-hero-copy" aria-labelledby="home-title">
        <span className="home-hero-kicker">MEETING / MODULE 01</span>
        <h1 id="home-title">Cùng gặp nhau, từ bất cứ đâu.</h1>
        <p>Phòng thử nghiệm âm thanh và hình ảnh trực tiếp.</p>
      </section>

      <section className="home-new-join" aria-label="Kết nối phòng họp">
        {!showRoomSettings && (
        <section className="join-card" aria-label="Tham gia phòng thử nghiệm">
          <span className="badge">Phòng thử nghiệm chung</span>
          <h2>Sẵn sàng kết nối?</h2>
          <p>Cho phép truy cập camera và microphone khi trình duyệt hỏi. Mở cùng trang này trên thiết bị thứ hai để gặp nhau.</p>
          <p className="join-hint">Dùng tai nghe để tránh tiếng vọng. Cấp quyền cho micro và camera trước khi vào phòng.</p>
          <div className="join-actions">
            <button
              className="join-page-link"
              type="button"
              onClick={() => setShowRoomSettings(true)}
            >
              Tham gia phòng
            </button>
          </div>
        </section>
        )}
        {showRoomSettings && (
          <RoomPermissionForm
            busy={savingSettings}
            error={error}
            onCancel={() => { setShowRoomSettings(false); setError(''); }}
            onSave={(settings) => void saveSettings(settings)}
          />
        )}
      </section>
      <footer className="home-page-footer">Chỉ dùng cho thử nghiệm • Phòng họp cần đăng nhập</footer>
      </>}
    </div>
  );
}
