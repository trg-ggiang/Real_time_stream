import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import { AdminOverview } from "./pages/AdminOverview";
import { ClubList } from "./pages/ClubList";
import { RequestDetailRoute } from "./pages/ClubRequestDetail";
import "./admin.css";
export function AdminApp({
  viewer,
  accessToken = "",
  role,
  onLogout,
}: DiscoveryViewer) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.title = "Quản trị hệ thống · uniCircle";
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (!viewer || !accessToken)
    return (
      <div className="ad-app ad-gate">
        <main>
          <h1>Quản trị hệ thống</h1>
          <p>Đăng nhập để kiểm tra quyền truy cập.</p>
          <a className="ad-primary" href={`${location.pathname}?mode=login`}>
            Đăng nhập
          </a>
          <Link to="/">Về khám phá</Link>
        </main>
      </div>
    );
  if (role !== "admin")
    return (
      <div className="ad-app ad-gate">
        <main>
          <h1>Bạn không có quyền quản trị</h1>
          <p>
            Khu vực này dành cho quản trị viên nền tảng. Quyền chủ nhiệm CLB
            không cấp quyền quản trị hệ thống.
          </p>
          <Link className="ad-primary" to="/me">
            Về không gian của tôi
          </Link>
          <Link to="/">Khám phá công khai</Link>
        </main>
      </div>
    );
  return (
    <div className="ad-app">
      <a className="ad-skip" href="#admin-content">
        Đến nội dung
      </a>
      <aside className="ad-sidebar">
        <Link className="ad-brand" to="/">
          uni<span>circle</span>.
        </Link>
        <div className="ad-identity">
          <strong>Quản trị hệ thống</strong>
          <span>{viewer.displayName}</span>
          <small>Quản trị viên nền tảng</small>
        </div>
        <button
          className="ad-menu"
          aria-expanded={open}
          aria-controls="admin-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          Điều hướng quản trị {open ? "−" : "+"}
        </button>
        <nav
          id="admin-navigation"
          className={open ? "is-open" : ""}
          aria-label="Điều hướng quản trị"
        >
          <NavLink to="/admin" end>
            Tổng quan
          </NavLink>
          <NavLink to="/admin/club-requests">Đề nghị thành lập CLB</NavLink>
          <NavLink to="/admin/clubs">Danh sách CLB</NavLink>
        </nav>
        <div className="ad-sidebar-bottom">
          <Link to="/">← Khám phá công khai</Link>
          <Link to="/me">Không gian cá nhân ↗</Link>
          <button onClick={onLogout} data-leave-account>
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="ad-workspace">
        <header className="ad-topbar">
          <span>uniCircle / Quản trị nền tảng</span>
          <span>{viewer.displayName}</span>
        </header>
        <main id="admin-content" ref={main} tabIndex={-1}>
          <Routes>
            <Route
              path="/admin"
              element={<AdminOverview token={accessToken} />}
            />
            <Route
              path="/admin/club-requests"
              element={<ClubList key="requests" token={accessToken} />}
            />
            <Route
              path="/admin/clubs"
              element={
                <ClubList key="directory" token={accessToken} directory />
              }
            />
            <Route
              path="/admin/club-requests/:id"
              element={<RequestDetailRoute token={accessToken} />}
            />
            <Route
              path="/admin/clubs/:id"
              element={<RequestDetailRoute token={accessToken} directory />}
            />
            <Route
              path="*"
              element={
                <>
                  <h1>Trang quản trị chưa khả dụng</h1>
                  <Link to="/admin">Về tổng quan →</Link>
                </>
              }
            />
          </Routes>
        </main>
        <footer className="ad-footer">
          uniCircle · Kết nối cộng đồng Bách khoa
        </footer>
      </div>
    </div>
  );
}
