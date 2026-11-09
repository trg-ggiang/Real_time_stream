import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeetingSessionsService } from './meeting-sessions.service';
import { MeetingSessionsController } from './meeting-sessions.controller';

@Module({ imports: [AuthModule], providers: [MeetingSessionsService], controllers: [MeetingSessionsController], exports: [MeetingSessionsService] })
export class MeetingSessionsModule {}
