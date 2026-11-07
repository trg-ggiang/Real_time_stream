import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource, TrackType } from 'livekit-server-sdk';

type AuthUser = { id: string };
type Meeting = {
  meeting_id: string;
  created_by: string;
  meeting_code: string;
  livekit_room_name: string;
  waiting_room_enabled: boolean;
  max_participants: number;
  allow_self_unmute: boolean;
};
type Member = { meeting_member_id: string; user_id: string; role: string; admission_status: string };

@Injectable()
export class MeetingsService {
  private supabaseClient?: SupabaseClient;
  private livekitRoomService?: RoomServiceClient;

  constructor(private readonly config: ConfigService) {
  }

  private get supabase(): SupabaseClient {
    if (this.supabaseClient) return this.supabaseClient;
    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const key = this.config.get<string>('SUPABASE_SECRET_KEY')?.trim();
    if (!url || !key) {
      throw new ServiceUnavailableException('Supabase is not configured.');
    }
    this.supabaseClient = createClient(url, key, { auth: { persistSession: false } });
    return this.supabaseClient;
  }

  private get roomService(): RoomServiceClient {
    if (this.livekitRoomService) return this.livekitRoomService;
    const livekitUrl = this.config.get<string>('LIVEKIT_URL')?.replace(/^wss:/, 'https:');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET')?.trim();
    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit is not configured.');
    }
    this.livekitRoomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    return this.livekitRoomService;
  }

  async authenticate(authorization?: string): Promise<AuthUser> {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Bearer access token is required.');
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Invalid access token.');
    const { data: user, error: userError } = await this.supabase
      .from('users').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (userError || !user) throw new UnauthorizedException('User is not registered in the application.');
    return { id: data.user.id };
  }

  async createMeeting(user: AuthUser, body: any) {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const capacity = Number(body?.maxParticipants);
    if (!title || title.length > 160 || !Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
      throw new ForbiddenException('title and maxParticipants (1–1000) are required.');
    }
    const meetingId = randomUUID();
    const roomName = `meeting-${meetingId}`;
    const meetingCode = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const waiting = body?.waitingRoomEnabled !== false;
    const selfUnmute = body?.allowSelfUnmute !== false;
    const { data: meeting, error } = await this.supabase.from('meetings').insert({
      meeting_id: meetingId, created_by: user.id, meeting_code: meetingCode,
      livekit_room_name: roomName, title, status: 'scheduled',
      waiting_room_enabled: waiting, max_participants: capacity,
      allow_self_unmute: selfUnmute,
    }).select('meeting_id,meeting_code,title,waiting_room_enabled,max_participants,allow_self_unmute').single();
    if (error || !meeting) throw new ServiceUnavailableException('Could not create meeting.');
    const { error: memberError } = await this.supabase.from('meeting_members').insert({
      meeting_id: meetingId, user_id: user.id, role: 'owner', admission_status: 'admitted', admitted_at: new Date().toISOString(),
    });
    if (memberError) {
      await this.supabase.from('meetings').delete().eq('meeting_id', meetingId);
      throw new ServiceUnavailableException('Could not register meeting owner.');
    }
    return meeting;
  }

  private async getMeeting(code: string): Promise<Meeting> {
    const { data, error } = await this.supabase.from('meetings').select('*').eq('meeting_code', code).maybeSingle();
    if (error || !data) throw new NotFoundException('Meeting not found.');
    return data as Meeting;
  }

  private async getMember(meetingId: string, userId: string): Promise<Member | null> {
    const { data, error } = await this.supabase.from('meeting_members').select('meeting_member_id,user_id,role,admission_status')
      .eq('meeting_id', meetingId).eq('user_id', userId).is('removed_at', null).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load meeting membership.');
    return data as Member | null;
  }

  private async requireModerator(meetingId: string, userId: string): Promise<Member> {
    const member = await this.getMember(meetingId, userId);
    if (!member || !['owner', 'moderator'].includes(member.role) || member.admission_status !== 'admitted') {
      throw new ForbiddenException('Meeting owner or moderator permission is required.');
    }
    return member;
  }

  async join(user: AuthUser, code: string) {
    const meeting = await this.getMeeting(code);
    let member = await this.getMember(meeting.meeting_id, user.id);
    if (!member) {
      const status = meeting.waiting_room_enabled ? 'pending' : 'admitted';
      const { data, error } = await this.supabase.from('meeting_members').insert({
        meeting_id: meeting.meeting_id, user_id: user.id, role: 'participant', admission_status: status,
        invited_at: new Date().toISOString(), admitted_at: status === 'admitted' ? new Date().toISOString() : null,
      }).select('meeting_member_id,user_id,role,admission_status').single();
      if (error || !data) throw new ServiceUnavailableException('Could not create meeting request.');
      member = data as Member;
    }
    if (member.admission_status === 'pending') return { status: 'pending', meetingId: meeting.meeting_id };
    if (member.admission_status !== 'admitted') throw new ForbiddenException('Meeting admission was denied.');
    const identity = `user-${user.id}`;
    const { data: reservation, error: reservationError } = await this.supabase.rpc('reserve_meeting_attendance', {
      p_meeting_id: meeting.meeting_id, p_meeting_member_id: member.meeting_member_id,
      p_identity: identity, p_capacity: meeting.max_participants,
    });
    if (reservationError) throw new ServiceUnavailableException('Could not reserve a meeting seat; apply the Supabase migration.');
    if (!reservation) throw new ForbiddenException('Meeting is full.');
    const apiKey = this.config.getOrThrow<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.getOrThrow<string>('LIVEKIT_API_SECRET');
    const token = new AccessToken(apiKey, apiSecret, { identity, ttl: this.config.getOrThrow<number>('LIVEKIT_TOKEN_TTL_SECONDS') });
    token.addGrant({ room: meeting.livekit_room_name, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false, canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] });
    return {
      status: 'admitted', meetingId: meeting.meeting_id, roomName: meeting.livekit_room_name,
      serverUrl: this.config.getOrThrow<string>('LIVEKIT_URL'), participantIdentity: identity,
      token: await token.toJwt(),
    };
  }

  async approve(user: AuthUser, meetingId: string, memberId: string) {
    const meeting = await this.getMeetingById(meetingId);
    if (meeting.created_by !== user.id) throw new ForbiddenException('Only the owner can approve admission.');
    const { data, error } = await this.supabase.from('meeting_members').update({ admission_status: 'admitted', admitted_at: new Date().toISOString() })
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId).eq('admission_status', 'pending')
      .select('meeting_member_id,admission_status').maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not approve admission.');
    if (!data) throw new NotFoundException('Pending join request not found.');
    return data;
  }

  async pending(user: AuthUser, meetingId: string) {
    await this.requireModerator(meetingId, user.id);
    const { data, error } = await this.supabase.from('meeting_members')
      .select('meeting_member_id,user_id,invited_at,users(display_name,avatar_url)')
      .eq('meeting_id', meetingId).eq('admission_status', 'pending').is('removed_at', null);
    if (error) throw new ServiceUnavailableException('Could not load join requests.');
    return data;
  }

  private async getMeetingById(id: string): Promise<Meeting> {
    const { data, error } = await this.supabase.from('meetings').select('*').eq('meeting_id', id).maybeSingle();
    if (error || !data) throw new NotFoundException('Meeting not found.');
    return data as Meeting;
  }

  async setModerator(user: AuthUser, meetingId: string, memberId: string, moderator: boolean) {
    const meeting = await this.getMeetingById(meetingId);
    if (meeting.created_by !== user.id) throw new ForbiddenException('Only the owner can change moderator roles.');
    const { data: target, error: lookupError } = await this.supabase.from('meeting_members').select('role,admission_status')
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId).is('removed_at', null).maybeSingle();
    if (lookupError || !target) throw new NotFoundException('Meeting member not found.');
    if (target.role === 'owner') throw new ForbiddenException('Owner role cannot be changed.');
    if (target.admission_status !== 'admitted') throw new ForbiddenException('Only admitted members can be moderators.');
    const { data, error } = await this.supabase.from('meeting_members').update({ role: moderator ? 'moderator' : 'participant' })
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId).select('meeting_member_id,role').single();
    if (error || !data) throw new ServiceUnavailableException('Could not update moderator role.');
    return data;
  }

  async updateSettings(user: AuthUser, meetingId: string, body: any) {
    const meeting = await this.getMeetingById(meetingId);
    if (meeting.created_by !== user.id) throw new ForbiddenException('Only the owner can update meeting settings.');
    const update: Record<string, unknown> = {};
    if (typeof body?.waitingRoomEnabled === 'boolean') update.waiting_room_enabled = body.waitingRoomEnabled;
    if (typeof body?.allowSelfUnmute === 'boolean') update.allow_self_unmute = body.allowSelfUnmute;
    if (body?.maxParticipants !== undefined) {
      const capacity = Number(body.maxParticipants);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) throw new ForbiddenException('maxParticipants must be from 1 to 1000.');
      update.max_participants = capacity;
    }
    if (!Object.keys(update).length) throw new ForbiddenException('At least one valid setting is required.');
    const { data, error } = await this.supabase.from('meetings').update(update).eq('meeting_id', meetingId)
      .select('meeting_id,waiting_room_enabled,max_participants,allow_self_unmute').single();
    if (error || !data) throw new ServiceUnavailableException('Could not update meeting settings.');
    return data;
  }

  async mute(user: AuthUser, meetingId: string, memberId: string) {
    await this.requireModerator(meetingId, user.id);
    const meeting = await this.getMeetingById(meetingId);
    const { data: attendance, error } = await this.supabase.from('attendances').select('livekit_identity')
      .eq('meeting_member_id', memberId).is('left_at', null).order('joined_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !attendance) throw new NotFoundException('Member is not currently in the meeting.');
    const participants = await this.roomService.listParticipants(meeting.livekit_room_name);
    const participant = participants.find((item) => item.identity === attendance.livekit_identity);
    const audioTracks = participant?.tracks?.filter((track) => track.type === TrackType.AUDIO) ?? [];
    if (!participant || audioTracks.length === 0) throw new NotFoundException('Participant has no published microphone track.');
    for (const track of audioTracks) await this.roomService.mutePublishedTrack(meeting.livekit_room_name, attendance.livekit_identity, track.sid, true);
    if (!meeting.allow_self_unmute) {
      await this.roomService.updateParticipant(meeting.livekit_room_name, attendance.livekit_identity, {
        permission: { canPublish: true, canSubscribe: true, canPublishData: false, canPublishSources: [TrackSource.CAMERA] },
      });
    }
    return { muted: true, meetingMemberId: memberId };
  }

  async removeMember(user: AuthUser, meetingId: string, memberId: string) {
    const meeting = await this.getMeetingById(meetingId);
    if (meeting.created_by !== user.id) throw new ForbiddenException('Only the owner can remove meeting members.');
    const { data: target, error: lookupError } = await this.supabase.from('meeting_members')
      .select('user_id,role').eq('meeting_id', meetingId).eq('meeting_member_id', memberId).is('removed_at', null).maybeSingle();
    if (lookupError || !target) throw new NotFoundException('Meeting member not found.');
    if (target.role === 'owner') throw new ForbiddenException('Owner cannot be removed from the meeting.');
    const { data: attendance } = await this.supabase.from('attendances').select('livekit_identity')
      .eq('meeting_member_id', memberId).is('left_at', null).maybeSingle();
    if (attendance) {
      try {
        await this.roomService.removeParticipant(meeting.livekit_room_name, attendance.livekit_identity);
      } catch {
        // The participant may have disconnected between the DB read and LiveKit call.
      }
      await this.supabase.from('attendances').update({ left_at: new Date().toISOString(), leave_reason: 'removed_by_owner' })
        .eq('meeting_member_id', memberId).is('left_at', null);
    }
    const { error } = await this.supabase.from('meeting_members').update({ removed_at: new Date().toISOString() })
      .eq('meeting_member_id', memberId).eq('meeting_id', meetingId);
    if (error) throw new ServiceUnavailableException('Could not remove meeting member.');
    return { removed: true, meetingMemberId: memberId };
  }

  async leave(user: AuthUser, meetingId: string) {
    const member = await this.getMember(meetingId, user.id);
    if (!member) throw new NotFoundException('Meeting membership not found.');
    const { error } = await this.supabase.from('attendances').update({ left_at: new Date().toISOString(), leave_reason: 'client_left' })
      .eq('meeting_member_id', member.meeting_member_id).is('left_at', null);
    if (error) throw new ServiceUnavailableException('Could not record meeting departure.');
    return { status: 'left' };
  }
}
