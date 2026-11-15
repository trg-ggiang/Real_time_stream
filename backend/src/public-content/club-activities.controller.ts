import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PublicPageQuery } from './public-content.controller';
import { ClubActivitiesService, type ActivityList } from './club-activities.service';

class CreateActivityDto {
  @IsUUID('4') activity_id!: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(10) @MaxLength(300) summary!: string;
  @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @IsISO8601({ strict: true }) starts_at!: string;
  @IsISO8601({ strict: true }) ends_at!: string;
  @IsIn(['onsite', 'online', 'hybrid']) format!: 'onsite' | 'online' | 'hybrid';
  @IsOptional() @IsString() @MaxLength(200) location_name?: string;
  @IsOptional() @IsString() @MaxLength(300) location_address?: string;
  @IsOptional() @IsUrl({ protocols: ['https', 'http'], require_protocol: true }) @MaxLength(2048) join_url?: string;
}

class ActivityQuery extends PublicPageQuery {
  @IsIn(['published', 'mine', 'pending_review', 'approved', 'rejected'])
  list: ActivityList = 'published';
}

class RejectActivityDto {
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
}

@Controller('my-clubs')
@UseGuards(JwtAuthGuard)
export class ClubActivitiesController {
  constructor(private readonly activities: ClubActivitiesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  clubs(@CurrentUser() user: User) {
    return this.activities.listClubs(user.userId);
  }

  @Get(':clubId/activities')
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: User, @Param('clubId', ParseUUIDPipe) clubId: string, @Query() query: ActivityQuery) {
    return this.activities.listActivities(user.userId, clubId, query.list, query.page, query.limit);
  }

  @Post(':clubId/activities')
  create(@CurrentUser() user: User, @Param('clubId', ParseUUIDPipe) clubId: string, @Body() input: CreateActivityDto) {
    return this.activities.createActivity(user.userId, clubId, input);
  }

  @Patch(':clubId/activities/:activityId/approve')
  approve(@CurrentUser() user: User, @Param('clubId', ParseUUIDPipe) clubId: string, @Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.activities.reviewActivity(user.userId, clubId, activityId);
  }

  @Patch(':clubId/activities/:activityId/reject')
  reject(@CurrentUser() user: User, @Param('clubId', ParseUUIDPipe) clubId: string, @Param('activityId', ParseUUIDPipe) activityId: string, @Body() input: RejectActivityDto) {
    return this.activities.reviewActivity(user.userId, clubId, activityId, input.reason);
  }
}
