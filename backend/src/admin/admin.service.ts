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
import { AdminDecisionDto, AdminListQuery } from "./admin.dto";
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
    const statuses = ["pending", "published", "rejected"] as const;
    const rows = await Promise.all(
      statuses.map((status) =>
        this.db
          .from("clubs")
          .select("club_id", { count: "exact", head: true })
          .eq("status", status),
      ),
    );
    rows.forEach((r) => this.check(r.error));
    return Object.fromEntries(statuses.map((s, i) => [s, rows[i].count ?? 0]));
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
    const creator =
      people.data?.find((x) => x.user_id === item.created_by) || null;
    const reviewer = people.data?.find((x) => x.user_id === item.reviewed_by);
    return {
      item,
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
