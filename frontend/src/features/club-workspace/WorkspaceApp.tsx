import { useEffect, useRef, useState } from "react";
import { Article } from "@phosphor-icons/react/dist/csr/Article";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { VideoCamera } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { ClipboardText } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { NotePencil } from "@phosphor-icons/react/dist/csr/NotePencil";
import { UserPlus } from "@phosphor-icons/react/dist/csr/UserPlus";
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
import { WorkspaceRecruitment,RecruitmentEditor,RecruitmentQueue,RecruitmentApplicationDetail } from '../recruitment/WorkspaceRecruitment';
import './workspace-polish.css';
import './workspace-theme.css';
import { channelLabel } from './channel-label';
import { useWorkspaceAttention } from './use-workspace-attention';
import { useAutoDismiss } from '../../shared/lib/use-auto-dismiss';
export function WorkspaceApp(props: DiscoveryViewer) {
  const match = useMatch("/workspace/:clubId/*");
  const clubId = match?.params.clubId || "";
  const clubs = usePersonalQuery<PrivatePage<Membership>>(
    props.accessToken || "",
    "me/clubs?page=1&limit=24",
  );
  return (
    <WorkspaceScope
      key={props.accessToken}
      {...props}
      clubId={clubId}
      clubs={clubs.data?.items}
    />
  );
}
function WorkspaceScope({
  viewer,
  accessToken = "",
  clubId,
  clubs,
  onMeeting,
  onLogout,
}: { clubId: string; clubs?: Membership[] } & DiscoveryViewer) {
  const location = useLocation();
  const attention = useWorkspaceAttention(accessToken, clubs?.map(item => item.club.club_id) ?? []);

  const state = usePersonalQuery<WorkspaceContext>(
    accessToken,
    `workspace/${clubId}`,
  );
  const channels = usePersonalQuery<WorkspaceList<ClubChannel>>(
    accessToken,
    `workspace/${clubId}/channels`,
  );
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail === clubId) channels.retry();
    };
    window.addEventListener('uc:workspace-channels-changed', refresh);
    return () => window.removeEventListener('uc:workspace-channels-changed', refresh);
  }, [clubId]);
  const [open, setOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(true);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [feedback, setFeedback] = useState('');
  useAutoDismiss(feedback, () => setFeedback(''));
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
  const ctx = state.data,
    chair = ctx?.membership.role === "chairperson",
    base = `/workspace/${clubId}`;
  const clubName = ctx?.club.name || clubs?.find(item => item.club.club_id === clubId)?.club.name || "Không gian CLB";
  const inChannel = location.pathname.startsWith(`${base}/channels/`);
  const inInformation = location.pathname === `${base}/information`;
  const inMeetings = location.pathname === `${base}/meetings` || location.pathname === `${base}/recurring-meetings`;
  const notify = (message: string) => setFeedback(message);
  return (
    <ClubContext.Provider
      value={ctx ? {
        ...ctx,
        token: accessToken,
        clubId,
        reload: state.retry,
        onMeeting,
        notify,
      } : null}
    >
      <div data-theme={darkTheme ? "dark" : "light"} className={`cw-app ${inChannel ? "cw-app--channel" : ""}${inInformation ? " cw-app--information" : ""}${inMeetings ? " cw-app--meetings" : ""}${infoCollapsed ? " cw-app--info-collapsed" : ""}`}>
        {feedback && <div className="cw-feedback-toast" role="status" aria-live="polite">{feedback}</div>}
        <a className="cw-skip" href="#workspace-content">
          Đến nội dung
        </a>
        <WorkspaceRail viewer={viewer} currentId={clubId} onLogout={onLogout} attention={attention} clubs={clubs ? [
          ...clubs.map(item => ({ id: item.club.club_id, name: item.club.name, logoUrl: item.club.logo_url })),
          ...(ctx && !clubs.some(item => item.club.club_id === clubId) ? [{ id: clubId, name: ctx.club.name, logoUrl: ctx.club.logo_url }] : []),
        ] : []} />
        <aside className="cw-sidebar">
          <div className="cw-club-identity">
            <div>
              <strong>{clubName}</strong>
              <small>{ctx ? chair ? "Chủ nhiệm" : ctx.membership.role === "head" ? "Trưởng ban" : "Thành viên" : "Đang kiểm tra quyền…"}</small>
            </div>
          </div>
          <button
            className="cw-mobile-toggle"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            {clubName} · {open ? "Ẩn menu" : "Mở menu"}
          </button>
          <nav
            className={open ? "is-open" : ""}
            id="workspace-navigation"
            aria-label="Điều hướng CLB"
          >
            {ctx && <><NavLink to={base} end className="cw-overview-link">Tổng quan CLB</NavLink>
            <div className="cw-channel-scroll" role="group" aria-label="Danh sách kênh">
            <ChannelNavigation channels={channels} clubId={clubId} chair={chair} attention={attention[clubId]} />
            </div>
            <details className="cw-nav-details cw-work-pinned" open={workOpen} onToggle={event => setWorkOpen(event.currentTarget.open)}><summary>Công việc CLB</summary><div>
              <NavLink to={`${base}/posts/new`}><NotePencil size={17} aria-hidden="true" />Viết bài</NavLink>
              <NavLink to={`${base}/posts`} end><Article size={17} aria-hidden="true" />Bài viết{attention[clubId]?.postRevisions ? <span className="cw-nav-count" aria-label={`${attention[clubId].postRevisions} bài cần sửa`}>{attention[clubId].postRevisions}</span> : null}</NavLink>
              <NavLink to={`${base}/activities`} end><CalendarBlank size={17} aria-hidden="true" />Hoạt động{attention[clubId]?.activityRevisions ? <span className="cw-nav-count" aria-label={`${attention[clubId].activityRevisions} hoạt động cần sửa`}>{attention[clubId].activityRevisions}</span> : null}</NavLink>
              {(chair||ctx.membership.role==='head')&&<NavLink to={`${base}/recruitments`}><UserPlus size={17} aria-hidden="true" />Tuyển thành viên</NavLink>}
              {chair && <NavLink to={`${base}/review`}><ClipboardText size={17} aria-hidden="true" />Duyệt nội dung{attention[clubId]?.review ? <span className="cw-nav-count">{attention[clubId].review}</span> : null}</NavLink>}
            </div></details></>}
          </nav>
        </aside>
        <div className="cw-workspace">
          {!inChannel && !inMeetings && <header className="cw-topbar"><span>{clubName}</span><span>{viewer?.displayName}{ctx && ` · ${chair ? "Chủ nhiệm" : ctx.membership.role === "head" ? "Trưởng ban" : "Thành viên"}`}</span></header>}
          <main id="workspace-content" ref={main} tabIndex={-1} className={inChannel ? "cw-channel-main" : undefined}>
            {ctx ? <Routes>
              <Route path={`${base}/recruitments`} element={chair||ctx.membership.role==='head'?<WorkspaceRecruitment />:<Denied />} />
              <Route path={`${base}/recruitments/new`} element={chair?<RecruitmentEditor />:<Denied />} />
              <Route path={`${base}/recruitments/:campaignId/edit`} element={chair||ctx.membership.role==='head'?<RecruitmentEditor />:<Denied />} />
              <Route path={`${base}/recruitments/:campaignId/applications`} element={chair||ctx.membership.role==='head'?<RecruitmentQueue />:<Denied />} />
              <Route path={`${base}/recruitments/:campaignId/applications/:applicationId`} element={chair||ctx.membership.role==='head'?<RecruitmentApplicationDetail />:<Denied />} />
              <Route path={base} element={<WorkspaceOverview />} />
              <Route path={`${base}/channels/:channel`} element={<WorkspaceChannel channels={channels} />} />
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
            </Routes> : <><h1>{clubName}</h1><PersonalState {...state} /><Link to="/workspace">← Không gian sinh hoạt</Link></>}
          </main>
        </div>
        {ctx ? <WorkspaceQuickPanel key={clubId} club={ctx.club} token={accessToken} chair={chair} collapsed={infoCollapsed} darkTheme={darkTheme} onThemeToggle={() => setDarkTheme(value => !value)} onToggle={() => setInfoCollapsed(value => !value)} /> : <aside className="cw-quick-panel" aria-label="Xem nhanh CLB" aria-busy={state.loading} />}

      </div>
    </ClubContext.Provider>
  );
}
function ChannelNavigation({ channels, clubId, chair, attention }: { channels: ReturnType<typeof usePersonalQuery<WorkspaceList<ClubChannel>>>; clubId: string; chair: boolean; attention?: import('./services/workspace-api').WorkspaceAttention }) {
  const unread = attention?.channels ?? [];
  return <>
    <div className="cw-channel-group"><div className="cw-group-heading"><span>Kênh sinh hoạt</span>{chair && <Link to={`/workspace/${clubId}/departments`} title="Quản lý ban và kênh của ban" aria-label="Quản lý ban và kênh">+</Link>}</div></div>
    <div className="cw-channel-list">
      {channels.loading && <p role="status">Đang tải kênh…</p>}
      {channels.error && <><p role="alert">{channels.error}</p><button onClick={channels.retry}>Thử lại</button></>}
      {channels.data?.items.map(channel => { const count = unread.find(item => item.channel_id === channel.channel_id)?.unread ?? 0; return <NavLink key={channel.channel_id} className={count ? 'cw-channel-unread' : undefined} aria-label={count ? `${channelLabel(channel)}, ${count} tin chưa đọc` : undefined} to={`/workspace/${clubId}/channels/${channel.channel_id}`}>{channelLabel(channel)}</NavLink>; })}
      {channels.data && !channels.data.items.length && <p>Chưa có kênh bạn có thể truy cập.</p>}
    </div>
    <div className="cw-channel-group"><div className="cw-group-heading"><span>Gọi và gặp mặt</span></div></div>
    <div className="cw-channel-list cw-voice-list"><NavLink to={`/workspace/${clubId}/meetings`} className={`cw-voice-link${attention?.meetings ? ' cw-voice-link--pending' : ''}`} aria-label={attention?.meetings ? `Phòng họp CLB, ${attention.meetings} buổi họp đang hoặc sắp diễn ra` : undefined}><VideoCamera size={18} aria-hidden="true" /><span className="cw-voice-label">Phòng họp CLB</span>{attention?.meetings ? <span className="cw-meeting-count" aria-hidden="true">{attention.meetings > 99 ? '99+' : attention.meetings}</span> : null}</NavLink><NavLink to={`/workspace/${clubId}/recurring-meetings`} className="cw-voice-link"><CalendarBlank size={18} aria-hidden="true" /><span className="cw-voice-label">Họp theo lịch</span></NavLink></div>
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
