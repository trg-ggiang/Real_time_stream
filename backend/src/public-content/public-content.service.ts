import {
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
    view: "public_club_activities",
    columns:
      "activity_id,club_id,club_name,club_logo_url,title,summary,description,cover_url,starts_at,ends_at,format,location_name,location_address,registration_opens_at,registration_closes_at,capacity,lifecycle_status,published_at,updated_at",
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

  async createClub(userId: string, input: CreateClubDto) {
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
    filters: { q?: string; period?: string } = {},
  ) {
    const source = sources[collection];
    const columns: string = source.columns;
    const query = this.supabase.client
      .from(source.view)
      .select(columns, { count: "exact" });
    // Plain-text search, not PostgREST filter syntax or SQL wildcard input.
    const search = filters.q
      ?.trim()
      .replace(/[%_\\]/g, " ")
      .trim();
    if (search)
      query.ilike(collection === "clubs" ? "name" : "title", `%${search}%`);
    if (collection === "activities" && filters.period === "upcoming") {
      query
        .gte("starts_at", new Date().toISOString())
        .eq("lifecycle_status", "scheduled");
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
}
