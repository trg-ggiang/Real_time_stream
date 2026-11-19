// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotificationBell, notificationHref, type NotificationItem } from "./Notifications";
const callbacks = vi.hoisted(() => new Map<string, () => void>());
vi.mock("socket.io-client", () => ({ io: () => ({ on: (event: string, fn: () => void) => callbacks.set(event, fn), disconnect: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); callbacks.clear(); });
const item: NotificationItem = { notification_id: "notification", title: "Đơn ứng tuyển đã được duyệt", body: "Bạn đã được thêm vào CLB.", read_at: null, created_at: "2026-11-19T12:00:00Z", data: { href: "/me/recruitment-applications/app" } };
it("loads persisted notifications, refreshes on socket invalidation and closes on Escape", async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ items: [item], unread_count: 1 }) })); vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter><NotificationBell token="synthetic-token" /></MemoryRouter>);
  const button = await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }); fireEvent.click(button);
  expect(await screen.findByText(item.title)).toBeTruthy();
  const before = fetcher.mock.calls.length; callbacks.get("notifications:changed")?.();
  await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(before));
  fireEvent.keyDown(document, { key: "Escape" }); expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(button);
});
it("marks only the chosen notification read before opening the internal destination", async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ items: [item], unread_count: 1 }) })); vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter><NotificationBell token="synthetic-token" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" })); fireEvent.click(await screen.findByText(item.title));
  await waitFor(() => expect(fetcher.mock.calls.some(call => (call as unknown as [string])[0] === "/api/me/notifications/notification/read")).toBe(true));
});
it("never follows external, executable or admin destinations from notification payloads", () => {
  for (const href of ["https://evil.invalid", "//evil.invalid", "javascript:alert(1)", "/admin", "/%2f%2fevil.invalid"]) expect(notificationHref({ ...item, data: { href } })).toBe("/me/notifications");
  expect(notificationHref(item)).toBe("/me/recruitment-applications/app");
});
