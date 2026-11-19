import { useEffect, useRef, useState, type FormEvent } from "react";
import { UserPlus } from "@phosphor-icons/react/dist/csr/UserPlus";
import { Stack } from "@phosphor-icons/react/dist/csr/Stack";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import { usePersonalQuery } from "../personal/use-personal-query";
import { PersonalState } from "../personal/components/PersonalState";
import {
  type Membership,
  type PrivatePage,
} from "../personal/services/personal-api";
import { ClubContext } from "./workspace-context";
import { WorkspaceRail } from "./WorkspaceRail";
import { WorkspaceQuickPanel } from "./WorkspaceQuickPanel";
import { type WorkspaceContext } from "./services/workspace-api";
import {
  ContentDetail,
  ContentEditor,
  ContentList,
} from "./pages/WorkspaceContent";
import { DepartmentsPage, MembersPage } from "./pages/WorkspacePeople";
import { WorkspaceChannel, type DraftChannel } from "./pages/WorkspaceChannel";
import { WorkspaceOverview } from "./pages/WorkspaceOverview";
import { RecruitmentPage } from "./pages/RecruitmentPage";
import {
  ClubInformation,
  MeetingsEntry,
  RecurringMeetings,
  ReviewHome,
} from "./pages/WorkspaceHome";
import "./workspace.css";
export function WorkspaceApp(props: DiscoveryViewer) {
  const match = useMatch("/workspace/:clubId/*");
  const clubId = match?.params.clubId || "";
  return (
    <WorkspaceScope
      key={`${props.accessToken}:${clubId}`}
      {...props}
      clubId={clubId}
    />
  );
}
function WorkspaceScope({
  viewer,
  accessToken = "",
  clubId,
  onMeeting,
  onLogout,
}: { clubId: string } & DiscoveryViewer) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = usePersonalQuery<WorkspaceContext>(
    accessToken,
    `workspace/${clubId}`,
  );
  const clubs = usePersonalQuery<PrivatePage<Membership>>(
    accessToken,
    "me/clubs?page=1&limit=24",
  );
  const [open, setOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelKind, setChannelKind] = useState<"text" | "voice">("text");
  const [createError, setCreateError] = useState("");
  const [draftChannels, setDraftChannels] = useState<DraftChannel[]>(() => loadDraftChannels(clubId));
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>(".cw-channel-list a.active")?.scrollIntoView?.({ block: "nearest" });
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setCreateOpen(false); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    document.title = `${state.data?.club.name || "Không gian CLB"} · uniCircle`;
  }, [state.data?.club.name]);
  function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = channelName.trim().replace(/\s+/g, " ");
    if (!name || name.length > 40) { setCreateError("Tên kênh phải có từ 1 đến 40 ký tự."); return; }
    const allNames = ["thông-báo", "thảo-luận", "tài-liệu", "hỏi-đáp", "Phòng chung", "Họp nhóm", ...draftChannels.map(item => item.name)];
    if (allNames.some(item => item.toLocaleLowerCase("vi").normalize("NFC") === name.toLocaleLowerCase("vi").normalize("NFC"))) {
      setCreateError("Tên kênh đã tồn tại trong CLB này.");
      return;
    }
    const draft: DraftChannel = { id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name, kind: channelKind };
    const next = [...draftChannels, draft];
    setDraftChannels(next);
    try { sessionStorage.setItem(`uc:channels:${clubId}`, JSON.stringify(next)); } catch { /* Browser storage can be unavailable. */ }
    setChannelName("");
    setChannelKind("text");
    setCreateError("");
    setCreateOpen(false);
    navigate(`/workspace/${clubId}/channels/${draft.id}`);
  }
  if (!state.data)
    return (
      <div className="cw-app cw-loading-page">
        <Link className="cw-brand" to="/workspace">
          uni<span>circle</span>.
        </Link>
        <main>
          <h1>Không gian CLB</h1>
          <PersonalState {...state} />
          <Link to="/workspace">← Không gian sinh hoạt</Link>
        </main>
      </div>
    );
  const ctx = state.data,
    chair = ctx.membership.role === "chairperson",
    base = `/workspace/${clubId}`;
  const inChannel = location.pathname.startsWith(`${base}/channels/`);
  const textChannels = [
    ["channels/announcements", "# thông-báo"],
    ["channels/general", "# thảo-luận"],
    ["channels/resources", "# tài-liệu"],
    ["channels/questions", "# hỏi-đáp"],
  ];
  const voiceChannels = [
    ["channels/voice-general", "Phòng chung"],
    ["channels/voice-team", "Họp nhóm"],
  ];
  return (
    <ClubContext.Provider
      value={{
        ...ctx,
        token: accessToken,
        clubId,
        reload: state.retry,
        onMeeting,
      }}
    >
      <div className={`cw-app ${inChannel ? "cw-app--channel" : ""}`}>
        <a className="cw-skip" href="#workspace-content">
          Đến nội dung
        </a>
        <WorkspaceRail viewer={viewer} currentId={clubId} onLogout={onLogout} clubs={[{ id: clubId, name: ctx.club.name, logoUrl: ctx.club.logo_url }, ...(clubs.data?.items || []).filter(item => item.club.club_id !== clubId).map(item => ({ id: item.club.club_id, name: item.club.name, logoUrl: item.club.logo_url }))]} />
        <aside className="cw-sidebar">
          <div className="cw-club-identity">
            <div>
              <strong>{ctx.club.name}</strong>
              <small>{chair ? "Chủ nhiệm" : "Thành viên"}</small>
            </div>
          </div>
          <button
            className="cw-mobile-toggle"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            {ctx.club.name} · {open ? "Ẩn menu" : "Mở menu"}
          </button>
          <nav
            className={open ? "is-open" : ""}
            id="workspace-navigation"
            aria-label="Điều hướng CLB"
          >
            <NavLink to={base} end className="cw-overview-link">Tổng quan CLB</NavLink>
            <div className="cw-channel-scroll" role="group" aria-label="Danh sách kênh">
            <div className="cw-channel-group"><div className="cw-group-heading"><span>Kênh văn bản</span>{chair && <button type="button" onClick={() => setCreateOpen(true)} aria-label="Tạo kênh văn bản" title="Tạo kênh văn bản">+</button>}</div></div>
            <div className="cw-channel-list">{textChannels.map(([path, label]) => (
              <NavLink
                key={path}
                to={`${base}${path ? "/" + path : ""}`}
              >
                {label}
              </NavLink>
            ))}
            {draftChannels.filter(item => item.kind === "text").map(item => <NavLink key={item.id} to={`${base}/channels/${item.id}`} title="Bản nháp trên trình duyệt"># {item.name}</NavLink>)}</div>
            <div className="cw-channel-group"><div className="cw-group-heading"><span>Kênh gọi nhanh</span>{chair && <button type="button" onClick={() => { setChannelKind("voice"); setCreateOpen(true); }} aria-label="Tạo kênh gọi nhanh" title="Tạo kênh gọi nhanh">+</button>}</div></div>
            <div className="cw-channel-list cw-voice-list">{voiceChannels.map(([path, label]) => <NavLink key={path} to={`${base}/${path}`} className="cw-voice-link"><span aria-hidden="true">◖</span> {label}</NavLink>)}
            {draftChannels.filter(item => item.kind === "voice").map(item => <NavLink key={item.id} className="cw-voice-link" to={`${base}/channels/${item.id}`} title="Bản nháp trên trình duyệt"><span aria-hidden="true">◖</span> {item.name}</NavLink>)}</div>
            <NavLink to={`${base}/departments`} className="cw-departments-link"><Stack size={18} aria-hidden="true" /><span>Các ban</span></NavLink>
            <NavLink to={`${base}/members`} className="cw-members-link"><UsersThree size={18} aria-hidden="true" /><span>Thành viên</span></NavLink>
            {chair && <NavLink to={`${base}/recruitment`} className="cw-recruitment-link"><UserPlus size={18} aria-hidden="true" /><span>Tuyển thành viên</span></NavLink>}
            </div>
            <details className="cw-nav-details cw-work-pinned" open={workOpen} onToggle={event => setWorkOpen(event.currentTarget.open)}><summary>Công việc CLB</summary><div>
              <NavLink to={`${base}/posts/new`}>Viết bài</NavLink>
              <NavLink to={`${base}/posts`} end>Bài viết</NavLink>
              <NavLink to={`${base}/activities`} end>Hoạt động</NavLink>
              <NavLink to={`${base}/meetings`}>Phòng họp</NavLink>
              <NavLink to={`${base}/recurring-meetings`}>Tạo họp định kỳ</NavLink>
              {chair && <NavLink to={`${base}/review`}>Duyệt nội dung</NavLink>}
            </div></details>
          </nav>
        </aside>
        <div className="cw-workspace">
          {!inChannel && <header className="cw-topbar"><span>{ctx.club.name}</span><span>{viewer?.displayName} · {chair ? "Chủ nhiệm" : "Thành viên"}</span></header>}
          <main id="workspace-content" ref={main} tabIndex={-1} className={inChannel ? "cw-channel-main" : undefined}>
            <Routes>
              <Route path={base} element={<WorkspaceOverview />} />
              <Route path={`${base}/channels/:channel`} element={<WorkspaceChannel drafts={draftChannels} />} />
              {(["posts", "activities"] as const).map((kind) => (
                <Route
                  key={kind}
                  path={`${base}/${kind}`}
                  element={<ContentList kind={kind} />}
                />
              ))}
              {(["posts", "activities"] as const).flatMap((kind) => [
                <Route
                  key={`${kind}-new`}
                  path={`${base}/${kind}/new`}
                  element={<ContentEditor key={`${kind}-new`} kind={kind} />}
                />,
                <Route
                  key={`${kind}-detail`}
                  path={`${base}/${kind}/:id`}
                  element={<ContentDetail kind={kind} />}
                />,
                <Route
                  key={`${kind}-edit`}
                  path={`${base}/${kind}/:id/edit`}
                  element={<EditorRoute kind={kind} />}
                />,
              ])}
              <Route path={`${base}/members`} element={<MembersPage />} />
              <Route
                path={`${base}/departments`}
                element={<DepartmentsPage />}
              />
              <Route path={`${base}/meetings`} element={<MeetingsEntry />} />
              <Route path={`${base}/recurring-meetings`} element={<RecurringMeetings />} />
              <Route path={`${base}/recruitment`} element={chair ? <RecruitmentPage /> : <Denied />} />
              <Route
                path={`${base}/information`}
                element={<ClubInformation />}
              />
              <Route
                path={`${base}/review`}
                element={chair ? <ReviewHome /> : <Denied />}
              />
              <Route
                path="*"
                element={
                  <>
                    <h1>Trang chưa khả dụng</h1>
                    <Link to={base}>Về không gian CLB →</Link>
                  </>
                }
              />
            </Routes>
          </main>
          <footer className="cw-footer">uniCircle · {ctx.club.name}</footer>
        </div>
        <WorkspaceQuickPanel club={ctx.club} token={accessToken} chair={chair} />
        {createOpen && <div className="cw-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="cw-create-dialog" role="dialog" aria-modal="true" aria-labelledby="cw-create-title"><form onSubmit={createChannel}>
          <div className="cw-create-title"><div><h2 id="cw-create-title">Tạo kênh</h2><p>Bản nháp giao diện cho {ctx.club.name}</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Đóng">×</button></div>
          <fieldset><legend>Loại kênh</legend><label><input type="radio" name="kind" checked={channelKind === "text"} onChange={() => setChannelKind("text")} /> Văn bản</label><label><input type="radio" name="kind" checked={channelKind === "voice"} onChange={() => setChannelKind("voice")} /> Gọi nhanh</label></fieldset>
          <label className="cw-create-name">Tên kênh<input autoFocus value={channelName} onChange={event => { setChannelName(event.target.value); setCreateError(""); }} maxLength={40} placeholder={channelKind === "text" ? "ví dụ: ý-tưởng" : "ví dụ: nhóm sự kiện"} /></label>
          {createError && <p role="alert" className="cw-create-error">{createError}</p>}
          <p className="cw-create-note">Kênh chỉ lưu trong phiên trình duyệt này, chưa được tạo trên hệ thống.</p>
          <div className="cw-create-actions"><button type="button" onClick={() => setCreateOpen(false)}>Hủy</button><button type="submit" className="cw-primary">Tạo bản nháp</button></div>
        </form></section></div>}
      </div>
    </ClubContext.Provider>
  );
}
function loadDraftChannels(clubId: string): DraftChannel[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`uc:channels:${clubId}`) || "[]");
    return Array.isArray(value) ? value.filter((item): item is DraftChannel => Boolean(item) && typeof item.id === "string" && item.id.startsWith("draft-") && typeof item.name === "string" && item.name.length <= 40 && (item.kind === "text" || item.kind === "voice")).slice(0, 30) : [];
  } catch { return []; }
}
function EditorRoute({ kind }: { kind: "posts" | "activities" }) {
  const id = useMatch("/workspace/:clubId/:kind/:id/edit")?.params.id;
  return <ContentEditor key={`${kind}:${id}`} kind={kind} />;
}
function Denied() {
  return (
    <div className="cw-panel">
      <h1>Chỉ dành cho chủ nhiệm</h1>
      <p>
        Bạn vẫn có thể xem nội dung và gửi đề xuất trong không gian sinh hoạt
        của CLB.
      </p>
    </div>
  );
}
