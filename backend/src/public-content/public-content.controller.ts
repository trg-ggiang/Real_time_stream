import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicContentService } from './public-content.service';

export class PublicPageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(24)
  limit = 12;
}

@Controller('public')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PublicContentController {
  constructor(private readonly content: PublicContentService) {}
  @Get('clubs') clubs(@Query() query: PublicPageQuery) { return this.content.list('clubs', query.page, query.limit); }
  @Get('activities') activities(@Query() query: PublicPageQuery) { return this.content.list('activities', query.page, query.limit); }
  @Get('posts') posts(@Query() query: PublicPageQuery) { return this.content.list('posts', query.page, query.limit); }
}
