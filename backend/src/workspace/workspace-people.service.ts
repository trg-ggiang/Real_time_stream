import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WorkspaceAccess,
  workspaceClubFields,
} from "./workspace-access.service";
import { ContactDto, DepartmentDto } from "./workspace.dto";
@Injectable()
export class WorkspacePeople {
  constructor(private readonly access: WorkspaceAccess) {}
  private get db() {
    return this.access.supabase.client;
  }
  async departments(userId: string, clubId: string) {
    await this.access.require(userId, clubId);
    const r = await this.db
      .from("club_departments")
      .select("department_id,name,description,is_management,is_private,status")
      .eq("club_id", clubId)
      .order("is_management", { ascending: false })
      .order("name");
    this.access.check(r.error, "workspace department lookup");
    return { items: r.data ?? [] };
  }
  async saveDepartment(
    userId: string,
    clubId: string,
    input: DepartmentDto,
    id?: string,
  ) {
    await this.access.require(userId, clubId, true);
    if (input.name.trim().length < 2)
      throw new BadRequestException("Nhập tên ban hợp lệ.");
    if (id) {
      const old = await this.db
        .from("club_departments")
        .select("is_management")
        .eq("club_id", clubId)
        .eq("department_id", id)
        .maybeSingle();
      this.access.check(old.error);
      if (!old.data) throw new NotFoundException();
      if (old.data.is_management && (input.status !== "active" || input.is_management === false))
        throw new ForbiddenException("Không thể ngừng hoặc bỏ vai trò Ban quản lý hiện có.");
    }
    if (input.is_management && input.status !== "active")
      throw new BadRequestException("Ban quản lý phải ở trạng thái đang hoạt động.");
    const payload = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_private: input.is_private,
      ...(input.is_management !== undefined && { is_management: input.is_management }),
      status: input.status,
    };
    const q = id
      ? this.db
          .from("club_departments")
          .update(payload)
          .eq("club_id", clubId)
          .eq("department_id", id)
      : this.db
          .from("club_departments")
          .insert({ ...payload, club_id: clubId, is_management: input.is_management ?? false });
    const r = await q
      .select("department_id,name,description,is_private,is_management,status")
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data) throw new NotFoundException();
    return { item: r.data };
  }
  async members(userId: string, clubId: string, page: number, limit: number, departmentId?: string) {
    const ctx = await this.access.require(userId, clubId);
    let query = this.db
      .from("club_memberships")
      .select(
        "membership_id,user_id,role,department_id,joined_at,users(display_name,avatar_url),club_departments(name)",
        { count: "exact" },
      )
      .eq("club_id", clubId)
      .eq("status", "active");
    if (departmentId) query = query.eq("department_id", departmentId);
    const r = await query
      .order("joined_at")
      .order("membership_id")
      .range((page - 1) * limit, page * limit - 1);
    this.access.check(r.error);
    return {
      items: r.data ?? [],
      total: r.count ?? 0,
      hasMore: page * limit < (r.count ?? 0),
      can_manage: ctx.membership.role === "chairperson",
    };
  }
  async candidates(userId: string, clubId: string, query: string) {
    await this.access.require(userId, clubId, true);
    const term = query.trim();
    if (term.length < 2 || term.length > 100)
      throw new BadRequestException("Nhập từ 2 đến 100 ký tự để tìm tài khoản.");
    const escaped = term.replace(/[\\%_]/g, character => "\\" + character);
    const users = await this.db.from("users")
      .select("user_id,display_name,email,avatar_url")
      .ilike(term.includes("@") ? "email" : "display_name", "%" + escaped + "%")
      .order("display_name").limit(8);
    this.access.check(users.error, "workspace member candidate lookup");
    if (!users.data?.length) return { items: [] };
    const existing = await this.db.from("club_memberships").select("user_id")
      .eq("club_id", clubId).in("user_id", users.data.map(user => user.user_id));
    this.access.check(existing.error, "workspace existing member lookup");
    const occupied = new Set((existing.data ?? []).map(item => item.user_id));
    return { items: users.data.filter(user => !occupied.has(user.user_id)) };
  }
  private async department(clubId: string, departmentId: string) {
    const r = await this.db
      .from("club_departments")
      .select("department_id,is_management")
      .eq("club_id", clubId)
      .eq("department_id", departmentId)
      .eq("status", "active")
      .maybeSingle();
    this.access.check(r.error, "workspace active department lookup");
    if (!r.data)
      throw new BadRequestException("Chọn ban đang hoạt động của đúng CLB.");
    return r.data;
  }
  async add(
    userId: string,
    clubId: string,
    email: string,
    departmentId: string,
    role: "member" | "head" = "member",
  ) {
    await this.access.require(userId, clubId, true);
    if (role !== "member" && role !== "head")
      throw new BadRequestException("Chọn vai trò Thành viên hoặc Trưởng ban.");
    const department = await this.department(clubId, departmentId);
    if (role === "head" && department.is_management)
      throw new BadRequestException("Không thể phân công Trưởng ban cho Ban quản lý.");
    const user = await this.db
      .from("users")
      .select("user_id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    this.access.check(user.error, "workspace account lookup");
    if (!user.data)
      throw new NotFoundException(
        "Không tìm thấy tài khoản theo email đã nhập.",
      );
    const r = await this.db
      .from("club_memberships")
      .insert({
        club_id: clubId,
        user_id: user.data.user_id,
        department_id: departmentId,
        role,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .select("membership_id")
      .single();
    this.access.check(r.error, "workspace member insert");
    return { item: r.data };
  }
  private async target(clubId: string, id: string) {
    const r = await this.db
      .from("club_memberships")
      .select("membership_id,role")
      .eq("club_id", clubId)
      .eq("membership_id", id)
      .eq("status", "active")
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data) throw new NotFoundException("Thành viên không còn hoạt động.");
    return r.data;
  }
  async move(userId: string, clubId: string, id: string, departmentId: string) {
    await this.access.require(userId, clubId, true);
    const target = await this.target(clubId, id);
    if (target.role === "chairperson")
      throw new ForbiddenException("Chủ nhiệm phải ở Ban quản trị.");
    await this.department(clubId, departmentId);
    const r = await this.db
      .from("club_memberships")
      .update({ department_id: departmentId })
      .eq("club_id", clubId)
      .eq("membership_id", id)
      .eq("status", "active")
      .in("role", ["member", "head"])
      .select("membership_id")
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data) throw new NotFoundException("Thành viên đã thay đổi.");
    return { item: r.data };
  }
  async remove(userId: string, clubId: string, id: string) {
    await this.access.require(userId, clubId, true);
    if ((await this.target(clubId, id)).role === "chairperson")
      throw new ForbiddenException(
        "Chuyển chủ nhiệm trước khi gỡ thành viên này.",
      );
    const r = await this.db
      .from("club_memberships")
      .update({ status: "removed", left_at: new Date().toISOString() })
      .eq("club_id", clubId)
      .eq("membership_id", id)
      .eq("status", "active")
      .in("role", ["member", "head"])
      .select("membership_id")
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data) throw new NotFoundException("Thành viên đã thay đổi.");
    return { item: r.data };
  }
  async transfer(userId: string, clubId: string, id: string) {
    await this.access.require(userId, clubId, true);
    await this.target(clubId, id);
    const r = await this.db.rpc("clubspace_transfer_chair", {
      p_club_id: clubId,
      p_actor_user_id: userId,
      p_new_membership_id: id,
    });
    this.access.check(r.error);
    return { transferred: true };
  }
  async contact(userId: string, clubId: string, input: ContactDto) {
    await this.access.require(userId, clubId, true);
    const payload = Object.fromEntries(
      ["contact_email", "contact_phone", "logo_url", "cover_url"]
        .filter((k) => Object.hasOwn(input, k))
        .map((k) => [
          k,
          typeof input[k as keyof ContactDto] === "string"
            ? (input[k as keyof ContactDto] as string).trim() || null
            : null,
        ]),
    );
    if (!Object.keys(payload).length)
      throw new BadRequestException("Chưa có thay đổi liên hệ hoặc ảnh.");
    const r = await this.db
      .from("clubs")
      .update(payload)
      .eq("club_id", clubId)
      .eq("status", "published")
      .select(workspaceClubFields)
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data) throw new NotFoundException("CLB không còn công khai.");
    return { club: r.data };
  }
}
