import { User } from '../users/entities/user.entity';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource, TrackType } from 'livekit-server-sdk';
import type { RoomSettingsDto } from './dto/room-settings.dto';

type RoomState = {
  ownerUserId: string;
  settings: RoomSettingsDto;
  pending: Map<string, { userId: string; displayName: string }>;
  approved: Set<string>;
  mutedUserIds: Set<string>;
};

const defaultRoomSettings: RoomSettingsDto = {
  allowMic: true,
  allowVideo: true,
  waitingRoom: true,
};

export interface JoinCredentials {
  serverUrl: string;
  participantIdentity: string;
  roomName: string;
  token: string;
  isHost: boolean;
  settings: RoomSettingsDto;
}

export interface WaitingRoomStatus {
  waiting: true;
}

@Injectable()
export class LivekitService {
  private readonly rooms = new Map<string, RoomState>();

  constructor(
    private readonly config: ConfigService,
  ) {}

  async createRoom(user: User, roomId: string, settings: RoomSettingsDto): Promise<void> {
    const enforcedSettings = { ...settings, waitingRoom: true };
    const existing = this.rooms.get(roomId);
    if (existing) {
      if (existing.ownerUserId !== user.userId) {
        throw new ConflictException('Phòng đã được khởi tạo.');
      }
      existing.settings = enforcedSettings;
      return;
    }
    this.rooms.set(roomId, {
      ownerUserId: user.userId,
      settings: enforcedSettings,
      pending: new Map(),
      approved: new Set(),
      mutedUserIds: new Set(),
    });
  }

  getWaitingParticipants(user: User, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerUserId !== user.userId) {
      throw new ForbiddenException('Chỉ chủ phòng mới xem được danh sách chờ.');
    }
    return [...room.pending.values()];
  }

  approveParticipant(user: User, roomId: string, participantUserId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerUserId !== user.userId) {
      throw new ForbiddenException('Chỉ chủ phòng mới duyệt được người tham gia.');
    }
    if (!room.pending.has(participantUserId)) {
      throw new ConflictException('Người tham gia không còn trong hàng chờ.');
    }
    room.pending.delete(participantUserId);
    room.approved.add(participantUserId);
  }

  async muteParticipantMicrophone(
    user: User,
    roomId: string,
    participantIdentity: string,
    muted: boolean,
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerUserId !== user.userId) {
      throw new ForbiddenException('Chủ phòng mới được điều khiển mic người khác.');
    }
    if (participantIdentity.startsWith(`${user.userId}:`)) {
      throw new ForbiddenException('Chủ phòng không thể điều khiển mic của chính mình bằng chức năng này.');
    }

    const serverUrl = this.config.get<string>('LIVEKIT_URL');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET')?.trim();
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit server API chưa được cấu hình.');
    }

    const roomService = new RoomServiceClient(
      serverUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:'),
      apiKey,
      apiSecret,
    );
    const participants = await roomService.listParticipants(roomId);
    const participant = participants.find((entry) => entry.identity === participantIdentity);
    if (!participant) throw new NotFoundException('Người tham gia không còn trong phòng.');
    const participantUserId = participantIdentity.slice(0, participantIdentity.lastIndexOf(':'));

    const microphoneTracks = participant.tracks.filter(
      (track) => track.type === TrackType.AUDIO && track.source === TrackSource.MICROPHONE,
    );
    if (muted) {
      await Promise.all(
        microphoneTracks
          .filter((track) => !track.muted)
          .map((track) => roomService.mutePublishedTrack(roomId, participantIdentity, track.sid, true)),
      );
      room.mutedUserIds.add(participantUserId);
    } else {
      room.mutedUserIds.delete(participantUserId);
    }

    const allowedSources: TrackSource[] = [];
    if (room.settings.allowVideo) allowedSources.push(TrackSource.CAMERA);
    if (room.settings.allowMic && !muted) allowedSources.push(TrackSource.MICROPHONE);
    await roomService.updateParticipant(roomId, participantIdentity, {
      permission: {
        canPublish: allowedSources.length > 0,
        canSubscribe: participant.permission?.canSubscribe ?? true,
        canPublishData: participant.permission?.canPublishData ?? false,
        canPublishSources: allowedSources,
      },
    });
  }
  async createJoinCredentials(
    user: User,
    requestedRoomId?: string,
  ): Promise<JoinCredentials | WaitingRoomStatus> {
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
    const roomName =
      requestedRoomId ?? this.config.getOrThrow<string>('LIVEKIT_ROOM_NAME');
    const roomState = requestedRoomId ? this.rooms.get(requestedRoomId) : undefined;
    if (!requestedRoomId || !roomState) {
      throw new NotFoundException('Phòng chưa được khởi tạo hoặc cần được tạo lại bởi chủ phòng.');
    }
    const settings = roomState.settings ?? defaultRoomSettings;
    const isHost = roomState.ownerUserId === user.userId;
    if (
      !isHost &&
      !roomState.approved.has(user.userId)
    ) {
      roomState.pending.set(user.userId, {
        userId: user.userId,
        displayName: user.displayName,
      });
      return { waiting: true };
    }
    roomState.pending.delete(user.userId);
    roomState.approved.delete(user.userId);
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: user.displayName,
      ttl: this.config.getOrThrow<number>('LIVEKIT_TOKEN_TTL_SECONDS'),
    });
    const allowedSources: TrackSource[] = [];
    if (settings.allowVideo) allowedSources.push(TrackSource.CAMERA);
    if (settings.allowMic && !roomState.mutedUserIds.has(user.userId)) {
      allowedSources.push(TrackSource.MICROPHONE);
    }
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: allowedSources.length > 0,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: allowedSources,
    });
    return {
      serverUrl,
      roomName,
      participantIdentity,
      token: await accessToken.toJwt(),
      isHost,
      settings,
    };
  }
}
