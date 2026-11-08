import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Header('Cache-Control', 'no-store')
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.register(dto);
    this.setSessionCookie(response, session.access_token);
    return { user: session.user };
  }

  @Header('Cache-Control', 'no-store')
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(dto);
    this.setSessionCookie(response, session.access_token);
    return { user: session.user };
  }

  @Header('Cache-Control', 'no-store')
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('rts_session', this.cookieOptions());
  }

  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie('rts_session', token, {
      ...this.cookieOptions(),
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
