import { Controller, Header, HttpCode, Post, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LivekitService } from './livekit.service';
import { CompleteProfileGuard } from '../users/complete-profile.guard';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekit: LivekitService) {}

  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, ThrottlerGuard, CompleteProfileGuard)
  createToken(@CurrentUser() user: User, @Query('sessionId', new ParseUUIDPipe({ optional: true })) sessionId?: string) {
    // Room and identity are server-controlled; ignore client-supplied grants.
    return this.livekit.createJoinCredentials(user, sessionId);
  }
}
