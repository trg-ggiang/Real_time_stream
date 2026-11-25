import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { usePersonalQuery } from '../personal/use-personal-query';
import { categories, reportCode, reportDate, statuses, type ReportPage, type SupportReport } from './support-api';
import { ReportContent, ReportStatusBadge, SupportLogin, SupportNavigation } from './SupportShared';

function MyReportDetail({ token, id }: { token: string; id: string }) {
  const state = usePersonalQuery<{ item: SupportReport }>(token, `support/reports/${encodeURIComponent(id)}`);
  return <><Link className="sp-back" to="/help/reports"><ArrowLeft size={17} aria-hidden="true" /> Tất cả báo cáo của tôi</Link><section className="sp-card">{state.data ? <ReportContent report={state.data.item} /> : state.error ? <div className="sp-error" role="alert"><p>{state.error}</p><button type="button" onClick={state.retry}>Thử lại</button></div> : <p role="status">Đang tải báo cáo…</p>}</section></>;
}

function MyReportList({ token }: { token: string }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page'))) || 1));
  const status = Object.hasOwn(statuses, params.get('status') || '') ? params.get('status')! : 'all';
  const state = usePersonalQuery<ReportPage>(token, `support/reports?${new URLSearchParams({ page: String(page), status, limit: '10' })}`);
  return <><div className="sp-list-toolbar"><label>Lọc trạng thái<select value={status} onChange={event => setParams({ status: event.target.value, page: '1' })}><option value="all">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><button type="button" onClick={state.retry} disabled={state.loading}>Tải lại</button></div>
    {state.error ? <div className="sp-error" role="alert"><p>{state.error}</p><button type="button" onClick={state.retry}>Thử lại</button></div> : state.loading ? <p className="sp-card" role="status">Đang tải báo cáo của bạn…</p> : state.data?.items.length ? <><div className="sp-my-reports">{state.data.items.map(item => <Link className="sp-card sp-report-row" key={item.report_id} to={`/help/reports/${item.report_id}`}><div><div className="sp-report-meta"><span className="sp-code">{reportCode(item.report_id)}</span><span>{categories[item.category]}</span></div><h2>{item.title}</h2><p>Gửi {reportDate(item.created_at)}</p></div><div><ReportStatusBadge status={item.status} /><span className="sp-row-action">Xem chi tiết <ArrowRight size={16} aria-hidden="true" /></span></div></Link>)}</div><nav className="sp-pagination" aria-label="Phân trang báo cáo"><button disabled={page === 1 || state.loading} onClick={() => setParams({ status, page: String(page - 1) })}>Trang trước</button><span>Trang {page} · {state.data.total} báo cáo</span><button disabled={!state.data.hasMore || state.loading} onClick={() => setParams({ status, page: String(page + 1) })}>Trang sau</button></nav></> : <section className="sp-card sp-empty"><ClipboardText size={36} aria-hidden="true" /><h2>{status === 'all' ? 'Bạn chưa gửi báo cáo nào' : 'Chưa có báo cáo ở trạng thái này'}</h2><p>Khi cần hỗ trợ, bạn có thể gửi sự cố và theo dõi phản hồi tại đây.</p><Link className="sp-primary" to="/report-issue">Tạo báo cáo mới</Link></section>}
  </>;
}

export function MyReportsPage({ token }: { token?: string }) {
  const { id } = useParams();
  return <div className="uc-support"><div className="dc-container sp-container"><SupportNavigation current="Báo cáo của tôi" signedIn={!!token} /><header className="sp-page-heading sp-page-heading--row"><div><span className="sp-eyebrow">THEO DÕI HỖ TRỢ</span><h1>Báo cáo của tôi</h1><p>Xem trạng thái và phản hồi cho những vấn đề bạn đã gửi.</p></div><Link className="sp-primary" to="/report-issue"><Plus size={18} aria-hidden="true" />Báo cáo mới</Link></header>{!token ? <SupportLogin returnTo={id ? `/help/reports/${id}` : '/help/reports'} /> : id ? <MyReportDetail token={token} id={id} /> : <MyReportList token={token} />}</div></div>;
}
