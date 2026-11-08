import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

// Dùng: me(@CurrentUser() user: User)
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest().user,
);
