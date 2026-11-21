import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type ActivityList = 'published' | 'mine' | 'pending_review' | 'approved' | 'rejected';

interface ActivityInput {
  activity_id: string;
  title: string;
  summary: string;
  description: string;
  starts_at: string;
  ends_at: string;
  format: 'onsite' | 'online' | 'hybrid';
  location_name?: string;
  location_address?: string;
  join_url?: string;
}

interface ActivityRow {
  activity_id: string;
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  format: string;
  location_name: string | null;
  location_address: string | null;
  join_url: string | null;
  publication_status: string;
  created_by?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
}

const activityFields = 'activity_id,title,summary,description,starts_at,ends_at,format,location_name,location_address,join_url,publication_status';
const reviewFields = 'created_by,submitted_at,reviewed_at,review_note';

@Injectable()
export class ClubActivitiesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listClubs(userId: string) {
    const { data: memberships, error } = await this.supabase.client.from('club_memberships')
      .select('club_id,role').eq('user_id', userId).eq('status', 'active');
    if (error) throw new ServiceUnavailableException('Không tải được danh sách CLB của bạn.');
    if (!memberships.length) return { items: [] };

    const roles = new Map(memberships.map(item => [item.club_id, item.role]));
    const { data: clubs, error: clubError } = await this.supabase.client.from('clubs')
      .select('club_id,name,summary').in('club_id', [...roles.keys()])
      .eq('status', 'published').order('name').order('club_id');
    if (clubError) throw new ServiceUnavailableException('Không tải được thông tin CLB.');
    return { items: clubs.map(club => ({ ...club, role: roles.get(club.club_id) })) };
  }

  private async membershipRole(userId: string, clubId: string) {
    const client = this.supabase.client;
    const [membership, club] = await Promise.all([
      client.from('club_memberships').select('role').eq('club_id', clubId)
        .eq('user_id', userId).eq('status', 'active').maybeSingle(),
      client.from('clubs').select('club_id').eq('club_id', clubId).eq('status', 'published').maybeSingle(),
    ]);
    if (membership.error || club.error) throw new ServiceUnavailableException('Không kiểm tra được quyền trong CLB.');
    if (!membership.data || !club.data) throw new ForbiddenException('Bạn cần là thành viên đang hoạt động của CLB này.');
    return membership.data.role;
  }

  async listActivities(userId: string, clubId: string, list: ActivityList, page: number, limit: number) {
    const role = await this.membershipRole(userId, clubId);
    const isReview = list !== 'published' && list !== 'mine';
    if (isReview && role !== 'chairperson') throw new ForbiddenException('Chỉ chủ nhiệm CLB được xem mục xét duyệt.');

    const columns: string = list === 'published' ? activityFields : `${activityFields},${reviewFields}`;
    const query = this.supabase.client.from('club_activities')
      .select(columns, { count: 'exact' })
      .eq('club_id', clubId);
    if (list === 'mine') {
      query.eq('created_by', userId).in('publication_status', ['pending_review', 'published', 'rejected']);
    } else {
      query.eq('publication_status', list === 'approved' ? 'published' : list);
    }
    const { data, error, count } = await query
      .order(list === 'published' ? 'starts_at' : 'submitted_at', { ascending: false })
      .order('activity_id').range((page - 1) * limit, page * limit - 1)
      .overrideTypes<ActivityRow[], { merge: false }>();
    if (error) throw new ServiceUnavailableException('Không tải được hoạt động của CLB.');

    const authorIds = isReview ? [...new Set(data.map(row => row.created_by).filter((id): id is string => typeof id === 'string'))] : [];
    const authors = authorIds.length ? await this.supabase.client.from('users')
      .select('user_id,display_name').in('user_id', authorIds) : { data: [], error: null };
    if (authors.error) throw new ServiceUnavailableException('Không tải được tên người gửi.');
    const names = new Map(authors.data.map(author => [author.user_id, author.display_name]));
    return {
      items: data.map(row => isReview ? { ...row, author_name: names.get(row.created_by ?? '') ?? 'Không rõ' } : row),
      hasMore: page * limit < (count ?? 0),
    };
  }

  async createActivity(userId: string, clubId: string, input: ActivityInput) {
    const role = await this.membershipRole(userId, clubId);
    const { activity_id, starts_at, ends_at, format } = input;
    const title = input.title.trim();
    const summary = input.summary.trim();
    const description = input.description.trim();
    const locationName = input.location_name?.trim();
    const locationAddress = input.location_address?.trim();
    const joinUrl = input.join_url;
    if (title.length < 2 || summary.length < 10 || description.length < 10) {
      throw new BadRequestException('Nhập đầy đủ tiêu đề, tóm tắt và mô tả hoạt động.');
    }
    if (!(Date.parse(ends_at) > Date.parse(starts_at))) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu.');
    }
    if ((format !== 'online' && !locationName) || (format !== 'onsite' && !joinUrl)) {
      throw new BadRequestException('Nhập địa điểm và đường dẫn trực tuyến phù hợp với hình thức đã chọn.');
    }

    const activities = this.supabase.client.from('club_activities');
    const now = new Date().toISOString();
    // Reusing the form's ID allows retries to resume the same draft or submission.
    const { error: insertError } = await activities.upsert({
      activity_id, club_id: clubId, created_by: userId, title, summary, description, starts_at, ends_at, format,
      location_name: format === 'online' ? null : locationName,
      location_address: format === 'online' ? null : locationAddress || null,
      ...(format !== 'onsite' && { join_url: joinUrl }),
      publication_status: 'draft', lifecycle_status: 'scheduled',
    }, { onConflict: 'activity_id', ignoreDuplicates: true });
    if (insertError) throw new ServiceUnavailableException('Không lưu được hoạt động.');

    const { data: submitted, error: submitError } = await activities.update({
      publication_status: 'pending_review', submitted_at: now,
    }).eq('club_id', clubId).eq('activity_id', activity_id).eq('created_by', userId)
      .eq('publication_status', 'draft').select('activity_id,publication_status').maybeSingle();
    if (submitError) throw new ServiceUnavailableException('Đã lưu bản nháp. Thử gửi lại trên cửa sổ này.');
    const current = submitted ? { data: submitted, error: null } : await activities
      .select('activity_id,publication_status').eq('club_id', clubId).eq('activity_id', activity_id)
      .eq('created_by', userId).maybeSingle();
    if (current.error) throw new ServiceUnavailableException('Không kiểm tra được trạng thái hoạt động. Thử gửi lại.');
    if (!current.data) throw new ConflictException('Mã hoạt động đã được sử dụng.');
    if (current.data.publication_status === 'pending_review' && role === 'chairperson') {
      return this.reviewActivity(userId, clubId, activity_id);
    }
    return { item: current.data };
  }

  async reviewActivity(userId: string, clubId: string, activityId: string, reason?: string) {
    if (await this.membershipRole(userId, clubId) !== 'chairperson') {
      throw new ForbiddenException('Chỉ chủ nhiệm của CLB này được xét duyệt hoạt động.');
    }
    const note = reason?.trim();
    if (reason !== undefined && !note) throw new BadRequestException('Nhập lý do từ chối.');
    const now = new Date().toISOString();
    const publicationStatus = reason === undefined ? 'published' : 'rejected';
    const { data, error } = await this.supabase.client.from('club_activities').update({
      publication_status: publicationStatus,
      reviewed_at: now, reviewed_by: userId, review_note: note ?? null,
      published_at: publicationStatus === 'published' ? now : null,
    }).eq('club_id', clubId).eq('activity_id', activityId).eq('publication_status', 'pending_review')
      .select('activity_id,publication_status').maybeSingle();
    if (error) throw new ServiceUnavailableException('Không lưu được quyết định xét duyệt. Vui lòng thử lại.');
    if (!data) throw new ConflictException('Hoạt động không còn chờ duyệt. Hãy tải lại danh sách.');
    return { item: data };
  }
}
