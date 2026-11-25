import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { User } from '../users/entities/user.entity';
import { CreateSupportReport, SupportReportQuery, UpdateSupportReport } from './support.dto';

const fields = 'report_id,category,title,description,steps,page_path,priority,status,admin_response,created_at,updated_at,resolved_at';
const summaryFields = 'report_id,category,title,priority,status,created_at,updated_at';
const reporter = ',reporter:users!support_reports_reporter_id_fkey(user_id,display_name,email)';

@Injectable()
export class SupportService {
  constructor(private readonly supabase: SupabaseService) {}
  private get db() { return this.supabase.client; }
  private requireAdmin(user: User) {
    if (user.role !== 'admin') throw new ForbiddenException('Chỉ quản trị viên được xử lý báo cáo sự cố.');
  }
  private check(error: { code?: string } | null) {
    if (!error) return;
    throw new ServiceUnavailableException('Chưa thực hiện được yêu cầu hỗ trợ. Vui lòng thử lại sau.');
  }

  async create(user: User, input: CreateSupportReport) {
    const values = { report_id: input.report_id, reporter_id: user.userId, category: input.category,
      title: input.title, description: input.description, steps: input.steps, page_path: input.page_path, priority: input.priority };
    const result = await this.db.from('support_reports').insert(values).select(fields).single();
    if (result.error?.code === '23505') {
      // A retry keeps its UUID, but must never overwrite an existing report or disclose another owner's data.
      const existing = await this.db.from('support_reports').select(fields)
        .eq('report_id', input.report_id).eq('reporter_id', user.userId).maybeSingle();
      this.check(existing.error);
      const item = existing.data;
      if (item && (['category', 'title', 'description', 'steps', 'page_path'] as const).every(key =>
        item[key] === values[key])) return { item };
      throw new ConflictException('Mã báo cáo đã được sử dụng. Hãy kiểm tra lịch sử trước khi tạo báo cáo mới.');
    }
    this.check(result.error);
    if (!result.data) throw new ServiceUnavailableException('Chưa xác nhận được báo cáo đã gửi. Hãy kiểm tra lịch sử báo cáo.');
    return { item: result.data };
  }

  async list(user: User, input: SupportReportQuery, admin = false) {
    if (admin) this.requireAdmin(user);
    const query = this.db.from('support_reports').select(summaryFields + (admin ? reporter : ''), { count: 'exact' });
    if (!admin) query.eq('reporter_id', user.userId);
    if (input.status !== 'all') query.eq('status', input.status);
    if (input.category !== 'all') query.eq('category', input.category);
    const search = input.q.replace(/[\\%_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (search) query.ilike('title', `%${search}%`);
    const result = await query.order('created_at', { ascending: false }).order('report_id')
      .range((input.page - 1) * input.limit, input.page * input.limit - 1);
    this.check(result.error);
    return { items: result.data ?? [], total: result.count ?? 0, page: input.page, limit: input.limit,
      hasMore: input.page * input.limit < (result.count ?? 0) };
  }

  async detail(user: User, id: string, admin = false) {
    if (admin) this.requireAdmin(user);
    const query = this.db.from('support_reports').select(fields + (admin ? reporter : '')).eq('report_id', id);
    if (!admin) query.eq('reporter_id', user.userId);
    const result = await query.maybeSingle();
    this.check(result.error);
    if (!result.data) throw new NotFoundException('Không tìm thấy báo cáo sự cố.');
    return { item: result.data };
  }

  async update(user: User, id: string, input: UpdateSupportReport) {
    this.requireAdmin(user);
    if (['resolved', 'rejected'].includes(input.status) && input.admin_response.trim().length < 10)
      throw new BadRequestException('Hãy nhập phản hồi ít nhất 10 ký tự trước khi đóng báo cáo.');
    const result = await this.db.from('support_reports').update({ status: input.status, priority: input.priority,
      admin_response: input.admin_response, processed_by: user.userId,
      resolved_at: ['resolved', 'rejected'].includes(input.status) ? new Date().toISOString() : null })
      .eq('report_id', id).eq('updated_at', input.expected_updated_at).select(fields + reporter).maybeSingle();
    this.check(result.error);
    if (!result.data) throw new ConflictException('Báo cáo vừa được cập nhật. Tải lại để xem nội dung mới trước khi lưu.');
    return { item: result.data };
  }
}
