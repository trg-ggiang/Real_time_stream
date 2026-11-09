import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMeetingDto, CreateQuickMeetingDto } from './dto/create-meeting.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { LeaveSessionDto } from './dto/leave-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { MeetingSettingsDto } from './dto/meeting-settings.dto';
import { SetModeratorDto } from './dto/set-moderator.dto';
import { MeetingsService } from './meetings.service';
import { ScreenShareDecisionDto } from './dto/screen-share.dto';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Post(':meetingId/sessions/:sessionId/screen-share/decision')
  screenShareDecision(@CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: ScreenShareDecisionDto) {
    return this.meetings.decideScreenShare(user, meetingId, sessionId, body.identity, body.approved);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: CreateMeetingDto) {
    return this.meetings.createMeeting(user, body);
  }

  @Post('quick')
  createQuick(@CurrentUser() user: User, @Body() body: CreateQuickMeetingDto) {
    return this.meetings.createQuickMeeting(user, body);
  }

  @Get(':code/sessions')
  sessions(@Param('code') code: string) {
    return this.meetings.listSessions(code);
  }

  @Post(':meetingId/sessions')
  createSession(@CurrentUser() user: User, @Param('meetingId', new ParseUUIDPipe()) meetingId: string, @Body() body: CreateSessionDto) {
    return this.meetings.createSession(user, meetingId, body);
  }

  @Post(':code/join')
  join(@CurrentUser() user: User, @Param('code') code: string, @Body() body: JoinSessionDto) {
    return this.meetings.join(user, code, body.sessionId);
  }

  @Get(':meetingId/sessions/:sessionId/join-status')
  joinStatus(
    @CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.meetings.joinStatus(user, meetingId, sessionId);
  }

  @Get(':meetingId/sessions/:sessionId/join-requests')
  pending(@CurrentUser() user: User, @Param('meetingId', new ParseUUIDPipe()) meetingId: string, @Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.meetings.pending(user, meetingId, sessionId);
  }

  @Post(':meetingId/sessions/:sessionId/join-requests/:memberId/approve')
  approve(
    @CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    return this.meetings.approve(user, meetingId, sessionId, memberId);
  }

  @Post(':meetingId/sessions/:sessionId/join-requests/:memberId/deny')
  deny(
    @CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    return this.meetings.deny(user, meetingId, sessionId, memberId);
  }

  @Post(':meetingId/members')
  invite(@CurrentUser() user: User, @Param('meetingId', new ParseUUIDPipe()) meetingId: string, @Body() body: InviteMemberDto) {
    return this.meetings.inviteMember(user, meetingId, body.email);
  }

  @Patch(':meetingId/members/:memberId/moderator')
  moderator(
    @CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() body: SetModeratorDto,
  ) {
    return this.meetings.setModerator(user, meetingId, memberId, body.enabled);
  }

  @Patch(':meetingId/settings')
  settings(@CurrentUser() user: User, @Param('meetingId', new ParseUUIDPipe()) meetingId: string, @Body() body: MeetingSettingsDto) {
    return this.meetings.updateSettings(user, meetingId, body);
  }

  @Post(':meetingId/sessions/:sessionId/members/:memberId/mute')
  mute(
    @CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    return this.meetings.mute(user, meetingId, sessionId, memberId);
  }

  @Post(':meetingId/members/:memberId/remove')
  remove(@CurrentUser() user: User, @Param('meetingId', new ParseUUIDPipe()) meetingId: string, @Param('memberId', new ParseUUIDPipe()) memberId: string) {
    return this.meetings.removeMember(user, meetingId, memberId);
  }

  @Post(':meetingId/sessions/:sessionId/leave')
  leave(
    @CurrentUser() user: User,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: LeaveSessionDto,
  ) {
    return this.meetings.leave(user, meetingId, sessionId, body.attendanceId);
  }

  @Post(':meetingId/sessions/:sessionId/end')
  endSession(@CurrentUser() user: User, @Param('meetingId', new ParseUUIDPipe()) meetingId: string, @Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.meetings.endSession(user, meetingId, sessionId);
  }
}
