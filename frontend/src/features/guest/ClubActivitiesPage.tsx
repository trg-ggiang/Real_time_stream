import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { publicDate, safePublicUrl } from './public-content';
import './club-activities.css';

type Club = { club_id: string; name: string; summary?: string; role: string };
type Activity = {
  activity_id: string; title: string; summary: string; description: string;
  starts_at: string; ends_at: string; format: string; location_name?: string; location_address?: string;
  join_url?: string; author_name?: string; review_note?: string; publication_status: string;
};
type Tab = 'published' | 'mine' | 'review';
type ReviewFilter = 'pending_review' | 'approved' | 'rejected';
const statusNames: Record<string, string> = { pending_review: 'Chờ duyệt', published: 'Đã công khai', rejected: 'Đã từ chối' };
const formats: Record<string, string> = { onsite: 'Trực tiếp', online: 'Trực tuyến', hybrid: 'Kết hợp' };
const apiBase = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');

function newActivityId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function clubRequest<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}/api/my-clubs${path}`, {
    ...options, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(options?.body && { 'Content-Type': 'application/json' }) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const message = result?.message;
    throw new Error(typeof message === 'string' ? message : 'Không thực hiện được thao tác. Vui lòng thử lại.');
  }
  return result;
}

function ActivityDialog({ title, busy, close, children }: { title: string; busy: boolean; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="guest-dialog club-activity-dialog" aria-labelledby="club-activity-dialog-title"
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <button type="button" className="guest-dialog-close" aria-label="Đóng" onClick={close} disabled={busy}>×</button>
    <h2 id="club-activity-dialog-title">{title}</h2>
    {children}
  </dialog>;
}

function CreateActivityDialog({ club, token, close, done }: {
  club: Club; token: string; close: () => void; done: (item: Activity) => void;
}) {
  const [format, setFormat] = useState('onsite');
  const id = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chairperson = club.role === 'chairperson';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? '').trim();
    const start = value('starts_at');
    const end = value('ends_at');
    if (end <= start) { setError('Thời gian kết thúc phải sau thời gian bắt đầu.'); return; }
    setBusy(true);
    setError('');
    try {
      id.current ??= newActivityId();
      const body = {
        activity_id: id.current, title: value('title'), summary: value('summary'), description: value('description'),
        starts_at: `${start}+07:00`, ends_at: `${end}+07:00`, format,
        location_name: value('location_name') || undefined, location_address: value('location_address') || undefined,
        join_url: value('join_url') || undefined,
      };
      const result = await clubRequest<{ item: Activity }>(token, `/${club.club_id}/activities`, {
        method: 'POST', body: JSON.stringify(body),
      });
      done(result.item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được hoạt động.');
    } finally {
      setBusy(false);
    }
  }

  return <ActivityDialog title="Tạo hoạt động" busy={busy} close={close}>
    <p className="club-activity-muted">{club.name}</p>
    <form onSubmit={event => void submit(event)}>
      <fieldset disabled={busy} className="club-activity-form">
        <label>Tiêu đề<input name="title" required minLength={2} maxLength={120} /></label>
        <label>Tóm tắt<input name="summary" required minLength={10} maxLength={300} /></label>
        <label>Mô tả<textarea name="description" required minLength={10} maxLength={5000} rows={4} /></label>
        <div className="club-activity-times">
          <label>Bắt đầu (giờ Việt Nam)<input name="starts_at" type="datetime-local" required /></label>
          <label>Kết thúc (giờ Việt Nam)<input name="ends_at" type="datetime-local" required /></label>
        </div>
        <label>Hình thức<select name="format" value={format} onChange={event => setFormat(event.target.value)}>
          {Object.entries(formats).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        {format !== 'online' && <>
          <label>Tên địa điểm<input name="location_name" required maxLength={200} /></label>
          <label>Địa chỉ<input name="location_address" maxLength={300} /></label>
        </>}
        {format !== 'onsite' && <label>Đường dẫn trực tuyến<input name="join_url" type="url" required maxLength={2048} /></label>}
        {error && <p role="alert">{error}</p>}
        <div className="club-activity-actions">
          <button type="button" className="guest-secondary" onClick={close}>Hủy</button>
          <button className="guest-primary" type="submit">{busy ? 'Đang lưu…' : chairperson ? 'Đăng hoạt động' : 'Gửi duyệt'}</button>
        </div>
      </fieldset>
    </form>
  </ActivityDialog>;
}

function ClubActivityWorkspace({ club, token, onPublished }: { club: Club; token: string; onPublished: () => void }) {
  const chairperson = club.role === 'chairperson';
  const [tab, setTab] = useState<Tab>('published');
  const [filter, setFilter] = useState<ReviewFilter>('pending_review');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Activity[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const list = tab === 'review' ? filter : tab;
  const path = `/${club.club_id}/activities`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void clubRequest<{ items: Activity[]; hasMore: boolean }>(token, `${path}?list=${list}&page=${page}`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setItems(result.items);
        setHasMore(result.hasMore);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, path, list, page, revision]);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  function openDetail(item: Activity) {
    setReviewError('');
    setRejecting(false);
    setDetail(item);
  }

  async function review(action: 'approve' | 'reject', reason?: string) {
    if (!detail) return;
    setReviewError('');
    setReviewBusy(true);
    try {
      await clubRequest(token, `${path}/${detail.activity_id}/${action}`, {
        method: 'PATCH', body: reason === undefined ? undefined : JSON.stringify({ reason }),
      });
      setDetail(null);
      setPage(1);
      setRevision(value => value + 1);
      setNotice(action === 'approve' ? 'Đã duyệt và công khai hoạt động.' : 'Đã từ chối hoạt động.');
      if (action === 'approve') onPublished();
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : 'Không lưu được quyết định xét duyệt.');
    } finally {
      setReviewBusy(false);
    }
  }

  return <>
    <a className="guest-text-action" href="#my-clubs">← CLB của tôi</a>
    <header className="club-activity-heading">
      <div><h1>{club.name}</h1><p>{chairperson ? 'Chủ nhiệm' : 'Thành viên'}</p></div>
      <button className="guest-primary" onClick={() => { setNotice(''); setCreating(true); }}>Tạo hoạt động</button>
    </header>
    <nav className="club-activity-tabs" aria-label="Hoạt động CLB">
      <button aria-pressed={tab === 'published'} onClick={() => changeTab('published')}>Hoạt động</button>
      <button aria-pressed={tab === 'mine'} onClick={() => changeTab('mine')}>Đề xuất của tôi</button>
      {chairperson && <button aria-pressed={tab === 'review'} onClick={() => { setFilter('pending_review'); changeTab('review'); }}>Xét duyệt</button>}
    </nav>
    {tab === 'review' && <label className="club-activity-filter">Trạng thái <select value={filter}
      onChange={event => { setFilter(event.target.value as ReviewFilter); setPage(1); }}>
      <option value="pending_review">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Đã từ chối</option>
    </select></label>}
    {notice && <p className="club-activity-notice" role="status">{notice}</p>}
    {loading ? <p role="status">Đang tải hoạt động…</p> : error ? <p role="alert">{error}{' '}
      <button className="guest-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p> :
      <>
        {items.length === 0 && <p className="guest-empty">Chưa có hoạt động trong mục này.</p>}
        <div className="club-activity-list">{items.map(item => <article key={item.activity_id}>
          <div><h2><button onClick={() => openDetail(item)}>{item.title}</button></h2>
            <p>{item.summary}</p><p className="club-activity-muted">{publicDate(item.starts_at)}
              {item.author_name && ` · Người gửi: ${item.author_name}`}</p></div>
          <span className="club-activity-status">{statusNames[item.publication_status]}</span>
        </article>)}</div>
        {(page > 1 || hasMore) && <div className="club-activity-actions">
          <button className="guest-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trang trước</button>
          <button className="guest-secondary" disabled={!hasMore} onClick={() => setPage(value => value + 1)}>Trang sau</button>
        </div>}
      </>}
    {creating && <CreateActivityDialog club={club} token={token} close={() => setCreating(false)} done={item => {
      const published = item.publication_status === 'published';
      setCreating(false);
      changeTab(published ? 'published' : 'mine');
      setRevision(value => value + 1);
      setNotice(published ? 'Đã công khai hoạt động.' : 'Đã gửi hoạt động để chủ nhiệm xét duyệt.');
      if (published) onPublished();
    }} />}
    {detail && <ActivityDialog title={detail.title} busy={reviewBusy} close={() => setDetail(null)}>
      {detail.author_name && <p>Người gửi: {detail.author_name}</p>}
      <p>{detail.summary}</p><p className="guest-long-text">{detail.description}</p>
      <dl className="guest-metadata">
        <dt>Bắt đầu</dt><dd>{publicDate(detail.starts_at)}</dd>
        <dt>Kết thúc</dt><dd>{publicDate(detail.ends_at)}</dd>
        <dt>Hình thức</dt><dd>{formats[detail.format] ?? detail.format}</dd>
        {detail.location_name && <><dt>Địa điểm</dt><dd>{[detail.location_name, detail.location_address].filter(Boolean).join(', ')}</dd></>}
        {safePublicUrl(detail.join_url) && <><dt>Trực tuyến</dt><dd><a href={safePublicUrl(detail.join_url)} target="_blank" rel="noreferrer">Mở đường dẫn</a></dd></>}
        <dt>Trạng thái</dt><dd>{statusNames[detail.publication_status]}</dd>
        {detail.publication_status === 'rejected' && detail.review_note && <><dt>Lý do từ chối</dt><dd>{detail.review_note}</dd></>}
      </dl>
      {reviewError && <p role="alert">{reviewError}</p>}
      {chairperson && tab === 'review' && detail.publication_status === 'pending_review' &&
        (rejecting ? <form onSubmit={event => {
          event.preventDefault();
          void review('reject', String(new FormData(event.currentTarget).get('reason') ?? '').trim());
        }}>
          <fieldset disabled={reviewBusy} className="club-activity-form">
            <label>Lý do từ chối<textarea name="reason" required rows={3} maxLength={1000} /></label>
            <div className="club-activity-actions">
              <button type="button" className="guest-secondary" onClick={() => setRejecting(false)}>Quay lại</button>
              <button className="guest-primary" type="submit">Xác nhận từ chối</button>
            </div>
          </fieldset>
        </form> : <div className="club-activity-actions">
          <button className="guest-secondary" disabled={reviewBusy} onClick={() => setRejecting(true)}>Từ chối</button>
          <button className="guest-primary" disabled={reviewBusy} onClick={() => void review('approve')}>Duyệt và công khai</button>
        </div>)}
    </ActivityDialog>}
  </>;
}

export function ClubActivitiesPage({ clubId, token, onPublished }: { clubId?: string; token: string; onPublished: () => void }) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void clubRequest<{ items: Club[] }>(token, '', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setClubs(result.items); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);
  const selected = clubs.find(club => club.club_id === clubId);
  return <main id="guest-content" className="club-activity-page">
    {loading ? <p role="status">Đang tải CLB của bạn…</p> : error ? <p role="alert">{error}{' '}
      <button className="guest-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p> :
      selected ? <ClubActivityWorkspace key={selected.club_id} club={selected} token={token} onPublished={onPublished} /> :
      <>
        <h1>CLB của tôi</h1>
        {clubId && <p role="alert">Bạn không có quyền mở CLB này.</p>}
        {!clubs.length && <p className="guest-empty">Bạn chưa tham gia CLB nào đang hoạt động.</p>}
        <div className="club-activity-list">{clubs.map(club => <article key={club.club_id}>
          <div><h2><a href={`#my-clubs/${club.club_id}`}>{club.name}</a></h2><p>{club.summary}</p></div>
          <span className="club-activity-status">{club.role === 'chairperson' ? 'Chủ nhiệm' : 'Thành viên'}</span>
        </article>)}</div>
      </>}
  </main>;
}
