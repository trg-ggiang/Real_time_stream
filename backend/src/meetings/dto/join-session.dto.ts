import { IsIn, IsOptional, IsUUID } from 'class-validator';

const deviceJoinModes = ['add', 'transfer'] as const;
export type DeviceJoinMode = typeof deviceJoinModes[number];

export class JoinSessionDto {
  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsIn(deviceJoinModes)
  deviceMode?: DeviceJoinMode;
}
