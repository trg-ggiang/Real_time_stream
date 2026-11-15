import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.users.getProfile(user.userId);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }
}
