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
    role: "chairperson" | "head" | "member";
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
  updated_at: string;
  membership_id: string;
  user_id: string;
  role: "chairperson" | "head" | "member";
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
export interface ClubChannel {
  channel_id: string; club_id: string; department_id: string | null;
  kind: 'general' | 'department'; name: string; description: string | null;
}
export interface ChannelMessage {
  message_id: string; channel_id: string; sender_membership_id: string; content: string;
  sender: string; avatar_url: string | null; created_at: string; edited_at: string | null;
  deleted_at: string | null; mine: boolean; client_message_id?: string;
  attachments?: ChannelAttachment[];
}
export interface ChannelAttachment {
  attachment_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  position: number;
}
export interface ChannelHistory {
  items: ChannelMessage[]; hasMore: boolean; cursor: { before: string; before_id: string } | null;
}
export interface ClubMeeting {
  meeting_id: string; meeting_code: string; title: string; recurrence_rule: string | null;
  meeting_sessions: { session_id: string; status: 'scheduled' | 'ongoing' | 'ended'; scheduled_start_at: string | null; scheduled_end_at: string | null }[];
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
  options?: RequestInit & { timeoutMs?: number },
) =>
  accountRequest<T>(
    token,
    `workspace/${clubId}${path ? "/" + path : ""}`,
    options,
  );
