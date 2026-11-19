// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClubContext, type WorkspaceSession } from "../workspace-context";
import type { Department } from "../services/workspace-api";
import { DepartmentsPage } from "./WorkspacePeople";

const context: WorkspaceSession = {
  clubId: "alpha", token: "session", reload: () => {},
  club: { club_id: "alpha", name: "CLB Alpha", summary: "", description: "", mission: null, logo_url: null, cover_url: null, contact_email: null, contact_phone: null },
  membership: { membership_id: "ma", user_id: "chair", club_id: "alpha", role: "chairperson", department_id: "management" },
};
const fixtures: Department[] = [
  { department_id: "technical", name: "Ban Kỹ thuật", description: "Phát triển website và công cụ của CLB", is_private: false, is_management: false, status: "active" },
  { department_id: "management", name: "Ban Điều hành", description: "Điều phối hoạt động của CLB", is_private: true, is_management: true, status: "active" },
  { department_id: "events", name: "Ban Sự kiện", description: null, is_private: false, is_management: false, status: "inactive" },
];
const request = vi.fn(async (_url: string, _options?: RequestInit): Promise<Pick<Response, "ok" | "status" | "json">> => ({ ok: true, status: 200, json: async () => ({ items: fixtures }) }));
const show = (role: "chairperson" | "member" = "chairperson") => render(<MemoryRouter><ClubContext.Provider value={{ ...context, membership: { ...context.membership, role } }}><div className="cw-app"><DepartmentsPage /></div></ClubContext.Provider></MemoryRouter>);
beforeEach(() => { request.mockReset(); request.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ items: fixtures }) })); vi.stubGlobal("fetch", request); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows every database department to members, including inactive/private/management, and hides write controls", async () => {
  show("member");
  expect(await screen.findByRole("rowheader", { name: /Ban Kỹ thuật/ })).toBeTruthy();
  const row = screen.getByRole("rowheader", { name: /Ban Điều hành/ }).closest("tr")!;
  expect(within(row).getByText("Ban quản lý")).toBeTruthy();
  expect(within(row).getByText("Riêng tư")).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: /Ban Sự kiện/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tạo ban" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Chỉnh sửa/ })).toBeNull();
  expect(request).toHaveBeenCalledWith("/api/workspace/alpha/departments", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer session" }) }));
});

it("combines accent-insensitive name search and status filters and restores all rows when cleared", async () => {
  show();
  await screen.findByRole("rowheader", { name: /Ban Kỹ thuật/ });
  fireEvent.change(screen.getByRole("searchbox", { name: "Tìm theo tên ban" }), { target: { value: "ky thuat" } });
  expect(screen.getByRole("rowheader", { name: /Ban Kỹ thuật/ })).toBeTruthy();
  expect(screen.queryByRole("rowheader", { name: /Ban Điều hành/ })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái ban" }), { target: { value: "inactive" } });
  expect(screen.getByRole("heading", { name: "Không có ban phù hợp" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
  expect(screen.getAllByRole("rowheader")).toHaveLength(3);
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái ban" }), { target: { value: "inactive" } });
  expect(screen.getAllByRole("rowheader")).toHaveLength(1);
  expect(screen.getByRole("rowheader", { name: /Ban Sự kiện/ })).toBeTruthy();
});

it("lets the chair create and edit through existing scoped APIs and reloads the database list", async () => {
  let items = [...fixtures];
  request.mockImplementation(async (url, options) => {
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    if (options?.method === "POST") items = [...items, { ...body, department_id: "new" }];
    if (options?.method === "PATCH") items = items.map(d => url.endsWith(d.department_id) ? { ...d, ...body } : d);
    return { ok: true, status: 200, json: async () => options?.method ? { item: items[items.length - 1] } : { items } };
  });
  show();
  await screen.findByRole("rowheader", { name: /Ban Kỹ thuật/ });
  fireEvent.click(screen.getByRole("button", { name: "Tạo ban" }));
  expect(screen.getByRole("heading", { name: "Tạo ban" })).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect((screen.getByRole("textbox", { name: /Tên ban/ }) as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByRole("textbox", { name: /Tên ban/ }), { target: { value: "Ban Hậu cần" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Mô tả" }), { target: { value: "Hỗ trợ tổ chức hoạt động" } });
  fireEvent.click(screen.getByRole("switch", { name: "Ban quản lý" }));
  fireEvent.click(screen.getByRole("switch", { name: "Ban riêng tư" }));
  fireEvent.submit(screen.getByRole("button", { name: "Tạo ban" }).closest("form")!);
  expect(await screen.findByRole("rowheader", { name: /Ban Hậu cần/ })).toBeTruthy();
  expect(request).toHaveBeenCalledWith("/api/workspace/alpha/departments", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Ban Hậu cần", description: "Hỗ trợ tổ chức hoạt động", is_private: true, is_management: true, status: "active" }) }));
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa Ban Hậu cần" }));
  expect((screen.getByRole("switch", { name: "Ban quản lý" }) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("combobox", { name: "Trạng thái" }) as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: /Tên ban/ }), { target: { value: "Ban Vận hành" } });
  fireEvent.submit(screen.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!);
  expect(await screen.findByRole("rowheader", { name: /Ban Vận hành/ })).toBeTruthy();
  expect(request).toHaveBeenCalledWith("/api/workspace/alpha/departments/new", expect.objectContaining({ method: "PATCH" }));
});

it("keeps form values on server failure and does not show success until the save is confirmed", async () => {
  show();
  await screen.findByRole("rowheader", { name: /Ban Kỹ thuật/ });
  fireEvent.click(screen.getByRole("button", { name: "Tạo ban" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Tên ban/ }), { target: { value: "Ban Thiết kế" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Trạng thái" }), { target: { value: "inactive" } });
  request.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: "Tên ban đã tồn tại." }) });
  fireEvent.submit(screen.getByRole("button", { name: "Tạo ban" }).closest("form")!);
  expect((await screen.findByRole("alert")).textContent).toContain("Tên ban đã tồn tại");
  expect((screen.getByRole("textbox", { name: /Tên ban/ }) as HTMLInputElement).value).toBe("Ban Thiết kế");
  expect((screen.getByRole("combobox", { name: "Trạng thái" }) as HTMLSelectElement).value).toBe("inactive");
  expect(screen.queryByText("Đã tạo ban thành công.")).toBeNull();
  fireEvent.click(screen.getByRole("switch", { name: "Ban quản lý" }));
  expect((screen.getByRole("combobox", { name: "Trạng thái" }) as HTMLSelectElement).value).toBe("active");
  fireEvent.click(screen.getByRole("button", { name: "Quay lại Các ban" }));
  expect(screen.getByRole("heading", { name: "Các ban" })).toBeTruthy();
});

it("supports retry and an empty database response without inventing departments", async () => {
  request.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ message: "Chưa tải được danh sách ban." }) });
  request.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) });
  show("member");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("rowheader")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByRole("heading", { name: "CLB chưa có ban nào" })).toBeTruthy();
  expect(screen.queryByRole("rowheader")).toBeNull();
});
