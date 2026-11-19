import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { accountRequest } from "../../shared/api/account-http";
import { useClub } from "../club-workspace/workspace-context";
import type { Department, WorkspaceList } from "../club-workspace/services/workspace-api";
import { useRecruitmentQuery, useRecruitmentWrite, uploadRecruitmentFile, writeRecruitment } from "./api";
import { FormBuilder, newQuestion } from "./FormBuilder";
import { serializeQuestions } from "./form";
import { Markdown } from "./Markdown";
import { campaignStatus, dateText, departmentName, type Campaign, type CampaignDetail, type Page, type Question, type RecruitingDepartment } from "./types";
import "./recruitment.css";
export function QueryNotice({ error, data, retry }: { error?: string; data?: unknown; retry: () => void }) {
  return data ? null : error ? <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Thử lại</button></div> : <p role="status">Đang tải…</p>;
}
export function Pager({ page, hasMore, onPage }: { page: number; hasMore?: boolean; onPage: (page: number) => void }) {
  return <nav className="rc-toolbar" aria-label="Phân trang"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Trang trước</button><span>Trang {page}</span><button type="button" disabled={!hasMore} onClick={() => onPage(page + 1)}>Trang sau →</button></nav>;
}
export function RecruitmentManagement() {
  const { clubId, token, membership } = useClub();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const [search, setSearch] = useState(params.get("q") || "");
  const query = new URLSearchParams({ page: String(page), limit: "12", status: params.get("status") || "all", q: params.get("q") || "" });
  const path = `workspace/${clubId}/recruitments`;
  const state = useRecruitmentQuery<Page<Campaign>>(path + "?" + query, token);
  if (membership.role !== "chairperson") return <div className="rc"><h1>Chỉ chủ nhiệm được quản lý tuyển thành viên</h1></div>;
  const update = (values: Record<string, string>) => { const next = new URLSearchParams(params); Object.entries(values).forEach(([k, v]) => next.set(k, v)); setParams(next); };
  return <section className="rc"><div className="rc-toolbar"><div><h1>Tuyển thành viên</h1><p>Tạo đợt tuyển, thiết kế biểu mẫu và xét duyệt ứng viên.</p></div><Link className="rc-primary" to="new">+ Tạo đợt tuyển</Link></div>
    <form className="rc-toolbar" onSubmit={e => { e.preventDefault(); update({ q: search.trim(), page: "1" }); }}><label>Tìm đợt tuyển<input value={search} maxLength={100} onChange={e => setSearch(e.target.value)} /></label><button>Tìm kiếm</button><label>Trạng thái<select value={params.get("status") || "all"} onChange={e => update({ status: e.target.value, page: "1" })}>{Object.entries({ all: "Tất cả", draft: "Bản nháp", open: "Đang mở", closed: "Đã đóng", completed: "Hoàn tất" }).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label></form>
    <QueryNotice {...state} />{state.data && <><p>{state.data.total} đợt tuyển</p><div className="rc-cards">{state.data.items.map(c => <article className="rc-panel" key={c.campaign_id}><span className="rc-badge">{campaignStatus(c)}</span><h2><Link to={`${c.campaign_id}/edit`}>{c.title}</Link></h2><p>{c.summary}</p><p className="rc-muted">{dateText(c.application_opens_at)} – {dateText(c.application_closes_at)}</p><div className="rc-actions"><Link to={`${c.campaign_id}/edit`}>Cấu hình & biểu mẫu</Link><Link to={`${c.campaign_id}/applications`}>Xét duyệt đơn →</Link></div></article>)}</div>{!state.data.items.length && <p>Chưa có đợt tuyển phù hợp.</p>}<Pager page={page} hasMore={state.data.hasMore} onPage={n => update({ page: String(n) })} /></>}
  </section>;
}
export function RecruitmentEditor() {
  const { clubId, token, membership } = useClub(); const { campaignId } = useParams();
  if (membership.role !== "chairperson") return <p>Chỉ chủ nhiệm được cấu hình tuyển thành viên.</p>;
  return campaignId ? <ExistingEditor key={campaignId} clubId={clubId} token={token} id={campaignId} /> : <CampaignEditor key="new" clubId={clubId} token={token} />;
}
function ExistingEditor({ clubId, token, id }: { clubId: string; token: string; id: string }) {
  const state = useRecruitmentQuery<CampaignDetail>(`workspace/${clubId}/recruitments/${id}`, token);
  return state.data ? <CampaignEditor {...{ clubId, token }} initial={state.data} /> : <div className="rc"><QueryNotice {...state} /></div>;
}
const localDate = (value?: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
function CampaignEditor({ clubId, token, initial }: { clubId: string; token: string; initial?: CampaignDetail }) {
  const navigate = useNavigate(), mutation = useRecruitmentWrite();
  const [detail, setDetail] = useState(initial);
  const c = detail?.item;
  const [title, setTitle] = useState(c?.title || ""), [summary, setSummary] = useState(c?.summary || ""), [description, setDescription] = useState(c?.description || ""), [benefits, setBenefits] = useState(c?.benefits || "");
  const [email, setEmail] = useState(c?.contact_email || ""), [phone, setPhone] = useState(c?.contact_phone || "");
  const [opens, setOpens] = useState(localDate(c?.application_opens_at)), [closes, setCloses] = useState(localDate(c?.application_closes_at));
  const [preview, setPreview] = useState(false), [message, setMessage] = useState(""), [confirm, setConfirm] = useState("");
  const path = `workspace/${clubId}/recruitments`, base = `/workspace/${clubId}/recruitments`;
  const reload = async () => { const next = await accountRequest<CampaignDetail>(token, `${path}/${c!.campaign_id}`); setDetail(next); return next; };
  async function save(e: FormEvent) {
    e.preventDefault(); setMessage("");
    if (Date.parse(closes) <= Date.parse(opens)) { mutation.setError("Ngày đóng đơn phải sau ngày mở đơn."); return; }
    const result = await mutation.run(async () => {
      const r = await writeRecruitment<{ item: Campaign }>(token, path + (c ? `/${c.campaign_id}` : ""), { title, summary, description, benefits, ...(email && { contact_email: email }), contact_phone: phone, cover_url: c?.cover_url || null, application_opens_at: new Date(opens).toISOString(), application_closes_at: new Date(closes).toISOString(), ...(c && { expected_updated_at: c.updated_at }) }, c ? "PATCH" : "POST");
      if (c) await reload(); else navigate(`${base}/${r.item.campaign_id}/edit`, { replace: true });
      return r;
    }); if (result) setMessage("Đã lưu thông tin đợt tuyển.");
  }
  async function action() {
    if (!c) return;
    const result = await mutation.run(async () => {
      await writeRecruitment(token, `${path}/${c.campaign_id}${confirm === "archive" ? "" : "/" + confirm}`, { expected_updated_at: c.updated_at }, confirm === "archive" ? "DELETE" : "POST");
      if (confirm === "archive") navigate(base); else await reload();
      return true;
    }); if (result) { setMessage("Đã cập nhật trạng thái đợt tuyển."); setConfirm(""); }
  }
  return <section className="rc"><Link to={base}>← Tuyển thành viên</Link><div className="rc-toolbar"><h1>{c ? "Cấu hình đợt tuyển" : "Tạo đợt tuyển"}</h1>{c && <span className="rc-badge">{campaignStatus(c)}</span>}</div>
    <form className="rc-panel" onSubmit={save}><fieldset disabled={mutation.busy} className="rc-fields"><label>Tên đợt tuyển<input required minLength={2} maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Tóm tắt<textarea maxLength={500} value={summary} onChange={e => setSummary(e.target.value)} /></label><div className="rc-grid"><label>Mở nhận đơn<input required type="datetime-local" value={opens} onChange={e => setOpens(e.target.value)} /></label><label>Hạn nhận đơn<input required type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} /></label></div><label>Mô tả (Markdown)<textarea required minLength={10} maxLength={50000} rows={8} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Quyền lợi (Markdown)<textarea rows={4} maxLength={20000} value={benefits} onChange={e => setBenefits(e.target.value)} /></label><div className="rc-grid"><label>Email liên hệ<input type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} /></label><label>Điện thoại liên hệ<input maxLength={32} value={phone} onChange={e => setPhone(e.target.value)} /></label></div><div className="rc-actions"><button className="rc-primary" type="submit">{mutation.busy ? "Đang lưu…" : "Lưu thông tin"}</button><button type="button" onClick={() => setPreview(!preview)}>{preview ? "Ẩn bản xem trước" : "Xem trước nội dung"}</button></div></fieldset></form>
    {preview && <article className="rc-panel"><h2>{title}</h2><p>{summary}</p><Markdown text={description} /><h3>Quyền lợi</h3><Markdown text={benefits} /></article>}
    {c && <><section className="rc-panel"><h2>Ảnh bìa</h2>{c.cover_url && <img className="rc-cover" src={c.cover_url} alt="Ảnh bìa đợt tuyển" />}<label>Tải ảnh JPG, PNG hoặc WebP (tối đa 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={mutation.busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > 5242880) { mutation.setError("Ảnh vượt quá 5 MB."); return; } void mutation.run(async () => { await uploadRecruitmentFile(token, c.campaign_id, file, "cover", c.updated_at); await reload(); setMessage("Đã cập nhật ảnh bìa."); }); }} /></label></section>
      <DepartmentConfiguration detail={detail!} {...{ token, clubId, reload }} />
      <section className="rc-panel"><h2>Công khai và quản lý</h2><p>Lưu thông tin và biểu mẫu của từng ban trước khi mở nhận đơn.</p><div className="rc-actions"><Link to={`${base}/${c.campaign_id}/applications`}>Xét duyệt đơn</Link><Link to={`/recruitments/${c.campaign_id}`}>Xem trang công khai</Link>{c.status === "draft" && <button disabled={mutation.busy} onClick={() => setConfirm("publish")}>Mở đợt tuyển</button>}{c.status === "open" && <button disabled={mutation.busy} onClick={() => setConfirm("close")}>Đóng nhận đơn</button>}<button disabled={mutation.busy} onClick={() => setConfirm("archive")}>Lưu trữ đợt tuyển</button></div>{confirm && <div className="rc-confirm" role="group" aria-label="Xác nhận thay đổi trạng thái"><p>{confirm === "publish" ? "Công khai đợt tuyển theo thời gian đã cấu hình?" : confirm === "close" ? "Đóng nhận đơn ngay? Các đơn đã nộp vẫn được giữ lại." : "Lưu trữ đợt tuyển và gỡ khỏi danh sách công khai?"}</p><button disabled={mutation.busy} onClick={() => void action()}>Xác nhận</button><button disabled={mutation.busy} onClick={() => setConfirm("")}>Hủy</button></div>}</section>
    </>}{mutation.error && <p role="alert" className="rc-error">{mutation.error} {c && <button onClick={() => window.location.reload()}>Tải lại dữ liệu</button>}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
function DepartmentConfiguration({ detail, clubId, token, reload }: { detail: CampaignDetail; clubId: string; token: string; reload: () => Promise<CampaignDetail> }) {
  const available = useRecruitmentQuery<WorkspaceList<Department>>(`workspace/${clubId}/departments`, token), mutation = useRecruitmentWrite();
  const [selected, setSelected] = useState(""), [description, setDescription] = useState(""), [requirements, setRequirements] = useState(""), [quantity, setQuantity] = useState("");
  const path = `workspace/${clubId}/recruitments/${detail.item.campaign_id}`;
  async function add(e: FormEvent) { e.preventDefault(); const result = await mutation.run(async () => { await writeRecruitment(token, path + "/departments", { department_id: selected, description, requirements, ...(quantity && { target_quantity: Number(quantity) }), expected_updated_at: detail.item.updated_at }); await reload(); return true; }); if (result) { setSelected(""); setDescription(""); setRequirements(""); setQuantity(""); } }
  return <section className="rc-panel"><h2>Các ban tuyển dụng</h2><p>{detail.application_count || 0} đơn đã nộp. Mỗi ban có biểu mẫu riêng.</p><QueryNotice {...available} />
    <form onSubmit={add}><fieldset className="rc-fields" disabled={mutation.busy}><div className="rc-grid"><label>Thêm ban<select required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Chọn ban đang hoạt động</option>{available.data?.items.filter(d => !d.is_management && d.status === "active" && !detail.departments.some(x => x.department_id === d.department_id)).map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}</select></label><label>Số lượng dự kiến<input type="number" min={1} max={1000000} value={quantity} onChange={e => setQuantity(e.target.value)} /></label></div><label>Mô tả công việc<textarea required maxLength={20000} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Yêu cầu<textarea maxLength={20000} value={requirements} onChange={e => setRequirements(e.target.value)} /></label><button disabled={!available.data}>Thêm ban vào đợt tuyển</button></fieldset></form>{mutation.error && <p role="alert">{mutation.error}</p>}
    {detail.departments.map(d => <DepartmentForm key={`${d.recruitment_department_id}:${d.current_form_version_id}`} department={d} count={detail.application_count || 0} expected={detail.item.updated_at} {...{ token, path, reload }} />)}
  </section>;
}
function DepartmentForm({ department: d, count, expected, token, path, reload }: { department: RecruitingDepartment; count: number; expected: string; token: string; path: string; reload: () => Promise<CampaignDetail> }) {
  const [questions, setQuestions] = useState<Question[]>(d.questions.length ? d.questions : [newQuestion()]), [ack, setAck] = useState(false), [saved, setSaved] = useState(false);
  const mutation = useRecruitmentWrite();
  async function save(e: FormEvent) { e.preventDefault(); const result = await mutation.run(async () => { await writeRecruitment(token, `${path}/departments/${d.recruitment_department_id}/form`, { questions: serializeQuestions(questions), expected_updated_at: expected, acknowledge_existing_applications: ack }, "PUT"); await reload(); return true; }); if (result) setSaved(true); }
  return <details className="rc-department" open={!d.current_form_version_id}><summary>{departmentName(d)} · {d.questions.length} câu hỏi {d.current_form_version_id ? "· Đã có biểu mẫu" : "· Chưa có biểu mẫu"}</summary><Markdown text={d.description} /><Markdown text={d.requirements} />{d.target_quantity && <p>Số lượng dự kiến: {d.target_quantity}</p>}<form onSubmit={save}><FormBuilder {...{ questions }} onChange={value => { setQuestions(value); setSaved(false); }} disabled={mutation.busy} />{count > 0 && <label className="rc-choice"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />Tôi xác nhận tạo phiên bản mới; câu hỏi và câu trả lời của các đơn đã nộp được giữ nguyên.</label>}<button className="rc-primary" disabled={mutation.busy || !questions.length || count > 0 && !ack}>{mutation.busy ? "Đang lưu…" : "Lưu phiên bản biểu mẫu"}</button>{mutation.error && <p role="alert">{mutation.error}</p>}{saved && <p role="status">Đã lưu phiên bản mới.</p>}</form></details>;
}
