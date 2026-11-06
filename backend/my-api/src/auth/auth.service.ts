import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.users.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email đã được sử dụng');

    let user: User;
    try {
      user = await this.users.create({
        email: dto.email,
        displayName: dto.displayName,
        passwordHash: await bcrypt.hash(dto.password, 10),
      });
    } catch (e: any) {
      // 23505 = vi phạm unique (hai request đăng ký cùng email cùng lúc)
      if ((e?.code ?? e?.driverError?.code) === '23505') {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw e;
    }
    return this.signToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);

    // password_hash có thể NULL (tài khoản không dùng mật khẩu)
    const ok =
      !!user?.passwordHash &&
      (await bcrypt.compare(dto.password, user.passwordHash));

    // Sai email hay sai mật khẩu đều trả cùng một thông báo
    if (!ok || !user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.signToken(user);
  }

  private async signToken(user: User) {
    const payload = { sub: user.userId, email: user.email };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
