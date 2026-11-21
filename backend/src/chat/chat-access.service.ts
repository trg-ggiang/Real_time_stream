import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoomServiceClient } from 'livekit-server-sdk';
import { MeetingSessionsService } from '../meeting-sessions/meeting-sessions.service';
import { UsersService } from '../users/users.service';
import { ChatIdentity } from './chat.types';
import { ChatHandshakeDto, parseChatDto } from './dto/chat.dto';

@Injectable()
export class LivekitPresenceService {
  constructor(private readonly config: ConfigService) {}

  async requireParticipant(roomName: string, identity: string) {
    const url = this.config.get<string>('LIVEKIT_URL');
    if (!url) throw new ServiceUnavailableException('LiveKit chưa sẵn sàng.');
    const client = new RoomServiceClient(url.replace(/^wss:/, 'https:'),
      this.config.get<string>('LIVEKIT_API_KEY'), this.config.get<string>('LIVEKIT_API_SECRET'), { requestTimeout: 5 });
    try { await client.getParticipant(roomName, identity); }
    catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'not_found') {
        throw new ForbiddenException('Bạn cần đang kết nối phòng họp để sử dụng chat.');
      }
      throw new ServiceUnavailableException('Chưa xác minh được kết nối LiveKit. Hãy thử kết nối lại chat.');
    }
  }
}

@Injectable()
export class ChatAccessService {
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService,
    private readonly users: UsersService, private readonly sessions: MeetingSessionsService,
    private readonly presence: LivekitPresenceService) {}

  async authenticate(raw: unknown): Promise<ChatIdentity> {
    const auth = await parseChatDto(ChatHandshakeDto, raw);
    let payload: { sub: string; exp: number };
    try {
      payload = await this.jwt.verifyAsync(auth.token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'), algorithms: ['HS256'],
      });
    } catch { throw new UnauthorizedException('Phiên đăng nhập hết hạn hoặc không hợp lệ.'); }
    if (typeof payload.sub !== 'string' || !Number.isFinite(payload.exp) ||
      !auth.participantIdentity.startsWith(`${payload.sub}:`) ||
      !await this.users.findById(payload.sub)) throw new UnauthorizedException('Không thể xác thực người gửi.');
    const identity = { userId: payload.sub, sessionId: auth.sessionId,
      participantIdentity: auth.participantIdentity, expiresAt: payload.exp * 1000 };
    await this.requireAccess(identity);
    return identity;
  }

  async requireAccess(identity: ChatIdentity) {
    if (Date.now() >= identity.expiresAt) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
    const session = await this.sessions.requireAccess(identity.userId, identity.sessionId);
    await this.presence.requireParticipant(session.livekit_room_name, identity.participantIdentity);
  }
}
