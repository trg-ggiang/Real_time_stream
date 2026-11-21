import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePersonalQuery } from '../../personal/use-personal-query';
import { PersonalState } from '../../personal/components/PersonalState';
import { AdminDialog, AdminPagination, adminDate, exportAdminCsv } from '../components/AdminTools';

interface Account { user_id: string; display_name: string; email: string; role: string | null; created_at: string; }
interface Accounts { items: Account[]; total: number; hasMore: boolean; }
interface Detail { account: Account; profile: Record<string, string | null> | null; memberships: { membership_id: string; club_id: string; club_name: string; role: string; status: string }[]; }
const memberRoles: Record<string, string> = { chairperson: 'Chủ nhiệm', department_head: 'Trưởng ban', member: 'Thành viên', vice_chairperson: 'Phó chủ nhiệm' };

function UserDetail({ token, id, onClose }: { token: string; id: string; onClose: () => void }) {
  const state = usePersonalQuery<Detail>(token, `admin/users/${id}`);
  return <AdminDialog title="Hồ sơ tài khoản" onClose={onClose}>{state.data ? <>
    <div className="ad-person-heading"><span className="ad-avatar">{state.data.account.display_name.slice(0, 1)}</span><div><h3>{state.data.account.display_name}</h3><p>{state.data.account.email}</p></div></div>
    <dl className="ad-meta"><dt>Quyền hệ thống</dt><dd>{state.data.account.role === 'admin' ? 'Admin tổng' : 'Người dùng'}</dd><dt>Ngày đăng ký</dt><dd>{adminDate(state.data.account.created_at)}</dd>
      {[['full_name', 'Họ tên'], ['student_code', 'Mã sinh viên'], ['school_or_faculty', 'Trường / khoa'], ['major', 'Ngành học'], ['cohort', 'Khóa'], ['phone', 'Điện thoại']].map(([key, label]) => <div className="ad-meta-pair" key={key}><dt>{label}</dt><dd>{state.data?.profile?.[key] || 'Chưa cung cấp'}</dd></div>)}
    </dl><h3>CLB tham gia</h3><div className="ad-membership-list">{state.data.memberships.length ? state.data.memberships.map(item => <div key={item.membership_id}><Link to={`/admin/clubs/${item.club_id}`} onClick={onClose}>{item.club_name}</Link><span>{memberRoles[item.role] || item.role} / {item.status === 'active' ? 'Đang tham gia' : item.status}</span></div>) : <p>Chưa tham gia CLB.</p>}</div>
  </> : <PersonalState {...state} showDiscoveryLink={false} />}</AdminDialog>;
}

export function AdminUsers({ token }: { token: string }) {
  const [params, setParams] = useSearchParams(), [selected, setSelected] = useState<string | null>(null);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page'))) || 1));
  const q = (params.get('q') || '').slice(0, 100), role = ['admin', 'user'].includes(params.get('role') || '') ? params.get('role')! : 'all';
  const state = usePersonalQuery<Accounts>(token, `admin/users?${new URLSearchParams({ q, role, page: String(page), limit: '8' })}`);
  const update = (values: Record<string, string>) => setParams({ q, role, ...values });
  return <>
    <div className="ad-heading"><div><h1>Tài khoản</h1><p>{state.data ? `${state.data.total} tài khoản trong hệ thống` : 'Danh sách tài khoản'}</p></div><div className="ad-actions"><button disabled={!state.data?.items.length} onClick={() => exportAdminCsv('tai-khoan-trang-' + page + '.csv', [['Tên', 'Email', 'Quyền', 'Ngày đăng ký'], ...state.data!.items.map(item => [item.display_name, item.email, item.role === 'admin' ? 'Admin tổng' : 'Người dùng', adminDate(item.created_at)])])}>Xuất trang CSV</button><button onClick={state.retry} disabled={state.loading}>Tải lại</button></div></div>
    <section className="ad-panel ad-data-panel"><form className="ad-filterbar" key={`${q}:${role}`} onSubmit={event => { event.preventDefault(); update({ q: String(new FormData(event.currentTarget).get('q') || '').trim(), page: '1' }); }}>
      <label>Tìm tài khoản<input name="q" maxLength={100} defaultValue={q} placeholder="Tên hoặc email" /></label><label>Quyền hệ thống<select value={role} onChange={event => update({ role: event.target.value, page: '1' })}><option value="all">Tất cả</option><option value="admin">Admin tổng</option><option value="user">Người dùng</option></select></label><button className="ad-primary" type="submit">Tìm kiếm</button>{q && <button type="button" onClick={() => update({ q: '', page: '1' })}>Xóa tìm kiếm</button>}
    </form>
    {state.data?.items.length ? <div className="ad-table-scroll"><table className="ad-table"><thead><tr><th scope="col">Tài khoản</th><th scope="col">Quyền hệ thống</th><th scope="col">Ngày đăng ký</th><th scope="col"><span className="ad-sr-only">Thao tác</span></th></tr></thead><tbody>{state.data.items.map(item => <tr key={item.user_id}><td><div className="ad-person-cell"><span className="ad-avatar">{item.display_name.slice(0, 1)}</span><div><strong>{item.display_name}</strong><span>{item.email}</span></div></div></td><td><span className={`ad-status ${item.role === 'admin' ? 'published' : 'neutral'}`}>{item.role === 'admin' ? 'Admin tổng' : 'Người dùng'}</span></td><td>{adminDate(item.created_at)}</td><td><button onClick={() => setSelected(item.user_id)}>Xem hồ sơ</button></td></tr>)}</tbody></table></div> : <PersonalState {...state} showDiscoveryLink={false} empty="Không tìm thấy tài khoản phù hợp." />}
    </section><AdminPagination page={page} hasMore={state.data?.hasMore} loading={state.loading} onPage={value => update({ page: String(value) })} />
    {selected && <UserDetail key={selected} token={token} id={selected} onClose={() => setSelected(null)} />}
  </>;
}
