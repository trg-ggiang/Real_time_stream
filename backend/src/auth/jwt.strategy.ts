import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Chạy sau khi token hợp lệ; giá trị trả về được gắn vào req.user
  async validate(payload: { sub: string; email: string }) {
    if (typeof payload.sub !== 'string' || !payload.sub) throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
