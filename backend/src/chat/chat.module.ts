import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { MeetingSessionsModule } from '../meeting-sessions/meeting-sessions.module';
import { ChatAccessService, LivekitPresenceService } from './chat-access.service';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({ imports: [JwtModule.register({}), UsersModule, MeetingSessionsModule],
  providers: [ChatAccessService, LivekitPresenceService, ChatRepository, ChatService, ChatGateway] })
export class ChatModule {}
