import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateClubDto } from "./create-club.dto";

// Only curated public views are exposed. Never fall back to the underlying tables.
const sources = {
  clubs: {
    view: "public_clubs",
    columns:
      "club_id,name,summary,description,mission,logo_url,cover_url,contact_email,contact_phone,published_at",
  },
  activities: {
    view: "public_activity_feed",
    columns:
      "activity_id,club_id,club_name,club_logo_url,title,summary,description,cover_url,starts_at,ends_at,format,location_name,location_address,registration_opens_at,registration_closes_at,capacity,lifecycle_status,published_at,updated_at,entry_type,campaign_id",
  },
  posts: {
    view: "public_club_posts",
    columns:
      "post_id,club_id,club_name,club_logo_url,title,summary,content,cover_url,activity_id,published_at,updated_at",
  },
} as const;
export type PublicCollection = keyof typeof sources;

@Injectable()
export class PublicContentService {
  constructor(private readonly supabase: SupabaseService) {}

  async clubCategories() {
    const { data, error } = await this.supabase.client
      .from("club_categories")
      .select("category_id,name")
      .order("name");
    if (error)
      throw new ServiceUnavailableException("Không thể tải danh mục loại CLB.");
    return {
      items: (data ?? []).map((row) => ({
        category_id: row.category_id,
        name: row.name,
      })),
    };
  }

  private async categoryClubIds(category: string) {
    const ids = new Set<string>();
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await this.supabase.client
        .from("club_category_links")
        .select("club_id")
        .eq("category_id", category)
        .order("club_id")
        .range(offset, offset + batchSize - 1);
      if (error)
        throw new ServiceUnavailableException("Không thể lọc câu lạc bộ theo loại.");
      for (const row of data ?? []) ids.add(row.club_id);
      if ((data?.length ?? 0) < batchSize) break;
    }
    return [...ids];
  }

  async createClub(userId: string, input: CreateClubDto) {
    const categoryIds = input.category_ids ?? [];
    if (categoryIds.length) {
      const { data: categories, error: categoryError } = await this.supabase.client
        .from("club_categories")
        .select("category_id")
        .in("category_id", categoryIds);
      if (categoryError)
        throw new ServiceUnavailableException("Không thể kiểm tra loại CLB.");
      if (categories?.length !== categoryIds.length)
        throw new BadRequestException("Loại CLB đã chọn không còn khả dụng. Hãy tải lại trang.");
    }
    const { data, error } = await this.supabase.client
      .from("clubs")
      .insert({
        name: input.name.trim(),
        summary: input.summary.trim(),
        description: input.description.trim(),
        mission: input.mission?.trim() || input.summary.trim(),
        contact_email: input.contact_email?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        logo_url: input.logo_url?.trim() || null,
        cover_url: input.cover_url?.trim() || null,
        status: "pending",
        created_by: userId,
      })
      .select("club_id,name,status")
      .single();
    if (error)
      throw new InternalServerErrorException(
        "Không thể gửi đăng ký câu lạc bộ. Vui lòng thử lại.",
      );
    if (categoryIds.length) {
      const { error: linkError } = await this.supabase.client
        .from("club_category_links")
        .insert(categoryIds.map((category_id) => ({ club_id: data.club_id, category_id })));
      if (linkError) {
        // The link batch is atomic. Remove only this newly created pending request.
        await this.supabase.client.from("clubs").delete()
          .eq("club_id", data.club_id).eq("created_by", userId).eq("status", "pending");
        throw new ServiceUnavailableException(
          "Chưa lưu được loại CLB. Kiểm tra danh sách đề nghị trước khi gửi lại.",
        );
      }
    }
    return { club: data };
  }

  async listMyClubRequests(userId: string) {
    const { data, error } = await this.supabase.client
      .from("clubs")
      .select("club_id,name,status,created_at,reviewed_at,review_note")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error)
      throw new ServiceUnavailableException(
        "Không thể tải trạng thái đăng ký câu lạc bộ.",
      );
    return { items: data ?? [] };
  }

  async detail(collection: PublicCollection, id: string) {
    const source = sources[collection];
    const columns: string = source.columns;
    const key =
      collection === "clubs"
        ? "club_id"
        : collection === "activities"
          ? "activity_id"
          : "post_id";
    const { data, error } = await this.supabase.client
      .from(source.view)
      .select(columns)
      .eq(key, id)
      .maybeSingle();
    if (error)
      throw new ServiceUnavailableException(
        "Nội dung công khai tạm thời chưa tải được.",
      );
    if (!data)
      throw new NotFoundException(
        "Nội dung không tồn tại hoặc chưa được công khai.",
      );
    return {
      item: Object.fromEntries(
        source.columns
          .split(",")
          .map((key) => [
            key,
            (data as unknown as Record<string, unknown>)[key] ?? null,
          ]),
      ),
    };
  }

  async list(
    collection: PublicCollection,
    page: number,
    limit: number,
    filters: { q?: string; period?: string; category?: string } = {},
  ) {
    const source = sources[collection];
    const columns: string = source.columns;
    const categoryIds = collection === "clubs" && filters.category
      ? await this.categoryClubIds(filters.category)
      : undefined;
    if (categoryIds && categoryIds.length === 0)
      return { items: [], page, limit, total: 0, hasMore: false };
    // Plain-text search, not PostgREST filter syntax or SQL wildcard input.
    const search = filters.q
      ?.trim()
      .replace(/[%_\\]/g, " ")
      .trim();
    if (categoryIds && categoryIds.length > 200)
      return this.listLargeCategory(categoryIds, page, limit, search);
    const query = this.supabase.client
      .from(source.view)
      .select(columns, { count: "exact" });
    if (search)
      query.ilike(collection === "clubs" ? "name" : "title", `%${search}%`);
    if (categoryIds) query.in("club_id", categoryIds);
    if (collection === "activities" && filters.period === "upcoming") {
      const now = new Date().toISOString();
      query.or(`and(entry_type.eq.recruitment,ends_at.gt.${now}),and(entry_type.eq.activity,starts_at.gte.${now},lifecycle_status.eq.scheduled)`);
    } else if (collection === "activities" && filters.period === "past") {
      query.lt("ends_at", new Date().toISOString());
    }
    const { data, error, count } = await query
      .order(
        collection === "activities" && filters.period === "upcoming"
          ? "starts_at"
          : "published_at",
        {
          ascending:
            collection === "activities" && filters.period === "upcoming",
          nullsFirst: false,
        },
      )
      .order(
        collection === "clubs"
          ? "club_id"
          : collection === "activities"
            ? "activity_id"
            : "post_id",
      )
      .range((page - 1) * limit, page * limit - 1);
    if (error)
      throw new ServiceUnavailableException(
        "Nội dung công khai tạm thời chưa tải được. Vui lòng thử lại.",
      );
    // Allowlist again at the response boundary, independent of SDK response shape.
    const keys = source.columns.split(",");
    const items = (data ?? []).map((row) =>
      Object.fromEntries(
        keys.map((key) => [
          key,
          (row as unknown as Record<string, unknown>)[key] ?? null,
        ]),
      ),
    );
    return {
      items,
      page,
      limit,
      total: count ?? 0,
      hasMore: page * limit < (count ?? 0),
    };
  }

  private async listLargeCategory(ids: string[], page: number, limit: number, search?: string) {
    const columns: string = sources.clubs.columns;
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      const query = this.supabase.client
        .from("public_clubs")
        .select(columns)
        .in("club_id", ids.slice(offset, offset + 200));
      if (search) query.ilike("name", `%${search}%`);
      const { data, error } = await query.order("club_id").range(0, 199);
      if (error)
        throw new ServiceUnavailableException("Nội dung công khai tạm thời chưa tải được. Vui lòng thử lại.");
      rows.push(...(data ?? []).map((row) => row as unknown as Record<string, unknown>));
    }
    rows.sort((a, b) => {
      const aDate = String(a.published_at ?? "");
      const bDate = String(b.published_at ?? "");
      return (bDate > aDate ? 1 : bDate < aDate ? -1 : 0)
        || String(a.club_id).localeCompare(String(b.club_id));
    });
    const keys = columns.split(",");
    const items = rows.slice((page - 1) * limit, page * limit).map((row) =>
      Object.fromEntries(keys.map((key) => [key, row[key] ?? null])),
    );
    return { items, page, limit, total: rows.length, hasMore: page * limit < rows.length };
  }
}
