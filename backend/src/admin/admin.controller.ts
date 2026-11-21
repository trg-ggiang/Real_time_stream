import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CompleteProfileGuard } from "../users/complete-profile.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { AdminService } from "./admin.service";
import { AdminDecisionDto, AdminListQuery, AdminDirectoryQuery } from "./admin.dto";
@Controller("admin")
@UseGuards(JwtAuthGuard, CompleteProfileGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('users') @Header('Cache-Control', 'private, no-store') users(@CurrentUser() u: User, @Query() q: AdminDirectoryQuery) {
    return this.admin.users(u, q);
  }
  @Get('users/:id') @Header('Cache-Control', 'private, no-store') userDetail(@CurrentUser() u: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.userDetail(u, id);
  }
  @Get('content') @Header('Cache-Control', 'private, no-store') content(@CurrentUser() u: User, @Query() q: AdminDirectoryQuery) {
    return this.admin.content(u, q);
  }
  @Get('content/:kind/:id') @Header('Cache-Control', 'private, no-store') contentDetail(@CurrentUser() u: User, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.contentDetail(u, kind, id);
  }
  @Get("summary") @Header("Cache-Control", "private, no-store") summary(
    @CurrentUser() u: User,
  ) {
    return this.admin.summary(u);
  }
  @Get("clubs") @Header("Cache-Control", "private, no-store") list(
    @CurrentUser() u: User,
    @Query() q: AdminListQuery,
  ) {
    return this.admin.list(u, q);
  }
  @Get("clubs/:id") @Header("Cache-Control", "private, no-store") detail(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.admin.detail(u, id);
  }
  @Patch("clubs/:id/decision") decision(
    @CurrentUser() u: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AdminDecisionDto,
  ) {
    return this.admin.decide(u, id, body);
  }
}
