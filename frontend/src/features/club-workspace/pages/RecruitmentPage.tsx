import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { FloppyDisk } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { useClub } from "../workspace-context";
import { usePersonalQuery } from "../../personal/use-personal-query";
import type { Department, WorkspaceList } from "../services/workspace-api";
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
  const { club, clubId, token, membership } = useClub();
  const departments = usePersonalQuery<WorkspaceList<Department>>(token, `workspace/${clubId}/departments`);
  return <div className="cw-recruitment">
    <header className="cw-heading cw-rec-heading"><div><span className="cw-eyebrow">Tuyển thành viên</span><h1>Tạo đợt tuyển</h1><p>Mở cánh cửa đến {club.name}. Cùng tìm những người đồng hành mới.</p></div><span className="cw-rec-badge">Bản mẫu</span></header>
    {!departments.data ? <section className="cw-panel cw-rec-panel" aria-label="Danh sách ban">
      {departments.loading ? <p role="status">Đang tải các ban của CLB…</p> : <><p className="cw-rec-error" role="alert">{departments.error}</p><button type="button" onClick={departments.retry}>Thử tải lại các ban</button></>}
    </section> : <RecruitmentForm key={`${clubId}:${membership.user_id}`} departments={departments.data.items} />}
  </div>;
}

function RecruitmentForm({ departments }: { departments: Department[] }) {
  const { club, clubId, membership } = useClub();
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
  function openPreview() {
    if (!selected.length) { setError("Chọn ít nhất một ban để xem trước mẫu đơn."); return; }
    if (draft.opensAt && draft.closesAt && draft.closesAt <= draft.opensAt) {
      setError("Ngày đóng đơn phải sau ngày mở đơn."); return;
    }
    setError(""); setPreview(true);
  }

  return <>
    <form onSubmit={save} noValidate>
      <div className="cw-rec-grid">
        <div className="cw-rec-general">
          <section className="cw-panel cw-rec-panel" aria-labelledby="recruitment-info">
            <h2 id="recruitment-info">Thông tin đợt tuyển</h2>
            <label>Tên đợt tuyển<Required /><input required value={draft.title} maxLength={160} onChange={e => update({ title: e.target.value })} /></label>
            <label>Mô tả<Required /><textarea required value={draft.description} maxLength={5000} rows={5} onChange={e => update({ description: e.target.value })} /></label>
            <div className="cw-rec-cover-field"><span className="cw-rec-label">Ảnh bìa<Required /></span>
              <input ref={fileInput} className="cw-rec-file-input" type="file" accept="image/png,image/jpeg" aria-label="Chọn ảnh bìa" onChange={chooseCover} />
              {draft.cover ? <div className="cw-rec-cover-preview"><img src={draft.cover.url} alt="Ảnh bìa đợt tuyển" /><div><span>{draft.cover.name}</span><button type="button" onClick={() => fileInput.current?.click()}>Đổi ảnh</button><button type="button" aria-label="Xóa ảnh bìa" onClick={() => { reader.current?.abort(); update({ cover: null }); setImageError(""); }}><X size={16} /></button></div></div>
                : <button className="cw-rec-upload" type="button" onClick={() => fileInput.current?.click()}><span className="cw-rec-upload-icon"><UploadSimple size={24} aria-hidden="true" /></span><strong>Tải ảnh bìa lên</strong><span>PNG, JPG · tối đa 10 MB</span></button>}
              {imageError && <p className="cw-rec-error" role="alert">{imageError}</p>}
            </div>
            <div className="cw-rec-dates"><label>Mở đơn<Required /><input type="date" required value={draft.opensAt} onChange={e => update({ opensAt: e.target.value })} /></label><label>Đóng đơn<Required /><input type="date" required min={draft.opensAt || undefined} value={draft.closesAt} onChange={e => update({ closesAt: e.target.value })} /></label></div>
          </section>
          <section className="cw-panel cw-rec-panel cw-rec-departments" aria-labelledby="recruitment-departments"><div className="cw-rec-section-heading"><h2 id="recruitment-departments">Ban đang tuyển</h2><span>{selected.length} ban</span></div><p className="cw-rec-help">Chọn ban để thiết lập mẫu đơn riêng.</p>
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
      {message && <p className="cw-rec-success" role="status">{message}</p>}
      <footer className="cw-rec-actions"><p>Bản mẫu giao diện · Bản nháp chỉ lưu trong tab này.</p><div><button type="button" onClick={openPreview}><Eye size={18} aria-hidden="true" />Xem trước mẫu đơn</button><button type="submit" className="cw-primary"><FloppyDisk size={18} aria-hidden="true" />Lưu nháp</button></div></footer>
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
