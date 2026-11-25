import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ClipboardText } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { UniCircleLogo } from "../../shared/components/UniCircleLogo";
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { Newspaper } from '@phosphor-icons/react/dist/csr/Newspaper';
import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';

const navigation = [
  { to: "/admin", label: "Tổng quan", Icon: SquaresFour },
  { to: "/admin/club-requests", label: "Đề nghị thành lập CLB", Icon: ClipboardText },
  { to: "/admin/clubs", label: "Danh sách CLB", Icon: UsersThree },
  { to: '/admin/users', label: 'Tài khoản', Icon: Users },
  { to: '/admin/content', label: 'Nội dung cộng đồng', Icon: Newspaper },
  { to: '/admin/support-reports', label: 'Báo cáo sự cố', Icon: Flag },
] as const;

export function AdminLayout({
  displayName,
  onLogout,
}: {
  displayName: string;
  onLogout?: () => void;
}) {
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    try { const saved = localStorage.getItem('unicircle.admin-theme'); return saved === 'dark' || saved === 'light' ? saved : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { return 'light'; }
  });
  useEffect(() => { try { localStorage.setItem('unicircle.admin-theme', theme); } catch { /* Optional preference. */ } }, [theme]);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const sidebarTrigger = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initial = displayName.trim().charAt(0).toLocaleUpperCase("vi-VN") || "A";
  const section = navigation.find(({ to }) => to !== "/admin" && (
    location.pathname === to || location.pathname.startsWith(`${to}/`)
  )) ?? navigation[0];

  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
    main.current?.focus({ preventScroll: true });
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLElement>('nav a[aria-current="page"], nav a')?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        sidebarTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => {
    if (!accountOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !account.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [accountOpen]);

  function handleMenuKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setAccountOpen(false);
      accountTrigger.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div className="ad-app ad-shell" data-theme={theme}>
      <a className="ad-skip" href="#admin-content">
        Đến nội dung
      </a>
      <aside id="admin-navigation" ref={sidebar} className={`ad-sidebar${open ? " is-open" : ""}`}>
        <Link className="ad-brand" to="/admin">
          <UniCircleLogo />
        </Link>
        <div className="ad-identity">
          <span className="ad-avatar" aria-hidden="true">{initial}</span>
          <div><strong>{displayName}</strong><small>Quản trị viên</small></div>
        </div>
        <nav aria-label="Điều hướng quản trị">
          {navigation.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/admin"}>
              <Icon size={20} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="ad-sidebar-bottom"><Link to="/"><ArrowSquareOut size={18} aria-hidden="true" /> Xem website</Link><span>Quản trị hệ thống</span></div>
      </aside>
      <div className="ad-workspace">
        <header className="ad-topbar">
          <div className="ad-topbar-inner">
            <button type="button" className="ad-menu" ref={sidebarTrigger} aria-label="Điều hướng quản trị" aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen((v) => !v)}>
              <List size={22} aria-hidden="true" />
            </button>
            <nav className="ad-breadcrumb" aria-label="Đường dẫn">
              <Link to="/admin">Quản trị</Link><span aria-hidden="true">/</span>
              <Link to={section.to} aria-current={location.pathname === section.to ? "page" : undefined}>{section.label}</Link>
            </nav>
            <button type="button" className="ad-theme-toggle" aria-label={theme === 'light' ? 'Chuyển giao diện tối' : 'Chuyển giao diện sáng'} onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
            <div className="ad-account" ref={account} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
            }}>
              <button type="button" className="ad-account-trigger" ref={accountTrigger} aria-label={`Tài khoản ${displayName}`} aria-haspopup="menu" aria-expanded={accountOpen} aria-controls="admin-account-menu" onClick={() => setAccountOpen((v) => !v)}>
                <span className="ad-avatar" aria-hidden="true">{initial}</span><CaretDown size={16} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div id="admin-account-menu" className="ad-account-menu" role="menu" aria-label="Tài khoản quản trị" ref={menu} onKeyDown={handleMenuKey}>
                  <button type="button" role="menuitem" className="ad-account-logout" onClick={onLogout} data-leave-account>
                    Đăng xuất <SignOut size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="admin-content" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="ad-footer">
          uniCircle · Kết nối cộng đồng Bách khoa
        </footer>
      </div>
    </div>
  );
}
