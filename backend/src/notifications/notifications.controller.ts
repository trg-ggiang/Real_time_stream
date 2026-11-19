import { Controller, Get, Header, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsIn, IsInt, Max, Min } from "class-validator";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { NotificationsService } from "./notifications.service";
export class NotificationQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsIn(["all", "unread"]) filter = "all";
}
@Controller("me/notifications")
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60000 } })
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() @Header("Cache-Control", "private, no-store") list(@CurrentUser() user: User, @Query() q: NotificationQuery) { return this.service.list(user.userId, q.page, q.filter === "unread"); }
  @Patch("read-all") @Header("Cache-Control", "private, no-store") readAll(@CurrentUser() user: User) { return this.service.read(user.userId, null); }
  @Patch(":id/read") @Header("Cache-Control", "private, no-store") read(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) { return this.service.read(user.userId, id); }
}
