import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

const clubFields = "club_id,name,summary,logo_url,cover_url";
const activityFields =
  "activity_id,club_id,club_name,title,starts_at,ends_at,cover_url,format,location_name,lifecycle_status";
const registrationFields =
  "registration_id,activity_id,status,registered_at,cancelled_at";
const requestFields =
  "club_id,name,summary,description,mission,logo_url,cover_url,contact_email,contact_phone,status,created_at,reviewed_at,review_note";

@Injectable()
export class PersonalService {
  constructor(private readonly supabase: SupabaseService) {}
  private unavailable(error: unknown) {
    if (error)
      throw new ServiceUnavailableException(
        "Dữ liệu cá nhân tạm thời chưa khả dụng. Vui lòng thử lại.",
      );
  }
  private page<T>(
    items: T[],
    count: number | null,
    page: number,
    limit: number,
  ) {
    return {
      items,
      total: count ?? 0,
      page,
      limit,
      hasMore: page * limit < (count ?? 0),
    };
  }

  async clubs(userId: string, page: number, limit: number) {
    const { data, error, count } = await this.supabase.client
      .from("club_memberships")
      .select(
        "membership_id,club_id,role,department_id,joined_at,clubs!inner(club_id,name,summary,logo_url,cover_url)",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("clubs.status", "published")
      .order("joined_at", { ascending: false })
      .order("membership_id")
      .range((page - 1) * limit, page * limit - 1);
    this.unavailable(error);
    return this.page(
      (data ?? []).map((row) => ({
        membership_id: row.membership_id,
        role: row.role,
        department_id: row.department_id,
        joined_at: row.joined_at,
        club: row.clubs,
      })),
      count,
      page,
      limit,
    );
  }
  async follows(userId: string, page: number, limit: number) {
    const { data, error, count } = await this.supabase.client
      .from("club_follows")
      .select(`club_id,created_at,clubs!inner(${clubFields})`, {
        count: "exact",
      })
      .eq("user_id", userId)
      .eq("clubs.status", "published")
      .order("created_at", { ascending: false })
      .order("club_id")
      .range((page - 1) * limit, page * limit - 1);
    this.unavailable(error);
    return this.page(
      (data ?? []).map((row) => ({
        club_id: row.club_id,
        created_at: row.created_at,
        club: row.clubs,
      })),
      count,
      page,
      limit,
    );
  }
  async following(userId: string, clubId: string) {
    const { data, error } = await this.supabase.client
      .from("club_follows")
      .select("club_id")
      .eq("user_id", userId)
      .eq("club_id", clubId)
      .maybeSingle();
    this.unavailable(error);
    return { following: !!data };
  }
  async follow(userId: string, clubId: string) {
    const visible = await this.supabase.client
      .from("public_clubs")
      .select("club_id")
      .eq("club_id", clubId)
      .maybeSingle();
    this.unavailable(visible.error);
    if (!visible.data)
      throw new NotFoundException("CLB không còn được công khai.");
    const { error } = await this.supabase.client
      .from("club_follows")
      .insert({ user_id: userId, club_id: clubId });
    if (error && error.code !== "23505") this.unavailable(error);
    return { following: true };
  }
  async unfollow(userId: string, clubId: string) {
    const { error } = await this.supabase.client
      .from("club_follows")
      .delete()
      .eq("user_id", userId)
      .eq("club_id", clubId);
    this.unavailable(error);
    return { following: false };
  }
  async registration(userId: string, activityId: string) {
    const { data, error } = await this.supabase.client
      .from("activity_registrations")
      .select(registrationFields)
      .eq("user_id", userId)
      .eq("activity_id", activityId)
      .maybeSingle();
    this.unavailable(error);
    return { registration: data };
  }
  async registrations(userId: string, page: number, limit: number) {
    const { data, error, count } = await this.supabase.client
      .from("activity_registrations")
      .select(registrationFields, { count: "exact" })
      .eq("user_id", userId)
      .order("registered_at", { ascending: false })
      .order("registration_id")
      .range((page - 1) * limit, page * limit - 1);
    this.unavailable(error);
    const ids = (data ?? []).map((row) => row.activity_id);
    const activities = ids.length
      ? await this.supabase.client
          .from("public_club_activities")
          .select(activityFields)
          .in("activity_id", ids)
      : { data: [], error: null };
    this.unavailable(activities.error);
    const byId = new Map(
      (activities.data ?? []).map((row) => [row.activity_id, row]),
    );
    // Hidden activities retain registration history, but do not leak draft/private content.
    return this.page(
      (data ?? []).map((row) => ({
        ...row,
        activity: byId.get(row.activity_id) ?? null,
      })),
      count,
      page,
      limit,
    );
  }
  private registrationError(error: { code?: string } | null) {
    if (error && ["P0001", "23514", "23503"].includes(error.code ?? "")) {
      throw new ConflictException(
        "Chưa thể thực hiện: hoạt động có thể đã hết chỗ, ngoài thời gian đăng ký hoặc bạn đã điểm danh. Hãy tải lại trạng thái.",
      );
    }
    this.unavailable(error);
  }
  async register(userId: string, activityId: string) {
    const existing = (await this.registration(userId, activityId)).registration;
    if (existing?.status === "registered") return { registration: existing };
    const activity = await this.supabase.client
      .from("club_activities")
      .select(
        "activity_id,starts_at,ends_at,registration_opens_at,registration_closes_at,publication_status,lifecycle_status,clubs!inner(status)",
      )
      .eq("activity_id", activityId)
      .eq("clubs.status", "published")
      .eq("publication_status", "published")
      .maybeSingle();
    this.unavailable(activity.error);
    if (!activity.data)
      throw new NotFoundException("Hoạt động không còn được công khai.");
    const a = activity.data;
    const now = Date.now();
    if (
      !["scheduled", "ongoing"].includes(a.lifecycle_status) ||
      Date.parse(a.ends_at) <= now ||
      (a.registration_opens_at && Date.parse(a.registration_opens_at) > now) ||
      Date.parse(a.registration_closes_at || a.starts_at) <= now
    ) {
      throw new ConflictException("Hoạt động hiện không nhận đăng ký.");
    }
    // The DB trigger locks the activity row and checks capacity/window atomically.
    // Do not implement seat reservation with a client-side count then insert.
    const query = existing
      ? this.supabase.client
          .from("activity_registrations")
          .update({ status: "registered" })
          .eq("registration_id", existing.registration_id)
          .eq("user_id", userId)
          .eq("status", "cancelled")
      : this.supabase.client.from("activity_registrations").insert({
          activity_id: activityId,
          user_id: userId,
          status: "registered",
        });
    const { data, error } = await query
      .select(registrationFields)
      .maybeSingle();
    if (error?.code === "23505") return this.registration(userId, activityId);
    this.registrationError(error);
    return data
      ? { registration: data }
      : this.registration(userId, activityId);
  }
  async cancel(userId: string, activityId: string) {
    const existing = (await this.registration(userId, activityId)).registration;
    if (!existing || existing.status === "cancelled")
      return { registration: existing };
    const { data, error } = await this.supabase.client
      .from("activity_registrations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("registration_id", existing.registration_id)
      .eq("user_id", userId)
      .eq("status", "registered")
      .select(registrationFields)
      .maybeSingle();
    this.registrationError(error);
    return data
      ? { registration: data }
      : this.registration(userId, activityId);
  }
  async requests(userId: string, page: number, limit: number) {
    const { data, error, count } = await this.supabase.client
      .from("clubs")
      .select(requestFields, { count: "exact" })
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .order("club_id")
      .range((page - 1) * limit, page * limit - 1);
    this.unavailable(error);
    return this.page(data ?? [], count, page, limit);
  }
  async request(userId: string, clubId: string) {
    const { data, error } = await this.supabase.client
      .from("clubs")
      .select(requestFields)
      .eq("created_by", userId)
      .eq("club_id", clubId)
      .maybeSingle();
    this.unavailable(error);
    if (!data) throw new NotFoundException("Không tìm thấy đề nghị của bạn.");
    return { item: data };
  }
}
