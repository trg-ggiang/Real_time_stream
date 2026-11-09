import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';
import { MeetingSessionsModule } from '../meeting-sessions/meeting-sessions.module';

@Module({ imports: [AuthModule, MeetingSessionsModule], controllers: [LivekitController], providers: [LivekitService] })
export class LivekitModule {}
