import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { accountRequest } from '../../../shared/api/account-http';
import { usePersonalQuery } from '../../personal/use-personal-query';
import { categories, reportCode, reportDate, statuses, type ReportPage, type ReportStatus, type SupportReport } from '../../support/support-api';
import { ReportContent, ReportStatusBadge } from '../../support/SupportShared';
import '../../support/support.css';

export function AdminSupport({ token }: { token: string }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page'))) || 1));
  const status = Object.hasOwn(statuses, params.get('status') || '') ? params.get('status')! : 'all';
  const category = Object.hasOwn(categories, params.get('category') || '') ? params.get('category')! : 'all';
  const q = (params.get('q') || '').slice(0, 100);
  const state = usePersonalQuery<ReportPage>(token, `admin/support-reports?${new URLSearchParams({ page: String(page), status, category, q, limit: '10' })}`);
  const update = (values: Record<string, string>) => setParams({ status, category, q, page: '1', ...values });
  return <div className="ad-support"><header className="ad-heading"><div><span className="sp-eyebrow">TRUNG TÂM TIẾP NHẬN</span><h1>Báo cáo sự cố</h1><p>Theo dõi vấn đề người dùng gặp phải và phản hồi ngay trong hệ thống.</p></div><button type="button" onClick={state.retry} disabled={state.loading}>Tải lại</button></header>
    <section className="ad-panel ad-data-panel"><form className="ad-filterbar sp-admin-filters" key={`${q}:${status}:${category}`} onSubmit={event => { event.preventDefault(); update({ q: String(new FormData(event.currentTarget).get('q') || '').trim() }); }}>
      <label>Tìm báo cáo<input name="q" defaultValue={q} maxLength={100} placeholder="Tìm theo tiêu đề sự cố" /></label><label>Trạng thái<select value={status} onChange={event => update({ status: event.target.value })}><option value="all">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><label>Nhóm sự cố<select value={category} onChange={event => update({ category: event.target.value })}><option value="all">Tất cả nhóm</option>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><button className="ad-primary" type="submit">Tìm kiếm</button>
    </form>
    {state.error ? <div className="sp-error" role="alert"><p>{state.error}</p><button type="button" onClick={state.retry}>Thử lại</button></div> : state.loading ? <p className="sp-admin-state" role="status">Đang tải báo cáo…</p> : state.data?.items.length ? <><div className="sp-admin-summary"><span>{state.data.total} báo cáo phù hợp</span><span>Mới nhất trước</span></div><div className="ad-table-scroll"><table className="ad-table sp-admin-table"><thead><tr><th scope="col">Báo cáo</th><th scope="col">Người gửi</th><th scope="col">Trạng thái</th><th scope="col">Ngày gửi</th><th scope="col"><span className="ad-sr-only">Thao tác</span></th></tr></thead><tbody>{state.data.items.map(item => <tr key={item.report_id}><td><span className="sp-code">{reportCode(item.report_id)}</span><strong>{item.title}</strong><small>{categories[item.category]}{item.priority === 'high' ? ' · Ảnh hưởng nhiều' : ''}</small></td><td><strong>{item.reporter?.display_name || 'Tài khoản đã xóa'}</strong><small>{item.reporter?.email}</small></td><td><ReportStatusBadge status={item.status} /></td><td>{reportDate(item.created_at)}</td><td><Link className="sp-admin-detail-link" to={`/admin/support-reports/${item.report_id}`}>Xem và xử lý</Link></td></tr>)}</tbody></table></div><nav className="sp-pagination" aria-label="Phân trang báo cáo"><button type="button" disabled={page === 1} onClick={() => update({ page: String(page - 1) })}>Trang trước</button><span>Trang {page}</span><button type="button" disabled={!state.data.hasMore} onClick={() => update({ page: String(page + 1) })}>Trang sau</button></nav></> : <div className="sp-empty"><ClipboardText size={34} aria-hidden="true" /><h2>Chưa có báo cáo phù hợp</h2><p>Báo cáo mới từ người dùng sẽ xuất hiện tại đây.</p>{(status !== 'all' || category !== 'all' || q) && <button type="button" onClick={() => setParams({})}>Xóa bộ lọc</button>}</div>}
    </section></div>;
}

function ReportEditor({ token, report, onSaved, onReload }: { token: string; report: SupportReport; onSaved: (item: SupportReport) => void; onReload: () => void }) {
  const [status, setStatus] = useState<ReportStatus>(report.status), [priority, setPriority] = useState(report.priority);
  const [response, setResponse] = useState(report.admin_response), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const closing = status === 'resolved' || status === 'rejected';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (request.current) return;
    if (closing && response.trim().length < 10) { setError('Nhập phản hồi ít nhất 10 ký tự trước khi đóng báo cáo.'); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await accountRequest<{ item: SupportReport }>(token, `admin/support-reports/${report.report_id}`, {
        method: 'PATCH', signal: controller.signal, body: JSON.stringify({ status, priority, admin_response: response.trim(), expected_updated_at: report.updated_at }),
      });
      if (!controller.signal.aborted) onSaved(result.item);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Chưa cập nhật được báo cáo.'); }
    finally { if (request.current === controller) request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <form className="ad-panel sp-admin-editor" aria-label="Xử lý báo cáo" onSubmit={submit}><div className="sp-section-heading"><h2>Xử lý báo cáo</h2></div><fieldset disabled={busy}><legend className="ad-sr-only">Cập nhật trạng thái và phản hồi</legend><label htmlFor="report-status">Trạng thái xử lý</label><select id="report-status" value={status} onChange={event => setStatus(event.target.value as ReportStatus)}>{Object.entries(statuses).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select><label htmlFor="admin-priority">Mức độ ưu tiên</label><select id="admin-priority" value={priority} onChange={event => setPriority(event.target.value as SupportReport['priority'])}><option value="normal">Thông thường</option><option value="high">Ưu tiên cao</option></select><label htmlFor="admin-response">Phản hồi cho người gửi{closing ? ' *' : ''}</label><textarea id="admin-response" value={response} onChange={event => setResponse(event.target.value)} rows={7} maxLength={3000} required={closing} minLength={closing ? 10 : undefined} placeholder="Mô tả kết quả kiểm tra, hướng xử lý hoặc thông tin cần người gửi bổ sung…" aria-describedby="response-hint" /><p id="response-hint" className="sp-field-hint">Người gửi sẽ đọc được nội dung này trong báo cáo của họ.</p></fieldset>{error && <div className="sp-error" role="alert"><p>{error}</p><button type="button" onClick={onReload}>Tải lại báo cáo</button></div>}<button className="ad-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu cập nhật'}</button></form>;
}

export function AdminSupportDetail({ token }: { token: string }) {
  const { id = '' } = useParams();
  return <AdminReportDetail key={id} token={token} id={id} />;
}
function AdminReportDetail({ token, id }: { token: string; id: string }) {
  const state = usePersonalQuery<{ item: SupportReport }>(token, `admin/support-reports/${encodeURIComponent(id)}`);
  const [saved, setSaved] = useState<SupportReport | null>(null), [notice, setNotice] = useState('');
  const report = saved ?? state.data?.item;
  const reload = () => { setSaved(null); setNotice(''); state.retry(); };
  return <div className="ad-support"><Link className="sp-back" to="/admin/support-reports"><ArrowLeft size={17} aria-hidden="true" /> Tất cả báo cáo</Link><header className="ad-heading"><div><h1>Chi tiết báo cáo</h1><p>Kiểm tra nội dung và cập nhật kết quả xử lý cho người gửi.</p></div><button type="button" onClick={reload} disabled={state.loading}>Tải lại</button></header>{notice && <p className="sp-admin-success" role="status"><CheckCircle size={20} aria-hidden="true" />{notice}</p>}{report ? <div className="sp-admin-detail-grid"><div className="ad-panel"><div className="sp-reporter"><span className="ad-avatar">{report.reporter?.display_name.slice(0, 1) || '?'}</span><div><strong>{report.reporter?.display_name || 'Tài khoản đã xóa'}</strong><span>{report.reporter?.email}</span></div></div><ReportContent report={report} /></div><ReportEditor key={report.updated_at} token={token} report={report} onReload={reload} onSaved={item => { setSaved(item); setNotice('Đã lưu trạng thái và phản hồi cho người gửi.'); }} /></div> : state.error ? <div className="ad-panel sp-error" role="alert"><p>{state.error}</p><button type="button" onClick={reload}>Thử lại</button></div> : <p role="status">Đang tải chi tiết báo cáo…</p>}</div>;
}
