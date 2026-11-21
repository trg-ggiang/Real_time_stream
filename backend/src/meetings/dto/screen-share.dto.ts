import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class ScreenShareDecisionDto {
  @IsString()
  @MaxLength(200)
  identity!: string;

  @IsBoolean()
  approved!: boolean;
}
