import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { accountRequest } from "../../shared/api/account-http";
import { useClub } from "../club-workspace/workspace-context";
import type { Department, WorkspaceList } from "../club-workspace/services/workspace-api";
import { useRecruitmentQuery, useRecruitmentWrite, writeRecruitment, openAttachment } from "./api";
import { AnswerSummary } from "./QuestionFields";
import { Pager, QueryNotice } from "./RecruitmentManagement";
import { applicationStatus, dateText, type Application, type ApplicationDetail, type CampaignDetail, type Page } from "./types";
import "./recruitment.css";
export function MyRecruitmentApplications({ token }: { token: string }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const state = useRecruitmentQuery<Page<Application>>(`me/recruitment-applications?page=${page}&limit=12&status=${params.get("status") || "all"}`, token);
  return <section className="rc"><div className="rc-toolbar"><h1>Đơn ứng tuyển của tôi</h1><Link to="/recruitments">Tìm đợt tuyển →</Link></div><label>Trạng thái<select value={params.get("status") || "all"} onChange={e => setParams({ status: e.target.value, page: "1" })}>{Object.entries({ all: "Tất cả", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" }).map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></label><QueryNotice {...state} />{state.data && <><div className="rc-cards">{state.data.items.map(a => <article className="rc-panel" key={a.application_id}><span className="rc-badge">{applicationStatus(a.display_status)}</span><h2><Link to={`/me/recruitment-applications/${a.application_id}`}>{a.recruitment_campaigns?.title || "Đơn ứng tuyển"}</Link></h2><p>Nộp lúc {dateText(a.submitted_at)}</p><p>{a.result_message}</p>{a.display_status === "approved" && <Link to={`/workspace/${a.recruitment_campaigns?.club_id}`}>Mở không gian CLB →</Link>}</article>)}</div>{!state.data.items.length && <p>Bạn chưa có đơn ứng tuyển phù hợp.</p>}<Pager page={page} hasMore={state.data.hasMore} onPage={n => { const next = new URLSearchParams(params); next.set("page", String(n)); setParams(next); }} /></>}</section>;
}
export function MyRecruitmentApplication({ token }: { token: string }) {
  const { applicationId = "" } = useParams();
  const state = useRecruitmentQuery<ApplicationDetail>(`me/recruitment-applications/${applicationId}`, token);
  return <section className="rc"><Link to="/me/recruitment-applications">← Đơn ứng tuyển của tôi</Link><h1>Đơn ứng tuyển đã nộp</h1><QueryNotice {...state} />{state.data && <><ApplicationReadout detail={state.data} token={token} /><Link to={`/recruitments/${state.data.item.campaign_id}`}>Xem đợt tuyển →</Link>{state.data.item.display_status === "approved" && state.data.item.recruitment_campaigns?.club_id && <p><Link className="rc-primary" to={`/workspace/${state.data.item.recruitment_campaigns.club_id}`}>Mở không gian CLB →</Link></p>}<p><button onClick={state.retry}>Làm mới kết quả</button></p></>}</section>;
}
function ApplicationReadout({ detail, token }: { detail: ApplicationDetail; token: string }) {
  const mutation = useRecruitmentWrite();
  const { item: a } = detail;
  return <article className="rc-panel"><span className="rc-badge">{applicationStatus(a.display_status)}</span><p>Nộp lúc {dateText(a.submitted_at)}</p>{a.result_message && <p role="status">{a.result_message}</p>}<h2>Thông tin tại thời điểm nộp</h2><dl className="rc-answers">{Object.entries({ full_name: "Họ tên", student_code: "MSSV", email: "Email", phone: "Điện thoại", school_or_faculty: "Trường / khoa", major: "Ngành", cohort: "Khóa" }).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{a.profile_snapshot?.[field] || "—"}</dd></div>)}</dl><h2>Câu trả lời đã nộp</h2><AnswerSummary questions={detail.questions} values={Object.fromEntries(detail.answers.map(x => [x.question_id, x.answer_value]))} />{detail.files.length > 0 && <><h3>File đính kèm</h3>{detail.files.map(f => <p key={f.file_id}><button disabled={mutation.busy} onClick={() => void mutation.run(() => openAttachment(token, f.file_id))}>{f.file_name}</button> · {Math.ceil(f.size_bytes / 1024)} KB</p>)}</>}{mutation.error && <p role="alert">{mutation.error}</p>}</article>;
}
export function RecruitmentReview() {
  const { membership } = useClub();
  return membership.role === "chairperson" ? <ReviewList /> : <p>Chỉ chủ nhiệm được xem đơn ứng tuyển.</p>;
}
function ReviewList() {
  const { clubId, token } = useClub(), { campaignId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1)), status = params.get("status") || "all", sort = params.get("sort") || "newest";
  const [search, setSearch] = useState(params.get("q") || ""), [selected, setSelected] = useState<string[]>([]), [decision, setDecision] = useState("");
  const [reason, setReason] = useState(""), [results, setResults] = useState<{ application_id: string; ok: boolean; message?: string }[]>([]);
  const path = `workspace/${clubId}/recruitments/${campaignId}`, base = `/workspace/${clubId}/recruitments/${campaignId}`;
  const query = new URLSearchParams({ page: String(page), limit: "20", status, sort, q: params.get("q") || "" });
  const state = useRecruitmentQuery<Page<Application>>(`${path}/applications?${query}`, token), campaign = useRecruitmentQuery<CampaignDetail>(path, token), mutation = useRecruitmentWrite();
  function update(values: Record<string, string>) { setSelected([]); setDecision(""); const next = new URLSearchParams(params); Object.entries(values).forEach(([k, v]) => next.set(k, v)); setParams(next); }
  const pending = state.data?.items.filter(a => a.display_status === "pending") || [];
  async function bulk(e: FormEvent) {
    e.preventDefault();
    const result = await mutation.run(() => writeRecruitment<{ items: typeof results }>(token, `${path}/applications/bulk-decision`, { decision, ...(reason && { reason }), applications: pending.filter(a => selected.includes(a.application_id)).map(a => ({ application_id: a.application_id, expected_updated_at: a.updated_at })) }));
    if (result) { setResults(result.items); setSelected([]); setDecision(""); state.retry(); }
  }
  async function exportCsv() {
    await mutation.run(async () => {
      const csv = await accountRequest<string>(token, `${path}/applications/export.csv?${query}`, {}, "text");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `ung-vien-${campaignId}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return <section className="rc"><Link to={`/workspace/${clubId}/recruitments`}>← Tuyển thành viên</Link><div className="rc-toolbar"><div><h1>Xét duyệt ứng viên</h1><p>{campaign.data?.item.title}</p></div><Link to={`${base}/edit`}>Cấu hình biểu mẫu</Link></div>
    <div className="rc-stats">{Object.entries({ total: "Tất cả đơn", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" }).map(([key, label]) => <div className="rc-panel" key={key}><strong>{state.data?.stats?.[key] ?? "…"}</strong><span>{label}</span></div>)}</div>
    <form className="rc-toolbar" onSubmit={e => { e.preventDefault(); update({ q: search.trim(), page: "1" }); }}><label>Tên, MSSV hoặc email<input maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label><button>Tìm kiếm</button><label>Trạng thái<select value={status} onChange={e => update({ status: e.target.value, page: "1" })}>{Object.entries({ all: "Tất cả", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Sắp xếp<select value={sort} onChange={e => update({ sort: e.target.value, page: "1" })}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label><button type="button" disabled={mutation.busy || !state.data} onClick={() => void exportCsv()}>Xuất CSV</button></form>
    <QueryNotice {...state} />{state.data && <><p>{state.data.total} đơn phù hợp</p><div className="rc-table-wrap"><table><thead><tr><th><input aria-label="Chọn tất cả đơn chờ trên trang" type="checkbox" checked={!!pending.length && pending.every(a => selected.includes(a.application_id))} disabled={!pending.length || mutation.busy} onChange={e => setSelected(e.target.checked ? pending.map(a => a.application_id) : [])} /></th><th>Ứng viên</th><th>Trạng thái</th><th>Nộp lúc</th><th>Chi tiết</th></tr></thead><tbody>{state.data.items.map(a => <tr key={a.application_id}><td><input type="checkbox" aria-label={`Chọn đơn của ${a.profile_snapshot?.full_name || a.application_id}`} disabled={a.display_status !== "pending" || mutation.busy} checked={selected.includes(a.application_id)} onChange={e => setSelected(current => e.target.checked ? [...current, a.application_id] : current.filter(id => id !== a.application_id))} /></td><td><strong>{a.profile_snapshot?.full_name}</strong><br />{a.profile_snapshot?.student_code}<br />{a.profile_snapshot?.email}</td><td>{applicationStatus(a.display_status)}</td><td>{dateText(a.submitted_at)}</td><td><Link to={`${base}/applications/${a.application_id}`}>Xem đơn →</Link></td></tr>)}</tbody></table></div>{!state.data.items.length && <p>Chưa có đơn phù hợp.</p>}<Pager {...{ page }} hasMore={state.data.hasMore} onPage={n => update({ page: String(n) })} /></>}
    {!!selected.length && <div className="rc-panel"><p>Đã chọn {selected.length} đơn trên trang này.</p><div className="rc-actions"><button disabled={mutation.busy} onClick={() => setDecision("approve")}>Duyệt các đơn đã chọn</button><button disabled={mutation.busy} onClick={() => setDecision("reject")}>Từ chối các đơn đã chọn</button></div></div>}
    {decision && <form className="rc-confirm" onSubmit={bulk}><h2>{decision === "approve" ? "Xác nhận duyệt hàng loạt" : "Xác nhận từ chối hàng loạt"}</h2><p>{decision === "approve" ? "Mỗi ứng viên sẽ được thêm vào ban mà họ đã đăng ký." : "Ứng viên sẽ nhận kết quả từ chối."} Kết quả xử lý được trả riêng cho từng đơn.</p>{decision === "reject" && <label>Lý do (không bắt buộc)<textarea maxLength={5000} value={reason} onChange={e => setReason(e.target.value)} /></label>}<button disabled={mutation.busy || !selected.length}>Xác nhận {selected.length} đơn</button><button type="button" disabled={mutation.busy} onClick={() => setDecision("")}>Hủy</button></form>}
    {!!results.length && <div role="status" className="rc-panel"><p>Đã xử lý {results.filter(r => r.ok).length}/{results.length} đơn.</p>{results.filter(r => !r.ok).map(r => <p key={r.application_id}>{r.application_id}: {r.message}</p>)}</div>}{mutation.error && <p role="alert">{mutation.error} <button onClick={state.retry}>Tải lại</button></p>}
  </section>;
}
export function RecruitmentReviewDetail() {
  const { clubId, token, membership } = useClub(), { campaignId = "", applicationId = "" } = useParams();
  const path = `workspace/${clubId}/recruitments/${campaignId}`;
  const state = useRecruitmentQuery<ApplicationDetail>(`${path}/applications/${applicationId}`, token);
  if (membership.role !== "chairperson") return <p>Chỉ chủ nhiệm được xem đơn ứng tuyển.</p>;
  return <section className="rc"><Link to={`/workspace/${clubId}/recruitments/${campaignId}/applications`}>← Danh sách ứng viên</Link><h1>Chi tiết đơn ứng tuyển</h1><QueryNotice {...state} />{state.data && <><ApplicationReadout detail={state.data} token={token} /><DecisionForm key={state.data.item.updated_at} application={state.data.item} {...{ path, clubId, token }} reload={state.retry} /></>}</section>;
}
function DecisionForm({ application: a, path, clubId, token, reload }: { application: Application; path: string; clubId: string; token: string; reload: () => void }) {
  const [department, setDepartment] = useState(""), [reason, setReason] = useState(""), [decision, setDecision] = useState("");
  const depts = useRecruitmentQuery<WorkspaceList<Department>>(`workspace/${clubId}/departments`, token), mutation = useRecruitmentWrite();
  if (a.display_status !== "pending") return <p>Đơn đã có quyết định. Các quyết định được giữ trong lịch sử.</p>;
  async function submit(e: FormEvent) { e.preventDefault(); const result = await mutation.run(() => writeRecruitment(token, `${path}/applications/${a.application_id}/decision`, { decision, expected_updated_at: a.updated_at, ...(department && decision === "approve" && { department_id: department }), ...(reason && decision === "reject" && { reason }) }, "PATCH")); if (result) reload(); }
  return <form className="rc-panel" onSubmit={submit}><h2>Quyết định của chủ nhiệm</h2><label>Ban tiếp nhận (khi duyệt)<select disabled={mutation.busy} value={department} onChange={e => setDepartment(e.target.value)}><option value="">Dùng ban ứng viên đã chọn</option>{depts.data?.items.filter(d => !d.is_management && d.status === "active").map(d => <option value={d.department_id} key={d.department_id}>{d.name}</option>)}</select></label><label>Lý do từ chối (không bắt buộc)<textarea maxLength={5000} value={reason} disabled={mutation.busy} onChange={e => setReason(e.target.value)} /></label><div className="rc-actions"><button type="button" disabled={mutation.busy} onClick={() => setDecision("approve")}>Duyệt & thêm thành viên</button><button type="button" disabled={mutation.busy} onClick={() => setDecision("reject")}>Từ chối</button></div>{decision && <div className="rc-confirm"><p>{decision === "approve" ? "Xác nhận duyệt đơn và thêm ứng viên vào CLB?" : "Xác nhận từ chối đơn này?"}</p><button className="rc-primary" disabled={mutation.busy}>Xác nhận</button><button type="button" disabled={mutation.busy} onClick={() => setDecision("")}>Hủy</button></div>}{mutation.error && <p role="alert">{mutation.error} <button type="button" onClick={reload}>Tải lại trạng thái</button></p>}</form>;
}
