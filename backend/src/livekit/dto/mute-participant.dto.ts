import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class MuteParticipantDto {
  @IsString()
  @IsNotEmpty()
  participantIdentity!: string;

  @IsBoolean()
  muted!: boolean;
}
