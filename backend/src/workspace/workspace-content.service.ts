import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceAccess } from "./workspace-access.service";
import { ActivityDraftDto, PostDraftDto, ReviewDto } from "./workspace.dto";
export type WorkspaceKind = "posts" | "activities";
interface ContentRow {
  [key: string]: unknown;
  publication_status: string;
  updated_at: string;
  author_id?: string;
  created_by?: string;
  join_url?: string | null;
}
const source = {
  posts: {
    table: "club_posts",
    id: "post_id",
    owner: "author_id",
    fields:
      "post_id,club_id,author_id,title,summary,content,cover_url,visibility,publication_status,submitted_at,reviewed_at,review_note,published_at,updated_at",
  },
  activities: {
    table: "club_activities",
    id: "activity_id",
    owner: "created_by",
    fields:
      "activity_id,club_id,created_by,title,summary,description,cover_url,starts_at,ends_at,format,location_name,location_address,join_url,registration_opens_at,registration_closes_at,capacity,lifecycle_status,publication_status,submitted_at,reviewed_at,review_note,published_at,updated_at",
  },
} as const;
@Injectable()
export class WorkspaceContent {
  constructor(private readonly access: WorkspaceAccess) {}
  private get db() {
    return this.access.supabase.client;
  }
  private async row(kind: WorkspaceKind, clubId: string, id: string) {
    const s = source[kind],
      fields: string = s.fields;
    const r = await this.db
      .from(s.table)
      .select(fields)
      .eq("club_id", clubId)
      .eq(s.id, id)
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data)
      throw new NotFoundException("Không tìm thấy nội dung trong CLB này.");
    return r.data as unknown as ContentRow;
  }
  async list(
    userId: string,
    clubId: string,
    kind: WorkspaceKind,
    list: string,
    page: number,
    limit: number,
  ) {
    const ctx = await this.access.require(userId, clubId);
    if (list === "review" && ctx.membership.role !== "chairperson")
      throw new ForbiddenException("Chỉ chủ nhiệm được xem hàng đợi.");
    const s = source[kind],
      fields: string = s.fields;
    const q = this.db
      .from(s.table)
      .select(fields, { count: "exact" })
      .eq("club_id", clubId);
    if (list === "published") q.eq("publication_status", "published");
    else if (list === "mine") q.eq(s.owner, userId);
    else q.eq("publication_status", "pending_review");
    const r = await q
      .order("updated_at", { ascending: false })
      .order(s.id)
      .range((page - 1) * limit, page * limit - 1);
    this.access.check(r.error);
    const items = (r.data ?? []).map((row) => {
      if (
        kind === "activities" &&
        ctx.membership.role !== "chairperson" &&
        (row as unknown as Record<string, unknown>).created_by !== userId
      ) {
        const { join_url, ...safe } = row as unknown as Record<string, unknown>;
        return safe;
      }
      return row;
    });
    return {
      items,
      total: r.count ?? 0,
      hasMore: page * limit < (r.count ?? 0),
    };
  }
  async detail(
    userId: string,
    clubId: string,
    kind: WorkspaceKind,
    id: string,
  ) {
    const ctx = await this.access.require(userId, clubId);
    const item = await this.row(kind, clubId, id);
    if (
      item.publication_status !== "published" &&
      item[source[kind].owner] !== userId &&
      ctx.membership.role !== "chairperson"
    )
      throw new ForbiddenException("Bạn không được đọc bản nháp này.");
    if (
      kind === "activities" &&
      ctx.membership.role !== "chairperson" &&
      item.created_by !== userId
    ) {
      const { join_url, ...safe } = item;
      return { item: safe };
    }
    return { item };
  }
  private payload(kind: WorkspaceKind, input: PostDraftDto | ActivityDraftDto) {
    const title = input.title.trim(),
      summary = input.summary.trim();
    if (title.length < 2 || summary.length < 10)
      throw new BadRequestException("Nhập đủ tiêu đề và tóm tắt.");
    if (kind === "posts") {
      const p = input as PostDraftDto;
      if (p.content.trim().length < 10)
        throw new BadRequestException("Nội dung bài viết quá ngắn.");
      return {
        title,
        summary,
        content: p.content.trim(),
        cover_url: p.cover_url || null,
        visibility: "public",
      };
    }
    const a = input as ActivityDraftDto;
    if (
      a.description.trim().length < 10 ||
      !(Date.parse(a.ends_at) > Date.parse(a.starts_at))
    )
      throw new BadRequestException(
        "Mô tả hoặc thời gian hoạt động chưa hợp lệ.",
      );
    if (
      (a.format !== "online" && !a.location_name?.trim()) ||
      (a.format !== "onsite" && !a.join_url)
    )
      throw new BadRequestException(
        "Nhập địa điểm/link theo hình thức hoạt động.",
      );
    if (
      (a.registration_opens_at &&
        Date.parse(a.registration_opens_at) >= Date.parse(a.ends_at)) ||
      (a.registration_closes_at &&
        Date.parse(a.registration_closes_at) > Date.parse(a.ends_at)) ||
      (a.registration_opens_at &&
        a.registration_closes_at &&
        Date.parse(a.registration_opens_at) >=
          Date.parse(a.registration_closes_at))
    )
      throw new BadRequestException("Khoảng thời gian đăng ký chưa hợp lệ.");
    return {
      title,
      summary,
      description: a.description.trim(),
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      format: a.format,
      location_name: a.format === "online" ? null : a.location_name!.trim(),
      location_address:
        a.format === "online" ? null : a.location_address?.trim() || null,
      join_url: a.format === "onsite" ? null : a.join_url,
      cover_url: a.cover_url || null,
      capacity: a.capacity ?? null,
      registration_opens_at: a.registration_opens_at || null,
      registration_closes_at: a.registration_closes_at || null,
    };
  }
  async save(
    userId: string,
    clubId: string,
    kind: WorkspaceKind,
    input: PostDraftDto | ActivityDraftDto,
    id?: string,
  ) {
    await this.access.require(userId, clubId);
    const s = source[kind],
      payload = this.payload(kind, input),
      contentId =
        kind === "posts"
          ? (input as PostDraftDto).post_id
          : (input as ActivityDraftDto).activity_id;
    if (id) {
      if (contentId !== id)
        throw new BadRequestException("Mã nội dung không khớp.");
      const old = await this.row(kind, clubId, id);
      if (old[s.owner] !== userId)
        throw new ForbiddenException("Chỉ tác giả sửa nội dung của mình.");
      if (!input.expected_updated_at)
        throw new BadRequestException("Thiếu phiên bản nội dung.");
      const r = await this.db
        .from(s.table)
        .update({ ...payload, publication_status: "draft" })
        .eq("club_id", clubId)
        .eq(s.id, id)
        .eq(s.owner, userId)
        .eq("updated_at", input.expected_updated_at)
        .eq("publication_status", old.publication_status)
        .select(s.id)
        .maybeSingle();
      this.access.check(r.error);
      if (!r.data)
        throw new ConflictException(
          "Nội dung đã thay đổi. Tải lại để tránh ghi đè.",
        );
    } else {
      const r = await this.db.from(s.table).upsert(
        {
          ...payload,
          [s.id]: contentId,
          [s.owner]: userId,
          club_id: clubId,
          publication_status: "draft",
          ...(kind === "activities" && { lifecycle_status: "scheduled" }),
        },
        { onConflict: s.id, ignoreDuplicates: true },
      );
      this.access.check(r.error);
    }
    const row = await this.row(kind, clubId, contentId);
    if (row[s.owner] !== userId)
      throw new ConflictException("Mã nội dung đã được sử dụng.");
    if (
      !id &&
      Object.entries(payload).some(([key, value]) =>
        key.endsWith("_at") && value && row[key]
          ? Date.parse(String(value)) !== Date.parse(String(row[key]))
          : (value ?? null) !== (row[key] ?? null),
      )
    )
      throw new ConflictException(
        "Đã có bản nháp khác với biểu mẫu hiện tại. Mở Của tôi để kiểm tra và sửa bản đã lưu.",
      );
    return { item: row };
  }
  async submit(
    userId: string,
    clubId: string,
    kind: WorkspaceKind,
    id: string,
    version: string,
  ) {
    const ctx = await this.access.require(userId, clubId);
    const s = source[kind],
      old = await this.row(kind, clubId, id);
    if (old[s.owner] !== userId)
      throw new ForbiddenException("Chỉ tác giả được gửi nội dung của mình.");
    if (!["draft", "changes_requested"].includes(old.publication_status))
      throw new ConflictException(
        "Nội dung không ở trạng thái có thể gửi duyệt.",
      );
    const r = await this.db
      .from(s.table)
      .update({
        publication_status: "pending_review",
        submitted_at: new Date().toISOString(),
      })
      .eq("club_id", clubId)
      .eq(s.id, id)
      .eq(s.owner, userId)
      .eq("updated_at", version)
      .eq("publication_status", old.publication_status)
      .select("updated_at")
      .maybeSingle();
    this.access.check(r.error);
    if (!r.data)
      throw new ConflictException("Nội dung đã đổi. Tải lại trước khi gửi.");
    if (kind === "activities" && ctx.membership.role === "chairperson")
      return this.review(userId, clubId, kind, id, {
        decision: "published",
        expected_updated_at: r.data.updated_at,
      });
    return { item: await this.row(kind, clubId, id) };
  }
  async review(
    userId: string,
    clubId: string,
    kind: WorkspaceKind,
    id: string,
    input: ReviewDto,
  ) {
    await this.access.require(userId, clubId, true);
    if (input.decision === "changes_requested" && !input.reason?.trim())
      throw new BadRequestException("Nhập lý do yêu cầu chỉnh sửa.");
    const s = source[kind],
      now = new Date().toISOString();
    const update = (status: string) =>
      this.db
        .from(s.table)
        .update({
          publication_status: status,
          reviewed_by: userId,
          reviewed_at: now,
          review_note:
            input.decision === "published" ? null : input.reason!.trim(),
          published_at: input.decision === "published" ? now : null,
        })
        .eq("club_id", clubId)
        .eq(s.id, id)
        .eq("publication_status", "pending_review")
        .eq("updated_at", input.expected_updated_at)
        .select(s.id)
        .maybeSingle();
    let r = await update(input.decision);
    // A known CHECK violation rolls back this statement. Support older rejection
    // enum only in that case; never retry network/unknown failures as mutations.
    if (
      input.decision === "changes_requested" &&
      r.error?.code === "23514" &&
      /publication_status/.test(r.error.message)
    )
      r = await update("rejected");
    this.access.check(r.error);
    if (!r.data)
      throw new ConflictException(
        "Nội dung không còn chờ duyệt hoặc đã được sửa.",
      );
    return { item: await this.row(kind, clubId, id) };
  }
}
