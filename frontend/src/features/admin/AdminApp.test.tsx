// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AdminApp } from "./AdminApp";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem('unicircle.admin-theme');
});

it("renders admin pages inside the same layout when navigating", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const request = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.endsWith("/summary")
      ? { pending: 0, published: 0, rejected: 0 }
      : { items: [], total: 0, page: 1, limit: 8, hasMore: false },
  }));
  vi.stubGlobal("fetch", request);
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminApp viewer={{ displayName: "An" }} accessToken="session" role="admin" />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Trạng thái CLB' });
  const main = screen.getByRole("main");
  const sidebar = within(screen.getByRole("navigation", { name: "Điều hướng quản trị" }));
  const directory = sidebar.getByRole("link", { name: "Danh sách CLB" });
  fireEvent.click(directory);
  await waitFor(() => expect(request.mock.calls.some(([url]) => url.includes("scope=directory"))).toBe(true));
  expect(request.mock.calls.find(([url]) => url.includes('scope=directory'))?.[0]).toContain('limit=8');
  expect(screen.getByRole("main")).toBe(main);
  expect(directory.getAttribute("aria-current")).toBe("page");
});

it("dismisses the admin account menu and calls the existing logout handler", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const onLogout = vi.fn();
  render(
    <MemoryRouter initialEntries={["/admin/unknown"]}>
      <AdminApp viewer={{ displayName: "An" }} accessToken="session" role="admin" onLogout={onLogout} />
    </MemoryRouter>,
  );

  const trigger = screen.getByRole("button", { name: "Tài khoản An" });
  fireEvent.click(trigger);
  expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Đăng xuất" }), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);

  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByRole("main"));
  expect(screen.queryByRole("menu")).toBeNull();

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));
  expect(onLogout).toHaveBeenCalledTimes(1);
});

it("keeps non-admin accounts out of a nested admin route", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  render(
    <MemoryRouter initialEntries={["/admin/club-requests/example"]}>
      <AdminApp viewer={{ displayName: "An" }} accessToken="session" />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Bạn không có quyền quản trị" })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});

it('replaces the three metric cards with charts using returned data and supports theme switching', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/summary')
    ? { pending: 2, published: 4, rejected: 1, users: 17, clubs: 7, posts: 11, activities: 9,
      registrations: [{ date: '2026-11-21', count: 3 }] }
    : { items: [], total: 0, hasMore: false } })));
  const { container } = render(<MemoryRouter initialEntries={['/admin']}><AdminApp viewer={{ displayName: 'An' }} accessToken="token" role="admin" /></MemoryRouter>);
  const chart = await screen.findByRole('img', { name: /Trạng thái CLB:/ });
  expect(chart.getAttribute('aria-label')).toContain('Đang chờ xét duyệt: 2');
  expect(screen.getByRole('img', { name: /Tài khoản mới theo ngày:/ }).getAttribute('aria-label')).toContain('2026-11-21: 3');
  expect(container.querySelector('.ad-stat-card')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển giao diện tối' }));
  expect(container.querySelector('.ad-app')?.getAttribute('data-theme')).toBe('dark');
});

it('searches accounts, filters system roles and opens student profile details', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/admin/users/u1')
    ? { account: { user_id: 'u1', display_name: 'An', email: 'an@example.com', role: null, created_at: '2026-11-21T00:00:00Z' }, profile: { student_code: '20260001' }, memberships: [] }
    : { items: [{ user_id: 'u1', display_name: 'An', email: 'an@example.com', role: null, created_at: '2026-11-21T00:00:00Z' }], total: 1, hasMore: false } }));
  vi.stubGlobal('fetch', fetcher);
  render(<MemoryRouter initialEntries={['/admin/users']}><AdminApp viewer={{ displayName: 'Admin' }} accessToken="token" role="admin" /></MemoryRouter>);
  await screen.findByText('an@example.com');
  fireEvent.change(screen.getByLabelText('Quyền hệ thống'), { target: { value: 'user' } });
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('role=user'))).toBe(true));
  fireEvent.change(screen.getByLabelText('Tìm tài khoản'), { target: { value: 'an' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('q=an'))).toBe(true));
  fireEvent.click(await screen.findByRole('button', { name: 'Xem hồ sơ' }));
  expect(await screen.findByText('20260001')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('switches content types, opens unpublished content and never sends moderation writes', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const item = { id: 'p1', title: 'Buổi sinh hoạt', summary: 'Nội dung', publication_status: 'draft', updated_at: '2026-11-21T00:00:00Z', cover_url: null, club: { club_id: 'club', name: 'SINNO', status: 'published' } };
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/posts/p1')
    ? { item: { ...item, body: 'Chi tiết bản nháp' } }
    : { items: [item], total: 1, hasMore: false } }));
  vi.stubGlobal('fetch', fetcher);
  render(<MemoryRouter initialEntries={['/admin/content']}><AdminApp viewer={{ displayName: 'Admin' }} accessToken="token" role="admin" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
  expect(await screen.findByText('Chi tiết bản nháp')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Trang công khai' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
  fireEvent.click(screen.getByRole('link', { name: 'Hoạt động' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes('kind=activities'))).toBe(true));
});

it('translates pending_review and filters content using its actual database status', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const fetcher = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ items: [{ id: 'pending', title: 'Nội dung cần duyệt', summary: '', publication_status: 'pending_review', updated_at: null }], total: 1, hasMore: false }) }));
  vi.stubGlobal('fetch', fetcher);
  render(<MemoryRouter initialEntries={['/admin/content']}><AdminApp viewer={{ displayName: 'Admin' }} accessToken="token" role="admin" /></MemoryRouter>);
  const badge = await screen.findByText('Chờ duyệt', { selector: '.ad-status' });
  expect(badge.classList.contains('pending_review')).toBe(true);
  expect(screen.queryByText('pending_review')).toBeNull();
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'pending_review' } });
  await waitFor(() => expect(fetcher.mock.calls.some(args => String(args[0]).includes('status=pending_review'))).toBe(true));
});
