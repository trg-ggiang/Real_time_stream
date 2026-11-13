import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';
import { MeetingSessionsModule } from '../meeting-sessions/meeting-sessions.module';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({ imports: [AuthModule, MeetingSessionsModule, MeetingsModule], controllers: [LivekitController], providers: [LivekitService] })
export class LivekitModule {}
