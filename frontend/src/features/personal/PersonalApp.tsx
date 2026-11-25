import { UniCircleLogo } from "../../shared/components/UniCircleLogo";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { CalendarCheck } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { ProfileForm } from "../profile/ProfileForm";
import { PersonalActivitiesPage, PersonalLists } from "./pages/PersonalLists";
import { ClubRequestDetail, NewClubRequest } from "./pages/ClubRequestPages";
import type { DiscoveryViewer } from "../discovery/DiscoveryApp";
import "./personal.css";
import "./personal-layout.css";
import { MyRecruitmentApplication,MyRecruitmentApplications } from '../recruitment/PublicRecruitment';
const nav = [
  ["/me/clubs", "CLB tham gia", Users],
  ["/me/follows", "Đang quan tâm", Heart],
  ["/me/registrations", "Hoạt động đã đăng ký", CalendarCheck],
  ["/me/recruitment-applications", "Đơn ứng tuyển", CalendarCheck],
  ["/me/profile", "Hồ sơ cá nhân", UserCircle],
] as const;
export function PersonalApp({
  viewer,
  accessToken,
  role,
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
    <div className="ps-app ps-student-shell">
      <a className="ps-skip" href="#personal-content">
        Đến nội dung
      </a>
      <aside className="ps-sidebar">
        <Link className="ps-brand" to="/">
          <UniCircleLogo />
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
        <div id="personal-navigation" className={`ps-sidebar-menu${open ? " is-open" : ""}`}>
          <nav
            className={open ? "is-open" : ""}
            aria-label="Điều hướng cá nhân"
          >
            {nav.map(([path, label, Icon]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  isActive ||
                  (path === "/me/clubs" &&
                    location.pathname.startsWith("/me/club-requests/"))
                    ? "active"
                    : undefined
                }
              >
                <Icon size={19} weight="regular" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ps-sidebar-bottom">
            <Link to="/"><Compass size={18} aria-hidden="true" />Khám phá công khai</Link>
            {role === "admin" && <Link to="/admin"><GearSix size={18} aria-hidden="true" />Quản trị hệ thống</Link>}
            <button className="ps-logout" onClick={onLogout} data-leave-account>
              <SignOut size={18} aria-hidden="true" />Đăng xuất
            </button>
          </div>
        </div>
      </aside>
      <div className="ps-workspace">
        <header className="ps-topbar">
          <Link to="/">Khám phá Bách khoa ↗</Link>
          <span>Tài khoản sinh viên</span>
        </header>
        <main id="personal-content" ref={content} tabIndex={-1}>
          <Routes>
            <Route path="/me/recruitment-applications" element={<MyRecruitmentApplications token={accessToken} />} />
            <Route path="/me/recruitment-applications/:applicationId" element={<MyRecruitmentApplication token={accessToken} />} />
            <Route path="/me" element={<Navigate replace to="/me/registrations" />} />
            <Route path="/me/clubs" element={<Navigate replace to="/workspace" />} />
            <Route
              path="/me/registrations"
              element={<PersonalActivitiesPage token={accessToken} />}
            />
            {(
              ["follows"] as const
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
                  <Link to="/workspace">Về Không gian CLB →</Link>
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
