import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AdminService } from "../admin/admin.service";
import { AdminDecisionDto } from "../admin/admin.dto";
import { PublicContentService } from "./public-content.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { CreateClubDto } from "./create-club.dto";
import { CompleteProfileGuard } from "../users/complete-profile.guard";

export class PublicPageQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit = 12;
}

export class DiscoveryQuery extends PublicPageQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(["all", "upcoming", "past"]) period?:
    "all" | "upcoming" | "past";
}

export class AdminClubsQuery extends PublicPageQuery {
  @IsOptional()
  @IsIn(["all", "pending", "approved", "rejected"])
  status: "all" | "pending" | "approved" | "rejected" = "all";
  @IsOptional() @IsString() @MaxLength(100) search = "";
}

@Controller("public")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PublicContentController {
  constructor(
    private readonly content: PublicContentService,
    private readonly admin: AdminService,
  ) {}
  @Get("clubs") clubs(@Query() query: DiscoveryQuery) {
    return this.content.list("clubs", query.page, query.limit, query);
  }
  @Get("activities") activities(@Query() query: DiscoveryQuery) {
    return this.content.list("activities", query.page, query.limit, query);
  }
  @Get("posts") posts(@Query() query: DiscoveryQuery) {
    return this.content.list("posts", query.page, query.limit, query);
  }

  @Post("clubs")
  @UseGuards(JwtAuthGuard, CompleteProfileGuard)
  createClub(@CurrentUser() user: User, @Body() dto: CreateClubDto) {
    return this.content.createClub(user.userId, dto);
  }

  @Get("clubs/mine")
  @UseGuards(JwtAuthGuard)
  myClubRequests(@CurrentUser() user: User) {
    return this.content.listMyClubRequests(user.userId);
  }

  // Compatibility URLs use the same guarded service; no membership provisioning here.
  @Get("admin/clubs")
  @Header("Cache-Control", "private, no-store")
  @UseGuards(JwtAuthGuard, CompleteProfileGuard)
  listAdminClubs(@CurrentUser() user: User, @Query() query: AdminClubsQuery) {
    return this.admin.list(user, {
      page: query.page,
      limit: query.limit,
      status: query.status === "approved" ? "published" : query.status,
      q: query.search,
      scope: "requests",
    });
  }
  @Patch("admin/clubs/:clubId/reject")
  @UseGuards(JwtAuthGuard, CompleteProfileGuard)
  rejectClub(
    @CurrentUser() user: User,
    @Param("clubId", ParseUUIDPipe) id: string,
    @Body() body: AdminDecisionDto,
  ) {
    return this.admin.decide(user, id, { ...body, decision: "reject" });
  }
  @Patch("admin/clubs/:clubId/approve")
  @UseGuards(JwtAuthGuard, CompleteProfileGuard)
  approveClub(
    @CurrentUser() user: User,
    @Param("clubId", ParseUUIDPipe) id: string,
    @Body() body: AdminDecisionDto,
  ) {
    return this.admin.decide(user, id, { ...body, decision: "approve" });
  }

  @Get("clubs/:id") club(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.detail("clubs", id);
  }
  @Get("activities/:id") activity(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.detail("activities", id);
  }
  @Get("posts/:id") post(@Param("id", ParseUUIDPipe) id: string) {
    return this.content.detail("posts", id);
  }
}
