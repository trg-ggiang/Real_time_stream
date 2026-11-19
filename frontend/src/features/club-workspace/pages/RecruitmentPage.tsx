import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { FloppyDisk } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { useNavigate } from "react-router-dom";
import { accountRequest } from "../../../shared/api/account-http";
import { useClub } from "../workspace-context";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { workspaceRequest, type Department, type RecruitmentApplicationQueueItem, type RecruitmentApplicationReview, type RecruitmentApplicationStatus, type RecruitmentCampaign, type WorkspaceList } from "../services/workspace-api";
import { useWorkspaceMutation } from "../use-workspace-mutation";
import { useUnsavedChanges } from "../../../shared/lib/use-unsaved-changes";
import { loadRecruitmentDraft, newRecruitmentQuestion, withRecruitmentDepartments, type RecruitmentDepartment, type RecruitmentDraft, type RecruitmentQuestion } from "../recruitment-model";
import "../recruitment.css";

function Required() { return <span className="cw-rec-required" aria-hidden="true"> *</span>; }

function DepartmentTabs({ departments, selected, onSelect, prefix }: {
  departments: RecruitmentDepartment[]; selected: string; onSelect: (id: string) => void; prefix: string;
}) {
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const index = departments.findIndex(d => d.id === selected);
    const next = event.key === "ArrowRight" ? (index + 1) % departments.length
      : event.key === "ArrowLeft" ? (index - 1 + departments.length) % departments.length
      : event.key === "Home" ? 0 : event.key === "End" ? departments.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onSelect(departments[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return <div className="cw-rec-tabs" role="tablist" aria-label={prefix === "editor" ? "Thiết lập theo ban" : "Ban ứng tuyển"} onKeyDown={navigate}>
    {departments.map(d => <button key={d.id} type="button" role="tab" id={`${prefix}-${d.id}`} aria-selected={selected === d.id}
      aria-controls={`${prefix}-panel`} tabIndex={selected === d.id ? 0 : -1} onClick={() => onSelect(d.id)}>{d.name}</button>)}
  </div>;
}

export function RecruitmentPage() {
  const { membership } = useClub();
  if (membership.role === "head") return <HeadRecruitmentReview />;
  return <ChairRecruitmentPage />;
}

const applicationStatusLabel: Record<RecruitmentApplicationStatus, string> = {
  draft: "Bản nháp", submitted: "Chờ duyệt", interviewing: "Qua vòng đơn", accepted: "Đã được nhận", rejected: "Đã từ chối", withdrawn: "Đã rút đơn",
};

function HeadRecruitmentReview() {
  const { clubId, token } = useClub();
  const [refresh, setRefresh] = useState(0);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<RecruitmentApplicationReview | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [score, setScore] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const mutation = useWorkspaceMutation();
  const queue = usePersonalQuery<WorkspaceList<RecruitmentApplicationQueueItem> & { total: number; hasMore: boolean }>(
    token, `workspace/${clubId}/recruitment?list=review&page=${page}&limit=24`, refresh,
  );
  const visible = (queue.data?.items ?? []).filter(item => filter === "all" || item.status === "submitted");

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") setRefresh(value => value + 1);
    };
    const timer = window.setInterval(refreshWhenVisible, 15000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!visible.length) { setSelectedId(""); return; }
    if (!visible.some(item => item.application_id === selectedId)) setSelectedId(visible[0].application_id);
  }, [queue.data, filter, selectedId]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(true); setDetailError("");
    void accountRequest<{ item: RecruitmentApplicationReview }>(token,
      `workspace/${clubId}/recruitment/applications/${selectedId}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDetail(result.item); })
      .catch(cause => { if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : "Chưa tải được hồ sơ."); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [token, clubId, selectedId, detailRefresh]);

  useEffect(() => {
    setScore(detail?.score == null ? "" : String(detail.score));
    setInternalNote(detail?.internal_note ?? "");
    setFeedback(detail?.feedback ?? "");
  }, [detail]);

  async function submitReview(status: "submitted" | "interviewing" | "accepted" | "rejected") {
    if (!detail) return;
    const scoreValue = score.trim() ? Number(score) : null;
    if (scoreValue !== null && (!Number.isInteger(scoreValue) || scoreValue < 0 || scoreValue > 100)) return;
    const saved = await mutation.run(signal => workspaceRequest<{ application: unknown }>(token, clubId,
      `recruitment/applications/${detail.application_id}/review`, {
        method: "PATCH", signal,
        body: JSON.stringify({ status, score: scoreValue, internal_note: internalNote, feedback }),
      }));
    if (saved) {
      setRefresh(value => value + 1);
      setDetailRefresh(value => value + 1);
    }
  }

  return <main className="cw-recruitment cw-rec-review">
    <header className="cw-heading cw-rec-heading"><div><span className="cw-eyebrow">Tuyển thành viên</span><h1>Hồ sơ ứng tuyển</h1><p>Xem câu trả lời và cập nhật kết quả vòng đơn của ban bạn phụ trách.</p></div></header>
    <div className="cw-rec-review-layout">
      <aside className="cw-panel cw-rec-panel cw-rec-review-list" aria-label="Danh sách hồ sơ">
        <div className="cw-rec-review-list-heading"><h2>Danh sách hồ sơ</h2><span>{queue.data?.total ?? 0}</span>
          <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={queue.loading}>Tải lại</button>
        </div>
        <label className="cw-rec-review-filter">Trạng thái
          <select value={filter} onChange={event => setFilter(event.target.value as "pending" | "all")}>
            <option value="pending">Chờ duyệt</option><option value="all">Tất cả hồ sơ</option>
          </select>
        </label>
        {queue.loading && <p className="cw-rec-empty" role="status">Đang tải hồ sơ…</p>}
        {queue.error && <div className="cw-rec-error" role="alert">{queue.error}<button type="button" onClick={queue.retry}>Thử lại</button></div>}
        {!queue.loading && !queue.error && !visible.length && <p className="cw-rec-empty">{filter === "pending" ? "Chưa có hồ sơ cần duyệt." : "Chưa có hồ sơ ứng tuyển."}</p>}
        <div className="cw-rec-review-items">{visible.map(item => <button key={item.application_id} type="button"
          className={selectedId === item.application_id ? "is-selected" : ""} onClick={() => setSelectedId(item.application_id)}>
          <span className="cw-rec-review-item-copy"><strong>{item.full_name}</strong><small>{item.department_name} · {new Date(item.submitted_at).toLocaleDateString("vi-VN")}</small></span>
          <span className={`cw-rec-review-status is-${item.status}`}>{applicationStatusLabel[item.status]}</span>
        </button>)}</div>
        {queue.data && (page > 1 || queue.data.hasMore) && <div className="cw-rec-review-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>← Trước</button>
          <span>Trang {page}</span>
          <button type="button" disabled={!queue.data.hasMore} onClick={() => setPage(value => value + 1)}>Sau →</button>
        </div>}
      </aside>

      <section className="cw-panel cw-rec-panel cw-rec-review-detail" aria-live="polite">
        {detailLoading && <p role="status">Đang tải chi tiết hồ sơ…</p>}
        {detailError && <p className="cw-rec-error" role="alert">{detailError}</p>}
        {!detail && !detailLoading && !detailError && <div className="cw-rec-empty"><h2>Chọn hồ sơ ứng tuyển</h2><p>Thông tin ứng viên và câu trả lời sẽ hiển thị tại đây.</p></div>}
        {detail && <>
          <header className="cw-rec-review-applicant"><h2>{detail.full_name}</h2><p>{detail.department_name} · Đã nộp {new Date(detail.submitted_at).toLocaleString("vi-VN")}</p><span className={`cw-rec-review-status is-${detail.status}`}>{applicationStatusLabel[detail.status]}</span></header>
          <section className="cw-rec-review-section"><h3>Thông tin khi nộp đơn</h3><dl><div><dt>Mã sinh viên</dt><dd>{detail.student_code}</dd></div><div><dt>Đợt tuyển</dt><dd>{detail.campaign_title}</dd></div>
            {detail.portfolio_url && <div><dt>CV / Portfolio</dt><dd><a href={detail.portfolio_url} target="_blank" rel="noreferrer">Mở liên kết</a></dd></div>}</dl></section>
          <section className="cw-rec-review-section"><h3>Câu trả lời</h3>{detail.questions.map(question => <article className="cw-rec-review-answer" key={question.question_id}><h4>{question.question_text}</h4><p>{detail.answers?.[question.question_id] || "Không có câu trả lời"}</p></article>)}</section>
          <section className="cw-rec-review-section cw-rec-review-evaluation"><h3>Đánh giá vòng đơn</h3>
            <label>Điểm (0–100) <span>không bắt buộc</span><input type="number" min={0} max={100} step={1} value={score} onChange={event => setScore(event.target.value)} placeholder="Nhập điểm" disabled={detail.status === "accepted" || detail.status === "rejected"} /></label>
            <label>Ghi chú nội bộ <span>không bắt buộc</span><textarea rows={3} value={internalNote} onChange={event => setInternalNote(event.target.value)} placeholder="Nhập ghi chú…" disabled={detail.status === "accepted" || detail.status === "rejected"} /></label>
            <label>Phản hồi gửi ứng viên <span>không bắt buộc</span><textarea rows={3} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Nhập phản hồi…" disabled={detail.status === "accepted" || detail.status === "rejected"} /></label>
            {score.trim() && (!Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > 100) && <p className="cw-rec-error" role="alert">Điểm cần là số nguyên từ 0 đến 100.</p>}
            {mutation.error && <p className="cw-rec-error" role="alert">{mutation.error}</p>}
            <footer className="cw-rec-review-actions">
              {detail.status !== "accepted" && detail.status !== "rejected" ? <>
                <button type="button" disabled={mutation.busy} onClick={() => void submitReview("submitted")}>Lưu đánh giá</button>
                <button type="button" className="cw-rec-review-reject" disabled={mutation.busy} onClick={() => void submitReview("rejected")}>Từ chối đơn</button>
                <button type="button" className="cw-primary" disabled={mutation.busy} onClick={() => void submitReview("interviewing")}>Cho qua vòng đơn</button>
              </> : <span>Đã ghi nhận kết quả xét duyệt.</span>}
            </footer>
          </section>
        </>}
      </section>
    </div>
  </main>;
}

function ChairRecruitmentPage() {
  const { club, clubId, token, membership } = useClub();
  const departments = usePersonalQuery<WorkspaceList<Department>>(token, `workspace/${clubId}/departments`);
  return <div className="cw-recruitment">
    <header className="cw-heading cw-rec-heading"><div><span className="cw-eyebrow">Tuyển thành viên</span><h1>Tạo đợt tuyển</h1><p>Mở cánh cửa đến {club.name}. Cùng tìm những người đồng hành mới.</p></div></header>
    {!departments.data ? <section className="cw-panel cw-rec-panel" aria-label="Danh sách ban">
      {departments.loading ? <p role="status">Đang tải các ban của CLB…</p> : <><p className="cw-rec-error" role="alert">{departments.error}</p><button type="button" onClick={departments.retry}>Thử tải lại các ban</button></>}
    </section> : <RecruitmentForm key={`${clubId}:${membership.user_id}`} departments={departments.data.items} />}
  </div>;
}

function RecruitmentForm({ departments }: { departments: Department[] }) {
  const { club, clubId, membership, token } = useClub();
  const navigate = useNavigate();
  const mutation = useWorkspaceMutation();
  const storageKey = `uc:recruitment:v2:${membership.user_id}:${clubId}`;
  const [draft, setDraft] = useState(() => withRecruitmentDepartments(loadRecruitmentDraft(storageKey), departments));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [activeId, setActiveId] = useState("");
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const reader = useRef<FileReader | null>(null);
  const uploadedCover = useRef<{ source: string; url: string } | null>(null);
  const selected = draft.departments.filter(d => d.enabled);
  const active = selected.find(d => d.id === activeId) || selected[0];
  useUnsavedChanges(JSON.stringify(draft) !== baseline);
  useEffect(() => () => reader.current?.abort(), []);

  function update(values: Partial<RecruitmentDraft>) {
    setDraft(previous => ({ ...previous, ...values })); setMessage(""); setError("");
  }
  function updateDepartment(id: string, values: Partial<RecruitmentDepartment>) {
    setDraft(previous => ({ ...previous, departments: previous.departments.map(d => d.id === id ? { ...d, ...values } : d) }));
    setMessage(""); setError("");
  }
  function updateQuestion(id: string, values: Partial<RecruitmentQuestion>) {
    if (active) updateDepartment(active.id, { questions: active.questions.map(q => q.id === id ? { ...q, ...values } : q) });
  }
  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    reader.current?.abort();
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setImageError("Chọn ảnh PNG hoặc JPG có dung lượng tối đa 10 MB."); return;
    }
    setImageError("");
    const pending = new FileReader(); reader.current = pending;
    pending.onload = () => {
      if (reader.current === pending && typeof pending.result === "string") update({ cover: { name: file.name, url: pending.result } });
    };
    pending.onerror = () => setImageError("Chưa đọc được ảnh. Hãy chọn lại tệp.");
    pending.readAsDataURL(file);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(""); setError("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      setBaseline(JSON.stringify(draft)); setError("");
      setMessage("Đã lưu bản nháp trong tab trình duyệt này. Đợt tuyển chưa được đăng.");
    } catch { setError("Chưa lưu được bản nháp. Bộ nhớ trình duyệt có thể đã đầy; thử dùng ảnh nhỏ hơn."); }
  }
  async function publish() {
    setMessage(""); setError("");
    if (membership.role !== "chairperson") { setError("Chỉ chủ nhiệm được đăng đợt tuyển."); return; }
    if (draft.title.trim().length < 2 || draft.description.trim().length < 10) {
      setError("Nhập tên đợt tuyển từ 2 ký tự và mô tả từ 10 ký tự."); return;
    }
    if (!draft.opensAt || !draft.closesAt || draft.closesAt <= draft.opensAt) {
      setError("Chọn ngày mở đơn và ngày đóng đơn; ngày đóng phải sau ngày mở."); return;
    }
    if (!selected.length) { setError("Chọn ít nhất một ban đang tuyển."); return; }
    const invalid = selected.find(d => !d.description.trim() || !d.requirements.trim() || !Number.isInteger(Number(d.quota)) || Number(d.quota) < 1 || Number(d.quota) > 1000 || d.questions.some(q => !q.text.trim()));
    if (invalid) { setActiveId(invalid.id); setError(`Điền đủ công việc, yêu cầu, chỉ tiêu và nội dung câu hỏi của ${invalid.name}.`); return; }
    const published = await mutation.run(async signal => {
      // Preserve IDs and the exact form for a manual retry in this page session.
      try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); }
      catch { sessionStorage.setItem(storageKey, JSON.stringify({ ...draft, cover: null })); }
      let cover_url: string | undefined;
      if (draft.cover) {
        if (draft.cover.url.startsWith("https://")) cover_url = draft.cover.url;
        else if (uploadedCover.current?.source === draft.cover.url) cover_url = uploadedCover.current.url;
        else {
          const [header, encoded] = draft.cover.url.split(",");
          const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
          const file = new Blob([bytes], { type: header.includes("image/png") ? "image/png" : "image/jpeg" });
          const body = new FormData(); body.append("file", file, draft.cover.name);
          const uploaded = await workspaceRequest<{ cover_url: string }>(token, clubId, "recruitment-cover", { method: "POST", body, signal });
          uploadedCover.current = { source: draft.cover.url, url: uploaded.cover_url };
          cover_url = uploaded.cover_url;
        }
        sessionStorage.setItem(storageKey, JSON.stringify({ ...draft, cover: { ...draft.cover, url: cover_url } }));
      }
      return workspaceRequest<{ item: RecruitmentCampaign }>(token, clubId, "recruitment", { method: "POST", signal, body: JSON.stringify({
        campaign_id: draft.campaignId, title: draft.title.trim(), description: draft.description.trim(), cover_url,
        application_opens_at: `${draft.opensAt}T00:00:00+07:00`, application_closes_at: `${draft.closesAt}T23:59:59.999+07:00`,
        departments: selected.map(d => ({ recruitment_department_id: d.recruitmentId, department_id: d.id, description: d.description.trim(), requirements: d.requirements.trim(), target_quantity: Number(d.quota),
          questions: d.questions.map(q => ({ question_id: q.id, question_text: q.text.trim(), help_text: q.hint.trim(), is_required: q.required, max_length: q.maxLength || 5000 })) })),
      }) });
    });
    if (published) {
      setBaseline(JSON.stringify(draft));
      try { sessionStorage.removeItem(storageKey); } catch { /* Publication already succeeded. */ }
      navigate(`/workspace/${clubId}/activities`, { state: { recruitmentPublished: published.item.campaign_id } });
    }
  }
  function openPreview() {
    if (!selected.length) { setError("Chọn ít nhất một ban để xem trước mẫu đơn."); return; }
    if (draft.opensAt && draft.closesAt && draft.closesAt <= draft.opensAt) {
      setError("Ngày đóng đơn phải sau ngày mở đơn."); return;
    }
    setError(""); setPreview(true);
  }

  return <>
    <form onSubmit={save} noValidate aria-busy={mutation.busy}>
      <fieldset disabled={mutation.busy} className="cw-rec-fields">
      <div className="cw-rec-grid">
        <div className="cw-rec-general">
          <section className="cw-panel cw-rec-panel" aria-labelledby="recruitment-info">
            <h2 id="recruitment-info">Thông tin đợt tuyển</h2>
            <label>Tên đợt tuyển<Required /><input required value={draft.title} maxLength={160} onChange={e => update({ title: e.target.value })} /></label>
            <label>Mô tả<Required /><textarea required value={draft.description} maxLength={5000} rows={5} onChange={e => update({ description: e.target.value })} /></label>
            <div className="cw-rec-cover-field"><span className="cw-rec-label">Ảnh bìa</span>
              <input ref={fileInput} className="cw-rec-file-input" type="file" accept="image/png,image/jpeg" aria-label="Chọn ảnh bìa" onChange={chooseCover} />
              {draft.cover ? <div className="cw-rec-cover-preview"><img src={draft.cover.url} alt="Ảnh bìa đợt tuyển" /><div><span>{draft.cover.name}</span><button type="button" onClick={() => fileInput.current?.click()}>Đổi ảnh</button><button type="button" aria-label="Xóa ảnh bìa" onClick={() => { reader.current?.abort(); update({ cover: null }); setImageError(""); }}><X size={16} /></button></div></div>
                : <button className="cw-rec-upload" type="button" onClick={() => fileInput.current?.click()}><span className="cw-rec-upload-icon"><UploadSimple size={24} aria-hidden="true" /></span><strong>Tải ảnh bìa lên</strong><span>PNG, JPG · tối đa 10 MB</span></button>}
              {imageError && <p className="cw-rec-error" role="alert">{imageError}</p>}
            </div>
            <div className="cw-rec-dates"><label>Mở đơn<Required /><input type="date" required value={draft.opensAt} onChange={e => update({ opensAt: e.target.value })} /></label><label>Đóng đơn<Required /><input type="date" required min={draft.opensAt || undefined} value={draft.closesAt} onChange={e => update({ closesAt: e.target.value })} /></label></div>
          </section>
          <section className="cw-panel cw-rec-panel cw-rec-departments" aria-labelledby="recruitment-departments"><div className="cw-rec-section-heading"><h2 id="recruitment-departments">Ban đang tuyển</h2><span>{selected.length} ban</span></div><p className="cw-rec-help">Chọn ban để thiết lập mẫu đơn riêng. Ban quản lý không mở tuyển thành viên.</p>
            {draft.departments.map(d => <label key={d.id} className="cw-rec-department"><input type="checkbox" checked={d.enabled} onChange={e => updateDepartment(d.id, { enabled: e.target.checked })} /><span>{d.name}</span></label>)}
            {!draft.departments.length && <p className="cw-rec-empty">CLB chưa có ban đang hoạt động. <a href={`/workspace/${clubId}/departments`} className="cw-link">Quản lý các ban →</a></p>}
          </section>
        </div>
        <section className="cw-panel cw-rec-panel cw-rec-settings" aria-labelledby="recruitment-settings"><h2 id="recruitment-settings">Thiết lập theo ban</h2>
          {active ? <>
            <DepartmentTabs departments={selected} selected={active.id} onSelect={setActiveId} prefix="editor" />
            <div id="editor-panel" role="tabpanel" aria-labelledby={`editor-${active.id}`} key={active.id}>
              <div className="cw-rec-department-fields"><label>Mô tả công việc<Required /><textarea required rows={3} value={active.description} maxLength={5000} onChange={e => updateDepartment(active.id, { description: e.target.value })} /></label>
                <label>Yêu cầu<Required /><textarea required rows={3} value={active.requirements} maxLength={5000} onChange={e => updateDepartment(active.id, { requirements: e.target.value })} /></label>
                <label>Chỉ tiêu<Required /><div className="cw-rec-quota"><input type="number" min={1} max={1000} required value={active.quota} onChange={e => updateDepartment(active.id, { quota: e.target.value })} /><span>thành viên</span></div></label>
              </div>
              <div className="cw-rec-form-heading"><div><h3>Mẫu đơn · {active.name}</h3><p>Câu hỏi dành cho những người bạn tương lai.</p></div><span>{active.questions.length} câu hỏi</span></div>
              <div className="cw-rec-questions">{active.questions.map((q, index) => <details className="cw-rec-question" open key={q.id}>
                <summary><span className="cw-rec-question-number">{String(index + 1).padStart(2, "0")}</span><span>Câu hỏi {index + 1}</span><CaretDown size={16} aria-hidden="true" /></summary>
                <div className="cw-rec-question-body"><div className="cw-rec-question-tools"><span>Câu trả lời đoạn văn</span><button type="button" aria-label={`Xóa câu hỏi ${index + 1}`} onClick={() => updateDepartment(active.id, { questions: active.questions.filter(item => item.id !== q.id) })}><Trash size={16} aria-hidden="true" />Xóa</button></div>
                  <label>Câu hỏi<Required /><input required value={q.text} maxLength={500} onChange={e => updateQuestion(q.id, { text: e.target.value })} /></label>
                  <label>Hướng dẫn<textarea rows={2} value={q.hint} maxLength={1000} onChange={e => updateQuestion(q.id, { hint: e.target.value })} /></label>
                  <div className="cw-rec-question-options"><label>Giới hạn ký tự<Required /><input type="number" min={1} max={10000} value={q.maxLength} onChange={e => updateQuestion(q.id, { maxLength: e.target.value === "" ? "" : Math.max(1, Math.min(10000, Number(e.target.value) || 1)) })} /></label>
                    <label className="cw-rec-switch-label"><span>Bắt buộc</span><span className="cw-rec-switch-row"><input type="checkbox" role="switch" aria-label={`Bắt buộc câu hỏi ${index + 1}`} checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} /><span>{q.required ? "Bắt buộc" : "Tùy chọn"}</span></span></label></div>
                </div>
              </details>)}</div>
              {!active.questions.length && <p className="cw-rec-empty">Thêm câu hỏi đầu tiên để bắt đầu xây dựng mẫu đơn.</p>}
              <button className="cw-rec-add" type="button" disabled={active.questions.length >= 20} onClick={() => updateDepartment(active.id, { questions: [...active.questions, newRecruitmentQuestion()] })}><Plus size={17} aria-hidden="true" />Thêm câu hỏi</button>
              {active.questions.length >= 20 && <p className="cw-rec-help">Mỗi ban có tối đa 20 câu hỏi trong bản mẫu.</p>}
            </div>
          </> : <div className="cw-rec-empty"><h3>Chọn ban đang tuyển</h3><p>Chọn ít nhất một ban ở bên trái để thiết lập công việc và câu hỏi.</p></div>}
        </section>
      </div>
      {error && <p className="cw-rec-error" role="alert">{error}</p>}
      {mutation.error && <p className="cw-rec-error" role="alert">{mutation.error} Biểu mẫu đã được giữ lại; nếu kết nối gián đoạn, kiểm tra Của tôi trước khi thử lại.</p>}
      {message && <p className="cw-rec-success" role="status">{message}</p>}
      <footer className="cw-rec-actions"><p>Lưu nháp trong tab này hoặc đăng lên Hoạt động CLB khi đã hoàn tất.</p><div><button type="button" onClick={openPreview}><Eye size={18} aria-hidden="true" />Xem trước mẫu đơn</button><button type="submit"><FloppyDisk size={18} aria-hidden="true" />Lưu nháp</button><button type="button" className="cw-primary" onClick={publish}>{mutation.busy ? "Đang đăng…" : "Đăng đợt tuyển"}</button></div></footer>
      </fieldset>
    </form>
    {preview && <RecruitmentPreview draft={draft} clubName={club.name} onClose={() => setPreview(false)} />}
  </>;
}

function RecruitmentPreview({ draft, clubName, onClose }: { draft: RecruitmentDraft; clubName: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const departments = draft.departments.filter(d => d.enabled);
  const [selectedId, setSelectedId] = useState(departments[0].id);
  const active = departments.find(d => d.id === selectedId)!;
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  const date = (value: string) => value ? value.split("-").reverse().join("/") : "Chưa chọn ngày";
  return <dialog ref={dialog} className="cw-rec-preview" aria-labelledby="recruitment-preview-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="cw-rec-preview-inner"><header><div><span className="cw-eyebrow">{clubName} · Xem trước mẫu đơn</span><h2 id="recruitment-preview-title">{draft.title.trim() || "Đợt tuyển mới"}</h2></div><button type="button" aria-label="Đóng xem trước" onClick={onClose}><X size={20} /></button></header>
      {draft.cover && <img className="cw-rec-preview-cover" src={draft.cover.url} alt="Ảnh bìa đợt tuyển" />}
      <p className="cw-rec-preview-description">{draft.description || "Mô tả đợt tuyển sẽ hiển thị tại đây."}</p>
      <div className="cw-rec-preview-dates"><span>Mở đơn <strong>{date(draft.opensAt)}</strong></span><span>Đóng đơn <strong>{date(draft.closesAt)}</strong></span></div>
      <DepartmentTabs departments={departments} selected={active.id} onSelect={setSelectedId} prefix="preview" />
      <div role="tabpanel" id="preview-panel" aria-labelledby={`preview-${active.id}`} key={active.id}>
        <div className="cw-rec-preview-role"><h3>{active.name}<span>{active.quota || "—"} thành viên</span></h3><h4>Mô tả công việc</h4><p>{active.description || "Chưa có mô tả công việc."}</p><h4>Yêu cầu</h4><p>{active.requirements || "Chưa có yêu cầu."}</p></div>
        {active.questions.map((q, index) => <label className="cw-rec-preview-question" key={q.id}>{index + 1}. {q.text || "Câu hỏi chưa có nội dung"}{q.required && <Required />}
          {q.hint && <span>{q.hint}</span>}<textarea rows={3} required={q.required} maxLength={q.maxLength || undefined} /><small>{q.maxLength ? `Tối đa ${q.maxLength.toLocaleString("vi-VN")} ký tự` : "Chưa đặt giới hạn ký tự"} · {q.required ? "Bắt buộc" : "Tùy chọn"}</small></label>)}
        {!active.questions.length && <p className="cw-rec-empty">Ban này chưa có câu hỏi.</p>}
      </div>
      <footer><span>Đây là bản xem trước, chưa nhận hồ sơ ứng tuyển.</span><button type="button" onClick={onClose}>Quay lại chỉnh sửa</button></footer>
    </div>
  </dialog>;
}
