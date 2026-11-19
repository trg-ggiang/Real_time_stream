import type { Question, Values } from "./types";
export function initialValues(questions: Question[], profile: Record<string, string | null> = {}): Values {
  return Object.fromEntries(questions.map(q => [q.question_id, q.profile_field ? profile[q.profile_field] || "" : ["checkboxes", "file"].includes(q.question_type) ? [] : ""]));
}
export function validateValues(questions: Question[], values: Values) {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const value = values[q.question_id], r = q.validation || {};
    const empty = value == null || typeof value === "string" && !value.trim() || Array.isArray(value) && !value.length;
    if (empty) { if (q.is_required) errors[q.question_id] = "Vui lòng trả lời câu hỏi này."; continue; }
    const choice = new Set((q.options || []).map(o => o.option_id));
    if (["number", "rating"].includes(q.question_type)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < (r.min ?? -Infinity) || value > (r.max ?? Infinity) || q.question_type === "rating" && (!Number.isInteger(value) || value < 1 || value > 5)) errors[q.question_id] = "Giá trị nằm ngoài giới hạn cho phép.";
    } else if (q.question_type === "file") {
      if (!Array.isArray(value) || value.length > (r.max_files ?? 1)) errors[q.question_id] = "Số file vượt giới hạn cho phép.";
    } else if (q.question_type === "checkboxes") {
      if (!Array.isArray(value) || value.some(v => !choice.has(v))) errors[q.question_id] = "Chọn phương án hợp lệ.";
    } else if (["single_choice", "dropdown"].includes(q.question_type)) {
      if (!choice.has(String(value))) errors[q.question_id] = "Chọn một phương án hợp lệ.";
    } else if (typeof value !== "string" || value.length < (r.min_length ?? 0) || value.length > (r.max_length ?? 10000)) errors[q.question_id] = "Độ dài câu trả lời chưa phù hợp.";
    else if (q.question_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[q.question_id] = "Email chưa hợp lệ.";
    else if (q.question_type === "phone" && !/^\+?[0-9][0-9 .()-]{7,24}$/.test(value)) errors[q.question_id] = "Số điện thoại chưa hợp lệ.";
    else if (q.question_type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors[q.question_id] = "Ngày chưa hợp lệ.";
  }
  return errors;
}
export function answerText(q: Question, value: unknown) {
  if (value == null || value === "" || Array.isArray(value) && !value.length) return "Chưa trả lời";
  if (["single_choice", "dropdown", "checkboxes"].includes(q.question_type)) return (Array.isArray(value) ? value : [value]).map(v => q.options?.find(o => o.option_id === v)?.label || "Phương án cũ").join(", ");
  return Array.isArray(value) ? `${value.length} file đính kèm` : String(value);
}
export function serializeQuestions(questions: Question[]) {
  return questions.map(({ field_id, question_text, help_text, question_type, is_required, options, validation, profile_field }) => ({ field_id, question_text, help_text, question_type, is_required, options, validation, ...(profile_field && { profile_field }) }));
}
