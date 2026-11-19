import { BadRequestException } from "@nestjs/common";
import { isEmail } from "class-validator";
import type { QuestionDto, QuestionType, QuestionValidationDto, AnswerDto } from "./recruitment.dto";

export interface RecruitmentQuestion {
  question_id: string;
  question_type: QuestionType;
  is_required: boolean;
  options: { option_id: string; label: string }[];
  validation: QuestionValidationDto;
}
export const FILE_LIMIT = 5 * 1024 * 1024;
export const FILE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const choiceTypes = new Set(["single_choice", "checkboxes", "dropdown"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateForm(questions: QuestionDto[]) {
  const fields = new Set<string>();
  for (const q of questions) {
    if (!q.question_text.trim()) throw new BadRequestException("Tiêu đề câu hỏi không được để trống.");
    if (q.field_id && fields.has(q.field_id)) throw new BadRequestException("Mã câu hỏi bị trùng.");
    if (q.field_id) fields.add(q.field_id);
    const options = q.options ?? [], rules = q.validation ?? {};
    if (choiceTypes.has(q.question_type)) {
      if (options.length < 2 || new Set(options.map(o => o.option_id)).size !== options.length || options.some(o => !o.label.trim()))
        throw new BadRequestException("Câu hỏi lựa chọn cần ít nhất hai phương án hợp lệ, có mã riêng.");
    } else if (options.length) throw new BadRequestException("Loại câu hỏi này không có phương án lựa chọn.");
    if ((rules.min_length ?? 0) > (rules.max_length ?? 10000) || (rules.min ?? -Infinity) > (rules.max ?? Infinity))
      throw new BadRequestException("Giới hạn tối thiểu không được lớn hơn tối đa.");
    if (q.profile_field && !["short_text", "paragraph", "email", "phone"].includes(q.question_type))
      throw new BadRequestException("Chỉ trường văn bản mới có thể điền sẵn từ hồ sơ.");
  }
}
export function answerErrors(questions: RecruitmentQuestion[], answers: AnswerDto[]): Record<string, string> {
  const errors: Record<string, string> = {}, seen = new Set<string>();
  const known = new Set(questions.map(q => q.question_id));
  for (const a of answers) {
    if (!known.has(a.question_id)) errors[a.question_id] = "Câu hỏi không thuộc phiên bản biểu mẫu này.";
    if (seen.has(a.question_id)) errors[a.question_id] = "Câu hỏi có nhiều câu trả lời trùng nhau.";
    seen.add(a.question_id);
  }
  for (const q of questions) {
    const value = answers.find(a => a.question_id === q.question_id)?.value;
    const empty = value == null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);
    if (empty) { if (q.is_required) errors[q.question_id] = "Vui lòng trả lời câu hỏi này."; continue; }
    const rules = q.validation || {}, allowed = new Set((q.options || []).map(o => o.option_id));
    let error = "";
    switch (q.question_type) {
      case "number": case "rating":
        if (typeof value !== "number" || !Number.isFinite(value)) error = "Vui lòng nhập số hợp lệ.";
        else if (q.question_type === "rating" && (!Number.isInteger(value) || value < 1 || value > 5)) error = "Chọn điểm từ 1 đến 5.";
        else if (value < (rules.min ?? -Infinity) || value > (rules.max ?? Infinity)) error = "Giá trị nằm ngoài giới hạn cho phép.";
        break;
      case "checkboxes":
        if (!Array.isArray(value) || value.some(v => typeof v !== "string" || !allowed.has(v)) || new Set(value).size !== value.length) error = "Chọn các phương án hợp lệ.";
        break;
      case "single_choice": case "dropdown":
        if (typeof value !== "string" || !allowed.has(value)) error = "Vui lòng chọn một phương án hợp lệ.";
        break;
      case "file":
        if (!Array.isArray(value) || value.length > (rules.max_files ?? 1) || value.some(v => typeof v !== "string" || !uuid.test(v)) || new Set(value).size !== value.length) error = "Danh sách file đính kèm chưa hợp lệ.";
        break;
      default:
        if (typeof value !== "string") error = "Vui lòng nhập nội dung hợp lệ.";
        else if (value.length < (rules.min_length ?? 0) || value.length > (rules.max_length ?? 10000)) error = "Độ dài câu trả lời chưa phù hợp.";
        else if (q.question_type === "email" && !isEmail(value)) error = "Địa chỉ email chưa hợp lệ.";
        else if (q.question_type === "phone" && !/^\+?[0-9][0-9 .()-]{7,24}$/.test(value)) error = "Số điện thoại chưa hợp lệ.";
        else if (q.question_type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) error = "Ngày chưa hợp lệ.";
    }
    if (error) errors[q.question_id] = error;
  }
  return errors;
}
export function validateAnswers(questions: RecruitmentQuestion[], answers: AnswerDto[]) {
  const fields = answerErrors(questions, answers);
  if (Object.keys(fields).length) throw new BadRequestException({ code: "FORM_INVALID", message: "Vui lòng kiểm tra các câu trả lời được đánh dấu.", fields });
}
export function detectedMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}
export function publicApplicationStatus(status: string) {
  return ({ submitted: "pending", interviewing: "pending", accepted: "approved", rejected: "rejected" } as Record<string, string>)[status] || status;
}
