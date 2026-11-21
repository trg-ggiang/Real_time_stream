// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AdminApp } from "./AdminApp";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders admin pages inside the same layout when navigating", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const request = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.endsWith("/summary")
      ? { pending: 0, published: 0, rejected: 0 }
      : { items: [], total: 0, page: 1, limit: 12, hasMore: false },
  }));
  vi.stubGlobal("fetch", request);
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminApp viewer={{ displayName: "An" }} accessToken="session" role="admin" />
    </MemoryRouter>,
  );

  await screen.findByText("Đang chờ xét duyệt");
  const main = screen.getByRole("main");
  const sidebar = within(screen.getByRole("navigation", { name: "Điều hướng quản trị" }));
  const directory = sidebar.getByRole("link", { name: "Danh sách CLB" });
  fireEvent.click(directory);
  await waitFor(() => expect(request.mock.calls.some(([url]) => url.includes("scope=directory"))).toBe(true));
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
