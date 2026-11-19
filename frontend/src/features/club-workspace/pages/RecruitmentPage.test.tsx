// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClubContext, type WorkspaceSession } from "../workspace-context";
import type { Department } from "../services/workspace-api";
import { RecruitmentPage } from "./RecruitmentPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ContentList } from "./WorkspaceContent";
import { RecruitmentDetail } from "./RecruitmentActivities";

const context: WorkspaceSession = {
  clubId: "alpha", token: "session", reload: () => {},
  club: { club_id: "alpha", name: "CLB Alpha", summary: "", description: "", mission: null, logo_url: null, cover_url: null, contact_email: null, contact_phone: null },
  membership: { membership_id: "ma", user_id: "chair", club_id: "alpha", role: "chairperson", department_id: "management" },
};
const show = (value = context) => render(<MemoryRouter><ClubContext.Provider value={value}><div className="cw-app"><RecruitmentPage /></div></ClubContext.Provider></MemoryRouter>);
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

it("excludes management departments including those enabled in a previously saved draft", async () => {
  const first = show(); await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
  first.unmount();
  request.mockResolvedValueOnce(response([{ ...departments[0], is_management: true }, departments[1]]));
  show(); await ready();
  expect(screen.queryByRole('checkbox', { name: 'Ban Kỹ thuật' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Ban Kỹ thuật' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Ban Truyền thông' })).toBeTruthy();
});

async function fillPublication() {
  await ready();
  fireEvent.change(screen.getByRole("textbox", { name: /Tên đợt tuyển/ }), { target: { value: "Tìm bạn đồng hành" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Mô tả" }), { target: { value: "Cùng xây dựng website cộng đồng." } });
  fireEvent.change(screen.getByLabelText(/Mở đơn/), { target: { value: "2026-12-01" } });
  fireEvent.change(screen.getByLabelText(/Đóng đơn/), { target: { value: "2026-12-20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Truyền thông" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Mô tả công việc/ }), { target: { value: "Xây dựng website" } });
  fireEvent.change(screen.getByRole("textbox", { name: /^Yêu cầu/ }), { target: { value: "Ham học hỏi" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: /Chỉ tiêu/ }), { target: { value: "12" } });
  fireEvent.change(screen.getByRole("textbox", { name: /^Câu hỏi/ }), { target: { value: "Bạn muốn học điều gì?" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: /Giới hạn ký tự/ }), { target: { value: "240" } });
}

it("uploads the cover, saves the entire form, and displays the persisted recruitment on Activities and detail", async () => {
  let campaign: Record<string, unknown> | null = null;
  request.mockImplementation(async (url, options) => {
    if (url.endsWith("/departments")) return response(departments);
    if (url.endsWith("/recruitment-cover")) return { ok: true, status: 200, json: async () => ({ cover_url: "https://storage.example/cover.png" }) };
    if (options?.method === "POST") {
      const submitted = JSON.parse(options.body as string);
      campaign = { ...submitted, club_id: "alpha", status: "open", created_by: "chair", updated_at: "2026-11-19T08:00:00Z",
        departments: submitted.departments.map((d: Record<string, unknown>) => ({ ...d, club_departments: { name: "Ban Kỹ thuật" }, recruitment_questions: d.questions })) };
      return { ok: true, status: 201, json: async () => ({ item: campaign }) };
    }
    if (url.includes("/content/activities")) return response([]);
    if (url.includes("/recruitment?")) return { ok: true, status: 200, json: async () => ({ items: campaign ? [campaign] : [], hasMore: false }) };
    return { ok: true, status: 200, json: async () => ({ item: campaign }) };
  });
  render(<MemoryRouter initialEntries={["/workspace/alpha/recruitment"]}><ClubContext.Provider value={context}><div className="cw-app"><Routes>
    <Route path="/workspace/alpha/recruitment" element={<RecruitmentPage />} />
    <Route path="/workspace/alpha/activities" element={<ContentList kind="activities" />} />
    <Route path="/workspace/alpha/recruitment/:id" element={<RecruitmentDetail />} />
  </Routes></div></ClubContext.Provider></MemoryRouter>);
  await fillPublication();
  fireEvent.change(screen.getByLabelText("Chọn ảnh bìa"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
  await screen.findByRole("img", { name: "Ảnh bìa đợt tuyển" });
  fireEvent.click(screen.getByRole("button", { name: "Đăng đợt tuyển" }));
  await screen.findByRole("heading", { name: "Hoạt động CLB" });
  expect(screen.getByText("Đã lưu mẫu đơn và đăng đợt tuyển lên Hoạt động CLB.").getAttribute("role")).toBe("status");
  const coverCall = request.mock.calls.find(([url]) => url.endsWith("/recruitment-cover"))!;
  expect(coverCall[1]?.body).toBeInstanceOf(FormData);
  expect((coverCall[1]?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  const sent = JSON.parse(request.mock.calls.find(([url, options]) => url.endsWith("/recruitment") && options?.method === "POST")![1]!.body as string);
  expect(sent.application_opens_at).toBe("2026-12-01T00:00:00+07:00");
  expect(sent.application_closes_at).toBe("2026-12-20T23:59:59.999+07:00");
  expect(sent.cover_url).toBe("https://storage.example/cover.png");
  expect(sent.departments).toHaveLength(1);
  expect(sent.departments[0].department_id).toBe(departments[0].department_id);
  expect(sent.departments[0].questions[0]).toMatchObject({ question_text: "Bạn muốn học điều gì?", is_required: true, max_length: 240 });
  expect(sessionStorage.getItem("uc:recruitment:v2:chair:alpha")).toBeNull();
  fireEvent.click(await screen.findByRole("link", { name: "Tìm bạn đồng hành" }));
  expect(await screen.findByText("Bạn muốn học điều gì?")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Ban Kỹ thuật" })).toBeTruthy();
});

it("keeps form data after publication failure and reuses IDs on manual retry without automatic writes", async () => {
  request.mockImplementation(async (url, options) => options?.method === "POST"
    ? { ok: false, status: 503, json: async () => ({ message: "Chưa lưu được đợt tuyển." }) }
    : response(departments));
  show(); await fillPublication();
  fireEvent.click(screen.getByRole("button", { name: "Đăng đợt tuyển" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Chưa lưu được đợt tuyển");
  expect((screen.getByRole("textbox", { name: /Tên đợt tuyển/ }) as HTMLInputElement).value).toBe("Tìm bạn đồng hành");
  const first = request.mock.calls.filter(([, options]) => options?.method === "POST");
  expect(first).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Đăng đợt tuyển" }));
  await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(2));
  const writes = request.mock.calls.filter(([, options]) => options?.method === "POST");
  expect(writes[1][1]!.body).toBe(writes[0][1]!.body);
});

it("validates every selected department before sending any publication request", async () => {
  show(); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Đăng đợt tuyển" }));
  expect(screen.getByRole("alert").textContent).toContain("Nhập tên đợt tuyển");
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  await fillPublication();
  fireEvent.click(screen.getByRole("checkbox", { name: "Ban Truyền thông" }));
  fireEvent.click(screen.getByRole("button", { name: "Đăng đợt tuyển" }));
  expect(screen.getByRole("alert").textContent).toContain("Ban Truyền thông");
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});
