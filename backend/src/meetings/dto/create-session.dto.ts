import { IsDateString } from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  scheduledStartAt!: string;

  @IsDateString()
  scheduledEndAt!: string;
}
