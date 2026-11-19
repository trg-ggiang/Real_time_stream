import { accountRequest } from "../../../shared/api/account-http";
export interface ClubSummary {
  club_id: string;
  name: string;
  summary?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
}
export interface Membership {
  membership_id: string;
  role: "chairperson" | "head" | "member";
  department_id: string;
  joined_at: string;
  club: ClubSummary;
}
export interface Follow {
  club_id: string;
  created_at: string;
  club: ClubSummary;
}
export interface Registration {
  registration_id: string;
  activity_id: string;
  status: "registered" | "cancelled";
  registered_at: string;
  cancelled_at: string | null;
}
export interface RegisteredActivity extends Registration {
  activity: {
    activity_id: string;
    club_id: string;
    club_name: string;
    title: string;
    starts_at: string;
    ends_at: string;
    cover_url?: string;
    location_name?: string;
    lifecycle_status: string;
  } | null;
}
export interface ClubRequest extends ClubSummary {
  description: string;
  mission?: string | null;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}
export interface PrivatePage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
export function personalPage<T>(
  token: string,
  path: string,
  page: number,
  signal: AbortSignal,
) {
  return accountRequest<PrivatePage<T>>(
    token,
    `me/${path}?page=${page}&limit=12`,
    { signal },
  );
}
export async function followState(
  token: string,
  id: string,
  options?: RequestInit,
) {
  const data = await accountRequest<{ following: boolean }>(
    token,
    `me/follows/${id}`,
    options,
  );
  if (typeof data.following !== "boolean")
    throw new Error("Chưa xác nhận được trạng thái quan tâm. Hãy tải lại.");
  return data;
}
export async function registrationState(
  token: string,
  id: string,
  options?: RequestInit,
) {
  const data = await accountRequest<{ registration: Registration | null }>(
    token,
    `me/registrations/${id}`,
    options,
  );
  if (
    data.registration !== null &&
    (!data.registration ||
      data.registration.activity_id !== id ||
      !["registered", "cancelled"].includes(data.registration.status))
  )
    throw new Error("Chưa xác nhận được trạng thái đăng ký. Hãy tải lại.");
  return data;
}
