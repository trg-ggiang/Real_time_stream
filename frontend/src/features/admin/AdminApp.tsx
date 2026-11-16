import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { authFormHref } from "../auth/redirect";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import { AdminOverview } from "./pages/AdminOverview";
import { ClubList } from "./pages/ClubList";
import { RequestDetailRoute } from "./pages/ClubRequestDetail";
import { AdminLayout } from "./AdminLayout";
import "./admin.css";

export function AdminApp({
  viewer,
  accessToken = "",
  role,
  onLogout,
}: DiscoveryViewer) {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Quản trị hệ thống · uniCircle";
  }, [location.pathname, location.search]);

  if (!viewer || !accessToken)
    return (
      <div className="ad-app ad-gate">
        <main>
          <h1>Quản trị hệ thống</h1>
          <p>Đăng nhập để kiểm tra quyền truy cập.</p>
          <a className="ad-primary" href={authFormHref("login", "/admin")}>
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
    <Routes>
      <Route
        path="/admin"
        element={<AdminLayout displayName={viewer.displayName} onLogout={onLogout} />}
      >
        <Route index element={<AdminOverview token={accessToken} />} />
        <Route
          path="club-requests"
          element={<ClubList key="requests" token={accessToken} />}
        />
        <Route
          path="clubs"
          element={<ClubList key="directory" token={accessToken} directory />}
        />
        <Route
          path="club-requests/:id"
          element={<RequestDetailRoute token={accessToken} />}
        />
        <Route
          path="clubs/:id"
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
      </Route>
    </Routes>
  );
}
