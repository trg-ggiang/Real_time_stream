import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/environment';
import { HealthController } from './health.controller';
import { LivekitModule } from './livekit/livekit.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    LivekitModule,
    MeetingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
