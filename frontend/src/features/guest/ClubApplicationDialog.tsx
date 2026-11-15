import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CloudArrowUp } from '@phosphor-icons/react/dist/csr/CloudArrowUp';
import { ImageSquare } from '@phosphor-icons/react/dist/csr/ImageSquare';
import './club-application.css';

export function ClubApplicationDialog({ token, onClose, onSubmitted }: { token: string; onClose: () => void; onSubmitted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [logoName, setLogoName] = useState('');
  const [coverName, setCoverName] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    const body = Object.fromEntries(['name', 'summary', 'description', 'contact_email', 'contact_phone']
      .map(key => [key, String(values.get(key) ?? '')]));
    const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
    try {
      const response = await fetch(`${base}/api/public/clubs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'Không gửi được đăng ký. Vui lòng thử lại.');
      onSubmitted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gửi được đăng ký. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="club-application-dialog" aria-labelledby="club-application-title" onCancel={onClose}>
    <button className="club-application-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
    <h2 id="club-application-title">Đăng ký thành lập CLB</h2>
    <p className="club-application-note">Vui lòng cung cấp thông tin cơ bản về câu lạc bộ.</p>
    <form onSubmit={event => void submit(event)} aria-busy={busy}>
      <section className="club-application-section"><h3>1. Thông tin cơ bản</h3>
        <label>Tên câu lạc bộ *<input name="name" required minLength={2} maxLength={120} placeholder="VD: CLB Công nghệ thông tin" /></label>
        <label>Giới thiệu ngắn *<input name="summary" required minLength={10} maxLength={300} placeholder="Giới thiệu ngắn về CLB" /></label>
        <label>Mô tả chi tiết *<textarea name="description" required minLength={20} maxLength={5000} rows={3} placeholder="Mục đích, hoạt động và định hướng của CLB..." /></label>
        <label>Sứ mệnh *<input name="mission" required minLength={10} maxLength={2000} placeholder="Sứ mệnh của câu lạc bộ" /></label>
      </section>
      <section className="club-application-section"><h3>2. Hình ảnh</h3>
        <label>Logo CLB<span className="club-upload-box"><CloudArrowUp size={19} aria-hidden="true" /><span>{logoName || 'Tải logo lên (không bắt buộc)'}</span><input type="file" accept="image/*" aria-label="Tải logo CLB lên" onChange={event => setLogoName(event.currentTarget.files?.[0]?.name || '')} /></span></label>
        <label>Ảnh bìa CLB<span className="club-upload-box"><ImageSquare size={19} aria-hidden="true" /><span>{coverName || 'Tải ảnh bìa lên (không bắt buộc)'}</span><input type="file" accept="image/*" aria-label="Tải ảnh bìa CLB lên" onChange={event => setCoverName(event.currentTarget.files?.[0]?.name || '')} /></span></label>
        <p className="club-upload-hint">Ảnh được chọn hiện chỉ hiển thị trong biểu mẫu, chưa tải lên máy chủ.</p>
      </section>
      <section className="club-application-section"><h3>3. Thông tin liên hệ</h3>
        <label>Email liên hệ<input name="contact_email" type="email" maxLength={254} placeholder="club@example.com" /></label>
        <label>Số điện thoại<input name="contact_phone" type="tel" maxLength={40} placeholder="Nhập số điện thoại" /></label>
      </section>
      <section className="club-application-section"><h3>4. Đơn vị trực thuộc</h3>
        <label className="club-affiliation-label"><span className="sr-only">Tổ chức trực thuộc</span><select name="affiliation" defaultValue=""><option value="">Chọn tổ chức (nếu có)</option><option value="none">Không thuộc tổ chức</option><option value="other">Khác</option></select></label>
        <p className="club-upload-hint">Đơn vị trực thuộc chưa được lưu vào bảng clubs.</p>
      </section>
      {error && <p role="alert" className="club-application-error">{error}</p>}
      <button type="submit" className="guest-primary club-application-submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu thành lập CLB'}</button>
    </form>
  </dialog>;
}
