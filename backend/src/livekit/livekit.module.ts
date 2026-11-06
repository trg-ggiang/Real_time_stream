import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';

@Module({ imports: [AuthModule], controllers: [LivekitController], providers: [LivekitService] })
export class LivekitModule {}
