import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatCursor, ChatMessage, HistoryPage } from './chat.types';

const COLUMNS = 'message_id,session_id,sender_id,client_message_id,content,created_at,sender:users!meeting_messages_sender_id_fkey(display_name)';
interface MessageRow {
  message_id: string; session_id: string; sender_id: string; client_message_id: string;
  content: string; created_at: string; sender: { display_name: string } | null;
}
const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.message_id, sessionId: row.session_id, senderId: row.sender_id,
  clientMessageId: row.client_message_id, content: row.content,
  // Preserve PostgreSQL microseconds: Date.toISOString() would truncate the cursor.
  createdAt: row.created_at.replace(/(?:\.(\d+))?(?:\+00:00|Z)$/, (_match, fraction: string | undefined) => `.${(fraction ?? '').padEnd(6, '0')}Z`),
  senderName: row.sender?.display_name || 'Thành viên',
});

@Injectable()
export class ChatRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async insert(sessionId: string, senderId: string, clientMessageId: string, content: string): Promise<ChatMessage> {
    const result = await this.supabase.client.from('meeting_messages').insert({
      session_id: sessionId, sender_id: senderId, client_message_id: clientMessageId, content,
    }).select(COLUMNS).single();
    if (!result.error) return toMessage(result.data as unknown as MessageRow);
    if (result.error.code !== '23505') throw new ServiceUnavailableException('Chưa lưu được tin nhắn. Hãy thử lại.');
    // A retry reads the original row; never UPDATE/upsert over another message.
    const existing = await this.supabase.client.from('meeting_messages').select(COLUMNS)
      .eq('session_id', sessionId).eq('sender_id', senderId).eq('client_message_id', clientMessageId).maybeSingle();
    if (existing.error || !existing.data) throw new ServiceUnavailableException('Chưa xác nhận được tin nhắn.');
    const message = toMessage(existing.data as unknown as MessageRow);
    if (message.content !== content) throw new ConflictException('Mã gửi này đã dùng cho nội dung khác.');
    return message;
  }

  async history(sessionId: string, cursor?: ChatCursor, direction: 'before' | 'after' = 'before'): Promise<HistoryPage> {
    const ascending = direction === 'after';
    let query = this.supabase.client.from('meeting_messages').select(COLUMNS).eq('session_id', sessionId);
    if (cursor) {
      const time = cursor.createdAt;
      const op = ascending ? 'gt' : 'lt';
      query = query.or(`created_at.${op}.${time},and(created_at.eq.${time},message_id.${op}.${cursor.id})`);
    }
    const result = await query.order('created_at', { ascending }).order('message_id', { ascending }).limit(51);
    if (result.error) throw new ServiceUnavailableException('Không thể tải lịch sử chat.');
    const messages = (result.data as unknown as MessageRow[]).slice(0, 50).map(toMessage);
    if (!ascending) messages.reverse();
    return { messages, hasMore: (result.data?.length ?? 0) > 50 };
  }
}
