import { confirmAction } from '../../shared/lib/confirm-action';
import { useEffect, useMemo, useState } from 'react';
import { publicDate, safePublicUrl } from './public-content';
import './club-management.css';

type ClubRequest = {
  club_id: string; name: string; summary: string | null; description: string | null; mission: string | null;
  logo_url: string | null; cover_url: string | null; contact_email: string | null; contact_phone: string | null;
  status: string; created_by: string | null; created_at: string | null; creator_name: string;
};
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
const filters: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' }, { id: 'pending', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Đã duyệt' }, { id: 'rejected', label: 'Từ chối' },
];
const statusLabel = (status: string) => status === 'pending' ? 'Chờ duyệt'
  : status === 'rejected' ? 'Từ chối' : ['approved', 'published'].includes(status) ? 'Đã duyệt' : status;
const statusClass = (status: string) => status === 'pending' ? 'pending'
  : status === 'rejected' ? 'rejected' : ['approved', 'published'].includes(status) ? 'approved' : 'other';

export function ClubManagementPage({ token }: { token: string }) {
  const [items, setItems] = useState<ClubRequest[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, processed: 0 });
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClubRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');
  const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');

  async function load(signal?: AbortSignal) {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${base}/api/public/admin/clubs`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'Không tải được yêu cầu thành lập CLB.');
      if (!Array.isArray(result?.items)) throw new Error('Dữ liệu danh sách CLB không hợp lệ.');
      setItems(result.items); setCounts({ total: result.total ?? 0, pending: result.pending ?? 0, processed: result.processed ?? 0 });
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được yêu cầu thành lập CLB.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [token]);

  const visibleItems = useMemo(() => items.filter(item => {
    const statusMatches = filter === 'all' || (filter === 'approved'
      ? ['approved', 'published'].includes(item.status) : item.status === filter);
    const needle = search.trim().toLocaleLowerCase('vi');
    const searchMatches = !needle || `${item.name} ${item.creator_name} ${item.summary ?? ''}`.toLocaleLowerCase('vi').includes(needle);
    return statusMatches && searchMatches;
  }), [items, filter, search]);

  async function reject(item: ClubRequest) {
    if (!(await confirmAction(`Từ chối yêu cầu thành lập “${item.name}”?`))
    ) return;
    setActionId(item.club_id); setError('');
    try {
      const response = await fetch(`${base}/api/public/admin/clubs/${encodeURIComponent(item.club_id)}/reject`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'Không cập nhật được trạng thái yêu cầu.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái yêu cầu.'); }
    finally { setActionId(''); }
  }

  async function approve(item: ClubRequest) {
    if (!(await confirmAction(`Đồng ý thành lập “${item.name}” và thêm người gửi làm chủ nhiệm CLB?`))
    ) return;
    setActionId(item.club_id); setError('');
    try {
      const response = await fetch(`${base}/api/public/admin/clubs/${encodeURIComponent(item.club_id)}/approve`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'Không thể duyệt yêu cầu CLB.');
      setSelected(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể duyệt yêu cầu CLB.'); }
    finally { setActionId(''); }
  }

  return <main className="club-management-page" aria-labelledby="club-management-title">
    <h1 id="club-management-title">Yêu cầu thành lập CLB</h1>
    <p className="club-management-subtitle">Quản lý và xét duyệt các yêu cầu thành lập câu lạc bộ từ sinh viên.</p>
    <div className="club-management-stats">
      <article className="club-management-total"><span className="club-stat-icon" aria-hidden="true">▢</span><strong>{counts.total}</strong><span>Tổng yêu cầu</span></article>
      <article className="club-management-pending"><span className="club-stat-icon" aria-hidden="true">◷</span><strong>{counts.pending.toString().padStart(2, '0')}</strong><span>Chờ duyệt</span></article>
      <article className="club-management-processed"><span className="club-stat-icon" aria-hidden="true">✓</span><strong>{counts.processed.toString().padStart(2, '0')}</strong><span>Đã xử lý</span></article>
    </div>
    <h2>Danh sách yêu cầu</h2>
    <label className="club-management-search"><span className="sr-only">Tìm tên CLB hoặc sinh viên</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm tên CLB hoặc sinh viên..." /></label>
    <div className="club-management-filters" role="group" aria-label="Lọc trạng thái">{filters.map(item => <button key={item.id} type="button" className={`club-filter-chip club-filter-${item.id}${filter === item.id ? ' is-active' : ''}`} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {error && <p className="club-management-error" role="alert">{error}</p>}
    {loading ? <p className="club-management-state" role="status">Đang tải danh sách…</p> : visibleItems.length ? <div className="club-request-list">
      {visibleItems.map(item => <article className="club-request-card" key={item.club_id}>
        <div className="club-request-heading"><h3>{item.name}</h3><span className={`club-request-status club-request-status-${statusClass(item.status)}`}>{statusLabel(item.status)}</span></div>
        <p className="club-request-byline">Người thành lập: {item.creator_name}</p>
        <p className="club-request-meta">Ngày gửi: {publicDate(item.created_at || undefined)}{item.summary ? ` · ${item.summary}` : ''}</p>
        <div className="club-request-actions">{item.status === 'pending' && <button type="button" className="club-reject-button" disabled={actionId === item.club_id} onClick={() => void reject(item)}>{actionId === item.club_id ? 'Đang xử lý…' : 'Từ chối'}</button>}<button type="button" className="club-details-button" onClick={() => setSelected(item)}>Xem chi tiết</button></div>
      </article>)}
    </div> : <p className="club-management-state">{search ? 'Không tìm thấy yêu cầu phù hợp.' : 'Chưa có yêu cầu nào trong danh sách này.'}</p>}
    {selected && <dialog open className="club-request-detail" aria-labelledby="club-detail-title">
      <button type="button" className="club-detail-close" aria-label="Đóng" onClick={() => setSelected(null)}>×</button>
      <span className={`club-request-status club-request-status-${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
      <h2 id="club-detail-title">{selected.name}</h2>
      {safePublicUrl(selected.logo_url) && <img className="club-detail-logo" src={safePublicUrl(selected.logo_url)} alt="Logo câu lạc bộ" />}
      {safePublicUrl(selected.cover_url) && <img className="club-detail-cover" src={safePublicUrl(selected.cover_url)} alt="Ảnh bìa câu lạc bộ" />}
      <dl><dt>Người thành lập</dt><dd>{selected.creator_name}</dd><dt>Ngày gửi</dt><dd>{publicDate(selected.created_at || undefined)}</dd><dt>Giới thiệu</dt><dd>{selected.summary || '—'}</dd><dt>Mô tả</dt><dd>{selected.description || '—'}</dd><dt>Sứ mệnh</dt><dd>{selected.mission || '—'}</dd><dt>Email</dt><dd>{selected.contact_email || '—'}</dd><dt>Điện thoại</dt><dd>{selected.contact_phone || '—'}</dd></dl>
      <div className="club-detail-actions">{selected.status === 'pending' && <><button type="button" className="club-reject-button" disabled={actionId === selected.club_id} onClick={() => void reject(selected)}>Từ chối</button><button type="button" className="club-details-button" disabled={actionId === selected.club_id} onClick={() => void approve(selected)}>{actionId === selected.club_id ? 'Đang xử lý…' : 'Đồng ý thành lập CLB'}</button></>}<button type="button" className="club-detail-close-action" onClick={() => setSelected(null)}>Đóng</button></div>
    </dialog>}
  </main>;
}
