import { Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LivekitService } from './livekit.service';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekit: LivekitService) {}

  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  createToken(@CurrentUser() user: User) {
    // Room and identity are server-controlled; ignore client-supplied grants.
    return this.livekit.createJoinCredentials(user);
  }
}
