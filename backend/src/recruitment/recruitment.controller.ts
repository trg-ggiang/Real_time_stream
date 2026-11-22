import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompleteProfileGuard } from '../users/complete-profile.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ApplicationInput,CampaignInput,CampaignVersion,DecisionInput,ManagedRecruitmentQuery,RecruitmentQuery,UploadPurpose } from './recruitment.dto';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentFiles } from './recruitment-files.service';
@Controller('public/recruitments')
@UseGuards(ThrottlerGuard) @Throttle({default:{limit:120,ttl:60000}})
export class PublicRecruitmentController {
 constructor(private readonly s:RecruitmentService){}
 @Get() list(@Query() q:RecruitmentQuery){return this.s.publicList(q);}
 @Get(':id') detail(@Param('id',ParseUUIDPipe) id:string){return this.s.detail(id);}
}
@Controller('workspace/:clubId/recruitments')
@UseGuards(JwtAuthGuard,CompleteProfileGuard,ThrottlerGuard) @Throttle({default:{limit:120,ttl:60000}})
export class ManagedRecruitmentController {
 constructor(private readonly s:RecruitmentService){}
 @Get() @Header('Cache-Control','private, no-store') list(@CurrentUser() u:User,@Param('clubId',ParseUUIDPipe)c:string,@Query()q:ManagedRecruitmentQuery){return this.s.managed(u.userId,c,q);}
 @Post() save(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Body()b:CampaignInput){return this.s.save(u.userId,c,b);}
 @Get(':id') @Header('Cache-Control','private, no-store') detail(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string){return this.s.detail(id,{actor:u.userId,club:c});}
 @Patch(':id') edit(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string,@Body()b:CampaignInput){return this.s.save(u.userId,c,b,id);}
 @Post(':id/publish') publish(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string,@Body()b:CampaignVersion){return this.s.publish(u.userId,c,id,b.expected_updated_at);}
 @Post(':id/close') close(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string,@Body()b:CampaignVersion){return this.s.publish(u.userId,c,id,b.expected_updated_at,true);}
 @Get(':id/applications') @Header('Cache-Control','private, no-store') applications(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string,@Query()q:RecruitmentQuery){return this.s.applications(u.userId,c,id,q);}
 @Get(':id/applications/:app') @Header('Cache-Control','private, no-store') application(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string,@Param('app',ParseUUIDPipe)app:string){return this.s.application(u.userId,app,{club:c,campaign:id});}
 @Patch(':id/applications/:app/decision') decide(@CurrentUser()u:User,@Param('clubId',ParseUUIDPipe)c:string,@Param('id',ParseUUIDPipe)id:string,@Param('app',ParseUUIDPipe)app:string,@Body()b:DecisionInput){return this.s.decide(u.userId,c,id,app,b);}
}
@Controller() @UseGuards(JwtAuthGuard,CompleteProfileGuard,ThrottlerGuard) @Throttle({default:{limit:120,ttl:60000}})
export class ApplicantController {
 constructor(private readonly s:RecruitmentService,private readonly files:RecruitmentFiles){}
 @Get('recruitments/:id/application-context') @Header('Cache-Control','private, no-store') context(@CurrentUser()u:User,@Param('id',ParseUUIDPipe)id:string){return this.s.context(u.userId,id);}
 @Post('recruitments/:id/applications') @Throttle({default:{limit:10,ttl:60000}}) submit(@CurrentUser()u:User,@Param('id',ParseUUIDPipe)id:string,@Body()b:ApplicationInput){return this.s.submit(u.userId,id,b);}
 @Get('me/recruitment-applications') @Header('Cache-Control','private, no-store') mine(@CurrentUser()u:User,@Query()q:RecruitmentQuery){return this.s.mine(u.userId,q);}
 @Get('me/recruitment-applications/:id') @Header('Cache-Control','private, no-store') application(@CurrentUser()u:User,@Param('id',ParseUUIDPipe)id:string){return this.s.application(u.userId,id);}
 @Post('recruitments/:id/files') @Throttle({default:{limit:20,ttl:60000}}) @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5242880,files:1,fields:4}})) upload(@CurrentUser()u:User,@Param('id',ParseUUIDPipe)id:string,@Body()b:UploadPurpose,@UploadedFile()f:any){return this.files.upload(u.userId,id,b,f);}
 @Get('recruitment-files/:id/download') @Header('Cache-Control','private, no-store') download(@CurrentUser()u:User,@Param('id',ParseUUIDPipe)id:string){return this.files.download(u.userId,id);}
}
