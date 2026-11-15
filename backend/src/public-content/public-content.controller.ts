import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicContentService } from './public-content.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateClubDto } from './create-club.dto';

export class PublicPageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(24)
  limit = 12;
}

export class AdminClubsQuery {
  @IsOptional() @IsIn(['all', 'pending', 'approved', 'rejected'])
  status: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  @IsOptional() @IsString() @MaxLength(100) search = '';
}

@Controller('public')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PublicContentController {
  constructor(private readonly content: PublicContentService) {}
  @Get('clubs') clubs(@Query() query: PublicPageQuery) { return this.content.list('clubs', query.page, query.limit); }
  @Get('activities') activities(@Query() query: PublicPageQuery) { return this.content.list('activities', query.page, query.limit); }
  @Get('posts') posts(@Query() query: PublicPageQuery) { return this.content.list('posts', query.page, query.limit); }

  @Post('clubs')
  @UseGuards(JwtAuthGuard)
  createClub(@CurrentUser() user: User, @Body() dto: CreateClubDto) {
    return this.content.createClub(user.userId, dto);
  }

  @Get('clubs/mine')
  @UseGuards(JwtAuthGuard)
  myClubRequests(@CurrentUser() user: User) {
    return this.content.listMyClubRequests(user.userId);
  }

  @Get('admin/clubs')
  @UseGuards(JwtAuthGuard)
  listAdminClubs(@CurrentUser() user: User, @Query() query: AdminClubsQuery) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin access is required.');
    return this.content.listAdminClubs(query.status || 'all', query.search || '');
  }

  @Patch('admin/clubs/:clubId/reject')
  @UseGuards(JwtAuthGuard)
  rejectClub(@CurrentUser() user: User, @Param('clubId') clubId: string) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin access is required.');
    return this.content.rejectClub(clubId, user.userId);
  }

  @Patch('admin/clubs/:clubId/approve')
  @UseGuards(JwtAuthGuard)
  approveClub(@CurrentUser() user: User, @Param('clubId') clubId: string) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin access is required.');
    return this.content.approveClub(clubId, user.userId);
  }
}
