import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { RecruitmentRepository } from "./recruitment.repository";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentFiles } from "./recruitment-files.service";
import { PublicRecruitmentController, RecruitmentApplicationsController, RecruitmentManagementController } from "./recruitment.controller";

@Module({
  imports: [AuthModule, UsersModule],
  providers: [RecruitmentRepository, RecruitmentService, RecruitmentFiles],
  controllers: [PublicRecruitmentController, RecruitmentManagementController, RecruitmentApplicationsController],
})
export class RecruitmentModule {}
