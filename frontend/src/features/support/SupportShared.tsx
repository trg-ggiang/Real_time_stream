import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { categories, reportCode, reportDate, statuses, type SupportReport } from './support-api';
import { authFormHref } from '../auth/redirect';

export function SupportNavigation({ current, signedIn = true }: { current: string; signedIn?: boolean }) {
  return <><nav className="sp-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">{current}</span></nav>
    <nav className="sp-tabs" aria-label="Điều hướng hỗ trợ"><NavLink to="/help" end>Trợ giúp và hỗ trợ</NavLink><NavLink to="/report-issue">Báo cáo sự cố</NavLink>{signedIn && <NavLink to="/help/reports">Báo cáo của tôi</NavLink>}</nav></>;
}

export function ReportStatusBadge({ status }: { status: SupportReport['status'] }) {
  return <span className={`sp-status sp-status--${status}`}><span aria-hidden="true" />{statuses[status]}</span>;
}

export function SupportLogin({ returnTo }: { returnTo: string }) {
  return <section className="sp-card sp-login"><h2>Đăng nhập để tiếp tục</h2><p>Báo cáo sẽ được gắn với tài khoản để bạn theo dõi trạng thái và nhận phản hồi.</p><a className="sp-primary" href={authFormHref('login', returnTo)}>Đăng nhập</a><Link to="/help"><ArrowLeft size={16} aria-hidden="true" /> Xem hướng dẫn trợ giúp</Link></section>;
}

export function ReportContent({ report }: { report: SupportReport }) {
  return <article className="sp-report-content">
    <div className="sp-report-meta"><span className="sp-code">{reportCode(report.report_id)}</span><ReportStatusBadge status={report.status} /><span>{categories[report.category]}</span></div>
    <h2>{report.title}</h2><p className="sp-muted">Gửi lúc {reportDate(report.created_at)} · Cập nhật {reportDate(report.updated_at)}</p>
    <section><h3>Mô tả sự cố</h3><p className="sp-prewrap">{report.description}</p></section>
    {report.steps && <section><h3>Các bước gặp sự cố</h3><p className="sp-prewrap">{report.steps}</p></section>}
    {report.page_path && <section><h3>Trang xảy ra sự cố</h3><p className="sp-path">{report.page_path}</p></section>}
    <section className="sp-response"><h3>Phản hồi từ quản trị viên</h3><p className="sp-prewrap">{report.admin_response || 'Báo cáo đã được ghi nhận. Phản hồi sẽ xuất hiện tại đây khi quản trị viên cập nhật.'}</p></section>
  </article>;
}
