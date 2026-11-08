import {
  Controller,
  Body,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LivekitService } from './livekit.service';
import { RoomSettingsDto } from './dto/room-settings.dto';
import { MuteParticipantDto } from './dto/mute-participant.dto';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekit: LivekitService) {}

  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  createToken(@CurrentUser() user: User) {
    // Room and identity are server-controlled; ignore client-supplied grants.
    return this.livekit.createJoinCredentials(user);
  }

  @Post('rooms/:roomId/token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  createRoomToken(
    @CurrentUser() user: User,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
  ) {
    return this.livekit.createJoinCredentials(user, roomId);
  }

  @Post('rooms/:roomId/settings')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  async createRoom(
    @CurrentUser() user: User,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Body() settings: RoomSettingsDto,
  ) {
    await this.livekit.createRoom(user, roomId, settings);
    return { created: true };
  }

  @Get('rooms/:roomId/waiting')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  getWaitingParticipants(
    @CurrentUser() user: User,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
  ) {
    return this.livekit.getWaitingParticipants(user, roomId);
  }

  @Post('rooms/:roomId/waiting/:participantUserId/approve')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  approveParticipant(
    @CurrentUser() user: User,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Param('participantUserId') participantUserId: string,
  ) {
    this.livekit.approveParticipant(user, roomId, participantUserId);
    return { approved: true };
  }

  @Post('rooms/:roomId/participants/mute-microphone')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  async muteParticipantMicrophone(
    @CurrentUser() user: User,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Body() dto: MuteParticipantDto,
  ) {
    await this.livekit.muteParticipantMicrophone(
      user,
      roomId,
      dto.participantIdentity,
      dto.muted,
    );
    return { muted: dto.muted };
  }
}
