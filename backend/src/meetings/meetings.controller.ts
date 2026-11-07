import { Body, Controller, Headers, Param, Patch, Post } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Post()
  create(@Headers('authorization') auth: string, @Body() body: any) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.createMeeting(user, body));
  }

  @Post(':code/join')
  join(@Headers('authorization') auth: string, @Param('code') code: string) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.join(user, code));
  }

  @Post(':meetingId/join-requests/:memberId/approve')
  approve(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string, @Param('memberId') memberId: string) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.approve(user, meetingId, memberId));
  }

  @Post(':meetingId/join-requests')
  pending(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.pending(user, meetingId));
  }

  @Patch(':meetingId/members/:memberId/moderator')
  moderator(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string, @Param('memberId') memberId: string, @Body() body: any) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.setModerator(user, meetingId, memberId, body?.enabled === true));
  }

  @Patch(':meetingId/settings')
  settings(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string, @Body() body: any) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.updateSettings(user, meetingId, body));
  }

  @Post(':meetingId/members/:memberId/mute')
  mute(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string, @Param('memberId') memberId: string) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.mute(user, meetingId, memberId));
  }

  @Post(':meetingId/members/:memberId/remove')
  remove(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string, @Param('memberId') memberId: string) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.removeMember(user, meetingId, memberId));
  }

  @Post(':meetingId/leave')
  leave(@Headers('authorization') auth: string, @Param('meetingId') meetingId: string) {
    return this.meetings.authenticate(auth).then((user) => this.meetings.leave(user, meetingId));
  }
}
