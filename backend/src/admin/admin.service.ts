import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { User } from "../users/entities/user.entity";
import { AdminDecisionDto, AdminListQuery, AdminDirectoryQuery } from "./admin.dto";
const listFields =
  "club_id,name,summary,logo_url,cover_url,status,created_by,created_at,updated_at,reviewed_at,published_at";
const detailFields =
  listFields +
  ",description,mission,contact_email,contact_phone,reviewed_by,review_note";
@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}
  require(user: User) {
    if (user.role !== "admin")
      throw new ForbiddenException("Chỉ quản trị viên nền tảng được truy cập.");
  }
  private get db() {
    return this.supabase.client;
  }
  private check(error: { code?: string } | null) {
    if (!error) return;
    if (["23514", "23503", "23505", "P0001"].includes(error.code || ""))
      throw new ConflictException(
        "Cấu trúc hoặc trạng thái CLB chưa đáp ứng điều kiện. Tải lại hồ sơ để kiểm tra.",
      );
    throw new ServiceUnavailableException(
      "Chưa thực hiện được yêu cầu. Tải lại trạng thái trước khi thử lại.",
    );
  }
  async list(user: User, input: AdminListQuery) {
    this.require(user);
    const { page, limit, status, scope } = input;
    const q = this.db.from("clubs").select(listFields, { count: "exact" });
    if (scope === "directory")
      q.in("status", ["published", "suspended", "archived"]);
    if (status !== "all") q.eq("status", status);
    const search = input.q
      .trim()
      .replace(/[\\%_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (search) q.ilike("name", `%${search}%`);
    const r = await q
      .order("created_at", { ascending: false })
      .order("club_id")
      .range((page - 1) * limit, page * limit - 1);
    this.check(r.error);
    return {
      items: r.data ?? [],
      total: r.count ?? 0,
      page,
      limit,
      hasMore: page * limit < (r.count ?? 0),
    };
  }
  async summary(user: User) {
    this.require(user);
    const statuses = ["pending", "published", "rejected", "suspended", "archived"] as const;
    const rows = await Promise.all(
      statuses.map((status) =>
        this.db
          .from("clubs")
          .select("club_id", { count: "exact", head: true })
          .eq("status", status),
      ),
    );
    rows.forEach((r) => this.check(r.error));
    const totals = await Promise.all(['users', 'clubs', 'club_posts', 'club_activities'].map(table =>
      this.db.from(table).select('*', { count: 'exact', head: true })));
    totals.forEach(r => this.check(r.error));
    const today = new Date(Date.now() + 7 * 3600_000); today.setUTCHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const start = new Date(today.getTime() - (6 - index) * 86400_000 - 7 * 3600_000);
      return { date: new Date(start.getTime() + 7 * 3600_000).toISOString().slice(0, 10), start: start.toISOString(), end: new Date(start.getTime() + 86400_000).toISOString() };
    });
    const daily = await Promise.all(days.map(day => this.db.from('users').select('user_id', { count: 'exact', head: true }).gte('created_at', day.start).lt('created_at', day.end)));
    daily.forEach(r => this.check(r.error));
    return { ...Object.fromEntries(statuses.map((s, i) => [s, rows[i].count ?? 0])),
      users: totals[0].count ?? 0, clubs: totals[1].count ?? 0,
      posts: totals[2].count ?? 0, activities: totals[3].count ?? 0,
      registrations: days.map((day, index) => ({ date: day.date, count: daily[index].count ?? 0 })) };
  }

  private search(value: string) {
    // Remove PostgREST filter delimiters before composing an OR expression.
    return value.replace(/[^\p{L}\p{N}\s@.\-]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  async users(user: User, input: AdminDirectoryQuery) {
    this.require(user);
    const query = this.db.from('users').select('user_id,email,display_name,avatar_url,role,created_at', { count: 'exact' });
    if (input.role === 'admin') query.eq('role', 'admin');
    if (input.role === 'user') query.or('role.is.null,role.eq.user');
    const search = this.search(input.q);
    if (search) query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
    const r = await query.order('created_at', { ascending: false }).order('user_id').range((input.page - 1) * input.limit, input.page * input.limit - 1);
    this.check(r.error);
    return { items: r.data ?? [], total: r.count ?? 0, page: input.page, limit: input.limit, hasMore: input.page * input.limit < (r.count ?? 0) };
  }
  async userDetail(user: User, id: string) {
    this.require(user);
    const [account, profile, memberships] = await Promise.all([
      this.db.from('users').select('user_id,email,display_name,avatar_url,role,created_at').eq('user_id', id).maybeSingle(),
      this.db.from('student_profiles').select('full_name,student_code,school_or_faculty,major,cohort,phone').eq('user_id', id).maybeSingle(),
      this.db.from('club_memberships').select('membership_id,club_id,role,status').eq('user_id', id).order('created_at').limit(100),
    ]);
    [account, profile, memberships].forEach(r => this.check(r.error));
    if (!account.data) throw new NotFoundException('Không tìm thấy tài khoản.');
    const ids = [...new Set((memberships.data ?? []).map(item => item.club_id))];
    const clubs = ids.length ? await this.db.from('clubs').select('club_id,name').in('club_id', ids) : { data: [], error: null };
    this.check(clubs.error);
    return { account: account.data, profile: profile.data, memberships: (memberships.data ?? []).map(item => ({ ...item,
      club_name: clubs.data?.find(club => club.club_id === item.club_id)?.name ?? 'CLB' })) };
  }
  private contentSource(kind: string) {
    if (kind !== 'posts' && kind !== 'activities') throw new BadRequestException('Loại nội dung không hợp lệ.');
    return kind === 'posts' ? { table: 'club_posts', id: 'post_id', body: 'content', extra: 'visibility' }
      : { table: 'club_activities', id: 'activity_id', body: 'description', extra: 'starts_at,ends_at,location_name' };
  }
  async content(user: User, input: AdminDirectoryQuery) {
    this.require(user);
    const source = this.contentSource(input.kind);
    const query = this.db.from(source.table).select(`${source.id},club_id,title,summary,cover_url,publication_status,updated_at,${source.extra}`, { count: 'exact' });
    if (input.status !== 'all') query.eq('publication_status', input.status);
    const search = this.search(input.q);
    if (search) query.ilike('title', `%${search}%`);
    const r = await query.order('updated_at', { ascending: false }).order(source.id).range((input.page - 1) * input.limit, input.page * input.limit - 1);
    this.check(r.error);
    const items = (r.data ?? []) as unknown as (Record<string, unknown> & { club_id: string })[];
    const ids = [...new Set(items.map(item => item.club_id))];
    const clubs = ids.length ? await this.db.from('clubs').select('club_id,name,status').in('club_id', ids) : { data: [], error: null };
    this.check(clubs.error);
    return { items: items.map(item => ({ ...item, id: item[source.id], club: clubs.data?.find(club => club.club_id === item.club_id) ?? null })),
      total: r.count ?? 0, page: input.page, limit: input.limit, hasMore: input.page * input.limit < (r.count ?? 0) };
  }
  async contentDetail(user: User, kind: string, id: string) {
    this.require(user);
    const source = this.contentSource(kind);
    const r = await this.db.from(source.table).select(`${source.id},club_id,title,summary,cover_url,publication_status,updated_at,review_note,${source.body},${source.extra}`).eq(source.id, id).maybeSingle();
    this.check(r.error);
    if (!r.data) throw new NotFoundException('Không tìm thấy nội dung.');
    const item = r.data as unknown as Record<string, unknown>;
    return { item: { ...item, id: item[source.id], body: item[source.body] } };
  }
  async detail(user: User, id: string) {
    this.require(user);
    const r = await this.db
      .from("clubs")
      .select(detailFields)
      .eq("club_id", id)
      .maybeSingle();
    this.check(r.error);
    if (!r.data) throw new NotFoundException("Không tìm thấy hồ sơ CLB.");
    const item = r.data as unknown as {
      [key: string]: unknown;
      created_by: string;
      reviewed_by: string | null;
    };
    const ids = [item.created_by, item.reviewed_by].filter(
      (v): v is string => typeof v === "string",
    );
    const people = ids.length
      ? await this.db
          .from("users")
          .select("user_id,display_name,email")
          .in("user_id", ids)
      : { data: [], error: null };
    this.check(people.error);
    const links = await this.db.from("club_category_links")
      .select("category_id").eq("club_id", id);
    this.check(links.error);
    const categories = links.data?.length
      ? await this.db.from("club_categories").select("category_id,name")
          .in("category_id", links.data.map((link) => link.category_id)).order("name")
      : { data: [], error: null };
    this.check(categories.error);
    const creator =
      people.data?.find((x) => x.user_id === item.created_by) || null;
    const reviewer = people.data?.find((x) => x.user_id === item.reviewed_by);
    return {
      item: { ...item, category_names: (categories.data ?? []).map((category) => category.name) },
      creator,
      reviewer: reviewer
        ? { user_id: reviewer.user_id, display_name: reviewer.display_name }
        : null,
    };
  }
  async decide(user: User, id: string, input: AdminDecisionDto) {
    this.require(user);
    const reason = input.reason?.trim();
    if (input.decision === "reject" && !reason)
      throw new BadRequestException(
        "Nhập lý do từ chối để người gửi có thể điều chỉnh hồ sơ mới.",
      );
    // Provisioning belongs to existing database triggers, never to an approval rollback.
    if (input.decision === "approve") {
      const chair = await this.db
        .from("club_memberships")
        .select("membership_id,department_id")
        .eq("club_id", id)
        .eq("status", "active")
        .eq("role", "chairperson")
        .maybeSingle();
      this.check(chair.error);
      if (!chair.data)
        throw new ConflictException(
          "CLB chưa có chủ nhiệm hợp lệ. Kiểm tra bước khởi tạo CLB trước khi duyệt.",
        );
      const department = await this.db
        .from("club_departments")
        .select("department_id")
        .eq("club_id", id)
        .eq("department_id", chair.data.department_id)
        .eq("is_management", true)
        .eq("status", "active")
        .maybeSingle();
      this.check(department.error);
      if (!department.data)
        throw new ConflictException(
          "Chủ nhiệm phải thuộc Ban quản trị đang hoạt động.",
        );
    }
    const now = new Date().toISOString();
    const r = await this.db
      .from("clubs")
      .update({
        status: input.decision === "approve" ? "published" : "rejected",
        reviewed_by: user.userId,
        reviewed_at: now,
        review_note: input.decision === "reject" ? reason : null,
        published_at: input.decision === "approve" ? now : null,
      })
      .eq("club_id", id)
      .eq("status", "pending")
      .eq("updated_at", input.expected_updated_at)
      .select(detailFields)
      .maybeSingle();
    this.check(r.error);
    if (!r.data)
      throw new ConflictException(
        "Hồ sơ đã thay đổi hoặc đã được xử lý. Tải lại trước khi quyết định.",
      );
    return { item: r.data };
  }
}
