import { useEffect, useRef, useState } from "react";
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
import { ContentImage } from "../discovery/components/PublicContent";
import { ClubContext } from "./workspace-context";
import { type WorkspaceContext } from "./services/workspace-api";
import {
  ContentDetail,
  ContentEditor,
  ContentList,
} from "./pages/WorkspaceContent";
import { DepartmentsPage, MembersPage } from "./pages/WorkspacePeople";
import {
  ClubInformation,
  MeetingsEntry,
  ReviewHome,
  WorkspaceHome,
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
  const location = useLocation(),
    navigate = useNavigate();
  const state = usePersonalQuery<WorkspaceContext>(
    accessToken,
    `workspace/${clubId}`,
  );
  const clubs = usePersonalQuery<PrivatePage<Membership>>(
    accessToken,
    "me/clubs?page=1&limit=24",
  );
  const [open, setOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    document.title = `${state.data?.club.name || "Không gian CLB"} · uniCircle`;
  }, [state.data?.club.name]);
  if (!state.data)
    return (
      <div className="cw-app cw-loading-page">
        <Link className="cw-brand" to="/me/clubs">
          uni<span>circle</span>.
        </Link>
        <main>
          <h1>Không gian CLB</h1>
          <PersonalState {...state} />
          <Link to="/me/clubs">← CLB tham gia</Link>
        </main>
      </div>
    );
  const ctx = state.data,
    chair = ctx.membership.role === "chairperson",
    base = `/workspace/${clubId}`;
  const navigation = [
    ["", "Tổng quan"],
    ["posts", "Bài viết"],
    ["activities", "Hoạt động"],
    ["meetings", "Phòng họp"],
    ["members", "Thành viên"],
    ["departments", "Cơ cấu CLB"],
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
      <div className="cw-app">
        <a className="cw-skip" href="#workspace-content">
          Đến nội dung
        </a>
        <aside className="cw-sidebar">
          <Link className="cw-brand" to="/">
            uni<span>circle</span>.
          </Link>
          <div className="cw-club-identity">
            <ContentImage
              src={ctx.club.logo_url}
              className="cw-club-logo"
              alt=""
            />
            <div>
              <strong>{ctx.club.name}</strong>
              <small>{chair ? "Chủ nhiệm" : "Thành viên"}</small>
            </div>
          </div>
          <label className="cw-switch-label">
            Đổi không gian
            <select
              aria-label="Chọn CLB"
              value={clubId}
              onChange={(e) => {
                if (
                  window.dispatchEvent(
                    new Event("uc:before-navigate", { cancelable: true }),
                  )
                )
                  navigate(`/workspace/${e.target.value}`);
              }}
              disabled={clubs.loading}
            >
              <option value={clubId}>{ctx.club.name}</option>
              {clubs.data?.items
                .filter((m) => m.club.club_id !== clubId)
                .map((m) => (
                  <option value={m.club.club_id} key={m.membership_id}>
                    {m.club.name} ·{" "}
                    {m.role === "chairperson" ? "Chủ nhiệm" : "Thành viên"}
                  </option>
                ))}
            </select>
          </label>
          <Link className="cw-all-clubs" to="/me/clubs">
            Tất cả CLB của tôi →
          </Link>
          <button
            className="cw-mobile-toggle"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            Điều hướng CLB {open ? "−" : "+"}
          </button>
          <nav
            className={open ? "is-open" : ""}
            id="workspace-navigation"
            aria-label="Điều hướng CLB"
          >
            <p>Sinh hoạt chung</p>
            {navigation.map(([path, label]) => (
              <NavLink
                key={path}
                to={`${base}${path ? "/" + path : ""}`}
                end={path === ""}
              >
                {label}
              </NavLink>
            ))}
            {chair && (
              <>
                <p>Quản lý · Chủ nhiệm</p>
                <NavLink to={`${base}/review`}>Nội dung chờ duyệt</NavLink>
                <NavLink to={`${base}/information`}>
                  Thông tin và liên hệ
                </NavLink>
              </>
            )}
          </nav>
          <div className="cw-sidebar-bottom">
            <Link to="/me">← Không gian của tôi</Link>
            <Link to={`/clubs/${clubId}`}>Trang CLB công khai ↗</Link>
            <button onClick={onLogout} data-leave-account>
              Đăng xuất
            </button>
          </div>
        </aside>
        <div className="cw-workspace">
          <header className="cw-topbar">
            <span>CLB / {ctx.club.name}</span>
            <span>
              {viewer?.displayName} · {chair ? "Chủ nhiệm" : "Thành viên"}
            </span>
          </header>
          <main id="workspace-content" ref={main} tabIndex={-1}>
            <Routes>
              <Route path={base} element={<WorkspaceHome />} />
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
      </div>
    </ClubContext.Provider>
  );
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
