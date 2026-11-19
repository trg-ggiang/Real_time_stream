import { useState, type Dispatch, type SetStateAction } from "react";
import { uploadRecruitmentFile } from "./api";
import { answerText } from "./form";
import type { Attachment, Question, Values } from "./types";
export function QuestionFields({ questions, values, onChange, errors = {}, disabled = false, token, campaign, files, onFiles, onUploadBusy }: {
  questions: Question[]; values: Values; onChange: (id: string, value: unknown) => void; errors?: Record<string, string>; disabled?: boolean;
  token?: string; campaign?: string; files?: Attachment[]; onFiles?: Dispatch<SetStateAction<Attachment[]>>; onUploadBusy?: (active: boolean) => void;
}) {
  return <div className="rc-questions">{questions.map((q, i) => <QuestionField key={q.question_id} {...{ q, values, onChange, errors, disabled, token, campaign, files, onFiles, onUploadBusy }} index={i} />)}</div>;
}
function QuestionField({ q, index, values, onChange, errors, disabled, token, campaign, files = [], onFiles, onUploadBusy }: {
  q: Question; index: number; values: Values; onChange: (id: string, value: unknown) => void; errors: Record<string, string>; disabled: boolean;
  token?: string; campaign?: string; files?: Attachment[]; onFiles?: Dispatch<SetStateAction<Attachment[]>>; onUploadBusy?: (active: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const value = values[q.question_id], id = `rc-q-${q.question_id}`, rules = q.validation || {};
  const common = { id, disabled: disabled || uploading, "aria-invalid": !!errors[q.question_id], "aria-describedby": `${id}-help ${id}-error` };
  const change = (v: unknown) => onChange(q.question_id, v);
  const selected = Array.isArray(value) ? value as string[] : [];
  async function upload(list: FileList | null) {
    if (!list?.length || !token || !campaign) return;
    const incoming = Array.from(list);
    if (selected.length + incoming.length > (rules.max_files ?? 1)) { setError(`Tối đa ${rules.max_files ?? 1} file.`); return; }
    if (incoming.some(f => f.size > (rules.max_size_bytes ?? 5242880) || !(rules.allowed_mime_types || ["application/pdf", "image/jpeg", "image/png", "image/webp"]).includes(f.type))) { setError("File không đúng loại hoặc vượt dung lượng cho phép."); return; }
    setUploading(true); onUploadBusy?.(true); setError("");
    const saved: Attachment[] = [];
    try { for (const file of incoming) saved.push((await uploadRecruitmentFile(token, campaign, file, "answer", q.question_id)).file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa tải được file."); }
    finally {
      if (saved.length) { change([...selected, ...saved.map(f => f.file_id)]); onFiles?.(current => [...current, ...saved]); }
      setUploading(false); onUploadBusy?.(false);
    }
  }
  return <fieldset className="rc-question" disabled={disabled}><legend>{index + 1}. {q.question_text}{q.is_required && <span aria-label="bắt buộc"> *</span>}</legend>
    <p id={`${id}-help`} className="rc-muted">{q.help_text}{q.question_type === "file" && ` Tối đa ${rules.max_files ?? 1} file, ${Math.round((rules.max_size_bytes ?? 5242880) / 1024)} KB/file. ${(rules.allowed_mime_types || ["PDF", "JPG", "PNG", "WebP"]).join(", ")}.`}</p>
    <label className="rc-sr-only" htmlFor={id}>{q.question_text}</label>
    {q.question_type === "paragraph" ? <textarea {...common} rows={4} minLength={rules.min_length} maxLength={rules.max_length ?? 10000} value={String(value ?? "")} onChange={e => change(e.target.value)} />
    : ["single_choice", "checkboxes"].includes(q.question_type) ? <div role="group" id={id} aria-describedby={`${id}-error`}>{(q.options || []).map(o => <label className="rc-choice" key={o.option_id}><input type={q.question_type === "checkboxes" ? "checkbox" : "radio"} name={id} disabled={disabled} value={o.option_id} checked={q.question_type === "checkboxes" ? selected.includes(o.option_id) : value === o.option_id} onChange={e => change(q.question_type === "checkboxes" ? e.target.checked ? [...selected, o.option_id] : selected.filter(v => v !== o.option_id) : o.option_id)} />{o.label}</label>)}</div>
    : q.question_type === "dropdown" || q.question_type === "rating" ? <select {...common} value={String(value ?? "")} onChange={e => change(q.question_type === "rating" && e.target.value ? Number(e.target.value) : e.target.value)}><option value="">Chọn câu trả lời</option>{q.question_type === "rating" ? [1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>) : q.options.map(o => <option key={o.option_id} value={o.option_id}>{o.label}</option>)}</select>
    : q.question_type === "file" ? <><input {...common} disabled={disabled || uploading || !token} type="file" multiple={(rules.max_files ?? 1) > 1} accept={(rules.allowed_mime_types || ["application/pdf", "image/jpeg", "image/png", "image/webp"]).join(",")} onChange={e => { void upload(e.target.files); e.target.value = ""; }} />{uploading && <p role="status">Đang tải file…</p>}{selected.map(fileId => <p key={fileId}>{files.find(f => f.file_id === fileId)?.file_name || "File đã tải"} <button type="button" disabled={disabled || uploading} onClick={() => change(selected.filter(v => v !== fileId))}>Gỡ file</button></p>)}{error && <p role="alert">{error}</p>}</>
    : <input {...common} type={q.question_type === "number" ? "number" : q.question_type === "email" ? "email" : q.question_type === "phone" ? "tel" : q.question_type === "date" ? "date" : "text"} step={q.question_type === "number" ? "any" : undefined} min={rules.min} max={rules.max} minLength={rules.min_length} maxLength={rules.max_length ?? 10000} value={typeof value === "number" ? value : String(value ?? "")} onChange={e => change(q.question_type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)} />}
    {errors[q.question_id] && <p className="rc-error" id={`${id}-error`} role="alert">{errors[q.question_id]}</p>}
  </fieldset>;
}
export function AnswerSummary({ questions, values }: { questions: Question[]; values: Values }) {
  return <dl className="rc-answers">{questions.map(q => <div key={q.question_id}><dt>{q.question_text}</dt><dd>{answerText(q, values[q.question_id])}</dd></div>)}</dl>;
}
