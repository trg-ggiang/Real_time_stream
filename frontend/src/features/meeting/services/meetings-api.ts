import { UnauthorizedError } from './token-api';
import type { JoinCredentials } from '../types';

export type Role = 'host' | 'moderator' | 'participant';
export type Membership = { meetingMemberId?: string; userId: string; role: Role; invitedAt: string | null };
export type MeetingInfo = { meetingId: string; meetingCode: string; title: string; recurrenceRule?: string | null; waitingRoomEnabled?: boolean };
export type MeetingSession = {
  session_id: string; meeting_id: string; status: 'scheduled' | 'ongoing' | 'ended';
  scheduled_start_at: string | null; scheduled_end_at: string | null; started_at?: string | null; ended_at?: string | null;
};
export type MeetingOverview = { meeting: MeetingInfo; membership?: Membership | null; sessions: MeetingSession[] };
export type JoinedSession = JoinCredentials & { status: 'admitted'; meetingId: string; sessionId: string; attendanceId: string };
export type Admission = { status: 'pending' | 'admitted' | 'denied' | 'not_requested' | 'session_ended'; meetingMemberId?: string; remainingAttempts?: number; retryAt?: string | null };
export type Member = {
  meeting_member_id: string; user_id: string; role: Role; invited_at: string | null;
  users: { display_name: string; email: string } | null;
};
export type JoinRequest = { requestId: string; meeting_member_id: string; meeting_members: { user_id: string; users: { display_name: string } | null } };

export class MeetingApiError extends Error {
  constructor(message: string, public status: number, public retryAt?: string) { super(message); }
}

// One authenticated client; requests time out, support cancellation, and never persist JWTs.
export async function meetingRequest<T>(accessToken: string, path: string, options: {
  method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal; keepalive?: boolean;
} = {}): Promise<T> {
  const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${base}/api/meetings${path}`, {
      method: options.method ?? 'GET', signal, cache: 'no-store', keepalive: options.keepalive,
      headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(timeout.aborted ? 'Yêu cầu quá thời gian. Hãy thử lại.' : 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401) throw new UnauthorizedError('Phiên đăng nhập hết hạn. Hãy đăng nhập lại.');
  if (!response.ok) {
    const scheduleErrors: Record<string, string> = {
      INVALID_SCHEDULE_TIME: 'Giờ bắt đầu phải ở tương lai và giờ kết thúc phải sau giờ bắt đầu. Hãy chọn lại thời gian.',
      SINGLE_SESSION_EXISTS: 'Cuộc họp không lặp này đã có một buổi. Hãy tạo cuộc họp mới nếu muốn đặt lịch khác.',
    };
    const messages: Record<number, string> = {
      400: 'Thông tin chưa hợp lệ. Kiểm tra biểu mẫu rồi thử lại.',
      403: 'Bạn chưa có quyền thực hiện thao tác này hoặc quyền vào buổi họp đã hết hạn.',
      404: 'Không tìm thấy cuộc họp, thành viên hoặc dữ liệu đã thay đổi. Hãy tải lại.',
      409: 'Dữ liệu đã thay đổi hoặc buổi họp chưa đến giờ. Hãy tải lại danh sách.',
      429: 'Bạn đã gửi quá nhiều yêu cầu. Hãy chờ trước khi thử lại.',
      503: 'Máy chủ chưa xử lý được yêu cầu. Hãy thử lại sau.',
    };
    throw new MeetingApiError((response.status === 409 && scheduleErrors[data?.code]) || messages[response.status] || 'Không hoàn tất được thao tác. Hãy thử lại.', response.status, data?.retryAt);
  }
  return data as T;
}

export function parseMeetingCode(value: string): string {
  let code = value.trim();
  if (/^https?:\/\//i.test(code)) {
    try { const url = new URL(code); code = url.searchParams.get('meeting') || ''; } catch { code = ''; }
  }
  code = code.toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(code)) throw new Error('Nhập mã cuộc họp gồm 10 chữ/số hoặc đường dẫn mời hợp lệ.');
  return code;
}

// Existing read API does not expose the viewer's role. Unknown permissions must
// be checked by the existing mutation endpoints, never inferred from a JWT or UI input.
export function canManageSessions(member: Membership | null | undefined): boolean {
  return member ? member.role !== 'participant' || member.invitedAt !== null : true;
}
export const roleLabels: Record<Role, string> = { host: 'Chủ phòng', moderator: 'Điều hành', participant: 'Thành viên' };
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
export function formatMeetingDate(value: string | null | undefined): string {
  return value && Number.isFinite(Date.parse(value)) ? dateFormatter.format(new Date(value)) : 'Không giới hạn thời gian';
}

export async function joinMeeting(accessToken: string, code: string, sessionId: string, signal: AbortSignal) {
  const result = await meetingRequest<JoinedSession | { status: 'pending'; meetingId: string; sessionId: string }>(accessToken,
    `/${encodeURIComponent(code)}/join`, { method: 'POST', body: { sessionId }, signal });
  if (result.status === 'admitted' && (!result.token || !result.serverUrl?.startsWith('wss://') || !result.attendanceId || !result.participantIdentity || !result.roomName)) {
    throw new Error('Thông tin vào phòng không hợp lệ. Hãy tải lại cuộc họp.');
  }
  if (result.status !== 'pending' && result.status !== 'admitted') throw new Error('Trạng thái tham gia không hợp lệ.');
  return result;
}
