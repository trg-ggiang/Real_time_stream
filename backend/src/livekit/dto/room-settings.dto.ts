import { IsBoolean } from 'class-validator';

export class RoomSettingsDto {
  @IsBoolean()
  allowMic!: boolean;

  @IsBoolean()
  allowVideo!: boolean;

  @IsBoolean()
  waitingRoom!: boolean;
}
