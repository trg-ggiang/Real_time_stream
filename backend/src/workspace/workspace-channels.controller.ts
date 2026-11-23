import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompleteProfileGuard } from '../users/complete-profile.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { WorkspaceChannels } from './workspace-channels.service';
import { attachmentByteLimit, attachmentCountLimit, type ChannelUpload } from './channel-attachments';

export class ChannelHistoryQuery {
  @IsOptional() @IsISO8601() before?: string;
  @IsOptional() @IsUUID() before_id?: string;
  @IsOptional() @IsString() @MaxLength(1849) ids?: string;
}
export class ChannelMessageDto {
  @IsUUID('4') client_message_id!: string;
  @IsString() @MinLength(1) @MaxLength(4000) content!: string;
}
class ChannelReadDto { @IsUUID() message_id!: string; }
class ChannelMessageActionDto {
  @IsIn(['edit', 'hide', 'recall']) action!: 'edit' | 'hide' | 'recall';
  @IsOptional() @IsString() @MaxLength(4000) content?: string;
}
class ChannelFileMessageDto {
  @IsUUID('4') client_message_id!: string;
  @IsString() @MaxLength(4000) content!: string;
}
class ChannelAttachmentQuery {
  @IsOptional() @IsIn(['preview', 'download']) mode?: 'preview' | 'download';
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
    return this.channels.history(u.userId, clubId, channelId, q.before, q.before_id, q.ids);
  }
  @Patch(':channelId/messages/:messageId')
  changeMessage(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string, @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: ChannelMessageActionDto) {
    return this.channels.changeMessage(u.userId, clubId, channelId, messageId, body);
  }
  @Post(':channelId/messages') send(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string, @Body() body: ChannelMessageDto) {
    return this.channels.send(u.userId, clubId, channelId, body);
  }
  @Post(':channelId/read') read(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string, @Body() body: ChannelReadDto) {
    return this.channels.markRead(u.userId, clubId, channelId, body.message_id);
  }

  @Post(':channelId/messages/attachments')
  @UseInterceptors(FilesInterceptor('files', attachmentCountLimit, {
    defParamCharset: 'utf8',
    limits: { files: attachmentCountLimit, fileSize: attachmentByteLimit + 1, fields: 2, fieldSize: 16000 },
  }))
  sendWithAttachments(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string, @Body() body: ChannelFileMessageDto,
    @UploadedFiles() files: ChannelUpload[] = []) {
    return this.channels.sendWithAttachments(u.userId, clubId, channelId, body, files);
  }

  @Get(':channelId/attachments/:attachmentId')
  @Header('Cache-Control', 'private, no-store')
  attachment(@CurrentUser() u: User, @Param('clubId', ParseUUIDPipe) clubId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string, @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Query() q: ChannelAttachmentQuery) {
    return this.channels.attachmentUrl(u.userId, clubId, channelId, attachmentId, q.mode === 'preview');
  }
}
