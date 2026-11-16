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
import { DiscoveryHome } from "./pages/DiscoveryHome";
import { CollectionPage } from "./pages/CollectionPage";
import { PublicDetailPage } from "./pages/PublicDetailPage";
import { useDiscoveryMotion } from "./hooks/use-discovery-motion";
import { PersonalApp } from "../personal/PersonalApp";
import { AdminApp } from "../admin/AdminApp";
import { WorkspaceApp } from "../club-workspace/WorkspaceApp";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "./discovery.css";

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
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const main = useRef<HTMLElement>(null);
  useDiscoveryMotion(main, `${location.pathname}${location.search}`);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        if (accountMenu.current) accountMenu.current.open = false;
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [location.pathname, location.search]);
  useEffect(() => {
    document.title = `${location.pathname.startsWith("/clubs") ? "Câu lạc bộ" : location.pathname.startsWith("/activities") ? "Hoạt động" : location.pathname.startsWith("/posts") ? "Bài viết" : "Khám phá"} · uniCircle`;
  }, [location.pathname]);
  const authUrl = (mode: string) =>
    `${location.pathname}${location.search ? `${location.search}&` : "?"}mode=${mode}`;
  function startRequest() {
    if (viewer && accessToken) navigate("/me/club-requests/new");
    else window.location.assign("/me/club-requests/new?mode=login");
  }
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
    <div className="dc-app">
      <a className="dc-skip" href="#public-content">
        Đến nội dung
      </a>
      <header className="dc-header">
        <div className="dc-container dc-header-inner">
          <Link className="dc-brand" to="/" aria-label="uniCircle — Khám phá">
            uni<span>circle</span>
            <i aria-hidden="true">.</i>
          </Link>
          <nav
            className={`dc-nav ${menu ? "is-open" : ""}`}
            aria-label="Điều hướng công khai"
          >
            <NavLink to="/clubs">Câu lạc bộ</NavLink>
            <NavLink to="/activities">Hoạt động</NavLink>
            <NavLink to="/posts">Bài viết</NavLink>
          </nav>
          <div className="dc-account">
            {viewer ? (
              <details ref={accountMenu}>
                <summary>
                  {viewer.displayName} <span aria-hidden="true">⌄</span>
                </summary>
                <div className="dc-account-menu">
                  <p>Sinh viên · {viewer.displayName}</p>
                  <Link to="/me">Không gian của tôi</Link>
                  <Link to="/me/clubs">CLB của tôi</Link>
                  <button onClick={startRequest}>Đề nghị thành lập CLB</button>
                  <button onClick={onMeeting}>Cuộc họp</button>
                  {role === "admin" && (
                    <Link to="/admin">Quản trị hệ thống</Link>
                  )}
                  <button onClick={onLogout}>Đăng xuất</button>
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
        </nav>
      </header>
      <main id="public-content" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<DiscoveryHome />} />
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
                uni<span>circle</span>
                <i aria-hidden="true">.</i>
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
