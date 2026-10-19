import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

export interface JoinCredentials {
  serverUrl: string;
  participantIdentity: string;
  roomName: string;
  token: string;
}

@Injectable()
export class LivekitService {
  constructor(private readonly config: ConfigService) {}

  async createJoinCredentials(): Promise<JoinCredentials> {
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
    const participantIdentity = randomUUID();
    const roomName = this.config.getOrThrow<string>('LIVEKIT_ROOM_NAME');
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      ttl: this.config.getOrThrow<number>('LIVEKIT_TOKEN_TTL_SECONDS'),
    });
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    });
    return {
      serverUrl,
      roomName,
      participantIdentity,
      token: await accessToken.toJwt(),
    };
  }
}
