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
