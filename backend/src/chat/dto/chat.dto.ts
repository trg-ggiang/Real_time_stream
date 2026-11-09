import { Type, plainToInstance } from 'class-transformer';
import { IsISO8601, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested, validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

export class SendMessageDto {
  @IsUUID() clientMessageId!: string;
  @IsString() @MaxLength(2000) @Matches(/\S/u) content!: string;
}
export class CursorDto {
  @IsUUID() id!: string;
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/) createdAt!: string;
}
export class HistoryDto {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CursorDto) before?: CursorDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CursorDto) after?: CursorDto;
}
export class ChatHandshakeDto {
  @IsString() @MaxLength(4096) token!: string;
  @IsUUID() sessionId!: string;
  @IsString() @MaxLength(100) participantIdentity!: string;
}

export async function parseChatDto<T extends object>(type: new () => T, value: unknown): Promise<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Dữ liệu chat không hợp lệ.');
  const dto = plainToInstance(type, value);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
  if (errors.length) throw new BadRequestException('Dữ liệu chat không hợp lệ hoặc nội dung vượt 2.000 ký tự.');
  return dto;
}
