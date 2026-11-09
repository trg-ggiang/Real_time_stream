import { User } from '../users/entities/user.entity';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import { getMeetingPublishSources } from './meeting-permissions';
import { MeetingSessionsService } from '../meeting-sessions/meeting-sessions.service';

export interface JoinCredentials {
  serverUrl: string;
  participantIdentity: string;
  roomName: string;
  token: string;
  sessionId?: string;
}

@Injectable()
export class LivekitService {
  constructor(private readonly config: ConfigService, private readonly sessions: MeetingSessionsService) {}

  async createJoinCredentials(user: User, sessionId?: string): Promise<JoinCredentials> {
    const serverUrl = this.config.get<string>('LIVEKIT_URL');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET')?.trim();
    if (
      !this.config.get<boolean>('POC_ENABLED') ||
      !serverUrl ||
      !apiKey ||
      !apiSecret
    ) {
      throw new ServiceUnavailableException(
        'Phòng thử nghiệm chưa được cấu hình trên máy chủ.',
      );
    }
    const participantIdentity = `${user.userId}:${randomUUID()}`;
    const roomName = sessionId
      ? (await this.sessions.requireAccess(user.userId, sessionId)).livekit_room_name
      : this.config.getOrThrow<string>('LIVEKIT_ROOM_NAME');
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: user.displayName,
      ttl: this.config.getOrThrow<number>('LIVEKIT_TOKEN_TTL_SECONDS'),
    });
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: true,
      canPublishSources: getMeetingPublishSources(true),
    });
    return {
      serverUrl,
      roomName,
      participantIdentity,
      token: await accessToken.toJwt(),
      ...(sessionId ? { sessionId } : {}),
    };
  }
}
