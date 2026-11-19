import { Link, Navigate } from "react-router-dom";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import { usePersonalQuery } from "../personal/use-personal-query";
import { PersonalState } from "../personal/components/PersonalState";
import type { Membership, PrivatePage } from "../personal/services/personal-api";
import { WorkspaceRail } from "./WorkspaceRail";
import "./workspace.css";

/** The workspace entry renders the club shell immediately, then opens a joined club. */
export function WorkspaceHub({ viewer, accessToken = "", onLogout }: DiscoveryViewer) {
  const clubs = usePersonalQuery<PrivatePage<Membership>>(accessToken, "me/clubs?page=1&limit=24");
  const firstClub = clubs.data?.items[0];
  if (firstClub) return <Navigate replace to={`/workspace/${firstClub.club.club_id}/channels/general`} />;
  return <div className="cw-app cw-entry-app">
    <a className="cw-skip" href="#workspace-content">Đến nội dung</a>
    <WorkspaceRail viewer={viewer} clubs={[]} onLogout={onLogout} />
    <aside className="cw-sidebar cw-entry-sidebar">
      <div className="cw-club-identity"><div><strong>Không gian sinh hoạt</strong><small>{viewer?.displayName}</small></div></div>
      <nav aria-label="Điều hướng CLB"><p>Kênh · xem trước</p><span># thông-báo</span><span># thảo-luận</span><span># tài-liệu</span><span># hỏi-đáp</span><div className="cw-nav-separator" /><p>Công việc trong CLB</p><span>Viết bài</span><span>Hoạt động</span><span>Tạo họp định kỳ</span></nav>
    </aside>
    <div className="cw-workspace"><header className="cw-topbar"><span>Không gian sinh hoạt</span><span>{viewer?.displayName}</span></header>
      <main id="workspace-content" tabIndex={-1}><div className="cw-entry-state"><span className="cw-eyebrow">CLB của bạn</span><h1>{clubs.loading ? "Đang mở không gian…" : "Bắt đầu sinh hoạt cùng CLB"}</h1><PersonalState {...clubs} empty="Bạn chưa tham gia CLB nào." />{!clubs.loading && <div className="cw-actions"><Link className="cw-primary" to="/clubs">Khám phá CLB</Link><Link className="cw-link" to="/me/club-requests/new">Tạo CLB mới →</Link></div>}</div></main>
    </div>
    <aside className="cw-quick-panel" aria-label="Xem nhanh CLB"><div className="cw-quick-header"><span>Thông tin CLB</span></div><section className="cw-quick-section"><h2>Chưa có CLB để hiển thị</h2><p>Thông tin CLB, lịch họp và hoạt động sẽ xuất hiện ở đây khi bạn tham gia một CLB.</p></section></aside>
  </div>;
}
