import { UniCircleLogo } from "../../shared/components/UniCircleLogo";
import { authFormHref } from "../auth/redirect";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { HeadNotifications } from "./components/HeadNotifications";
import { UserRectangle } from "@phosphor-icons/react/dist/csr/UserRectangle";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { DiscoveryHome } from "./pages/DiscoveryHome";
import { CollectionPage } from "./pages/CollectionPage";
import { PublicDetailPage } from "./pages/PublicDetailPage";
import { useDiscoveryMotion } from "./hooks/use-discovery-motion";
import { PersonalApp } from "../personal/PersonalApp";
import { AdminApp } from "../admin/AdminApp";
import { WorkspaceApp } from "../club-workspace/WorkspaceApp";
import { WorkspaceHub } from "../club-workspace/WorkspaceHub";
import { RecruitmentApply,RecruitmentPublicDetail,RecruitmentPublicList } from '../recruitment/PublicRecruitment';
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "./discovery.css";
import "./discovery-home.css";

export interface DiscoveryViewer {
  viewer?: { displayName: string };
  role?: string | null;
  accessToken?: string;
  onMeeting?: () => void;
  onLogout?: () => void;
}
export function DiscoveryApp({
  viewer,
  role,
  accessToken,
  onMeeting,
  onLogout,
}: DiscoveryViewer) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const main = useRef<HTMLElement>(null);
  useDiscoveryMotion(main, `${location.pathname}${location.search}`);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const notifications = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenu(false);
      for (const panel of [accountMenu.current, notifications.current]) {
        if (!panel?.open) continue;
        const restoreFocus = panel.contains(document.activeElement);
        panel.open = false;
        if (restoreFocus) panel.querySelector("summary")?.focus();
      }
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const panel of [accountMenu.current, notifications.current]) {
        if (panel?.open && !panel.contains(event.target)) panel.open = false;
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("click", closeOnOutsideClick, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("click", closeOnOutsideClick, true);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [location.pathname, location.search]);
  useEffect(() => {
    document.title = `${location.pathname.startsWith("/clubs") ? "Câu lạc bộ" : location.pathname.startsWith("/activities") ? "Hoạt động" : location.pathname.startsWith("/posts") ? "Bài viết" : "Khám phá"} · uniCircle`;
  }, [location.pathname]);
  const authUrl = (mode: "login" | "register") =>
    authFormHref(mode, `${location.pathname}${location.search}${location.hash}`);
  function startRequest() {
    if (viewer && accessToken) navigate("/me/club-requests/new");
    else window.location.assign(authFormHref("login", "/me/club-requests/new"));
  }
  const initials = (viewer?.displayName ?? "")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi-VN");
  if (location.pathname === "/admin" || location.pathname.startsWith("/admin/"))
    return (
      <AdminApp
        viewer={viewer}
        accessToken={accessToken}
        role={role}
        onLogout={onLogout}
      />
    );
  if (location.pathname.startsWith("/workspace/")) {
    if (viewer && accessToken)
      return (
        <WorkspaceApp
          viewer={viewer}
          accessToken={accessToken}
          role={role}
          onMeeting={onMeeting}
          onLogout={onLogout}
        />
      );
    return (
      <div className="dc-app">
        <main className="dc-container dc-detail-state">
          <h1>Không gian CLB</h1>
          <p>Đăng nhập và hoàn thiện hồ sơ để kiểm tra quyền thành viên.</p>
          <a className="dc-button" href={authUrl("login")}>
            Đăng nhập
          </a>
        </main>
      </div>
    );
  }
  if (location.pathname === "/workspace") {
    if (viewer && accessToken)
      return <WorkspaceHub viewer={viewer} accessToken={accessToken} onLogout={onLogout} />;
    return (
      <div className="dc-app">
        <main className="dc-container dc-detail-state">
          <h1>Không gian sinh hoạt</h1>
          <p>Đăng nhập để xem các CLB bạn đã tham gia.</p>
          <a className="dc-button" href={authFormHref("login", "/workspace")}>Đăng nhập</a>
        </main>
      </div>
    );
  }
  if (location.pathname === "/me" || location.pathname.startsWith("/me/")) {
    if (viewer && accessToken)
      return (
        <PersonalApp
          viewer={viewer}
          accessToken={accessToken}
          role={role}
          onMeeting={onMeeting}
          onLogout={onLogout}
        />
      );
    return (
      <div className="dc-app">
        <main className="dc-container dc-detail-state">
          <h1>Không gian của bạn</h1>
          <p>Đăng nhập và hoàn thiện hồ sơ sinh viên để tiếp tục.</p>
          <a className="dc-button" href={authUrl("login")}>
            Đăng nhập
          </a>
        </main>
      </div>
    );
  }
  return (
    <div className={isHome ? "dc-app dc-home" : "dc-app"}>
      <a className="dc-skip" href="#public-content">
        Đến nội dung
      </a>
      <header className={viewer ? "dc-header dc-header-signed-in" : "dc-header"}>
        <div className="dc-container dc-header-inner">
          <Link className="dc-brand" to="/" aria-label="uniCircle — Khám phá">
            <UniCircleLogo />
          </Link>
          <nav
            className={`dc-nav ${menu ? "is-open" : ""}`}
            aria-label="Điều hướng công khai"
          >
            <NavLink to="/clubs">Câu lạc bộ</NavLink>
            <NavLink to="/activities">Hoạt động</NavLink>
            <NavLink to="/posts">Bài viết</NavLink>
            {viewer && <NavLink to="/workspace">Không gian sinh hoạt</NavLink>}
          </nav>
          <div className="dc-account">
            {viewer && (
              <HeadNotifications key={accessToken || "guest"} token={accessToken} panelRef={notifications} />
            )}
            {viewer ? (
              <details ref={accountMenu}>
                <summary aria-label={`Menu tài khoản của ${viewer.displayName}`}>
                  <span className="dc-account-avatar" aria-hidden="true">{initials || "U"}</span>
                </summary>
                <div className="dc-account-menu">
                  <p className="dc-account-heading">Sinh viên · {viewer.displayName}</p>
                  <Link to="/me"><UserRectangle size={18} aria-hidden="true" />Không gian của tôi</Link>
                  <Link to="/workspace"><Users size={18} aria-hidden="true" />CLB của tôi</Link>
                  <button onClick={startRequest}><Plus size={18} aria-hidden="true" />Tạo CLB</button>
                  <button onClick={onMeeting}><CalendarBlank size={18} aria-hidden="true" />Cuộc họp</button>
                  {role === "admin" && (
                    <Link to="/admin"><GearSix size={18} aria-hidden="true" />Quản trị hệ thống</Link>
                  )}
                  <button className="dc-account-logout" onClick={onLogout}><SignOut size={18} aria-hidden="true" />Đăng xuất</button>
                </div>
              </details>
            ) : (
              <>
                <a className="dc-login" href={authUrl("login")}>
                  Đăng nhập
                </a>
                <a className="dc-button dc-signup" href={authUrl("register")}>
                  Tham gia <ArrowUpRight aria-hidden="true" size={17} />
                </a>
              </>
            )}
            <button
              className="dc-menu-toggle"
              aria-expanded={menu}
              aria-controls="mobile-public-nav"
              aria-label={menu ? "Đóng điều hướng" : "Mở điều hướng"}
              onClick={() => setMenu((v) => !v)}
            >
              {menu ? <X size={23} /> : <List size={23} />}
            </button>
          </div>
        </div>
        <nav
          id="mobile-public-nav"
          className="dc-mobile-nav"
          hidden={!menu}
          aria-label="Điều hướng trên điện thoại"
        >
          <Link to="/clubs">Câu lạc bộ</Link>
          <Link to="/activities">Hoạt động</Link>
          <Link to="/posts">Bài viết</Link>
          {viewer && <Link to="/workspace">Không gian sinh hoạt</Link>}
        </nav>
      </header>
      <main id="public-content" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<DiscoveryHome />} />
          <Route path="/recruitments" element={<RecruitmentPublicList />} />
          <Route path="/recruitments/:campaignId" element={<RecruitmentPublicDetail token={accessToken} />} />
          <Route path="/recruitments/:campaignId/apply" element={<RecruitmentApply token={accessToken} />} />
          {(["clubs", "activities", "posts"] as const).map((kind) => (
            <Route
              key={kind}
              path={`/${kind}`}
              element={<CollectionPage kind={kind} />}
            />
          ))}
          {(["clubs", "activities", "posts"] as const).map((kind) => (
            <Route
              key={kind}
              path={`/${kind}/:id`}
              element={
                <PublicDetailPage
                  kind={kind}
                  signedIn={!!viewer}
                  accessToken={accessToken}
                />
              }
            />
          ))}
          <Route
            path="*"
            element={
              <div className="dc-container dc-state dc-not-found">
                <h1>Trang chưa khả dụng</h1>
                <p>Đường dẫn này không tồn tại trong khu vực công khai.</p>
                <Link to="/">Quay về khám phá →</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="dc-footer">
        <div className="dc-container">
          <div className="dc-footer-top">
            <div>
              <Link className="dc-brand" to="/">
                <UniCircleLogo />
              </Link>
              <p>
                Cùng một mái trường.
                <br />
                Thêm nhiều điểm chạm.
              </p>
            </div>
            <div>
              <h2>Khám phá</h2>
              <Link to="/clubs">Câu lạc bộ</Link>
              <Link to="/activities">Hoạt động</Link>
              <Link to="/posts">Bài viết</Link>
            </div>
            <div>
              <h2>Dành cho CLB</h2>
              <p>
                Đưa cộng đồng của bạn
                <br />
                đến gần hơn với sinh viên.
              </p>
              <button onClick={startRequest}>
                Đề nghị thành lập CLB <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="dc-footer-bottom">
            <span>Dự án mô phỏng nền tảng CLB tại Bách khoa.</span>
            <span>
              Nội dung tham khảo không đại diện quản trị CLB chính thức.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
