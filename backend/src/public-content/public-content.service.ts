import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateClubDto } from './create-club.dto';

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

  async listAdminClubs(status: 'all' | 'pending' | 'approved' | 'rejected', search: string) {
    const query = this.supabase.client.from('clubs')
      .select('club_id,name,summary,description,mission,logo_url,cover_url,contact_email,contact_phone,status,created_by,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range(0, 1999);
    if (status === 'pending') query.eq('status', 'pending');
    if (status === 'approved') query.in('status', ['approved', 'published']);
    if (status === 'rejected') query.eq('status', 'rejected');
    const normalizedSearch = search.trim().replace(/[,%()]/g, ' ');
    if (normalizedSearch) query.ilike('name', `%${normalizedSearch}%`);
    const [{ data, error, count }, totalResult, pendingResult, processedResult] = await Promise.all([
      query,
      this.supabase.client.from('clubs').select('club_id', { count: 'exact', head: true }),
      this.supabase.client.from('clubs').select('club_id', { count: 'exact', head: true }).eq('status', 'pending'),
      this.supabase.client.from('clubs').select('club_id', { count: 'exact', head: true }).neq('status', 'pending'),
    ]);
    if (error || totalResult.error || pendingResult.error || processedResult.error) {
      throw new ServiceUnavailableException('Không thể tải danh sách đăng ký câu lạc bộ.');
    }
    const creatorIds = [...new Set((data ?? []).map(row => row.created_by).filter((id): id is string => typeof id === 'string'))];
    const creatorsResult = creatorIds.length
      ? await this.supabase.client.from('users').select('user_id,display_name').in('user_id', creatorIds)
      : { data: [], error: null };
    if (creatorsResult.error) throw new ServiceUnavailableException('Không thể tải thông tin người gửi.');
    const creators = new Map((creatorsResult.data ?? []).map(user => [user.user_id, user.display_name]));
    const items = (data ?? []).map(club => ({ ...club, creator_name: creators.get(club.created_by) ?? 'Không rõ người gửi' }));
    return { items, total: totalResult.count ?? 0, pending: pendingResult.count ?? 0, processed: processedResult.count ?? 0 };
  }

  async rejectClub(clubId: string, adminId: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.client.from('clubs').update({
      status: 'rejected', reviewed_by: adminId, reviewed_at: now, review_note: 'Yêu cầu đã bị từ chối bởi quản trị viên.',
    })
      .eq('club_id', clubId).eq('status', 'pending').select('club_id,status').maybeSingle();
    if (error) throw new ServiceUnavailableException('Không thể cập nhật trạng thái câu lạc bộ.');
    if (!data) throw new ServiceUnavailableException('Yêu cầu không còn ở trạng thái chờ duyệt.');
    return { club: data };
  }

  async approveClub(clubId: string, adminId: string) {
    const { data: club, error: lookupError } = await this.supabase.client.from('clubs')
      .select('club_id,created_by,status').eq('club_id', clubId).eq('status', 'pending').maybeSingle();
    if (lookupError) throw new ServiceUnavailableException('Could not load the pending club request.');
    if (!club || typeof club.created_by !== 'string') throw new ServiceUnavailableException('The request is no longer pending or has no creator.');

    const { data: existingMembership, error: membershipLookupError } = await this.supabase.client.from('club_memberships')
      .select('club_id,user_id').eq('club_id', clubId).eq('user_id', club.created_by).maybeSingle();
    if (membershipLookupError) throw new ServiceUnavailableException('Could not check club membership.');
    let insertedMembership = false;
    if (!existingMembership) {
      const { error: membershipError } = await this.supabase.client.from('club_memberships').insert({
        club_id: clubId, user_id: club.created_by, role: 'president',
      });
      if (membershipError) throw new ServiceUnavailableException('Could not add the club creator as a member.');
      insertedMembership = true;
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase.client.from('clubs').update({
      status: 'published', published_at: now, reviewed_by: adminId, reviewed_at: now, review_note: null,
    }).eq('club_id', clubId).eq('status', 'pending').select('club_id,name,status,published_at').maybeSingle();
    if (error || !data) {
      if (insertedMembership) await this.supabase.client.from('club_memberships').delete()
        .eq('club_id', clubId).eq('user_id', club.created_by);
      if (error) throw new ServiceUnavailableException('Could not publish the club.');
      throw new ServiceUnavailableException('The request was processed by another account.');
    }
    return { club: data };
  }

  async createClub(userId: string, input: CreateClubDto) {
    const { data, error } = await this.supabase.client.from('clubs').insert({
      name: input.name.trim(), summary: input.summary.trim(), description: input.description.trim(),
      mission: input.mission?.trim() || input.summary.trim(), contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null, logo_url: input.logo_url?.trim() || null,
      cover_url: input.cover_url?.trim() || null, status: 'pending', created_by: userId,
    }).select('club_id,name,status').single();
    if (error) throw new InternalServerErrorException('Không thể gửi đăng ký câu lạc bộ. Vui lòng thử lại.');
    return { club: data };
  }

  async listMyClubRequests(userId: string) {
    const { data, error } = await this.supabase.client.from('clubs')
      .select('club_id,name,status,created_at,reviewed_at,review_note')
      .eq('created_by', userId).order('created_at', { ascending: false }).limit(20);
    if (error) throw new ServiceUnavailableException('Không thể tải trạng thái đăng ký câu lạc bộ.');
    return { items: data ?? [] };
  }

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
