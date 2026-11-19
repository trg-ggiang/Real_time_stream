import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompleteProfileGuard } from '../users/complete-profile.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { WorkspaceChannels } from './workspace-channels.service';

export class ChannelHistoryQuery {
  @IsOptional() @IsISO8601() before?: string;
  @IsOptional() @IsUUID() before_id?: string;
}
export class ChannelMessageDto {
  @IsUUID('4') client_message_id!: string;
  @IsString() @MinLength(1) @MaxLength(4000) content!: string;
}
@Controller('workspace/:clubId/channels')
@UseGuards(JwtAuthGuard, CompleteProfileGuard)
export class WorkspaceChannelsController {
  constructor(private readonly channels: WorkspaceChannels) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string) {
    return this.channels.list(u.userId, clubId);
  }
  @Get(':channelId/messages') @Header('Cache-Control', 'private, no-store') history(@CurrentUser() u: User,
    @Param('clubId', ParseUUIDPipe) clubId: string, @Param('channelId', ParseUUIDPipe) channelId: string, @Query() q: ChannelHistoryQuery) {
    return this.channels.history(u.userId, clubId, channelId, q.before, q.before_id);
  }
  @Post(':channelId/messages') send(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string, @Body() body: ChannelMessageDto) {
    return this.channels.send(u.userId, clubId, channelId, body);
  }
}
