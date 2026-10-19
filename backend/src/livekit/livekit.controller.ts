import { Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LivekitService } from './livekit.service';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekit: LivekitService) {}

  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  createToken() {
    // Room and identity are server-controlled; ignore client-supplied grants.
    return this.livekit.createJoinCredentials();
  }
}
