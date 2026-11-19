import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { usePersonalQuery } from "../personal/use-personal-query";
import type { ContentItem, WorkspaceClub, WorkspaceList } from "./services/workspace-api";

export function WorkspaceQuickPanel({ club, token, chair }: { club: WorkspaceClub; token: string; chair: boolean }) {
  const location = useLocation();
  const [otherOpen, setOtherOpen] = useState(() => /\/(members|departments|information)$/.test(location.pathname));
  const activities = usePersonalQuery<WorkspaceList<ContentItem>>(token, `workspace/${club.club_id}/content/activities?list=published&page=1&limit=12`);
  const upcoming = (activities.data?.items || []).filter(item => item.starts_at && Number.isFinite(Date.parse(item.starts_at)) && Date.parse(item.starts_at) >= Date.now()).sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!)).slice(0, 3);
  return <aside className="cw-quick-panel" aria-label="Xem nhanh CLB">
    <div className="cw-quick-header"><span>Thông tin CLB</span><time dateTime={new Date().toISOString().slice(0, 10)}>{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</time></div>
    <section className="cw-quick-section cw-quick-about"><h2>{club.name}</h2><p>{club.summary || "CLB chưa cập nhật phần giới thiệu ngắn."}</p></section>
    <section className="cw-quick-section"><div className="cw-quick-heading"><span aria-hidden="true">▦</span><h2>Lịch họp</h2></div><p>Lịch họp của CLB chưa được đồng bộ. Khi có lịch, các buổi họp sắp tới sẽ hiện tại đây.</p></section>
    <section className="cw-quick-section"><div className="cw-quick-heading"><span aria-hidden="true">◷</span><h2>Hoạt động sắp tới</h2></div>{activities.loading ? <p>Đang tải hoạt động…</p> : activities.error ? <p>Chưa tải được hoạt động.</p> : upcoming.length ? <ul>{upcoming.map(item => <li key={item.activity_id}><time dateTime={item.starts_at}>{new Date(item.starts_at!).toLocaleDateString("vi-VN", { day: "numeric", month: "short" })}</time><span>{item.title}</span></li>)}</ul> : <p>Chưa có hoạt động sắp tới.</p>}</section>
    <details className="cw-quick-other" open={otherOpen} onToggle={event => setOtherOpen(event.currentTarget.open)}><summary>Khác</summary><nav aria-label="Mục khác của CLB"><NavLink to={`/workspace/${club.club_id}/members`}>Thành viên</NavLink>{chair && <NavLink to={`/workspace/${club.club_id}/departments`}>Cơ cấu CLB</NavLink>}{chair && <NavLink to={`/workspace/${club.club_id}/information`}>Thông tin CLB</NavLink>}<Link to={`/clubs/${club.club_id}`}>Trang CLB công khai ↗</Link></nav></details>
  </aside>;
}
