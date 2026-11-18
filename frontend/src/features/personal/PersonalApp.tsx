import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ProfileForm } from "../profile/ProfileForm";
import { PersonalLists } from "./pages/PersonalLists";
import { AccountOverview } from "./pages/AccountOverview";
import { ClubRequestDetail, NewClubRequest } from "./pages/ClubRequestPages";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import "./personal.css";
const nav = [
  ["/me", "Tổng quan tài khoản"],
  ["/me/profile", "Hồ sơ sinh viên"],
  ["/me/registrations", "Hoạt động đã đăng ký"],
  ["/me/follows", "CLB đang quan tâm"],
  ["/me/club-requests", "Đề nghị thành lập CLB"],
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
    document.title = "Tài khoản · uniCircle";
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
            <small>Tài khoản sinh viên</small>
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
          <Link to="/">Trang chủ</Link>
          <Link to="/workspace">Không gian sinh hoạt</Link>
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
          <Link to="/">← Trang chủ</Link>
          <Link to="/workspace">Không gian sinh hoạt →</Link>
        </header>
        <main id="personal-content" ref={content} tabIndex={-1}>
          <Routes>
            <Route path="/me/clubs" element={<Navigate replace to="/workspace" />} />
            <Route
              path="/me"
              element={
                <AccountOverview displayName={viewer.displayName} />
              }
            />
            {(
              ["follows", "registrations", "club-requests"] as const
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
                      <h1>Hồ sơ sinh viên</h1>
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
          uniCircle · Tài khoản sinh viên
        </footer>
      </div>
    </div>
  );
}
