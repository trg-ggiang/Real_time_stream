import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useMatch,
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
import { type WorkspaceContext, type ClubChannel, type WorkspaceList } from "./services/workspace-api";
import {
  ContentDetail,
  ContentEditor,
  ContentList,
} from "./pages/WorkspaceContent";
import { DepartmentsPage, MembersPage } from "./pages/WorkspacePeople";
import { WorkspaceChannel } from "./pages/WorkspaceChannel";
import { WorkspaceOverview } from "./pages/WorkspaceOverview";
import {
  ClubInformation,
  MeetingsEntry,
  RecurringMeetings,
  ReviewHome,
} from "./pages/WorkspaceHome";
import "./workspace.css";
import './workspace-polish.css';
import './workspace-theme.css';
import { channelLabel } from './channel-label';
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
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [darkTheme, setDarkTheme] = useState(() => {
    try { return localStorage.getItem("unicircle.workspace-theme") === "dark"; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("unicircle.workspace-theme", darkTheme ? "dark" : "light"); }
    catch { /* The theme still works when browser storage is unavailable. */ }
  }, [darkTheme]);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>(".cw-channel-list a.active")?.scrollIntoView?.({ block: "nearest" });
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    document.title = `${state.data?.club.name || "Không gian CLB"} · uniCircle`;
  }, [state.data?.club.name]);
  if (!state.data)
    return (
      <div className="cw-app cw-loading-page" data-theme={darkTheme ? "dark" : "light"}>
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
      <div data-theme={darkTheme ? "dark" : "light"} className={`cw-app ${inChannel ? "cw-app--channel" : ""}${infoCollapsed ? " cw-app--info-collapsed" : ""}`}>
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
            <ChannelNavigation token={accessToken} clubId={clubId} chair={chair} />
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
          {!inChannel && <header className="cw-topbar"><span>{ctx.club.name}</span><span>{viewer?.displayName} · {chair ? "Chủ nhiệm" : ctx.membership.role === "head" ? "Trưởng ban" : "Thành viên"}</span></header>}
          <main id="workspace-content" ref={main} tabIndex={-1} className={inChannel ? "cw-channel-main" : undefined}>
            <Routes>
              <Route path={base} element={<WorkspaceOverview />} />
              <Route path={`${base}/channels/:channel`} element={<WorkspaceChannel />} />
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
        <WorkspaceQuickPanel club={ctx.club} token={accessToken} chair={chair} collapsed={infoCollapsed} darkTheme={darkTheme} onThemeToggle={() => setDarkTheme(value => !value)} onToggle={() => setInfoCollapsed(value => !value)} />

      </div>
    </ClubContext.Provider>
  );
}
function ChannelNavigation({ token, clubId, chair }: { token: string; clubId: string; chair: boolean }) {
  const channels = usePersonalQuery<WorkspaceList<ClubChannel>>(token, `workspace/${clubId}/channels`);
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent).detail === clubId) channels.retry(); };
    window.addEventListener('uc:workspace-channels-changed', refresh);
    return () => window.removeEventListener('uc:workspace-channels-changed', refresh);
  }, [clubId]);
  return <>
    <div className="cw-channel-group"><div className="cw-group-heading"><span>Kênh sinh hoạt</span>{chair && <Link to={`/workspace/${clubId}/departments`} title="Quản lý ban và kênh của ban" aria-label="Quản lý ban và kênh">+</Link>}</div></div>
    <div className="cw-channel-list">
      {channels.loading && <p role="status">Đang tải kênh…</p>}
      {channels.error && <><p role="alert">{channels.error}</p><button onClick={channels.retry}>Thử lại</button></>}
      {channels.data?.items.map(channel => <NavLink key={channel.channel_id} to={`/workspace/${clubId}/channels/${channel.channel_id}`}>{channelLabel(channel)}</NavLink>)}
      {channels.data && !channels.data.items.length && <p>Chưa có kênh bạn có thể truy cập.</p>}
    </div>
    <div className="cw-channel-group"><div className="cw-group-heading"><span>Gọi và gặp mặt</span></div></div>
    <div className="cw-channel-list cw-voice-list"><NavLink to={`/workspace/${clubId}/meetings`} className="cw-voice-link"><span aria-hidden="true">◖</span> Phòng họp CLB</NavLink><NavLink to={`/workspace/${clubId}/recurring-meetings`} className="cw-voice-link"><span aria-hidden="true">◖</span> Họp theo lịch</NavLink></div>
  </>;
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
