import { useEffect, useState, type FormEvent } from 'react';

type Profile = { full_name: string | null; student_code: string | null; school_or_faculty: string | null; major: string | null; cohort: string | null; phone: string | null; bio: string | null };
const fields: Array<[keyof Profile, string]> = [
  ['full_name', 'Họ và tên'], ['student_code', 'Mã sinh viên'], ['school_or_faculty', 'Trường / khoa'],
  ['major', 'Ngành học'], ['cohort', 'Khóa'], ['phone', 'Số điện thoại'], ['bio', 'Giới thiệu'],
];
const empty: Profile = { full_name: '', student_code: '', school_or_faculty: '', major: '', cohort: '', phone: '', bio: '' };
const required: Array<keyof Profile> = ['full_name', 'student_code', 'school_or_faculty', 'major', 'cohort'];
const complete = (value: Profile) => required.every(key => Boolean(value[key]?.trim()));

export function PersonalProfile({ token, autoContinue, onContinue, onLogout }: { token: string; autoContinue: boolean; onContinue: () => void; onLogout: () => void }) {
  const [profile, setProfile] = useState<Profile>(empty);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
  const api = (method: string, body?: unknown) => fetch(`${base}/api/users/me/profile`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
  });
  useEffect(() => {
    let active = true;
    void api('GET').then(async response => {
      if (!response.ok) throw new Error('Không tải được hồ sơ. Vui lòng thử lại.');
      const data = await response.json();
      if (active) {
        const loaded = Object.fromEntries(Object.keys(empty).map(key => [key, data[key] ?? ''])) as Profile;
        setProfile(loaded);
        setSaved(complete(loaded));
        if (autoContinue && complete(loaded)) onContinue();
      }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [token, autoContinue]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    if (!complete(profile)) {
      setError('Vui lòng điền họ tên, mã sinh viên, trường/khoa, ngành và khóa trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    try {
      const response = await api('PATCH', profile);
      if (!response.ok) throw new Error(response.status === 400 ? 'Một số thông tin chưa hợp lệ.' : 'Không lưu được hồ sơ. Vui lòng thử lại.');
      const data = await response.json();
      setProfile(Object.fromEntries(Object.keys(empty).map(key => [key, data[key] ?? ''])) as Profile);
      setSaved(true);
      setMessage('Đã lưu hồ sơ. Đang mở trang chủ…');
      onContinue();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ.'); }
    finally { setBusy(false); }
  }
  if (busy && !saved && !error) return <main className="profile-page"><p role="status">Đang kiểm tra hồ sơ sinh viên…</p></main>;
  return <main className="profile-page">
    <section className="profile-card" aria-labelledby="profile-title">
      <header className="profile-header"><a href="/" className="profile-brand">uni<span>circle</span></a><button type="button" onClick={onLogout}>Đăng xuất</button></header>
      <div className="profile-intro"><p className="profile-eyebrow">HỒ SƠ SINH VIÊN · BƯỚC 02</p>
        <h1 id="profile-title">Một chút về bạn,<br /><span>để kết nối đúng hơn.</span></h1>
        <p>Hoàn thiện thông tin sinh viên trước khi tiếp tục. Số điện thoại và giới thiệu có thể bổ sung sau.</p></div>
      {busy && <p role="status">Đang tải…</p>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <form onSubmit={save}><p className="profile-section-title">Thông tin học tập <span>* Bắt buộc</span></p>
        {fields.map(([key, label]) => <label key={key}>{label}
          {key === 'bio' ? <textarea maxLength={1000} value={profile[key] ?? ''} disabled={busy} onChange={e => { setProfile({ ...profile, [key]: e.target.value }); setMessage(''); setSaved(false); }} />
            : <input maxLength={key === 'phone' ? 30 : key === 'student_code' || key === 'cohort' ? 40 : 120} value={profile[key] ?? ''} disabled={busy} onChange={e => { setProfile({ ...profile, [key]: e.target.value }); setMessage(''); setSaved(false); }} />}
        </label>)}
        <div className="profile-actions"><button type="submit" disabled={busy}>Lưu hồ sơ</button><button type="button" onClick={onContinue} disabled={busy || !saved || !complete(profile)}>Tiếp tục đến trang chủ →</button></div>
      </form>
    </section>
  </main>;
}
