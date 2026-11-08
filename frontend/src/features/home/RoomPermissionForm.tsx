import './RoomPermissionForm.css';

export type RoomPermissions = {
  allowMic: boolean;
  allowVideo: boolean;
};

export function RoomPermissionForm({ busy, error, onCancel, onSave }: {
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (settings: RoomPermissions) => void;
}) {
  return (
    <section className="room-permission-step" aria-labelledby="room-permission-title">
      <header className="room-permission-heading">
        <span className="room-permission-step-number" aria-hidden="true">1</span>
        <div>
          <h2 id="room-permission-title">Thiết lập phòng</h2>
          <p>Chọn quyền mặc định cho người tham gia.</p>
        </div>
      </header>
      <form className="room-permission-form" onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        onSave({
          allowMic: values.get('allowMic') === 'on',
          allowVideo: values.get('allowVideo') === 'on',
        });
      }}>
        <label><input type="checkbox" name="allowMic" defaultChecked /> Cho phép bật microphone</label>
        <label><input type="checkbox" name="allowVideo" defaultChecked /> Cho phép bật camera</label>
        <p className="room-permission-note">Thành viên cần được chủ phòng chấp nhận trước khi vào phòng.</p>
        {error && <p className="room-permission-error" role="alert">{error}</p>}
        <div className="room-permission-actions">
          <button className="room-permission-cancel" type="button" onClick={onCancel} disabled={busy}>Quay lại</button>
          <button className="room-permission-submit" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thiết lập và vào phòng'}</button>
        </div>
      </form>
    </section>
  );
}
