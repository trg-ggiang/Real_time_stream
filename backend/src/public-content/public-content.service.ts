import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

// Only curated public views are exposed. Never fall back to the underlying tables.
const sources = {
  clubs: { view: 'public_clubs', columns: 'club_id,name,summary,description,mission,logo_url,cover_url,contact_email,contact_phone,published_at' },
  activities: { view: 'public_club_activities', columns: 'activity_id,club_id,club_name,club_logo_url,title,summary,description,cover_url,starts_at,ends_at,format,location_name,location_address,registration_opens_at,registration_closes_at,capacity,lifecycle_status,published_at,updated_at' },
  posts: { view: 'public_club_posts', columns: 'post_id,club_id,club_name,club_logo_url,title,summary,content,cover_url,activity_id,published_at,updated_at' },
} as const;
export type PublicCollection = keyof typeof sources;

@Injectable()
export class PublicContentService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(collection: PublicCollection, page: number, limit: number) {
    const source = sources[collection];
    const columns: string = source.columns;
    const { data, error, count } = await this.supabase.client.from(source.view)
      .select(columns, { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order(collection === 'clubs' ? 'club_id' : collection === 'activities' ? 'activity_id' : 'post_id')
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw new ServiceUnavailableException('Nội dung công khai tạm thời chưa tải được. Vui lòng thử lại.');
    // Allowlist again at the response boundary, independent of SDK response shape.
    const keys = source.columns.split(',');
    const items = (data ?? []).map(row => Object.fromEntries(keys.map(key => [key, (row as unknown as Record<string, unknown>)[key] ?? null])));
    return { items, page, limit, total: count ?? 0, hasMore: page * limit < (count ?? 0) };
  }
}
