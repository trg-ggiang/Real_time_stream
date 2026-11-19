import { ArgumentsHost, Body, CallHandler, Catch, Controller, Delete, ExceptionFilter, ExecutionContext, Get, Header, Injectable, NestInterceptor, Param, ParseUUIDPipe, Patch, PayloadTooLargeException, Post, Put, Query, UploadedFile, UseFilters, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompleteProfileGuard } from "../users/complete-profile.guard";
import { User } from "../users/entities/user.entity";
import { ApplicationPage, BulkDecisionDto, CampaignDto, DecisionDto, FilePurposeDto, RecruitmentPage, RecruitingDepartmentDto, SaveFormDto, SubmitApplicationDto, VersionDto } from "./recruitment.dto";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentFiles, UploadedRecruitmentFile } from "./recruitment-files.service";
import { FILE_LIMIT } from "./recruitment-validation";

@Catch(PayloadTooLargeException)
class RecruitmentUploadLimitFilter implements ExceptionFilter {
  catch(_error: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(413).json({ code: "FILE_TOO_LARGE", message: "File vượt quá dung lượng cho phép (tối đa 5 MB)." });
  }
}

@Injectable()
class PrivateRecruitmentResponse implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse().setHeader("Cache-Control", "private, no-store");
    return next.handle();
  }
}

@Controller("public/recruitments")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PublicRecruitmentController {
  constructor(private readonly service: RecruitmentService) {}
  @Get() list(@Query() q: RecruitmentPage) { return this.service.publicList(q); }
  @Get(":id") detail(@Param("id", ParseUUIDPipe) id: string) { return this.service.publicDetail(id); }
}

@Controller("workspace/:clubId/recruitments")
@UseGuards(JwtAuthGuard, CompleteProfileGuard, ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@UseInterceptors(PrivateRecruitmentResponse)
export class RecruitmentManagementController {
  constructor(private readonly service: RecruitmentService) {}
  @Get() list(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Query() q: RecruitmentPage) { return this.service.managedList(u.userId, c, q); }
  @Post() create(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Body() b: CampaignDto) { return this.service.saveCampaign(u.userId, c, b); }
  @Get(":id") detail(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string) { return this.service.managedDetail(u.userId, c, id); }
  @Patch(":id") update(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Body() b: CampaignDto) { return this.service.saveCampaign(u.userId, c, b, id); }
  @Delete(":id") archive(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Body() b: VersionDto) { return this.service.campaignAction(u.userId, c, id, b.expected_updated_at, "archive"); }
  @Post(":id/publish") publish(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Body() b: VersionDto) { return this.service.campaignAction(u.userId, c, id, b.expected_updated_at, "open"); }
  @Post(":id/close") close(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Body() b: VersionDto) { return this.service.campaignAction(u.userId, c, id, b.expected_updated_at, "close"); }
  @Post(":id/departments") department(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Body() b: RecruitingDepartmentDto) { return this.service.addDepartment(u.userId, c, id, b); }
  @Put(":id/departments/:departmentId/form") form(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Param("departmentId", ParseUUIDPipe) d: string, @Body() b: SaveFormDto) { return this.service.saveForm(u.userId, c, id, d, b); }
  @Get(":id/applications") applications(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Query() q: ApplicationPage) { return this.service.applications(u.userId, c, id, q); }
  @Get(":id/applications/export.csv") @Header("Content-Type", "text/csv; charset=utf-8") @Header("Content-Disposition", 'attachment; filename="recruitment-applications.csv"')
  export(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Query() q: ApplicationPage) { return this.service.exportCsv(u.userId, c, id, q); }
  @Get(":id/applications/:applicationId") application(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Param("applicationId", ParseUUIDPipe) a: string) { return this.service.applicationDetail(u.userId, a, { club: c, campaign: id }); }
  @Patch(":id/applications/:applicationId/decision") decision(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Param("applicationId", ParseUUIDPipe) a: string, @Body() b: DecisionDto) { return this.service.decide(u.userId, c, id, a, b); }
  @Post(":id/applications/bulk-decision") bulk(@CurrentUser() u: User, @Param("clubId", ParseUUIDPipe) c: string, @Param("id", ParseUUIDPipe) id: string, @Body() b: BulkDecisionDto) { return this.service.bulkDecision(u.userId, c, id, b); }
}

@Controller()
@UseGuards(JwtAuthGuard, CompleteProfileGuard, ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(PrivateRecruitmentResponse)
export class RecruitmentApplicationsController {
  constructor(private readonly service: RecruitmentService, private readonly files: RecruitmentFiles) {}
  @Get("recruitments/:id/application-context") context(@CurrentUser() u: User, @Param("id", ParseUUIDPipe) id: string) { return this.service.applicationContext(u.userId, id); }
  @Post("recruitments/:id/applications") @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(@CurrentUser() u: User, @Param("id", ParseUUIDPipe) id: string, @Body() b: SubmitApplicationDto) { return this.service.submit(u.userId, id, b); }
  @Get("me/recruitment-applications") mine(@CurrentUser() u: User, @Query() q: ApplicationPage) { return this.service.mine(u.userId, q); }
  @Get("me/recruitment-applications/:id") detail(@CurrentUser() u: User, @Param("id", ParseUUIDPipe) id: string) { return this.service.applicationDetail(u.userId, id); }
  @Post("recruitments/:id/files") @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseFilters(RecruitmentUploadLimitFilter)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: FILE_LIMIT, files: 1, fields: 4 } }))
  upload(@CurrentUser() u: User, @Param("id", ParseUUIDPipe) id: string, @Body() b: FilePurposeDto, @UploadedFile() file: UploadedRecruitmentFile) { return this.files.upload(u.userId, id, b, file); }
  @Get("recruitment-files/:id/download") download(@CurrentUser() u: User, @Param("id", ParseUUIDPipe) id: string) { return this.files.download(u.userId, id); }
}
