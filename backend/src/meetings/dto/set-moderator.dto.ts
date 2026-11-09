import { IsBoolean } from 'class-validator';

export class SetModeratorDto {
  @IsBoolean()
  enabled!: boolean;
}
