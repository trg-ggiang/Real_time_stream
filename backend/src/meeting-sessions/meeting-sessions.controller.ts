import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { MeetingSessionsService } from './meeting-sessions.service';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('meeting-sessions')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class MeetingSessionsController {
  constructor(private readonly sessions: MeetingSessionsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: User) { return this.sessions.listForUser(user.userId); }
}
