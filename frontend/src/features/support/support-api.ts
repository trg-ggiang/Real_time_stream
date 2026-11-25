import { accountRequest } from '../../shared/api/account-http';

export const categories = { account: 'Tài khoản và hồ sơ', clubs: 'Câu lạc bộ', recruitment: 'Tuyển thành viên', meetings: 'Phòng họp', content: 'Hoạt động và bài viết', other: 'Vấn đề khác' } as const;
export const statuses = { new: 'Mới tiếp nhận', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết', rejected: 'Không tiếp nhận' } as const;
export type Category = keyof typeof categories;
export type ReportStatus = keyof typeof statuses;
export interface SupportReport {
  report_id: string; category: Category; title: string; description: string; steps: string; page_path: string;
  priority: 'normal' | 'high'; status: ReportStatus; admin_response: string; created_at: string; updated_at: string; resolved_at: string | null;
  reporter?: { user_id: string; display_name: string; email: string } | null;
}
export interface ReportPage { items: SupportReport[]; total: number; page: number; limit: number; hasMore: boolean; }
export interface ReportDraft { report_id: string; category: Category; title: string; description: string; steps: string; page_path: string; priority: 'normal' | 'high'; }
export const reportCode = (id: string) => `SC-${id.slice(0, 8).toUpperCase()}`;
export const reportDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
export function createReport(token: string, draft: ReportDraft, signal: AbortSignal) {
  return accountRequest<{ item: SupportReport }>(token, 'support/reports', { method: 'POST', body: JSON.stringify(draft), signal });
}
