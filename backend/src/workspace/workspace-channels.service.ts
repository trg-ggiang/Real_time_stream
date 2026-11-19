import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceAccess } from './workspace-access.service';

const fields = 'channel_id,club_id,department_id,kind,name,description';
const messageFields = 'message_id,channel_id,sender_membership_id,client_message_id,content,created_at,edited_at,deleted_at,club_memberships!sender_membership_id(users(display_name,avatar_url))';

@Injectable()
export class WorkspaceChannels {
  constructor(private readonly access: WorkspaceAccess) {}
  private get db() { return this.access.supabase.client; }

  private async readable(userId: string, channelId: string) {
    // The existing database function is the authority for department privacy.
    // A chairperson/admin does not bypass a private channel's access rules.
    const result = await this.db.rpc('clubspace_can_read_channel', { p_actor: userId, p_channel: channelId });
    this.access.check(result.error);
    return result.data === true;
  }

  async list(userId: string, clubId: string) {
    await this.access.require(userId, clubId);
    const result = await this.db.from('club_channels').select(fields).eq('club_id', clubId).order('created_at').order('channel_id');
    this.access.check(result.error);
    const visible = await Promise.all((result.data ?? []).map(async channel => await this.readable(userId, channel.channel_id) ? channel : null));
    return { items: visible.filter(Boolean) };
  }

  private async authorize(userId: string, clubId: string, channelId: string) {
    const context = await this.access.require(userId, clubId);
    const result = await this.db.from('club_channels').select(fields).eq('club_id', clubId).eq('channel_id', channelId).maybeSingle();
    this.access.check(result.error);
    if (!result.data) throw new NotFoundException('Không tìm thấy kênh trong CLB này.');
    if (!await this.readable(userId, channelId)) throw new ForbiddenException('Bạn không có quyền đọc kênh này.');
    return context;
  }

  private publicMessage(row: Record<string, any>, membershipId: string) {
    const { club_memberships, client_message_id, ...message } = row;
    return { ...message, content: row.deleted_at ? '' : row.content,
      sender: club_memberships?.users?.display_name || 'Thành viên',
      avatar_url: club_memberships?.users?.avatar_url ?? null,
      mine: row.sender_membership_id === membershipId,
      // Idempotency keys are useful only to the sender.
      ...(row.sender_membership_id === membershipId ? { client_message_id } : {}),
    };
  }

  async history(userId: string, clubId: string, channelId: string, before?: string, beforeId?: string) {
    const context = await this.authorize(userId, clubId, channelId);
    if (!!before !== !!beforeId) throw new BadRequestException('Thiếu thông tin phân trang tin nhắn.');
    const query = this.db.from('channel_messages').select(messageFields).eq('channel_id', channelId);
    if (before && beforeId) {
      const time = new Date(before).toISOString();
      query.or(`created_at.lt.${time},and(created_at.eq.${time},message_id.lt.${beforeId})`);
    }
    const result = await query.order('created_at', { ascending: false }).order('message_id', { ascending: false }).limit(51);
    this.access.check(result.error);
    const rows = (result.data ?? []).slice(0, 50);
    const last = rows.at(-1);
    return { items: rows.reverse().map(row => this.publicMessage(row, context.membership.membership_id)),
      hasMore: (result.data?.length ?? 0) > 50,
      cursor: last ? { before: last.created_at, before_id: last.message_id } : null };
  }

  async send(userId: string, clubId: string, channelId: string, body: { client_message_id: string; content: string }) {
    const context = await this.authorize(userId, clubId, channelId);
    const content = body.content.trim();
    if (!content || [...content].length > 2000) throw new BadRequestException('Tin nhắn cần từ 1 đến 2000 ký tự.');
    const result = await this.db.from('channel_messages').insert({ channel_id: channelId,
      sender_membership_id: context.membership.membership_id, client_message_id: body.client_message_id,
      content, updated_by: userId }).select(messageFields).single();
    if (result.error?.code === '23505') {
      const existing = await this.db.from('channel_messages').select(messageFields).eq('channel_id', channelId)
        .eq('sender_membership_id', context.membership.membership_id).eq('client_message_id', body.client_message_id).maybeSingle();
      this.access.check(existing.error);
      if (!existing.data || existing.data.content !== content || existing.data.deleted_at) throw new ConflictException('Tin nhắn đã thay đổi. Kiểm tra lịch sử trước khi gửi lại.');
      return { item: this.publicMessage(existing.data, context.membership.membership_id) };
    }
    this.access.check(result.error);
    return { item: this.publicMessage(result.data!, context.membership.membership_id) };
  }
}
