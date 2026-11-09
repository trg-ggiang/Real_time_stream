import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, ServerError, TrackSource } from 'livekit-server-sdk';
import { SupabaseService } from '../supabase/supabase.service';
import { User } from '../users/entities/user.entity';

type Meeting = {
  meeting_id: string;
  created_by: string;
  meeting_code: string;
  title: string;
  recurrence_rule: string | null;
  waiting_room_enabled: boolean;
};

type Session = {
  session_id: string;
  meeting_id: string;
  livekit_room_name: string;
  status: 'scheduled' | 'ongoing' | 'ended';
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  started_at: string | null;
  ended_at: string | null;
};

type Member = {
  meeting_member_id: string;
  meeting_id: string;
  user_id: string;
  role: string;
  admission_status: string;
  invited_at: string | null;
  removed_at: string | null;
};

const MEMBER_SELECT = 'meeting_member_id,meeting_id,user_id,role,admission_status,invited_at,removed_at';
const MEETING_SELECT = 'meeting_id,created_by,meeting_code,title,recurrence_rule,waiting_room_enabled';
const SESSION_SELECT = 'session_id,meeting_id,livekit_room_name,status,scheduled_start_at,scheduled_end_at,started_at,ended_at';
const ADMISSION_RETRY_LIMIT = 3;
const ADMISSION_COOLDOWN_MS = 30 * 60 * 1000;

type RecurrenceRule = {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: number;
  weekdays?: Set<number>;
  monthDays?: Set<number>;
  months?: Set<number>;
};

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRecurrenceRule(raw: string): RecurrenceRule {
  const ruleText = raw.trim().replace(/^RRULE:/i, '');
  const values = new Map<string, string>();
  for (const part of ruleText.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) throw new BadRequestException('recurrenceRule must use RFC 5545 RRULE syntax.');
    const key = part.slice(0, separator).toUpperCase();
    if (values.has(key)) throw new BadRequestException(`recurrenceRule contains duplicate ${key}.`);
    values.set(key, part.slice(separator + 1).toUpperCase());
  }
  const allowed = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH']);
  if ([...values.keys()].some((key) => !allowed.has(key))) {
    throw new BadRequestException('recurrenceRule contains an unsupported RFC 5545 field.');
  }
  const frequency = values.get('FREQ');
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency ?? '')) {
    throw new BadRequestException('recurrenceRule FREQ must be DAILY, WEEKLY, MONTHLY, or YEARLY.');
  }
  const interval = Number(values.get('INTERVAL') ?? '1');
  if (!Number.isInteger(interval) || interval < 1 || interval > 1000) {
    throw new BadRequestException('recurrenceRule INTERVAL must be between 1 and 1000.');
  }
  const countText = values.get('COUNT');
  const count = countText === undefined ? undefined : Number(countText);
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 5000)) {
    throw new BadRequestException('recurrenceRule COUNT must be between 1 and 5000.');
  }
  const untilText = values.get('UNTIL');
  if (count !== undefined && untilText !== undefined) {
    throw new BadRequestException('RFC 5545 recurrenceRule must use COUNT or UNTIL, not both.');
  }
  let until: number | undefined;
  if (untilText !== undefined) {
    if (/^\d{8}$/.test(untilText)) {
      until = Date.UTC(Number(untilText.slice(0, 4)), Number(untilText.slice(4, 6)) - 1, Number(untilText.slice(6, 8)), 23, 59, 59, 999);
    } else if (/^\d{8}T\d{6}Z$/.test(untilText)) {
      until = Date.UTC(
        Number(untilText.slice(0, 4)), Number(untilText.slice(4, 6)) - 1, Number(untilText.slice(6, 8)),
        Number(untilText.slice(9, 11)), Number(untilText.slice(11, 13)), Number(untilText.slice(13, 15)),
      );
    } else {
      throw new BadRequestException('recurrenceRule UNTIL must be an RFC 5545 UTC DATE or DATE-TIME.');
    }
  }
  if (count === undefined && until === undefined) {
    throw new BadRequestException('recurrenceRule must include COUNT or UNTIL to bound generated sessions.');
  }
  const weekdayTokens = values.get('BYDAY')?.split(',');
  if (weekdayTokens?.some((day) => !Object.hasOwn(WEEKDAYS, day))) {
    throw new BadRequestException('recurrenceRule BYDAY supports unnumbered weekday codes only.');
  }
  const monthDayTokens = values.get('BYMONTHDAY')?.split(',');
  if (monthDayTokens && !['MONTHLY', 'YEARLY'].includes(frequency ?? '')) {
    throw new BadRequestException('recurrenceRule BYMONTHDAY is supported only with MONTHLY or YEARLY frequency.');
  }
  const monthDays = monthDayTokens?.map(Number);
  if (monthDays?.some((day) => !Number.isInteger(day) || day === 0 || day < -31 || day > 31)) {
    throw new BadRequestException('recurrenceRule BYMONTHDAY values must be from -31 to -1 or 1 to 31.');
  }
  const monthTokens = values.get('BYMONTH')?.split(',');
  const months = monthTokens?.map(Number);
  if (months?.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
    throw new BadRequestException('recurrenceRule BYMONTH values must be from 1 to 12.');
  }
  return {
    frequency: frequency as RecurrenceRule['frequency'],
    interval,
    count,
    until,
    weekdays: weekdayTokens ? new Set(weekdayTokens.map((day) => WEEKDAYS[day])) : undefined,
    monthDays: monthDays ? new Set(monthDays) : undefined,
    months: months ? new Set(months) : undefined,
  };
}

function recurrenceMatches(rule: RecurrenceRule, start: Date, candidate: Date): boolean {
  const dayDifference = Math.floor((Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86_400_000);
  if (dayDifference < 0) return false;
  const weekdayMatches = !rule.weekdays || rule.weekdays.has(candidate.getUTCDay());
  if (rule.frequency === 'DAILY') return dayDifference % rule.interval === 0 && weekdayMatches;
  if (rule.frequency === 'WEEKLY') {
    const mondayOffset = (date: Date) => (date.getUTCDay() + 6) % 7;
    const startWeek = Math.floor((dayDifference + mondayOffset(start)) / 7);
    return startWeek % rule.interval === 0 && weekdayMatches;
  }
  const monthDifference = (candidate.getUTCFullYear() - start.getUTCFullYear()) * 12 + candidate.getUTCMonth() - start.getUTCMonth();
  const yearDifference = candidate.getUTCFullYear() - start.getUTCFullYear();
  if (rule.frequency === 'YEARLY' && yearDifference % rule.interval !== 0) return false;
  if (rule.frequency === 'MONTHLY' && monthDifference % rule.interval !== 0) return false;
  if (rule.months && !rule.months.has(candidate.getUTCMonth() + 1)) return false;
  if (rule.frequency === 'YEARLY' && !rule.months && !rule.monthDays && !rule.weekdays &&
    candidate.getUTCMonth() !== start.getUTCMonth()) return false;
  const monthDay = candidate.getUTCDate();
  const monthLength = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)).getUTCDate();
  const monthDayMatches = !rule.monthDays || [...rule.monthDays].some((day) => (day > 0 ? day : monthLength + day + 1) === monthDay);
  const dayMatches = rule.monthDays
    ? monthDayMatches
    : rule.weekdays
      ? true
      : monthDay === start.getUTCDate();
  return monthDifference >= 0 && weekdayMatches && dayMatches &&
    (rule.frequency !== 'YEARLY' || yearDifference >= 0);
}

function expandRecurrence(startAt: Date, endAt: Date, rule: RecurrenceRule): Array<{ startAt: string; endAt: string }> {
  if (rule.until !== undefined && rule.until < startAt.getTime()) {
    throw new BadRequestException('recurrenceRule UNTIL must not be earlier than the first session.');
  }
  const duration = endAt.getTime() - startAt.getTime();
  const occurrences: Array<{ startAt: string; endAt: string }> = [];
  const maxDays = 366 * 1000;
  if (rule.until !== undefined && rule.until - startAt.getTime() > maxDays * 86_400_000) {
    throw new BadRequestException('recurrenceRule UNTIL must be within 1000 years of its first session.');
  }
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const candidate = new Date(startAt.getTime() + offset * 86_400_000);
    if (rule.until !== undefined && candidate.getTime() > rule.until) break;
    if (offset > 0 && !recurrenceMatches(rule, startAt, candidate)) continue;
    occurrences.push({ startAt: candidate.toISOString(), endAt: new Date(candidate.getTime() + duration).toISOString() });
    if (rule.count !== undefined && occurrences.length >= rule.count) return occurrences;
  }
  if (rule.count !== undefined && occurrences.length < rule.count) {
    throw new BadRequestException('recurrenceRule could not produce the requested COUNT within the supported range.');
  }
  if (occurrences.length > 5000) throw new BadRequestException('recurrenceRule generates too many sessions (maximum 5000).');
  return occurrences;
}

@Injectable()
export class MeetingsService {
  private livekitRoomService?: RoomServiceClient;

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  private get roomService(): RoomServiceClient {
    if (this.livekitRoomService) return this.livekitRoomService;
    const serverUrl = this.config.get<string>('LIVEKIT_URL')?.replace(/^wss:/, 'https:');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET')?.trim();
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit is not configured.');
    }
    this.livekitRoomService = new RoomServiceClient(serverUrl, apiKey, apiSecret);
    return this.livekitRoomService;
  }

  private rank(role: string): number {
    return role === 'host' ? 3 : role === 'moderator' ? 2 : 1;
  }

  private async disconnectIfPresent(roomName: string, identity: string): Promise<void> {
    try {
      // Removing directly avoids a race between listing and removing a participant.
      await this.roomService.removeParticipant(roomName, identity);
    } catch (error) {
      // A room may never have been created, or disappear after its last client leaves.
      // Either the room or participant already being absent satisfies this cleanup.
      if (error instanceof ServerError && error.status === 404 && error.code === 'not_found') return;
      throw error;
    }
  }

  private async getMeetingByCode(code: string): Promise<Meeting> {
    const { data, error } = await this.supabase.from('meetings').select(MEETING_SELECT)
      .eq('meeting_code', code.trim()).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load meeting.');
    if (!data) throw new NotFoundException('Meeting not found.');
    return data as Meeting;
  }

  private async getMeetingById(meetingId: string): Promise<Meeting> {
    const { data, error } = await this.supabase.from('meetings').select(MEETING_SELECT)
      .eq('meeting_id', meetingId).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load meeting.');
    if (!data) throw new NotFoundException('Meeting not found.');
    return data as Meeting;
  }

  private async getSession(meetingId: string, sessionId: string): Promise<Session> {
    const { data, error } = await this.supabase.from('meeting_sessions').select(SESSION_SELECT)
      .eq('meeting_id', meetingId).eq('session_id', sessionId).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load meeting session.');
    if (!data) throw new NotFoundException('Meeting session not found.');
    return data as Session;
  }

  private async getMember(meetingId: string, userId: string): Promise<Member | null> {
    const { data, error } = await this.supabase.from('meeting_members').select(MEMBER_SELECT)
      .eq('meeting_id', meetingId).eq('user_id', userId).is('removed_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load meeting membership.');
    return data as Member | null;
  }

  private async getMemberById(meetingId: string, memberId: string): Promise<Member> {
    const { data, error } = await this.supabase.from('meeting_members').select(MEMBER_SELECT)
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId).is('removed_at', null).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load meeting member.');
    if (!data) throw new NotFoundException('Meeting member not found.');
    return data as Member;
  }

  private async requireMember(meetingId: string, userId: string): Promise<Member> {
    const member = await this.getMember(meetingId, userId);
    if (!member || member.admission_status !== 'admitted') {
      throw new ForbiddenException('An admitted meeting member is required.');
    }
    return member;
  }

  private async requireModerator(meetingId: string, userId: string): Promise<Member> {
    const member = await this.requireMember(meetingId, userId);
    if (!['host', 'moderator'].includes(member.role)) {
      throw new ForbiddenException('Meeting owner or moderator permission is required.');
    }
    return member;
  }

  private async requireMeetingMember(meetingId: string, userId: string): Promise<Member> {
    const member = await this.requireMember(meetingId, userId);
    if (member.role === 'participant' && member.invited_at === null) {
      throw new ForbiddenException('A session-only guest cannot manage meeting sessions.');
    }
    return member;
  }

  private async insertMeeting(owner: User, title: string, waitingRoomEnabled: boolean, recurrenceRule: string | null) {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new BadRequestException('Meeting title cannot be empty.');
    const meetingId = randomUUID();
    const meetingCode = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const { data: meeting, error } = await this.supabase.from('meetings').insert({
      meeting_id: meetingId,
      created_by: owner.userId,
      meeting_code: meetingCode,
      title: cleanTitle,
      recurrence_rule: recurrenceRule,
      waiting_room_enabled: waitingRoomEnabled,
    }).select(MEETING_SELECT).single();
    if (error || !meeting) {
      if (error?.code === '23505') throw new ConflictException('Could not allocate a unique meeting link; please retry.');
      throw new ServiceUnavailableException('Could not create meeting.');
    }
    const { error: ownerError } = await this.supabase.from('meeting_members').insert({
      meeting_id: meetingId,
      user_id: owner.userId,
      role: 'host',
      admission_status: 'admitted',
      admitted_at: new Date().toISOString(),
    });
    if (ownerError) {
      await this.supabase.from('meetings').delete().eq('meeting_id', meetingId);
      throw new ServiceUnavailableException('Could not register meeting owner.');
    }
    return meeting as Meeting;
  }

  async createMeeting(owner: User, body: { title: string; waitingRoomEnabled?: boolean; recurrenceRule?: string | null }) {
    if (body.recurrenceRule?.trim()) parseRecurrenceRule(body.recurrenceRule);
    return this.insertMeeting(owner, body.title, body.waitingRoomEnabled !== false, body.recurrenceRule?.trim() || null);
  }

  async createQuickMeeting(owner: User, body: { title: string; waitingRoomEnabled?: boolean }) {
    const meeting = await this.insertMeeting(owner, body.title, body.waitingRoomEnabled !== false, null);
    const now = new Date().toISOString();
    const session = await this.insertSession(meeting.meeting_id, {
      scheduledStartAt: now,
      scheduledEndAt: null,
      status: 'ongoing',
      startedAt: now,
    });
    return { ...meeting, session };
  }

  async listSessions(code: string) {
    const meeting = await this.getMeetingByCode(code);
    const { data, error } = await this.supabase.from('meeting_sessions').select(SESSION_SELECT)
      .eq('meeting_id', meeting.meeting_id).order('scheduled_start_at', { ascending: true });
    if (error) throw new ServiceUnavailableException('Could not load meeting sessions.');
    return { meeting: { meetingId: meeting.meeting_id, title: meeting.title, meetingCode: meeting.meeting_code,
      recurrenceRule: meeting.recurrence_rule, waitingRoomEnabled: meeting.waiting_room_enabled }, sessions: data ?? [] };
  }

  private async insertSession(meetingId: string, values: {
    scheduledStartAt: string;
    scheduledEndAt: string | null;
    status: Session['status'];
    startedAt?: string | null;
  }) {
    const sessionId = randomUUID();
    const { data, error } = await this.supabase.from('meeting_sessions').insert({
      session_id: sessionId,
      meeting_id: meetingId,
      livekit_room_name: `session-${sessionId}`,
      status: values.status,
      scheduled_start_at: values.scheduledStartAt,
      scheduled_end_at: values.scheduledEndAt,
      started_at: values.startedAt ?? null,
    }).select(SESSION_SELECT).single();
    if (error || !data) throw new ServiceUnavailableException('Could not create meeting session.');
    return data as Session;
  }

  async createSession(user: User, meetingId: string, body: { scheduledStartAt: string; scheduledEndAt: string }) {
    await this.requireMeetingMember(meetingId, user.userId);
    const meeting = await this.getMeetingById(meetingId);
    const startAt = new Date(body.scheduledStartAt);
    const endAt = new Date(body.scheduledEndAt);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt || startAt.getTime() <= Date.now()) {
      throw new ConflictException({ code: 'INVALID_SCHEDULE_TIME', message: 'Scheduled session must start in the future and end after it starts.' });
    }
    let occurrences = [{ startAt: startAt.toISOString(), endAt: endAt.toISOString() }];
    if (meeting.recurrence_rule?.trim()) {
      occurrences = expandRecurrence(startAt, endAt, parseRecurrenceRule(meeting.recurrence_rule));
    } else {
      const { count, error } = await this.supabase.from('meeting_sessions').select('session_id', { count: 'exact', head: true })
        .eq('meeting_id', meetingId);
      if (error) throw new ServiceUnavailableException('Could not check existing meeting sessions.');
      if ((count ?? 0) > 0) throw new ConflictException({ code: 'SINGLE_SESSION_EXISTS', message: 'This meeting is configured for one session. Add a recurrence rule to schedule a series.' });
    }
    const existingStarts = new Set<string>();
    for (let index = 0; index < occurrences.length; index += 100) {
      const starts = occurrences.slice(index, index + 100).map((occurrence) => occurrence.startAt);
      const { data: existing, error: existingError } = await this.supabase.from('meeting_sessions')
        .select('scheduled_start_at').eq('meeting_id', meetingId).in('scheduled_start_at', starts);
      if (existingError) throw new ServiceUnavailableException('Could not check for existing recurring sessions.');
      for (const row of existing ?? []) existingStarts.add(row.scheduled_start_at);
    }
    const pending = occurrences.filter((occurrence) => !existingStarts.has(occurrence.startAt));
    if (!pending.length) return { sessions: [], alreadyScheduled: true };
    const rows = pending.map((occurrence) => {
      const sessionId = randomUUID();
      return {
        session_id: sessionId,
        meeting_id: meetingId,
        livekit_room_name: `session-${sessionId}`,
        status: 'scheduled',
        scheduled_start_at: occurrence.startAt,
        scheduled_end_at: occurrence.endAt,
      };
    });
    const created: Session[] = [];
    for (let index = 0; index < rows.length; index += 100) {
      const { data, error } = await this.supabase.from('meeting_sessions').insert(rows.slice(index, index + 100)).select(SESSION_SELECT);
      if (error) throw new ServiceUnavailableException('Could not create all scheduled meeting sessions; retrying will skip sessions already created.');
      created.push(...(data ?? []) as Session[]);
    }
    return { sessions: created, alreadyScheduled: false };
  }

  private async checkAdmissionRetryLimit(meetingId: string, userId: string) {
    const cutoff = new Date(Date.now() - ADMISSION_COOLDOWN_MS).toISOString();
    const { data, error } = await this.supabase.from('meeting_members').select('removed_at')
      .eq('meeting_id', meetingId).eq('user_id', userId).eq('admission_status', 'denied')
      .is('invited_at', null).gte('removed_at', cutoff).order('removed_at', { ascending: false });
    if (error) throw new ServiceUnavailableException('Could not check join request history.');
    const denials = data ?? [];
    if (denials.length >= ADMISSION_RETRY_LIMIT) {
      const lastDeniedAt = new Date(denials[0].removed_at).getTime();
      const retryAt = lastDeniedAt + ADMISSION_COOLDOWN_MS;
      if (retryAt > Date.now()) {
        throw new HttpException({
          message: 'The join request limit has been reached. Please try again later.',
          retryAt: new Date(retryAt).toISOString(),
        }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  private async createGuestMember(meetingId: string, user: User, admissionStatus: string): Promise<Member> {
    const { data, error } = await this.supabase.from('meeting_members').insert({
      meeting_id: meetingId,
      user_id: user.userId,
      role: 'participant',
      admission_status: admissionStatus,
    }).select(MEMBER_SELECT).single();
    if (error || !data) {
      if (error?.code === '23505') throw new ConflictException('A join request is already being processed.');
      throw new ServiceUnavailableException('Could not create meeting join request.');
    }
    return data as Member;
  }

  private async activateSession(session: Session): Promise<Session> {
    if (session.status === 'ended') throw new ForbiddenException('This meeting session has ended.');
    if (session.status === 'ongoing') return session;
    const now = Date.now();
    if (session.scheduled_start_at && new Date(session.scheduled_start_at).getTime() > now) {
      throw new ConflictException({ message: 'This meeting session has not started yet.', startsAt: session.scheduled_start_at });
    }
    const startedAt = new Date().toISOString();
    const { data, error } = await this.supabase.from('meeting_sessions').update({ status: 'ongoing', started_at: startedAt })
      .eq('session_id', session.session_id).eq('meeting_id', session.meeting_id).eq('status', 'scheduled')
      .select(SESSION_SELECT).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not start meeting session.');
    if (data) return data as Session;
    const latest = await this.getSession(session.meeting_id, session.session_id);
    if (latest.status !== 'ongoing') throw new ConflictException('This meeting session is no longer open.');
    return latest;
  }

  async join(user: User, code: string, sessionId: string) {
    const meeting = await this.getMeetingByCode(code);
    let session = await this.getSession(meeting.meeting_id, sessionId);
    session = await this.activateSession(session);

    let member = await this.getMember(meeting.meeting_id, user.userId);
    if (!member) {
      await this.checkAdmissionRetryLimit(meeting.meeting_id, user.userId);
      const admissionStatus = meeting.waiting_room_enabled ? 'pending' : 'admitted';
      member = await this.createGuestMember(meeting.meeting_id, user, admissionStatus);
      if (admissionStatus === 'pending') return { status: 'pending', meetingId: meeting.meeting_id, sessionId: session.session_id };
    } else if (member.admission_status === 'pending') {
      return { status: 'pending', meetingId: meeting.meeting_id, sessionId: session.session_id };
    }

    if (member.admission_status !== 'admitted') throw new ForbiddenException('Meeting admission was denied.');

    const livekitIdentity = `${user.userId}:${randomUUID()}`;
    const serverUrl = this.config.get<string>('LIVEKIT_URL')?.trim();
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET')?.trim();
    if (!serverUrl || !apiKey || !apiSecret) throw new ServiceUnavailableException('LiveKit is not configured.');
    const token = new AccessToken(apiKey, apiSecret, {
      identity: livekitIdentity,
      name: user.displayName,
      ttl: this.config.getOrThrow<number>('LIVEKIT_TOKEN_TTL_SECONDS'),
    });
    token.addGrant({
      room: session.livekit_room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA,
        ...(member.role === 'host' && meeting.created_by === user.userId ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [])],
    });
    const accessToken = await token.toJwt();
    const attendanceValues = { livekit_identity: livekitIdentity, joined_at: new Date().toISOString(), left_at: null };
    const { data, error } = await this.supabase.from('attendances').insert({
      meeting_member_id: member.meeting_member_id,
      session_id: session.session_id,
      ...attendanceValues,
    }).select('attendance_id').single();
    if (error || !data) throw new ServiceUnavailableException('Could not record meeting attendance.');
    const attendanceId = data.attendance_id;

    return {
      status: 'admitted',
      role: member.role,
      meetingId: meeting.meeting_id,
      sessionId: session.session_id,
      attendanceId,
      roomName: session.livekit_room_name,
      serverUrl,
      participantIdentity: livekitIdentity,
      token: accessToken,
    };
  }

  async decideScreenShare(user: User, meetingId: string, sessionId: string, identity: string, approved: boolean) {
    const meeting = await this.getMeetingById(meetingId);
    const host = await this.requireMeetingMember(meetingId, user.userId);
    if (meeting.created_by !== user.userId || host.role !== 'host') throw new ForbiddenException('Only the host can approve screen sharing.');
    const session = await this.getSession(meetingId, sessionId);
    if (session.status !== 'ongoing') throw new ConflictException('The session is not ongoing.');
    const { data, error } = await this.supabase.from('attendances').select('meeting_member_id')
      .eq('session_id', sessionId).eq('livekit_identity', identity).is('left_at', null).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not check screen sharing participant.');
    if (!data) throw new NotFoundException('Connected attendance not found.');
    const target = await this.getMemberById(meetingId, data.meeting_member_id);
    if (target.admission_status !== 'admitted' || target.removed_at) throw new ForbiddenException('An admitted participant is required.');
    const participant = await this.roomService.getParticipant(session.livekit_room_name, identity);
    if (participant.attributes.screenShareRequest !== 'pending') throw new ConflictException('Screen sharing request is no longer pending.');
    await this.roomService.updateParticipant(session.livekit_room_name, identity, {
      permission: { ...participant.permission, canPublish: true, canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA,
        ...(approved ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [])] },
      attributes: { screenShareRequest: approved ? '' : 'denied' },
    });
    return { approved };
  }

  async pending(user: User, meetingId: string, sessionId: string) {
    await this.requireModerator(meetingId, user.userId);
    const session = await this.getSession(meetingId, sessionId);
    const { data, error } = await this.supabase.from('meeting_members')
      .select('meeting_member_id,user_id,role,admission_status,created_at,users(display_name,avatar_url)')
      .eq('meeting_id', meetingId)
      .eq('role', 'participant').is('invited_at', null).is('removed_at', null)
      .eq('admission_status', 'pending');
    if (error) throw new ServiceUnavailableException('Could not load join requests.');
    return (data ?? []).map(member => ({
      requestId: member.meeting_member_id,
      meeting_member_id: member.meeting_member_id,
      session_id: session.session_id,
      meeting_members: { user_id: member.user_id, role: member.role, admission_status: member.admission_status,
        created_at: member.created_at, users: member.users },
    }));
  }

  async joinStatus(user: User, meetingId: string, sessionId: string) {
    const session = await this.getSession(meetingId, sessionId);
    if (session.status === 'ended') return { status: 'session_ended', sessionId };
    const member = await this.getMember(meetingId, user.userId);
    if (member) {
      if (member.admission_status === 'pending') {
        return { status: 'pending', meetingMemberId: member.meeting_member_id, sessionId };
      }
      if (member.admission_status === 'admitted') {
        return { status: 'admitted', meetingMemberId: member.meeting_member_id, sessionId };
      }
    }
    const { data, error } = await this.supabase.from('meeting_members')
      .select('meeting_member_id,removed_at').eq('meeting_id', meetingId).eq('user_id', user.userId)
      .eq('admission_status', 'denied').is('invited_at', null)
      .order('removed_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not load join request status.');
    if (data) {
      const cutoff = new Date(Date.now() - ADMISSION_COOLDOWN_MS).toISOString();
      const { data: recentDenials, error: denialError } = await this.supabase.from('meeting_members')
        .select('removed_at').eq('meeting_id', meetingId).eq('user_id', user.userId)
        .eq('admission_status', 'denied').is('invited_at', null).gte('removed_at', cutoff)
        .order('removed_at', { ascending: false });
      if (denialError) throw new ServiceUnavailableException('Could not load join retry status.');
      const retryAt = (recentDenials?.length ?? 0) >= ADMISSION_RETRY_LIMIT
        ? new Date(new Date(recentDenials![0].removed_at).getTime() + ADMISSION_COOLDOWN_MS).toISOString()
        : null;
      return {
        status: 'denied',
        meetingMemberId: data.meeting_member_id,
        sessionId,
        retryAt: retryAt && new Date(retryAt).getTime() > Date.now() ? retryAt : null,
        remainingAttempts: Math.max(0, ADMISSION_RETRY_LIMIT - (recentDenials?.length ?? 0)),
      };
    }
    return { status: 'not_requested', sessionId };
  }

  async approve(user: User, meetingId: string, sessionId: string, memberId: string) {
    await this.requireModerator(meetingId, user.userId);
    const session = await this.getSession(meetingId, sessionId);
    if (session.status === 'ended') throw new ConflictException('Cannot approve entry into an ended session.');
    const member = await this.getMemberById(meetingId, memberId);
    if (member.admission_status !== 'pending' || member.invited_at !== null || member.role !== 'participant') {
      throw new ConflictException('Only guest requests can be approved here.');
    }
    const { data, error } = await this.supabase.from('meeting_members').update({
      admission_status: 'admitted',
      admitted_at: new Date().toISOString(),
    }).eq('meeting_id', meetingId).eq('meeting_member_id', memberId)
      .eq('admission_status', 'pending').is('removed_at', null)
      .select('meeting_member_id,admission_status,admitted_at').maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not approve join request.');
    if (!data) throw new ConflictException('Join request is no longer pending.');
    return { ...data, sessionId };
  }

  async deny(user: User, meetingId: string, sessionId: string, memberId: string) {
    await this.requireModerator(meetingId, user.userId);
    await this.getSession(meetingId, sessionId);
    const member = await this.getMemberById(meetingId, memberId);
    if (member.admission_status !== 'pending' || member.invited_at !== null || member.role !== 'participant') {
      throw new ConflictException('Only guest requests can be denied here.');
    }
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.from('meeting_members').update({ admission_status: 'denied', removed_at: now })
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId)
      .eq('admission_status', 'pending').is('removed_at', null).select('meeting_member_id').maybeSingle();
    if (error) throw new ServiceUnavailableException('Could not deny join request.');
    if (!data) throw new ConflictException('Join request is no longer pending.');
    return { status: 'denied', meetingMemberId: memberId, sessionId };
  }

  async setModerator(user: User, meetingId: string, memberId: string, enabled: boolean) {
    const meeting = await this.getMeetingById(meetingId);
    if (meeting.created_by !== user.userId) throw new ForbiddenException('Only the meeting owner can change moderator roles.');
    const target = await this.getMemberById(meetingId, memberId);
    if (target.role === 'host') throw new ForbiddenException('Owner role cannot be changed.');
    if (target.admission_status !== 'admitted' || target.invited_at === null) {
      throw new ForbiddenException('Only permanent admitted members can be moderators.');
    }
    const { data, error } = await this.supabase.from('meeting_members')
      .update({ role: enabled ? 'moderator' : 'participant' })
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId).select('meeting_member_id,role').single();
    if (error || !data) throw new ServiceUnavailableException('Could not update moderator role.');
    return data;
  }

  async inviteMember(user: User, meetingId: string, email: string) {
    await this.requireModerator(meetingId, user.userId);
    const { data: targetUser, error: userError } = await this.supabase.from('users').select('user_id')
      .eq('email', email.trim().toLowerCase()).maybeSingle();
    if (userError) throw new ServiceUnavailableException('Could not look up invitee.');
    if (!targetUser) throw new NotFoundException('User not found.');
    const targetUserId = targetUser.user_id as string;
    const existing = await this.getMember(meetingId, targetUserId);
    if (existing) {
      if (existing.invited_at !== null && existing.admission_status === 'admitted') return existing;
      throw new ConflictException('This user already has an active membership or join request.');
    }
    const invitedAt = new Date().toISOString();
    const { data, error } = await this.supabase.from('meeting_members').insert({
      meeting_id: meetingId,
      user_id: targetUserId,
      role: 'participant',
      admission_status: 'admitted',
      invited_at: invitedAt,
      admitted_at: invitedAt,
    }).select(MEMBER_SELECT).single();
    if (error || !data) {
      if (error?.code === '23503') throw new NotFoundException('User not found.');
      throw new ServiceUnavailableException('Could not invite meeting member.');
    }
    return data;
  }

  async updateSettings(user: User, meetingId: string, body: { waitingRoomEnabled: boolean }) {
    const meeting = await this.getMeetingById(meetingId);
    if (meeting.created_by !== user.userId) throw new ForbiddenException('Only the meeting owner can update meeting settings.');
    const { data, error } = await this.supabase.from('meetings').update({ waiting_room_enabled: body.waitingRoomEnabled })
      .eq('meeting_id', meetingId).select('meeting_id,waiting_room_enabled').single();
    if (error || !data) throw new ServiceUnavailableException('Could not update meeting settings.');
    // Pending requests are deliberately not auto-admitted when the lobby is disabled;
    // they remain pending and retain the explicit approve/deny audit path.
    return data;
  }

  async mute(user: User, meetingId: string, sessionId: string, memberId: string) {
    const actor = await this.requireModerator(meetingId, user.userId);
    const session = await this.getSession(meetingId, sessionId);
    if (session.status !== 'ongoing') throw new ConflictException('Microphone moderation requires an active session.');
    const target = await this.getMemberById(meetingId, memberId);
    if (target.admission_status !== 'admitted') throw new ForbiddenException('Target must be admitted to the meeting.');
    if (target.user_id === user.userId) throw new ForbiddenException('Use the meeting controls to mute your own microphone.');
    if (this.rank(actor.role) < this.rank(target.role)) throw new ForbiddenException('You may mute members of your rank or lower.');
    const { data, error } = await this.supabase.from('attendances')
      .select('livekit_identity').eq('meeting_member_id', memberId).eq('session_id', sessionId)
      .not('livekit_identity', 'is', null).not('joined_at', 'is', null).is('left_at', null)
      .order('joined_at', { ascending: false });
    if (error) throw new ServiceUnavailableException('Could not load participant attendance.');
    if (!data?.length) throw new NotFoundException('Member is not currently connected to this session.');
    const participants = await this.roomService.listParticipants(session.livekit_room_name);
    let mutedTracks = 0;
    for (const attendance of data) {
      if (!attendance.livekit_identity) continue;
      const participant = participants.find((item) => item.identity === attendance.livekit_identity);
      const audioTracks = participant?.tracks?.filter((track) => track.source === TrackSource.MICROPHONE) ?? [];
      for (const track of audioTracks) {
        await this.roomService.mutePublishedTrack(session.livekit_room_name, attendance.livekit_identity, track.sid, true);
        mutedTracks += 1;
      }
    }
    if (mutedTracks === 0) throw new NotFoundException('Participant has no published microphone track.');
    return { muted: true, persistsAfterReconnect: false, meetingMemberId: memberId, sessionId };
  }

  async removeMember(user: User, meetingId: string, memberId: string) {
    const actor = await this.requireModerator(meetingId, user.userId);
    const target = await this.getMemberById(meetingId, memberId);
    if (target.role === 'host' || this.rank(actor.role) < this.rank(target.role)) {
      throw new ForbiddenException('You may remove only members of your rank or lower; the owner cannot be removed.');
    }
    const { data: attendances, error: readError } = await this.supabase.from('attendances')
      .select('attendance_id,session_id,livekit_identity').eq('meeting_member_id', memberId)
      .not('joined_at', 'is', null).is('left_at', null);
    if (readError) throw new ServiceUnavailableException('Could not load active attendances.');
    for (const attendance of attendances ?? []) {
      const session = await this.getSession(meetingId, attendance.session_id);
      if (attendance.livekit_identity) {
        await this.disconnectIfPresent(session.livekit_room_name, attendance.livekit_identity);
      }
      const { error } = await this.supabase.from('attendances').update({ left_at: new Date().toISOString(), leave_reason: 'removed' })
        .eq('attendance_id', attendance.attendance_id).is('left_at', null);
      if (error) throw new ServiceUnavailableException('Could not close member attendance.');
    }
    const { error } = await this.supabase.from('meeting_members').update({ removed_at: new Date().toISOString() })
      .eq('meeting_id', meetingId).eq('meeting_member_id', memberId).is('removed_at', null);
    if (error) throw new ServiceUnavailableException('Could not remove meeting member.');
    return { removed: true, meetingMemberId: memberId };
  }

  async leave(user: User, meetingId: string, sessionId: string, attendanceId: string) {
    const member = await this.requireMember(meetingId, user.userId);
    const session = await this.getSession(meetingId, sessionId);
    const { data: attendance, error: attendanceError } = await this.supabase.from('attendances')
      .select('attendance_id,livekit_identity,joined_at,left_at')
      .eq('attendance_id', attendanceId).eq('meeting_member_id', member.meeting_member_id)
      .eq('session_id', sessionId).maybeSingle();
    if (attendanceError) throw new ServiceUnavailableException('Could not load attendance.');
    if (!attendance || !attendance.joined_at || attendance.left_at) return { status: 'left', sessionId, attendanceId };
    if (attendance.livekit_identity) {
      await this.disconnectIfPresent(session.livekit_room_name, attendance.livekit_identity);
    }
    const { error } = await this.supabase.from('attendances').update({ left_at: new Date().toISOString(), leave_reason: 'client_left' })
      .eq('attendance_id', attendance.attendance_id).is('left_at', null);
    if (error) throw new ServiceUnavailableException('Could not record meeting departure.');
    return { status: 'left', sessionId, attendanceId };
  }

  async endSession(user: User, meetingId: string, sessionId: string) {
    await this.requireMeetingMember(meetingId, user.userId);
    const session = await this.getSession(meetingId, sessionId);
    if (session.status === 'ended') return { status: 'ended', sessionId, endedAt: session.ended_at };
    const { data: active, error: readError } = await this.supabase.from('attendances')
      .select('attendance_id,meeting_member_id,livekit_identity').eq('session_id', sessionId)
      .not('joined_at', 'is', null).is('left_at', null);
    if (readError) throw new ServiceUnavailableException('Could not load active session participants.');
    for (const attendance of active ?? []) {
      if (attendance.livekit_identity) {
        await this.disconnectIfPresent(session.livekit_room_name, attendance.livekit_identity);
      }
      const { error } = await this.supabase.from('attendances').update({ left_at: new Date().toISOString(), leave_reason: 'session_ended' })
        .eq('attendance_id', attendance.attendance_id).is('left_at', null);
      if (error) throw new ServiceUnavailableException('Could not close session attendance.');
    }
    const endedAt = new Date().toISOString();
    const { data: sessionAttendances, error: attendanceError } = await this.supabase.from('attendances')
      .select('meeting_member_id').eq('session_id', sessionId);
    if (attendanceError) throw new ServiceUnavailableException('Could not load session guest history.');
    const guestIds = [...new Set((sessionAttendances ?? []).map((row) => row.meeting_member_id))];
    for (const memberId of guestIds) {
      const { error: guestError } = await this.supabase.from('meeting_members')
        .update({ removed_at: endedAt }).eq('meeting_id', meetingId).eq('meeting_member_id', memberId)
        .eq('role', 'participant').is('invited_at', null).is('removed_at', null);
      if (guestError) throw new ServiceUnavailableException('Could not expire session-only guest access.');
    }
    const { error } = await this.supabase.from('meeting_sessions').update({ status: 'ended', ended_at: endedAt })
      .eq('meeting_id', meetingId).eq('session_id', sessionId).neq('status', 'ended');
    if (error) throw new ServiceUnavailableException('Could not end meeting session.');
    return { status: 'ended', sessionId, endedAt };
  }
}
