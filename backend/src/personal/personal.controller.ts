import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CompleteProfileGuard } from "../users/complete-profile.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { PersonalService } from "./personal.service";
class PersonalPage {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(24) limit = 12;
}
@Controller("me")
@UseGuards(JwtAuthGuard, CompleteProfileGuard)
export class PersonalController {
  constructor(private readonly personal: PersonalService) {}
  @Get("clubs")
  @Header("Cache-Control", "private, no-store")
  clubs(@CurrentUser() user: User, @Query() q: PersonalPage) {
    return this.personal.clubs(user.userId, q.page, q.limit);
  }
  @Get("follows")
  @Header("Cache-Control", "private, no-store")
  follows(@CurrentUser() user: User, @Query() q: PersonalPage) {
    return this.personal.follows(user.userId, q.page, q.limit);
  }
  @Get("follows/:id")
  @Header("Cache-Control", "private, no-store")
  following(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.personal.following(user.userId, id);
  }
  @Put("follows/:id")
  follow(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.personal.follow(user.userId, id);
  }
  @Delete("follows/:id")
  unfollow(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.personal.unfollow(user.userId, id);
  }
  @Get("registrations")
  @Header("Cache-Control", "private, no-store")
  registrations(@CurrentUser() user: User, @Query() q: PersonalPage) {
    return this.personal.registrations(user.userId, q.page, q.limit);
  }
  @Get("registrations/:id")
  @Header("Cache-Control", "private, no-store")
  registration(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.personal.registration(user.userId, id);
  }
  @Put("registrations/:id")
  register(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.personal.register(user.userId, id);
  }
  @Delete("registrations/:id")
  cancel(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.personal.cancel(user.userId, id);
  }
  @Get("club-requests")
  @Header("Cache-Control", "private, no-store")
  requests(@CurrentUser() user: User, @Query() q: PersonalPage) {
    return this.personal.requests(user.userId, q.page, q.limit);
  }
  @Get("club-requests/:id")
  @Header("Cache-Control", "private, no-store")
  request(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.personal.request(user.userId, id);
  }
}
