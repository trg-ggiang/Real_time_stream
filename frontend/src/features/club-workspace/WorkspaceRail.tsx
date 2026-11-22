import { useState } from "react";
import { Link } from "react-router-dom";
import { ContentImage } from "../discovery/components/PublicContent";
import { safePublicUrl } from "../../shared/lib/content-format";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import type { WorkspaceAttention } from './services/workspace-api';

export interface RailClub { id: string; name: string; logoUrl?: string | null }

export function WorkspaceRail({ viewer, clubs, currentId, onLogout, attention = {} }: {
  viewer?: { displayName: string; avatarUrl?: string | null };
  clubs: RailClub[];
  currentId?: string;
  onLogout?: () => void;
  attention?: Record<string, WorkspaceAttention>;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = safePublicUrl(viewer?.avatarUrl);
  return <aside className="cw-club-rail" aria-label="CLB đã tham gia">
    <Link className="cw-rail-home" to="/" aria-label="Trang chủ" title="Trang chủ"><House size={23} weight="fill" aria-hidden="true" /></Link>
    <span className="cw-rail-divider" />
    <div className="cw-rail-clubs">{clubs.map(club => <Link key={club.id} className={`cw-rail-club ${club.id === currentId ? "is-current" : ""}`} to={`/workspace/${club.id}/channels/general`} title={club.name} aria-label={`Mở ${club.name}${attention[club.id]?.total ? `, ${attention[club.id].total} thông báo` : ''}`} aria-current={club.id === currentId ? "page" : undefined} onClick={event => { if (!window.dispatchEvent(new Event("uc:before-navigate", { cancelable: true }))) event.preventDefault(); }}>
      {club.logoUrl ? <ContentImage src={club.logoUrl} alt="" /> : <span>{club.name.trim().charAt(0).toUpperCase()}</span>}
      {!!attention[club.id]?.total && <span className="cw-rail-badge" aria-hidden="true">{attention[club.id].total > 99 ? '99+' : attention[club.id].total}</span>}
    </Link>)}</div>
    <Link className="cw-rail-add" to="/me/club-requests/new" aria-label="Tạo CLB mới" title="Tạo CLB mới"><Plus size={22} aria-hidden="true" /></Link>
    <Link className="cw-rail-explore" to="/clubs" aria-label="Khám phá CLB" title="Khám phá CLB"><MagnifyingGlass size={22} aria-hidden="true" /></Link>
    <details className="cw-rail-account"><summary aria-label={`Mở menu tài khoản của ${viewer?.displayName || "sinh viên"}`} title={viewer?.displayName || "Tài khoản"}>
      {avatar && !avatarFailed ? <img src={avatar} alt="" onError={() => setAvatarFailed(true)} /> : <span aria-hidden="true">{viewer?.displayName.trim().charAt(0).toUpperCase() || "S"}</span>}
    </summary><div className="cw-rail-account-menu"><strong>{viewer?.displayName || "Sinh viên"}</strong><Link to="/me">Tài khoản</Link><button type="button" onClick={onLogout}>Đăng xuất</button></div></details>
  </aside>;
}
