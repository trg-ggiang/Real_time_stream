import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsBoolean()
  waitingRoomEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recurrenceRule?: string | null;
}

export class CreateQuickMeetingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsBoolean()
  waitingRoomEnabled?: boolean;
}
