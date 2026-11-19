export const questionTypes = ["short_text", "paragraph", "single_choice", "checkboxes", "dropdown", "number", "email", "phone", "date", "file", "rating"] as const;
export type QuestionType = typeof questionTypes[number];
export const typeLabels: Record<QuestionType, string> = { short_text: "Trả lời ngắn", paragraph: "Đoạn văn", single_choice: "Một lựa chọn", checkboxes: "Nhiều lựa chọn", dropdown: "Danh sách thả xuống", number: "Số", email: "Email", phone: "Điện thoại", date: "Ngày", file: "Tải file", rating: "Thang điểm 1–5" };
export interface Question {
  question_id: string; field_id: string; question_text: string; help_text?: string; question_type: QuestionType;
  is_required: boolean; options: { option_id: string; label: string }[];
  validation: { min_length?: number; max_length?: number; min?: number; max?: number; max_files?: number; max_size_bytes?: number; allowed_mime_types?: string[] };
  profile_field?: string;
}
export interface Campaign {
  campaign_id: string; club_id: string; club_name?: string; title: string; description: string; summary?: string;
  benefits?: string; contact_email?: string; contact_phone?: string; cover_url?: string | null;
  application_opens_at: string; application_closes_at: string; updated_at: string; status: string;
  effective_status?: string; accepting_applications?: boolean;
}
export interface RecruitingDepartment {
  recruitment_department_id: string; department_id: string; department_name?: string; club_departments?: { name: string };
  description: string; requirements?: string; target_quantity?: number; questions: Question[];
  current_form_version_id?: string; form_version_id?: string;
}
export interface CampaignDetail { item: Campaign; departments: RecruitingDepartment[]; application_count?: number }
export interface Application {
  application_id: string; campaign_id: string; status: string; display_status: string; updated_at: string;
  submitted_at?: string; result_message?: string; recruitment_department_id?: string; department_name?: string;
  profile_snapshot?: Record<string, string | null>; recruitment_campaigns?: { title: string; club_id: string };
}
export interface ApplicationDetail { item: Application; questions: Question[]; answers: { question_id: string; answer_value: unknown }[]; files: Attachment[] }
export interface Attachment { file_id: string; question_id?: string; file_name: string; size_bytes: number; mime_type: string }
export interface ApplicationContext extends CampaignDetail { profile: Record<string, string | null>; application: Application | null; can_apply: boolean; unavailable_reason: string | null }
export interface Page<T> { items: T[]; total: number; page: number; limit: number; hasMore: boolean; stats?: Record<string, number> }
export type Values = Record<string, unknown>;
export const applicationStatus = (value: string) => ({ pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", submitted: "Chờ duyệt", interviewing: "Chờ duyệt", accepted: "Đã duyệt" })[value] || value;
export const campaignStatus = (item: Campaign) => {
  if (item.status === "open") return Date.now() < Date.parse(item.application_opens_at) ? "Sắp mở đơn" : Date.now() >= Date.parse(item.application_closes_at) ? "Đã hết hạn" : "Đang nhận đơn";
  return ({ draft: "Bản nháp", closed: "Đã đóng", completed: "Hoàn tất", cancelled: "Đã hủy" })[item.status] || item.status;
};
export const dateText = (value?: string) => value ? new Date(value).toLocaleString("vi-VN") : "—";
export const departmentName = (d: RecruitingDepartment) => d.department_name || d.club_departments?.name || "Ban tuyển dụng";
