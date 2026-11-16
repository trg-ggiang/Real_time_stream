import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ProfileForm } from "../profile/ProfileForm";
import { PersonalLists, PersonalOverview } from "./pages/PersonalLists";
import { ClubRequestDetail, NewClubRequest } from "./pages/ClubRequestPages";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import "./personal.css";
const nav = [
  ["/me", "Tổng quan"],
  ["/me/clubs", "CLB tham gia"],
  ["/me/follows", "Đang quan tâm"],
  ["/me/registrations", "Hoạt động đã đăng ký"],
  ["/me/club-requests", "Đề nghị CLB"],
  ["/me/profile", "Hồ sơ cá nhân"],
];
export function PersonalApp({
  viewer,
  accessToken,
  role,
  onMeeting,
  onLogout,
}: DiscoveryViewer) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    document.title = "Không gian của tôi · uniCircle";
    window.scrollTo(0, 0);
    content.current?.focus({ preventScroll: true });
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (!viewer || !accessToken) return null;
  return (
    <div className="ps-app">
      <a className="ps-skip" href="#personal-content">
        Đến nội dung
      </a>
      <aside className="ps-sidebar">
        <Link className="ps-brand" to="/">
          uni<span>circle</span>.
        </Link>
        <div className="ps-identity">
          <span className="ps-avatar" aria-hidden="true">
            {viewer.displayName.trim().charAt(0).toUpperCase() || "S"}
          </span>
          <div>
            <strong>{viewer.displayName}</strong>
            <small>Không gian cá nhân</small>
          </div>
        </div>
        <button
          className="ps-mobile-toggle"
          aria-expanded={open}
          aria-controls="personal-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          Điều hướng cá nhân {open ? "−" : "+"}
        </button>
        <nav
          id="personal-navigation"
          className={open ? "is-open" : ""}
          aria-label="Điều hướng cá nhân"
        >
          {nav.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === "/me"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ps-sidebar-bottom">
          <Link to="/">← Khám phá công khai</Link>
          <button onClick={onMeeting} data-leave-account>
            Mở phòng họp
          </button>
          {role === "admin" && <Link to="/admin">Quản trị hệ thống ↗</Link>}
          <button onClick={onLogout} data-leave-account>
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="ps-workspace">
        <header className="ps-topbar">
          <Link to="/">Khám phá Bách khoa ↗</Link>
          <span>Tài khoản sinh viên</span>
        </header>
        <main id="personal-content" ref={content} tabIndex={-1}>
          <Routes>
            <Route
              path="/me"
              element={
                <PersonalOverview
                  token={accessToken}
                  displayName={viewer.displayName}
                />
              }
            />
            {(
              ["clubs", "follows", "registrations", "club-requests"] as const
            ).map((kind) => (
              <Route
                key={kind}
                path={`/me/${kind}`}
                element={<PersonalLists token={accessToken} kind={kind} />}
              />
            ))}
            <Route
              path="/me/club-requests/new"
              element={<NewClubRequest token={accessToken} />}
            />
            <Route
              path="/me/club-requests/:id"
              element={<ClubRequestDetail token={accessToken} />}
            />
            <Route
              path="/me/profile"
              element={
                <>
                  <div className="ps-heading">
                    <div>
                      <h1>Hồ sơ cá nhân</h1>
                      <p>Cập nhật thông tin sinh viên của bạn.</p>
                    </div>
                  </div>
                  <ProfileForm token={accessToken} />
                </>
              }
            />
            <Route
              path="*"
              element={
                <>
                  <h1>Trang chưa khả dụng</h1>
                  <Link to="/me">Về tổng quan →</Link>
                </>
              }
            />
          </Routes>
        </main>
        <footer className="ps-footer">
          uniCircle · Cộng đồng bắt đầu từ những kết nối.
        </footer>
      </div>
    </div>
  );
}
