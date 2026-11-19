// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RecruitmentApply, RecruitmentList } from "./RecruitmentPublic";
import { RecruitmentEditor } from "./RecruitmentManagement";
import { RecruitmentReview, RecruitmentReviewDetail } from "./RecruitmentApplications";
import { FormBuilder, newQuestion } from "./FormBuilder";
import { ClubContext, type WorkspaceSession } from "../club-workspace/workspace-context";
import { Markdown } from "./Markdown";
import { accountRequest } from "../../shared/api/account-http";
import { initialValues, validateValues } from "./form";
import type { CampaignDetail } from "./types";
const timestamp = "2026-11-19T12:00:00.123456+00:00";
const q = { ...newQuestion(), question_id: "q1", question_text: "Họ tên", profile_field: "full_name" };
const d = { recruitment_department_id: "recruiting-department", department_id: "club-department", department_name: "Ban kỹ thuật", description: "Công việc kỹ thuật", questions: [q], form_version_id: "version-1", current_form_version_id: "version-1" };
const campaign: CampaignDetail = { item: { campaign_id: "campaign", club_id: "club", title: "Tuyển thành viên mùa thu", description: "Mô tả tuyển thành viên", application_opens_at: "2020-01-01T00:00:00Z", application_closes_at: "2099-01-01T00:00:00Z", updated_at: timestamp, status: "open", accepting_applications: true }, departments: [d], application_count: 1 };
const app = { application_id: "app", campaign_id: "campaign", display_status: "pending", status: "submitted", updated_at: timestamp, profile_snapshot: { full_name: "Minh Hải", student_code: "20235703" } };
const context = { ...campaign, profile: { full_name: "Minh Hải", email: "student@example.edu" }, application: null, can_apply: true };
const workspace = { token: "synthetic-token", clubId: "club", membership: { role: "chairperson" }, club: { name: "Test club" }, reload: vi.fn() } as unknown as WorkspaceSession;
let requests: { url: string; options?: RequestInit }[];
function stub(handler: (url: string, options?: RequestInit) => unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => { requests.push({ url, options }); const data = handler(url, options); return { ok: true, json: async () => data }; }));
}
beforeEach(() => { requests = []; vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("prefills profile, requires a review and consent, then submits once with the exact form version", async () => {
  stub((url, options) => options?.method === "POST" ? { item: app } : context);
  render(<MemoryRouter initialEntries={["/recruitments/campaign/apply"]}><Routes><Route path="/recruitments/:campaignId/apply" element={<RecruitmentApply token="synthetic-token" />} /><Route path="/me/recruitment-applications/:applicationId" element={<h1>Đã nhận đơn</h1>} /></Routes></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Ban ứng tuyển"), { target: { value: d.recruitment_department_id } });
  expect((screen.getByLabelText("Họ tên") as HTMLInputElement).value).toBe("Minh Hải");
  fireEvent.click(screen.getByRole("button", { name: "Xem lại đơn →" }));
  const submit = screen.getByRole("button", { name: "Xác nhận nộp đơn" }); expect((submit as HTMLButtonElement).disabled).toBe(true);
  expect(requests.filter(r => r.options?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByRole("checkbox", { name: /Tôi xác nhận/ })); fireEvent.click(submit); fireEvent.click(submit);
  await screen.findByRole("heading", { name: "Đã nhận đơn" });
  const writes = requests.filter(r => r.options?.method === "POST"); expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0].options?.body))).toEqual({ recruitment_department_id: "recruiting-department", form_version_id: "version-1", answers: [{ question_id: "q1", value: "Minh Hải" }] });
});
it("blocks active members and offers an existing submission instead of another form", async () => {
  stub(() => ({ ...context, can_apply: false, unavailable_reason: "ALREADY_MEMBER" }));
  const view = render(<MemoryRouter initialEntries={["/recruitments/campaign/apply"]}><Routes><Route path="/recruitments/:campaignId/apply" element={<RecruitmentApply token="synthetic-token" />} /></Routes></MemoryRouter>);
  expect(await screen.findByText("Bạn đã là thành viên của CLB này.")).toBeTruthy(); expect(screen.queryByLabelText("Ban ứng tuyển")).toBeNull();
  view.unmount(); stub(() => ({ ...context, can_apply: false, application: app }));
  render(<MemoryRouter initialEntries={["/recruitments/campaign/apply"]}><Routes><Route path="/recruitments/:campaignId/apply" element={<RecruitmentApply token="synthetic-token" />} /></Routes></MemoryRouter>);
  expect((await screen.findByRole("link", { name: "Xem đơn đã nộp" })).getAttribute("href")).toBe("/me/recruitment-applications/app");
});
it("requires reloading after FORM_CHANGED and keeps the rejected submission on the review screen", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => options?.method === "POST" ? { ok: false, status: 409, json: async () => ({ code: "FORM_CHANGED", message: "Biểu mẫu đã thay đổi." }) } : { ok: true, json: async () => context }));
  render(<MemoryRouter initialEntries={["/recruitments/campaign/apply"]}><Routes><Route path="/recruitments/:campaignId/apply" element={<RecruitmentApply token="synthetic-token" />} /></Routes></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Ban ứng tuyển"), { target: { value: d.recruitment_department_id } });
  fireEvent.click(screen.getByText("Xem lại đơn →")); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByText("Xác nhận nộp đơn"));
  await screen.findByText("Biểu mẫu đã thay đổi.");
  expect((screen.getByText("Xác nhận nộp đơn") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: /Tải lại trạng thái và biểu mẫu mới/ })).toBeTruthy();
});
it("saves a new version against the recruiting department id with explicit acknowledgement and exact timestamp", async () => {
  stub((url, options) => options?.method === "PUT" ? { campaign: campaign.item } : url.includes("/departments") ? { items: [] } : campaign);
  render(<MemoryRouter initialEntries={["/workspace/club/recruitments/campaign/edit"]}><ClubContext.Provider value={workspace}><Routes><Route path="/workspace/:clubId/recruitments/:campaignId/edit" element={<RecruitmentEditor />} /></Routes></ClubContext.Provider></MemoryRouter>);
  const save = await screen.findByText("Lưu phiên bản biểu mẫu");
  fireEvent.click(screen.getByText(/Ban kỹ thuật · 1 câu hỏi/));
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /Tôi xác nhận tạo phiên bản mới/ })); fireEvent.submit(save.closest("form")!);
  await waitFor(() => expect(requests.some(r => r.options?.method === "PUT")).toBe(true));
  const request = requests.find(r => r.options?.method === "PUT")!;
  expect(request.url).toContain("/departments/recruiting-department/form");
  const payload = JSON.parse(String(request.options?.body)); expect(payload.expected_updated_at).toBe(timestamp); expect(payload.acknowledge_existing_applications).toBe(true);
  expect(payload.questions[0].question_id).toBeUndefined();
});
it("reviews an application with a separate confirmation and original concurrency token", async () => {
  stub((url, options) => options?.method === "PATCH" ? { item: { ...app, display_status: "approved" } } : url.endsWith("/departments") ? { items: [] } : { item: app, questions: [q], answers: [{ question_id: "q1", answer_value: "Tên cũ" }], files: [] });
  render(<MemoryRouter initialEntries={["/workspace/club/recruitments/campaign/applications/app"]}><ClubContext.Provider value={workspace}><Routes><Route path="/workspace/:clubId/recruitments/:campaignId/applications/:applicationId" element={<RecruitmentReviewDetail />} /></Routes></ClubContext.Provider></MemoryRouter>);
  fireEvent.click(await screen.findByText("Duyệt & thêm thành viên")); expect(requests.some(r => r.options?.method === "PATCH")).toBe(false);
  expect(screen.getByText("Tên cũ")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() => expect(requests.some(r => r.options?.method === "PATCH")).toBe(true));
  expect(JSON.parse(String(requests.find(r => r.options?.method === "PATCH")?.options?.body))).toEqual({ decision: "approve", expected_updated_at: timestamp });
});
it("reports partial bulk results and sends only selected pending rows", async () => {
  stub((url, options) => options?.method === "POST" ? { items: [{ application_id: "app", ok: false, message: "Đơn vừa được người khác duyệt." }] } : url.includes("/applications?") ? { items: [app, { ...app, application_id: "done", display_status: "approved" }], stats: { total: 2, pending: 1 }, total: 2 } : campaign);
  render(<MemoryRouter initialEntries={["/workspace/club/recruitments/campaign/applications"]}><ClubContext.Provider value={workspace}><Routes><Route path="/workspace/:clubId/recruitments/:campaignId/applications" element={<RecruitmentReview />} /></Routes></ClubContext.Provider></MemoryRouter>);
  fireEvent.click(await screen.findByLabelText("Chọn tất cả đơn chờ trên trang")); fireEvent.click(screen.getByText("Duyệt các đơn đã chọn")); fireEvent.click(screen.getByText("Xác nhận 1 đơn"));
  await screen.findByText("Đã xử lý 0/1 đơn."); expect(screen.getByText(/Đơn vừa được người khác duyệt/)).toBeTruthy();
  const body = JSON.parse(String(requests.find(r => r.options?.method === "POST")?.options?.body)); expect(body.applications).toEqual([{ application_id: "app", expected_updated_at: timestamp }]);
});
it("builder previews all eleven field types and safely escapes Markdown HTML", () => {
  const change = vi.fn(); render(<FormBuilder questions={[q]} onChange={change} disabled={false} />);
  expect(screen.getByLabelText("Loại câu hỏi").querySelectorAll("option")).toHaveLength(11);
  fireEvent.click(screen.getByText("+ Bộ thông tin sinh viên")); expect(change.mock.calls[0][0]).toHaveLength(8);
  fireEvent.click(screen.getByText("Xem trước biểu mẫu")); expect((screen.getByLabelText("Họ tên") as HTMLInputElement).disabled).toBe(true);
  render(<Markdown text={'# Xin chào\n**Đậm**\n<img src=x onerror=alert(1)>\n[Link](https://example.com)\n[Bad](javascript:alert(1))'} />);
  expect(document.querySelector("img")).toBeNull(); expect(document.querySelector('a[href^="javascript:"]')).toBeNull(); expect(screen.getByRole("link", { name: "Link" }).getAttribute("rel")).toBe("noopener noreferrer");
});
it("uploads FormData without forcing JSON content-type, while keeping auth", async () => {
  stub(() => ({ file: { file_id: "file" } })); const body = new FormData(); body.append("file", new File(["cv"], "cv.pdf"));
  await accountRequest("synthetic-token", "recruitments/campaign/files", { method: "POST", body });
  const headers = requests[0].options?.headers as Record<string, string>; expect(headers.Authorization).toBe("Bearer synthetic-token"); expect(headers["Content-Type"]).toBeUndefined();
});
it("keeps numeric zero, validates dates and prefills only configured fields", () => {
  const number = { ...q, question_id: "n", question_type: "number" as const, validation: { min: 0, max: 5 }, profile_field: undefined };
  const date = { ...q, question_id: "date", question_type: "date" as const };
  expect(validateValues([number], { n: 0 })).toEqual({}); expect(validateValues([number], { n: "0" }).n).toBeTruthy();
  expect(validateValues([date], { date: "2026-02-30" }).date).toBeTruthy(); expect(initialValues([q, number], { full_name: "Hải" })).toEqual({ q1: "Hải", n: "" });
});
it("public club recruitment requests are filtered by club at the server", async () => {
  stub(() => ({ items: [], total: 0 })); render(<MemoryRouter><RecruitmentList compact clubId="club-id" /></MemoryRouter>);
  await screen.findByText("Chưa có đợt tuyển phù hợp."); expect(requests[0].url).toContain("club_id=club-id");
});
