import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WorkspaceAccess } from '../workspace/workspace-access.service';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentFiles } from './recruitment-files.service';
import { PublicRecruitmentController,ManagedRecruitmentController,ApplicantController } from './recruitment.controller';
@Module({imports:[AuthModule,UsersModule],providers:[WorkspaceAccess,RecruitmentService,RecruitmentFiles],controllers:[PublicRecruitmentController,ManagedRecruitmentController,ApplicantController]})
export class RecruitmentModule{}
