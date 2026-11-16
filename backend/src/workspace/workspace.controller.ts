import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CompleteProfileGuard } from "../users/complete-profile.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { WorkspaceAccess } from "./workspace-access.service";
import { WorkspacePeople } from "./workspace-people.service";
import { WorkspaceContent, WorkspaceKind } from "./workspace-content.service";
import {
  ActivityDraftDto,
  AddMemberDto,
  ContactDto,
  ContentQuery,
  ContentVersion,
  DepartmentDto,
  MoveMemberDto,
  PostDraftDto,
  ReviewDto,
  TransferDto,
  WorkspacePage,
} from "./workspace.dto";
enum Kind {
  posts = "posts",
  activities = "activities",
}
@Controller("workspace/:clubId")
@UseGuards(JwtAuthGuard, CompleteProfileGuard)
export class WorkspaceController {
  constructor(
    private readonly access: WorkspaceAccess,
    private readonly people: WorkspacePeople,
    private readonly content: WorkspaceContent,
  ) {}
  @Get() @Header("Cache-Control", "private, no-store") context(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
  ) {
    return this.access.require(u.userId, c);
  }
  @Get("departments") @Header("Cache-Control", "private, no-store") departments(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
  ) {
    return this.people.departments(u.userId, c);
  }
  @Post("departments") department(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: DepartmentDto,
  ) {
    return this.people.saveDepartment(u.userId, c, b);
  }
  @Patch("departments/:id") editDepartment(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: DepartmentDto,
  ) {
    return this.people.saveDepartment(u.userId, c, b, id);
  }
  @Get("members") @Header("Cache-Control", "private, no-store") members(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Query() q: WorkspacePage,
  ) {
    return this.people.members(u.userId, c, q.page, q.limit);
  }
  @Post("members") add(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: AddMemberDto,
  ) {
    return this.people.add(u.userId, c, b.email, b.department_id);
  }
  @Patch("members/:id/department") move(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: MoveMemberDto,
  ) {
    return this.people.move(u.userId, c, id, b.department_id);
  }
  @Post("members/:id/remove") remove(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.people.remove(u.userId, c, id);
  }
  @Post("transfer-chair") transfer(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: TransferDto,
  ) {
    return this.people.transfer(u.userId, c, b.membership_id);
  }
  @Patch("contact") contact(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: ContactDto,
  ) {
    return this.people.contact(u.userId, c, b);
  }
  @Get("content/:kind") @Header("Cache-Control", "private, no-store") list(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("kind", new ParseEnumPipe(Kind)) k: WorkspaceKind,
    @Query() q: ContentQuery,
  ) {
    return this.content.list(u.userId, c, k, q.list, q.page, q.limit);
  }
  @Get("content/:kind/:id")
  @Header("Cache-Control", "private, no-store")
  detail(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("kind", new ParseEnumPipe(Kind)) k: WorkspaceKind,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.content.detail(u.userId, c, k, id);
  }
  @Post("posts") post(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: PostDraftDto,
  ) {
    return this.content.save(u.userId, c, "posts", b);
  }
  @Patch("posts/:id") editPost(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: PostDraftDto,
  ) {
    return this.content.save(u.userId, c, "posts", b, id);
  }
  @Post("activities") activity(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: ActivityDraftDto,
  ) {
    return this.content.save(u.userId, c, "activities", b);
  }
  @Patch("activities/:id") editActivity(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: ActivityDraftDto,
  ) {
    return this.content.save(u.userId, c, "activities", b, id);
  }
  @Post("content/:kind/:id/submit") submit(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("kind", new ParseEnumPipe(Kind)) k: WorkspaceKind,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: ContentVersion,
  ) {
    return this.content.submit(u.userId, c, k, id, b.expected_updated_at);
  }
  @Patch("content/:kind/:id/review") review(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Param("kind", new ParseEnumPipe(Kind)) k: WorkspaceKind,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: ReviewDto,
  ) {
    return this.content.review(u.userId, c, k, id, b);
  }
}
