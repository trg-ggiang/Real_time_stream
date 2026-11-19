// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClubContext, type WorkspaceSession } from "../workspace-context";
import type { Department } from "../services/workspace-api";
import { RecruitmentPage } from "./RecruitmentPage";

const context: WorkspaceSession = {
  clubId: "alpha", token: "session", reload: () => {},
  club: { club_id: "alpha", name: "CLB Alpha", summary: "", description: "", mission: null, logo_url: null, cover_url: null, contact_email: null, contact_phone: null },
  membership: { membership_id: "ma", user_id: "chair", club_id: "alpha", role: "chairperson", department_id: "management" },
};
const show = (value = context) => render(<ClubContext.Provider value={value}><div className="cw-app"><RecruitmentPage /></div></ClubContext.Provider>);
const department = (department_id: string, name: string, status: "active" | "inactive" = "active"): Department => ({ department_id, name, status, description: null, is_management: false, is_private: false });
const departments = [department("11111111-1111-4111-8111-111111111111", "Ban Kỹ thuật"), department("22222222-2222-4222-8222-222222222222", "Ban Truyền thông")];
const response = (items: Department[]) => ({ ok: true, status: 200, json: async () => ({ items }) });
const request = vi.fn(async (_url: string, _options?: RequestInit): Promise<Pick<Response, "ok" | "status" | "json">> => response(departments));
const ready = () => screen.findByRole("textbox", { name: /Tên đợt tuyển/ });
beforeEach(() => { request.mockReset(); request.mockImplementation(async () => response(departments)); vi.stubGlobal("fetch", request); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it("reads the current club's departments and keeps edits when switching, without backend writes", async () => {
  show();
  await ready();
  screen.getAllByRole("textbox").forEach(field => expect((field as HTMLInputElement).value).toBe(""));
  screen.getAllByRole("spinbutton").forEach(field => expect((field as HTMLInputElement).value).toBe(""));
  fireEvent.change(screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }), { target: { value: "12" } });
  fireEvent.change(screen.getByRole("textbox", { name: /Mô tả công việc/ }), { target: { value: "Xây dựng website cộng đồng" } });
  fireEvent.click(screen.getByRole("tab", { name: "Ban Truyền thông" }));
  expect((screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }) as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }), { target: { value: "9" } });
  fireEvent.keyDown(screen.getByRole("tab", { name: "Ban Truyền thông" }), { key: "ArrowLeft" });
  expect((screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }) as HTMLInputElement).value).toBe("12");
  expect((screen.getByRole("textbox", { name: /Mô tả công việc/ }) as HTMLTextAreaElement).value).toBe("Xây dựng website cộng đồng");
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Kỹ thuật" }));
  expect((screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }) as HTMLInputElement).value).toBe("9");
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Kỹ thuật" }));
  fireEvent.click(screen.getByRole("tab", { name: "Ban Kỹ thuật" }));
  expect((screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }) as HTMLInputElement).value).toBe("12");
  expect(request).toHaveBeenCalledWith("/api/workspace/alpha/departments", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer session" }) }));
  expect(request.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});

it("previews current questions and limits per department, and keeps drafts scoped to user and club", async () => {
  const view = show();
  await ready();
  fireEvent.change(screen.getByRole("textbox", { name: /Tên đợt tuyển/ }), { target: { value: "Tìm bạn đồng hành" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm câu hỏi" }));
  const added = screen.getByText("Câu hỏi 2").closest("details")!;
  fireEvent.change(within(added).getByRole("textbox", { name: /^Câu hỏi/ }), { target: { value: "Dự án bạn tự hào nhất?" } });
  fireEvent.change(within(added).getByRole("spinbutton", { name: /Giới hạn ký tự/ }), { target: { value: "240" } });
  fireEvent.click(within(added).getByRole("switch", { name: "Bắt buộc câu hỏi 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Xem trước mẫu đơn" }));
  const preview = await screen.findByRole("dialog");
  const answer = within(preview).getByRole("textbox", { name: /Dự án bạn tự hào nhất/ }) as HTMLTextAreaElement;
  expect(answer.maxLength).toBe(240); expect(answer.required).toBe(false);
  fireEvent.click(within(preview).getByRole("tab", { name: "Ban Truyền thông" }));
  expect(within(preview).queryByRole("textbox", { name: /Dự án bạn tự hào nhất/ })).toBeNull();
  fireEvent.click(within(preview).getByRole("button", { name: "Đóng xem trước" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  expect(screen.getByRole("status").textContent).toContain("trong tab trình duyệt này");
  view.unmount();
  const restored = show();
  await ready();
  expect((screen.getByRole("textbox", { name: /Tên đợt tuyển/ }) as HTMLInputElement).value).toBe("Tìm bạn đồng hành");
  expect((screen.getByRole("switch", { name: "Bắt buộc câu hỏi 2" }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Xóa câu hỏi 2" }));
  expect(screen.queryByText("Câu hỏi 2")).toBeNull();
  restored.unmount();
  const otherUser = show({ ...context, membership: { ...context.membership, user_id: "another-chair" } });
  await ready();
  expect((screen.getByRole("textbox", { name: /Tên đợt tuyển/ }) as HTMLInputElement).value).toBe("");
  otherUser.unmount();
  show({ ...context, clubId: "beta", club: { ...context.club, club_id: "beta" } });
  await ready();
  expect((screen.getByRole("textbox", { name: /Tên đợt tuyển/ }) as HTMLInputElement).value).toBe("");
  expect(request).toHaveBeenCalledWith("/api/workspace/beta/departments", expect.anything());
  expect(request.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});

it("handles empty departments, invalid date order and image selection honestly", async () => {
  show();
  await ready();
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Kỹ thuật" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Truyền thông" }));
  fireEvent.click(screen.getByRole("button", { name: "Xem trước mẫu đơn" }));
  expect(screen.getByRole("alert").textContent).toContain("Chọn ít nhất một ban");
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Kỹ thuật" }));
  fireEvent.change(screen.getByLabelText(/Mở đơn/), { target: { value: "2026-12-10" } });
  fireEvent.change(screen.getByLabelText(/Đóng đơn/), { target: { value: "2026-12-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem trước mẫu đơn" }));
  expect(screen.getByRole("alert").textContent).toContain("Ngày đóng đơn phải sau ngày mở đơn");
  fireEvent.change(screen.getByLabelText(/Đóng đơn/), { target: { value: "2026-12-20" } });
  fireEvent.change(screen.getByLabelText("Chọn ảnh bìa"), { target: { files: [new File(["<svg />"], "cover.svg", { type: "image/svg+xml" })] } });
  expect(screen.getByRole("alert").textContent).toContain("PNG hoặc JPG");
  fireEvent.change(screen.getByLabelText("Chọn ảnh bìa"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
  expect(await screen.findByRole("img", { name: "Ảnh bìa đợt tuyển" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh bìa" }));
  expect(screen.queryByRole("img", { name: "Ảnh bìa đợt tuyển" })).toBeNull();
});

it("reconciles saved settings with current database department IDs and names instead of reviving removed or sample departments", async () => {
  const view = show();
  await ready();
  fireEvent.change(screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  view.unmount();
  request.mockResolvedValueOnce(response([
    department(departments[0].department_id, "Ban Công nghệ"),
    department(departments[1].department_id, "Ban Truyền thông", "inactive"),
    department("33333333-3333-4333-8333-333333333333", "Ban Hậu cần"),
  ]));
  show();
  await ready();
  expect(screen.getByRole("checkbox", { name: "Ban Công nghệ" })).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "Ban Kỹ thuật" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "Ban Truyền thông" })).toBeNull();
  expect((screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }) as HTMLInputElement).value).toBe("12");
  fireEvent.click(screen.getByRole("tab", { name: "Ban Hậu cần" }));
  expect((screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }) as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("textbox", { name: /Mô tả công việc/ }) as HTMLTextAreaElement).value).toBe("");
});

it("shows loading and retry on read failure, then an honest empty state without sample departments", async () => {
  request.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ message: "Chưa tải được ban của CLB." }) });
  request.mockResolvedValueOnce(response([]));
  show();
  expect(screen.getByRole("status").textContent).toContain("Đang tải các ban");
  expect((await screen.findByRole("alert")).textContent).toContain("Chưa tải được ban");
  expect(screen.queryByRole("checkbox", { name: "Ban Kỹ thuật" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Thử tải lại các ban" }));
  expect(await screen.findByText(/CLB chưa có ban đang hoạt động/)).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Xem trước mẫu đơn" }));
  expect(screen.getByRole("alert").textContent).toContain("Chọn ít nhất một ban");
});
