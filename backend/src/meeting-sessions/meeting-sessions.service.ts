import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface MeetingSession {
  session_id: string;
  meeting_id: string;
  livekit_room_name: string;
  status: string;
}

@Injectable()
export class MeetingSessionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listForUser(userId: string) {
    const members = await this.supabase.client.from('meeting_members')
      .select('meeting_id').eq('user_id', userId)
      .eq('admission_status', 'admitted').is('removed_at', null);
    if (members.error) throw new ServiceUnavailableException('Không thể đọc quyền cuộc họp.');
    const ids = [...new Set((members.data ?? []).map(row => row.meeting_id as string))];
    if (!ids.length) return [];
    const sessions = await this.supabase.client.from('meeting_sessions')
      .select('session_id,livekit_room_name,meetings!inner(title)')
      .in('meeting_id', ids).eq('status', 'ongoing').order('created_at', { ascending: false });
    if (sessions.error) throw new ServiceUnavailableException('Không thể đọc phiên họp.');
    return (sessions.data ?? []).map(row => ({
      sessionId: row.session_id as string,
      roomName: row.livekit_room_name as string,
      title: (row.meetings as unknown as { title: string }).title,
    }));
  }

  async requireAccess(userId: string, sessionId: string): Promise<MeetingSession> {
    const session = await this.supabase.client.from('meeting_sessions')
      .select('session_id,meeting_id,livekit_room_name,status').eq('session_id', sessionId).maybeSingle();
    if (session.error) throw new ServiceUnavailableException('Không thể kiểm tra phiên họp.');
    if (!session.data || session.data.status !== 'ongoing') {
      throw new ForbiddenException('Phiên họp chưa bắt đầu hoặc đã kết thúc.');
    }
    const member = await this.supabase.client.from('meeting_members').select('meeting_member_id')
      .eq('meeting_id', session.data.meeting_id).eq('user_id', userId)
      .eq('admission_status', 'admitted').is('removed_at', null).limit(1);
    if (member.error) throw new ServiceUnavailableException('Không thể kiểm tra thành viên.');
    if (!member.data?.length) throw new ForbiddenException('Bạn chưa được phép tham gia phiên họp này.');
    return session.data as MeetingSession;
  }
}
