import { accountRequest } from "../../../shared/api/account-http";
export type ContentKind = "posts" | "activities";
export interface WorkspaceClub {
  club_id: string;
  name: string;
  summary: string;
  description: string;
  mission: string | null;
  logo_url: string | null;
  cover_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}
export interface WorkspaceContext {
  club: WorkspaceClub;
  membership: {
    membership_id: string;
    user_id: string;
    club_id: string;
    role: "chairperson" | "member" | "head";
    department_id: string;
  };
}
export interface Department {
  department_id: string;
  name: string;
  description: string | null;
  is_management: boolean;
  is_private: boolean;
  status: "active" | "inactive";
}
export interface Member {
  membership_id: string;
  user_id: string;
  role: "chairperson" | "member" | "head";
  department_id: string;
  joined_at: string;
  users: { display_name: string; avatar_url: string | null };
  club_departments: { name: string };
}
export interface ContentItem {
  post_id?: string;
  activity_id?: string;
  club_id: string;
  author_id?: string;
  created_by?: string;
  title: string;
  summary: string;
  content?: string;
  description?: string;
  visibility?: "public" | "internal";
  cover_url?: string | null;
  publication_status: string;
  review_note?: string | null;
  updated_at: string;
  published_at?: string | null;
  starts_at?: string;
  ends_at?: string;
  format?: string;
  location_name?: string | null;
  location_address?: string | null;
  join_url?: string | null;
  capacity?: number | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
}
export interface WorkspaceList<T> {
  items: T[];
  total?: number;
  hasMore?: boolean;
}
export interface RecruitmentCampaign {
  campaign_id: string;
  club_id: string;
  title: string;
  description: string;
  cover_url: string | null;
  application_opens_at: string;
  application_closes_at: string;
  status: "draft" | "open" | "closed" | "completed" | "cancelled";
  created_by: string;
  updated_at: string;
  departments?: {
    recruitment_department_id: string;
    department_id: string;
    description: string;
    requirements: string | null;
    target_quantity: number | null;
    club_departments: { name: string };
    recruitment_questions: { question_id: string; question_text: string; help_text: string | null; is_required: boolean; max_length: number; sort_order: number }[];
  }[];
}
export type RecruitmentApplicationStatus = "draft" | "submitted" | "interviewing" | "accepted" | "rejected" | "withdrawn";
export interface RecruitmentApplicationQueueItem {
  application_id: string;
  campaign_id: string;
  recruitment_department_id: string;
  full_name: string;
  student_code: string;
  status: RecruitmentApplicationStatus;
  submitted_at: string;
  score: number | null;
  internal_note: string | null;
  feedback: string | null;
  department_name: string;
  campaign_title: string;
}
export interface RecruitmentApplicationReview extends RecruitmentApplicationQueueItem {
  answers: Record<string, string>;
  portfolio_url: string | null;
  questions: { question_id: string; question_text: string }[];
}
export const recruitmentStatus = (status: RecruitmentCampaign["status"]) => ({ draft: "Bản nháp", open: "Đã đăng", closed: "Đã đóng đơn", completed: "Đã hoàn thành", cancelled: "Đã hủy" })[status];
export const contentId = (item: ContentItem) =>
  item.post_id || item.activity_id!;
export const contentStatus = (status: string) =>
  ({
    draft: "Bản nháp",
    pending_review: "Chờ duyệt",
    changes_requested: "Cần chỉnh sửa",
    rejected: "Cần chỉnh sửa",
    published: "Đã đăng",
    archived: "Đã lưu trữ",
  })[status] || status;
export const workspaceRequest = <T>(
  token: string,
  clubId: string,
  path = "",
  options?: RequestInit,
) =>
  accountRequest<T>(
    token,
    `workspace/${clubId}${path ? "/" + path : ""}`,
    options,
  );
