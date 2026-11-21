import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePersonalQuery } from '../../personal/use-personal-query';
import { PersonalState } from '../../personal/components/PersonalState';
import { ContentImage } from '../../discovery/components/PublicContent';
import { AdminDialog, AdminPagination, adminDate } from '../components/AdminTools';

interface Item { id: string; title: string; summary: string; body?: string; cover_url: string | null; publication_status: string; visibility?: string; updated_at: string; starts_at?: string; ends_at?: string; location_name?: string; review_note?: string; club?: { club_id: string; name: string; status: string } | null; }
const statuses: Record<string, string> = { all: 'Tất cả trạng thái', draft: 'Bản nháp', pending_review: 'Chờ duyệt', published: 'Đã đăng', rejected: 'Đã từ chối', changes_requested: 'Cần chỉnh sửa', archived: 'Đã lưu trữ' };

function ContentDetail({ token, kind, id, onClose }: { token: string; kind: string; id: string; onClose: () => void }) {
  const state = usePersonalQuery<{ item: Item }>(token, `admin/content/${kind}/${id}`), item = state.data?.item;
  return <AdminDialog title={item?.title || 'Chi tiết nội dung'} onClose={onClose}>{item ? <>
    {item.cover_url && <ContentImage src={item.cover_url} alt="" className="ad-dialog-cover" />}
    <span className={`ad-status ${item.publication_status}`}>{statuses[item.publication_status] || 'Chưa xác định'}</span>
    <p className="ad-content-body">{item.body || item.summary}</p>
    {item.starts_at && <dl className="ad-meta"><dt>Bắt đầu</dt><dd>{adminDate(item.starts_at)}</dd><dt>Kết thúc</dt><dd>{adminDate(item.ends_at)}</dd><dt>Địa điểm</dt><dd>{item.location_name || 'Chưa cung cấp'}</dd></dl>}
    {item.review_note && <div className="ad-review-note"><h3>Phản hồi xét duyệt</h3><p>{item.review_note}</p></div>}
  </> : <PersonalState {...state} showDiscoveryLink={false} />}</AdminDialog>;
}

export function AdminContent({ token }: { token: string }) {
  const [params, setParams] = useSearchParams(), [selected, setSelected] = useState<string | null>(null);
  const kind = params.get('kind') === 'activities' ? 'activities' : 'posts';
  const status = Object.hasOwn(statuses, params.get('status') || '') ? params.get('status')! : 'all';
  const q = (params.get('q') || '').slice(0, 100), page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page'))) || 1));
  const state = usePersonalQuery<{ items: Item[]; total: number; hasMore: boolean }>(token, `admin/content?${new URLSearchParams({ kind, status, q, page: String(page), limit: '8' })}`);
  const update = (values: Record<string, string>) => { setSelected(null); setParams({ kind, status, q, ...values }); };
  return <>
    <div className="ad-heading"><div><h1>Nội dung cộng đồng</h1><p>{state.data ? `${state.data.total} ${kind === 'posts' ? 'bài viết' : 'hoạt động'}` : 'Tra cứu nội dung toàn hệ thống'}</p></div><button onClick={state.retry} disabled={state.loading}>Tải lại</button></div>
    <nav className="ad-tabs" aria-label="Loại nội dung"><Link to="/admin/content?kind=posts" aria-current={kind === 'posts' ? 'page' : undefined}>Bài viết</Link><Link to="/admin/content?kind=activities" aria-current={kind === 'activities' ? 'page' : undefined}>Hoạt động</Link></nav>
    <section className="ad-panel ad-data-panel"><form className="ad-filterbar" key={`${kind}:${q}:${status}`} onSubmit={event => { event.preventDefault(); update({ q: String(new FormData(event.currentTarget).get('q') || '').trim(), page: '1' }); }}><label>Tìm nội dung<input name="q" defaultValue={q} maxLength={100} placeholder="Tên bài viết hoặc hoạt động" /></label><label>Trạng thái<select value={status} onChange={event => update({ status: event.target.value, page: '1' })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="ad-primary" type="submit">Tìm kiếm</button>{q && <button type="button" onClick={() => update({ q: '', page: '1' })}>Xóa tìm kiếm</button>}</form>
    {state.data?.items.length ? <div className="ad-table-scroll"><table className="ad-table"><thead><tr><th scope="col">Nội dung</th><th scope="col">CLB</th><th scope="col">Trạng thái</th><th scope="col">Cập nhật</th><th scope="col"><span className="ad-sr-only">Thao tác</span></th></tr></thead><tbody>{state.data.items.map(item => <tr key={item.id}><td><div className="ad-content-cell"><ContentImage src={item.cover_url} alt="" /><div><strong>{item.title}</strong><span>{item.summary}</span></div></div></td><td>{item.club ? <Link to={`/admin/clubs/${item.club.club_id}`}>{item.club.name}</Link> : 'Chưa có thông tin'}</td><td><span className={`ad-status ${item.publication_status}`}>{statuses[item.publication_status] || 'Chưa xác định'}</span></td><td>{adminDate(item.updated_at)}</td><td><button onClick={() => setSelected(item.id)}>Xem chi tiết</button>{item.publication_status === 'published' && item.club?.status === 'published' && (kind === 'activities' || item.visibility === 'public') && <Link className="ad-public-link" to={`/${kind}/${item.id}`}>Trang công khai</Link>}</td></tr>)}</tbody></table></div> : <PersonalState {...state} showDiscoveryLink={false} empty="Không có nội dung phù hợp." />}</section>
    <AdminPagination page={page} hasMore={state.data?.hasMore} loading={state.loading} onPage={value => update({ page: String(value) })} />
    {selected && <ContentDetail key={`${kind}:${selected}`} token={token} kind={kind} id={selected} onClose={() => setSelected(null)} />}
  </>;
}
