export interface AdminClubSummary {
  club_id: string;
  name: string;
  summary: string;
  logo_url: string | null;
  cover_url: string | null;
  status: "pending" | "published" | "rejected" | "suspended" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  published_at?: string | null;
}
export interface AdminClub extends AdminClubSummary {
  description: string;
  mission: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  reviewed_by?: string | null;
  review_note?: string | null;
}
export interface AdminPage {
  items: AdminClubSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
export interface AdminDetail {
  item: AdminClub;
  creator: { user_id: string; display_name: string; email: string } | null;
  reviewer: { user_id: string; display_name: string } | null;
}
export interface AdminSummary {
  pending: number;
  published: number;
  rejected: number;
}
export const clubStatus = (status: string) =>
  ({
    pending: "Chờ xét duyệt",
    published: "Đã công khai",
    rejected: "Đã từ chối",
    suspended: "Tạm ngừng",
    archived: "Đã lưu trữ",
  })[status] || status;
