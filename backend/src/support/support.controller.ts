import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { SupportService } from './support.service';
import { CreateSupportReport, SupportReportQuery, UpdateSupportReport } from './support.dto';

@Controller('support/reports')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60000 } })
export class SupportController {
  constructor(private readonly service: SupportService) {}
  @Post() @Throttle({ default: { limit: 5, ttl: 60000, getTracker: request => request.user.userId } })
  create(@CurrentUser() user: User, @Body() body: CreateSupportReport) { return this.service.create(user, body); }
  @Get() @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: User, @Query() query: SupportReportQuery) { return this.service.list(user, query); }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) { return this.service.detail(user, id); }
}

@Controller('admin/support-reports')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60000 } })
export class AdminSupportController {
  constructor(private readonly service: SupportService) {}
  @Get() @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: User, @Query() query: SupportReportQuery) { return this.service.list(user, query, true); }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) { return this.service.detail(user, id, true); }
  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSupportReport) {
    return this.service.update(user, id, body);
  }
}
