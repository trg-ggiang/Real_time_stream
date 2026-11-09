import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/environment';
import { HealthController } from './health.controller';
import { LivekitModule } from './livekit/livekit.module';
import { ChatModule } from './chat/chat.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    SupabaseModule,
    AuthModule,
    LivekitModule,
    ChatModule,
    MeetingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
