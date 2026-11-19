import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { usePersonalQuery } from "../personal/use-personal-query";
import type { ClubMeeting, ContentItem, WorkspaceClub, WorkspaceList } from "./services/workspace-api";

function PanelDate({ value, year = false }: { value: string; year?: boolean }) {
  const date = new Date(value);
  return <time dateTime={value}><span className="cw-panel-date-day">{date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>{year && <small className="cw-panel-date-year">{date.getFullYear()}</small>}</time>;
}

export function WorkspaceQuickPanel({ club, token, chair, collapsed = false, onToggle }: { club: WorkspaceClub; token: string; chair: boolean; collapsed?: boolean; onToggle?: () => void }) {
  const location = useLocation();
  const [otherOpen, setOtherOpen] = useState(() => /\/(members|departments|information)$/.test(location.pathname));
  const activities = usePersonalQuery<WorkspaceList<ContentItem>>(token, `workspace/${club.club_id}/content/activities?list=published&page=1&limit=12`);
  const meetings = usePersonalQuery<WorkspaceList<ClubMeeting>>(token, `workspace/${club.club_id}/meetings?page=1&limit=24`);
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent).detail === club.club_id) meetings.retry(); };
    window.addEventListener('uc:workspace-meetings-changed', refresh);
    return () => window.removeEventListener('uc:workspace-meetings-changed', refresh);
  }, [club.club_id]);
  const sessions = (meetings.data?.items || []).flatMap(meeting => meeting.meeting_sessions.map(session => ({ ...session, title: meeting.title })))
    .filter(session => session.status === 'ongoing' || session.status === 'scheduled' && session.scheduled_start_at && Date.parse(session.scheduled_start_at) >= Date.now())
    .sort((a, b) => (a.scheduled_start_at || '').localeCompare(b.scheduled_start_at || '')).slice(0, 3);
  const upcoming = (activities.data?.items || []).filter(item => item.starts_at && Number.isFinite(Date.parse(item.starts_at)) && Date.parse(item.starts_at) >= Date.now()).sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!)).slice(0, 3);
  return <aside className="cw-quick-panel" aria-label="Xem nhanh CLB">
    <div className="cw-quick-header"><div hidden={collapsed}><span>Thông tin CLB</span><PanelDate value={new Date().toISOString()} year /></div><button className="cw-info-toggle" type="button" onClick={onToggle} aria-expanded={!collapsed} aria-controls="workspace-club-info" aria-label={collapsed ? 'Mở thông tin CLB' : 'Thu gọn thông tin CLB'} title={collapsed ? 'Mở thông tin CLB' : 'Thu gọn thông tin CLB'}>{collapsed ? '‹' : '›'}</button></div>
    <div id="workspace-club-info" hidden={collapsed}>
    <section className="cw-quick-section cw-quick-about"><h2>{club.name}</h2><p>{club.summary || "CLB chưa cập nhật phần giới thiệu ngắn."}</p></section>
    <section className="cw-quick-section"><div className="cw-quick-heading"><span aria-hidden="true">▦</span><h2>Lịch họp</h2></div>{meetings.loading ? <p>Đang tải lịch họp…</p> : meetings.error ? <><p role="alert">{meetings.error}</p><button onClick={meetings.retry}>Thử lại</button></> : sessions.length ? <ul>{sessions.map(session => <li key={session.session_id}>{session.scheduled_start_at ? <PanelDate value={session.scheduled_start_at} year /> : <span className="cw-meeting-live">Đang họp</span>}<Link to={`/workspace/${club.club_id}/meetings`}>{session.title}</Link></li>)}</ul> : <p>Chưa có buổi họp sắp tới.</p>}<Link to={`/workspace/${club.club_id}/meetings`}>Xem tất cả cuộc họp</Link></section>
    <section className="cw-quick-section"><div className="cw-quick-heading"><span aria-hidden="true">◷</span><h2>Hoạt động sắp tới</h2></div>{activities.loading ? <p>Đang tải hoạt động…</p> : activities.error ? <p>Chưa tải được hoạt động.</p> : upcoming.length ? <ul>{upcoming.map(item => <li key={item.activity_id}><PanelDate value={item.starts_at!} year={new Date(item.starts_at!).getFullYear() !== new Date().getFullYear()} /><span>{item.title}</span></li>)}</ul> : <p>Chưa có hoạt động sắp tới.</p>}</section>
    <details className="cw-quick-other" open={otherOpen} onToggle={event => setOtherOpen(event.currentTarget.open)}><summary>Khác</summary><nav aria-label="Mục khác của CLB"><NavLink to={`/workspace/${club.club_id}/members`}>Thành viên</NavLink>{chair && <NavLink to={`/workspace/${club.club_id}/departments`}>Cơ cấu CLB</NavLink>}{chair && <NavLink to={`/workspace/${club.club_id}/information`}>Thông tin CLB</NavLink>}<Link to={`/clubs/${club.club_id}`}>Trang CLB công khai ↗</Link></nav></details>
    </div>
  </aside>;
}
