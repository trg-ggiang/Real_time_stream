import { Body, Controller, Get, Header, Put, UseGuards } from "@nestjs/common";
import { IsISO8601 } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { HeadNotifications } from "./head-notifications.service";
export class ReadHeadNotifications { @IsISO8601() through!: string; }
@Controller("me/head-notifications")
@UseGuards(JwtAuthGuard)
export class HeadNotificationsController {
  constructor(private readonly service: HeadNotifications) {}
  @Get() @Header("Cache-Control", "private, no-store") list(@CurrentUser() u: User) { return this.service.list(u.userId); }
  @Put("read") @Header("Cache-Control", "private, no-store") read(@CurrentUser() u: User, @Body() b: ReadHeadNotifications) { return this.service.read(u.userId, b.through); }
}
