import { IsBoolean } from 'class-validator';

export class MeetingSettingsDto {
  @IsBoolean()
  waitingRoomEnabled!: boolean;
}
