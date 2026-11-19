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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { WorkspaceRecruitment } from "./workspace-recruitment.service";
import { PublishRecruitmentDto, RecruitmentApplicationReviewDto } from "./recruitment.dto";
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
  MemberSearchQuery,
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
    private readonly recruitment: WorkspaceRecruitment,
  ) {}
  @Get("recruitment") @Header("Cache-Control", "private, no-store") recruitmentList(
    @CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Query() q: ContentQuery,
  ) { return this.recruitment.list(u.userId, c, q.list, q.page, q.limit); }
  @Get("recruitment/:id") @Header("Cache-Control", "private, no-store") recruitmentDetail(
    @CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string,
  ) { return this.recruitment.detail(u.userId, c, id); }
  @Get("recruitment/applications/:id") @Header("Cache-Control", "private, no-store") applicationReviewDetail(
    @CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string,
  ) { return this.recruitment.applicationReviewDetail(u.userId, c, id); }
  @Patch("recruitment/applications/:id/review") reviewRecruitmentApplication(
    @CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string,
    @Body() b: RecruitmentApplicationReviewDto,
  ) { return this.recruitment.reviewApplication(u.userId, c, id, b); }
  @Post("recruitment") publishRecruitment(
    @CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Body() b: PublishRecruitmentDto,
  ) { return this.recruitment.publish(u.userId, c, b); }
  @Post("recruitment-cover")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  recruitmentCover(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number },
  ) { return this.recruitment.cover(u.userId, c, file); }
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
    return this.people.members(u.userId, c, q.page, q.limit, q.department_id);
  }
  @Get("member-candidates") @Header("Cache-Control", "private, no-store") candidates(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Query() q: MemberSearchQuery,
  ) {
    return this.people.candidates(u.userId, c, q.q);
  }
  @Post("members") add(
    @CurrentUser() u: User,
    @Param("clubId", ParseUUIDPipe) c: string,
    @Body() b: AddMemberDto,
  ) {
    return this.people.add(u.userId, c, b.email, b.department_id, b.role);
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
