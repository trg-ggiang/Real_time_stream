import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AccountApiError } from "../../shared/api/account-http";
import { authFormHref } from "../auth/redirect";
import { useRecruitmentQuery, writeRecruitment } from "./api";
import { initialValues, validateValues } from "./form";
import { Markdown } from "./Markdown";
import { QuestionFields, AnswerSummary } from "./QuestionFields";
import { QueryNotice, Pager } from "./RecruitmentManagement";
import { campaignStatus, dateText, departmentName, type Campaign, type CampaignDetail, type ApplicationContext, type Attachment, type Application, type Page, type Values } from "./types";
import "./recruitment.css";
export function RecruitmentList({ clubId, compact = false }: { clubId?: string; compact?: boolean }) {
  const [params, setParams] = useSearchParams();
  const page = compact ? 1 : Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const q = compact ? "" : params.get("q") || "";
  const [search, setSearch] = useState(q);
  const query = new URLSearchParams({ page: String(page), limit: compact ? "6" : "12", status: compact ? "open" : params.get("status") || "all", ...(q && { q }), ...(clubId && { club_id: clubId }) });
  const state = useRecruitmentQuery<Page<Campaign>>(`recruitments?${query}`);
  const update = (values: Record<string, string>) => { const next = new URLSearchParams(params); Object.entries(values).forEach(([k, v]) => next.set(k, v)); setParams(next); };
  return <section className={compact ? "rc" : "rc dc-container dc-list-page"}><div className="rc-toolbar"><h1>{compact ? "Đợt tuyển thành viên" : "Tìm CLB, bắt đầu hành trình mới."}</h1>{compact && <Link to="/recruitments">Xem tất cả đợt tuyển →</Link>}</div>
    {!compact && <><p>Khám phá các đợt tuyển và gửi đơn ứng tuyển vào ban phù hợp.</p><form className="rc-toolbar" onSubmit={e => { e.preventDefault(); update({ q: search.trim(), page: "1" }); }}><label>Tìm đợt tuyển<input maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label><button>Tìm kiếm</button><label>Trạng thái<select value={params.get("status") || "all"} onChange={e => update({ status: e.target.value, page: "1" })}><option value="all">Tất cả</option><option value="open">Đang mở / sắp mở</option><option value="closed">Đã đóng</option><option value="completed">Hoàn tất</option></select></label></form></>}
    <QueryNotice {...state} />{state.data && <><div className="rc-cards">{state.data.items.map(c => <article className="rc-panel" key={c.campaign_id}>{c.cover_url && <img className="rc-card-cover" src={c.cover_url} alt="" loading="lazy" />}<p className="rc-muted">{c.club_name}</p><span className="rc-badge">{campaignStatus(c)}</span><h2><Link to={`/recruitments/${c.campaign_id}`}>{c.title}</Link></h2><p>{c.summary}</p><p>Hạn nhận đơn: {dateText(c.application_closes_at)}</p><Link to={`/recruitments/${c.campaign_id}`}>Xem thông tin & ứng tuyển →</Link></article>)}</div>{!state.data.items.length && <p>Chưa có đợt tuyển phù hợp.</p>}{!compact && <Pager {...{ page }} hasMore={state.data.hasMore} onPage={n => update({ page: String(n) })} />}</>}
  </section>;
}
export function RecruitmentPublicDetail({ token }: { token?: string }) {
  const { campaignId = "" } = useParams();
  const state = useRecruitmentQuery<CampaignDetail>(`recruitments/${campaignId}`);
  if (!state.data) return <div className="rc dc-container dc-detail-page"><QueryNotice {...state} /></div>;
  const { item: c, departments } = state.data;
  const accepting = c.accepting_applications;
  const apply = `/recruitments/${campaignId}/apply`;
  return <article className="rc dc-container dc-detail-page"><Link to="/recruitments">← Tuyển thành viên</Link><p><Link to={`/clubs/${c.club_id}`}>{c.club_name || "Câu lạc bộ"}</Link></p><span className="rc-badge">{campaignStatus(c)}</span><h1>{c.title}</h1><p>{c.summary}</p>{c.cover_url && <img className="rc-cover" src={c.cover_url} alt="Ảnh bìa đợt tuyển" />}<div className="rc-detail-grid"><div><Markdown text={c.description} />{c.benefits && <><h2>Quyền lợi</h2><Markdown text={c.benefits} /></>}<h2>Các ban đang tuyển</h2>{departments.map(d => <section className="rc-panel" key={d.recruitment_department_id}><h3>{departmentName(d)}</h3><Markdown text={d.description} /><Markdown text={d.requirements} />{d.target_quantity && <p>Số lượng dự kiến: {d.target_quantity}</p>}<p>{d.questions.length} câu hỏi ứng tuyển</p></section>)}</div><aside className="rc-panel"><h2>Thông tin ứng tuyển</h2><p>Mở nhận đơn: {dateText(c.application_opens_at)}</p><p>Hạn nhận đơn: {dateText(c.application_closes_at)}</p>{c.contact_email && <p>Email: {c.contact_email}</p>}{c.contact_phone && <p>Điện thoại: {c.contact_phone}</p>}{accepting ? token ? <Link className="rc-primary" to={apply}>Ứng tuyển vào CLB</Link> : <a className="rc-primary" href={authFormHref("login", apply)}>Đăng nhập để ứng tuyển</a> : <p>Đợt tuyển hiện chưa nhận đơn.</p>}<p className="rc-muted">Chọn một ban và kiểm tra lại thông tin trước khi nộp. Mỗi sinh viên chỉ nộp một đơn trong một đợt tuyển.</p></aside></div></article>;
}
export function RecruitmentApply({ token }: { token?: string }) {
  const location = useLocation();
  if (!token) return <div className="rc dc-container dc-detail-page"><h1>Ứng tuyển thành viên</h1><p>Đăng nhập và hoàn thiện hồ sơ để nộp đơn.</p><a className="rc-primary" href={authFormHref("login", location.pathname)}>Đăng nhập</a></div>;
  return <AuthenticatedApply key={`${token}:${location.pathname}`} token={token} />;
}
function AuthenticatedApply({ token }: { token: string }) {
  const { campaignId = "" } = useParams();
  const state = useRecruitmentQuery<ApplicationContext>(`recruitments/${campaignId}/application-context`, token);
  return state.data ? <ApplyForm key={state.data.departments.map(d => d.form_version_id).join(":")} context={state.data} token={token} reload={state.retry} /> : <div className="rc dc-container dc-detail-page"><QueryNotice {...state} /></div>;
}
function ApplyForm({ context, token, reload }: { context: ApplicationContext; token: string; reload: () => void }) {
  const [departmentId, setDepartmentId] = useState("");
  const [values, setValues] = useState<Values>({}), [files, setFiles] = useState<Attachment[]>([]), [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [changed, setChanged] = useState(false), [expired, setExpired] = useState(false), [uploadCount, setUploadCount] = useState(0);
  const pending = useRef(false), navigate = useNavigate();
  const d = context.departments.find(x => x.recruitment_department_id === departmentId), questions = d?.questions || [];
  useEffect(() => {
    const check = () => setExpired(Date.now() >= Date.parse(context.item.application_closes_at));
    check(); const timer = setInterval(check, 1000); return () => clearInterval(timer);
  }, [context.item.application_closes_at]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (departmentId && !busy) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave);
  }, [departmentId, busy]);
  if (!context.can_apply || expired) return <section className="rc dc-container dc-detail-page"><h1>{context.item.title}</h1><p>{context.application ? "Bạn đã nộp đơn cho đợt tuyển này." : context.unavailable_reason === "ALREADY_MEMBER" ? "Bạn đã là thành viên của CLB này." : "Đợt tuyển hiện không nhận đơn hoặc đã hết hạn."}</p>{context.application && <Link className="rc-primary" to={`/me/recruitment-applications/${context.application.application_id}`}>Xem đơn đã nộp</Link>}<p><Link to={`/recruitments/${context.item.campaign_id}`}>← Thông tin đợt tuyển</Link></p></section>;
  function check(e: FormEvent) { e.preventDefault(); const invalid = validateValues(questions, values); setErrors(invalid); if (!Object.keys(invalid).length) { setReview(true); setConsent(false); setError(""); } else document.querySelector<HTMLElement>(".rc-question")?.scrollIntoView?.({ block: "center" }); }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!d?.form_version_id || !consent || pending.current || changed || uploadCount) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const { item } = await writeRecruitment<{ item: Application }>(token, `recruitments/${context.item.campaign_id}/applications`, { recruitment_department_id: departmentId, form_version_id: d.form_version_id, answers: questions.map(q => ({ question_id: q.question_id, value: values[q.question_id] ?? null })) });
      navigate(`/me/recruitment-applications/${item.application_id}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa nộp được đơn.");
      if (cause instanceof AccountApiError && cause.fields) { setErrors(cause.fields); setReview(false); }
      if (cause instanceof AccountApiError && cause.code === "FORM_CHANGED") setChanged(true);
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className="rc dc-container dc-detail-page"><Link to={`/recruitments/${context.item.campaign_id}`}>← Thông tin đợt tuyển</Link><h1>{review ? "Kiểm tra đơn trước khi nộp" : "Ứng tuyển: " + context.item.title}</h1><p className="rc-muted">Bước {review ? "2/2 · Xác nhận" : "1/2 · Điền biểu mẫu"} · Hạn nhận đơn {dateText(context.item.application_closes_at)}</p>
    <section className="rc-panel"><h2>Hồ sơ sinh viên</h2><dl className="rc-answers">{Object.entries({ full_name: "Họ tên", student_code: "MSSV", email: "Email", phone: "Điện thoại", school_or_faculty: "Trường / khoa", major: "Ngành", cohort: "Khóa" }).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{context.profile[key] || "Chưa cập nhật"}</dd></div>)}</dl><Link to="/me/profile">Cập nhật hồ sơ</Link></section>
    {!review ? <form onSubmit={check} noValidate><fieldset disabled={busy || changed || uploadCount > 0} className="rc-fields"><label>Ban ứng tuyển<select required value={departmentId} onChange={e => { const next = context.departments.find(x => x.recruitment_department_id === e.target.value); setDepartmentId(e.target.value); setValues(initialValues(next?.questions || [], context.profile)); setErrors({}); setFiles([]); }}><option value="">Chọn một ban</option>{context.departments.map(x => <option key={x.recruitment_department_id} value={x.recruitment_department_id} disabled={!x.form_version_id}>{departmentName(x)}</option>)}</select></label></fieldset>
      {d && <><Markdown text={d.description} /><Markdown text={d.requirements} /><QuestionFields {...{ questions, values, errors, token, files }} campaign={context.item.campaign_id} disabled={busy || changed} onFiles={setFiles} onUploadBusy={active => setUploadCount(n => n + (active ? 1 : -1))} onChange={(id, value) => { setValues(v => ({ ...v, [id]: value })); setErrors(prev => { const next = { ...prev }; delete next[id]; return next; }); }} /></>}
      <button className="rc-primary" disabled={!d || busy || changed || uploadCount > 0}>Xem lại đơn →</button></form>
    : <form onSubmit={submit}><div className="rc-panel"><h2>Ban ứng tuyển: {d && departmentName(d)}</h2><AnswerSummary {...{ questions, values }} /><ul>{files.filter(f => Object.values(values).some(v => Array.isArray(v) && v.includes(f.file_id))).map(f => <li key={f.file_id}>{f.file_name}</li>)}</ul><label className="rc-choice"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />Tôi xác nhận thông tin và đồng ý gửi đơn cho CLB.</label><div className="rc-actions"><button type="button" disabled={busy} onClick={() => setReview(false)}>← Chỉnh sửa</button><button className="rc-primary" disabled={!consent || busy || changed}>{busy ? "Đang nộp đơn…" : "Xác nhận nộp đơn"}</button></div></div></form>}
    {error && <div className="rc-error" role="alert"><p>{error}</p><button disabled={busy} onClick={reload}>Tải lại trạng thái {changed ? "và biểu mẫu mới" : "đơn"}</button></div>}
  </section>;
}
