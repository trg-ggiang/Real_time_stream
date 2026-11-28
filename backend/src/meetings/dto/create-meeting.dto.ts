import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsOptional() @IsUUID() clubId?: string;
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsBoolean()
  waitingRoomEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowEarlyJoin?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recurrenceRule?: string | null;
}

export class CreateQuickMeetingDto {
  @IsOptional() @IsUUID() clubId?: string;
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsBoolean()
  waitingRoomEnabled?: boolean;
}
