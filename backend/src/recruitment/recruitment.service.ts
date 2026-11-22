import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { WorkspaceAccess } from '../workspace/workspace-access.service';
import { ApplicationInput, CampaignInput, DecisionInput, ManagedRecruitmentQuery, RecruitmentQuery } from './recruitment.dto';
import { validateAnswers,validateQuestions } from './recruitment.validation';
@Injectable()
export class RecruitmentService {
 constructor(readonly supabase:SupabaseService,private readonly users:UsersService,private readonly access:WorkspaceAccess){}
 get db(){return this.supabase.client;}
 check(error:{code?:string;message?:string}|null){
  if(!error)return;
  if(error.code==='42501')throw new ForbiddenException('Bạn không có quyền quản lý đơn hoặc đợt tuyển này.');
  if(error.code==='P0002')throw new NotFoundException('Không tìm thấy nội dung.');
  if(error.code==='40001')throw new ConflictException({code:error.message==='FORM_CHANGED'?'FORM_CHANGED':'DATA_CHANGED',message:'Dữ liệu hoặc trạng thái đã thay đổi. Tải lại trước khi thử tiếp.'});
  if(error.code==='23505')throw new ConflictException('Bạn đã nộp đơn, đã là thành viên hoặc dữ liệu bị trùng.');
  if(error.code==='22023'&&error.message==='Recruitment deadline passed')throw new BadRequestException('Hạn nhận đơn đã qua. Hãy đưa đợt tuyển về bản nháp để chỉnh lại thời gian.');
  if(['22023','23514','P0001','23503'].includes(error.code||''))throw new BadRequestException('Chưa đáp ứng điều kiện: kiểm tra thời gian, ban, biểu mẫu và trạng thái hiện tại.');
  throw new ServiceUnavailableException('Tuyển thành viên chưa sẵn sàng. Kiểm tra migration hoặc thử lại sau.');
 }
 async rpc(name:string,args:Record<string,unknown>){const r=await this.db.rpc(name,args);this.check(r.error);return Array.isArray(r.data)?r.data[0]:r.data;}
 private page(r:any,q:RecruitmentQuery){this.check(r.error);return {items:r.data||[],total:r.count||0,page:q.page,hasMore:q.page*q.limit<(r.count||0)};}
 async publicList(q:RecruitmentQuery){const b=this.db.from('public_recruitment_campaigns').select('*',{count:'exact'});if(q.club_id)b.eq('club_id',q.club_id);if(q.q)b.ilike('title',`%${q.q.replace(/[%_\\]/g,' ')}%`);return this.page(await b.order('created_at',{ascending:false}).order('campaign_id').range((q.page-1)*q.limit,q.page*q.limit-1),q);}
 async campaign(id:string,club?:string){const b=this.db.from('recruitment_campaigns').select('*').eq('campaign_id',id);if(club)b.eq('club_id',club);const r=await b.maybeSingle();this.check(r.error);if(!r.data)throw new NotFoundException('Không tìm thấy đợt tuyển.');return r.data;}
 async questions(version:string|null){if(!version)return [];const r=await this.db.from('recruitment_questions').select('question_id,field_id,question_text,help_text,question_type,is_required,options,validation,profile_field,sort_order').eq('form_version_id',version).order('sort_order');this.check(r.error);return r.data||[];}
 async detail(id:string,scope?:{actor:string;club:string}){
  let item:any;
  if(scope){const ctx=await this.access.require(scope.actor,scope.club);if(!['chairperson','head'].includes(ctx.membership.role))throw new ForbiddenException();item=await this.campaign(id,scope.club);}else{const r=await this.db.from('public_recruitment_campaigns').select('*').eq('campaign_id',id).maybeSingle();this.check(r.error);if(!r.data)throw new NotFoundException('Đợt tuyển chưa được đăng hoặc không còn công khai.');item=r.data;}
  const departments=this.db.from('recruitment_departments').select('recruitment_department_id,department_id,description,current_form_version_id,club_departments!inner(name,status)').eq('campaign_id',id);
  if(!scope)departments.eq('club_departments.status','active');
  const r=await departments.order('created_at');this.check(r.error);
  return {item,departments:await Promise.all((r.data||[]).map(async d=>({...d,questions:await this.questions(d.current_form_version_id)})))};
 }
 async managed(actor:string,club:string,q:ManagedRecruitmentQuery){
  const ctx=await this.access.require(actor,club);
  if(!['chairperson','head'].includes(ctx.membership.role))throw new ForbiddenException();
  const now=new Date().toISOString();
  const query=this.db.from('recruitment_campaigns').select('*',{count:'exact'}).eq('club_id',club).is('deleted_at',null);
  if(q.campaign_status==='open')query.eq('status','open').lte('application_opens_at',now).gt('application_closes_at',now);
  if(q.campaign_status==='waiting')query.or(`status.eq.pending_review,and(status.eq.open,application_opens_at.gt.${now},application_closes_at.gt.${now})`);
  if(q.campaign_status==='closed')query.or(`status.in.(closed,completed),and(status.eq.open,application_closes_at.lte.${now})`);
  return this.page(await query.order('application_closes_at',{ascending:true}).order('campaign_id').range((q.page-1)*q.limit,q.page*q.limit-1),q);
 }
 async save(actor:string,club:string,input:CampaignInput,id?:string){await this.access.require(actor,club,true);if(Date.parse(input.application_closes_at)<=Date.parse(input.application_opens_at))throw new BadRequestException('Hạn tuyển phải sau giờ bắt đầu.');if(new Set(input.departments.map(d=>d.department_id)).size!==input.departments.length)throw new BadRequestException('Ban tuyển bị trùng.');for(const d of input.departments)validateQuestions(d.questions);if(id&&!input.expected_updated_at)throw new BadRequestException('Thiếu phiên bản đợt tuyển.');const {expected_updated_at,...values}=input;return {item:await this.rpc('recruitment_v3_save',{p_actor:actor,p_club:club,p_id:id||null,p_expected:expected_updated_at||null,p_input:values})};}
 async reviewCampaign(actor:string,club:string,id:string,expected:string,returnToDraft=false){
  await this.access.require(actor,club,true);
  return {item:await this.rpc('recruitment_v3_review',{p_actor:actor,p_club:club,p_id:id,p_expected:expected,p_return:returnToDraft})};
 }
 async publish(actor:string,club:string,id:string,expected:string,close=false){await this.access.require(actor,club,true);return {item:await this.rpc('recruitment_v3_publish',{p_actor:actor,p_club:club,p_id:id,p_expected:expected,p_close:close})};}
 async context(actor:string,id:string){const detail=await this.detail(id);const [profile,user,app,member]=await Promise.all([this.users.getProfile(actor),this.users.findById(actor),this.db.from('recruitment_applications').select('application_id,status').eq('campaign_id',id).eq('applicant_id',actor).maybeSingle(),this.db.from('club_memberships').select('membership_id').eq('club_id',detail.item.club_id).eq('user_id',actor).eq('status','active').maybeSingle()]);this.check(app.error);this.check(member.error);return {...detail,profile:{...profile,email:user?.email},application:app.data,can_apply:!!detail.item.accepting_applications&&detail.departments.length>0&&!app.data&&!member.data,reason:app.data?'ALREADY_APPLIED':member.data?'ALREADY_MEMBER':!detail.item.accepting_applications?'WINDOW_CLOSED':!detail.departments.length?'NO_ACTIVE_DEPARTMENT':null};}
 async submit(actor:string,id:string,b:ApplicationInput){const d=await this.db.from('recruitment_departments').select('current_form_version_id').eq('campaign_id',id).eq('recruitment_department_id',b.recruitment_department_id).maybeSingle();this.check(d.error);if(d.data?.current_form_version_id!==b.form_version_id)this.check({code:'40001',message:'FORM_CHANGED'});validateAnswers(await this.questions(b.form_version_id),b.answers);return {item:await this.rpc('recruitment_v3_submit',{p_actor:actor,p_campaign:id,p_department:b.recruitment_department_id,p_version:b.form_version_id,p_answers:b.answers.map(a=>({question_id:a.question_id,value:a.value??null}))})};}
 async reviewer(actor:string,club:string,campaign:string){const ctx=await this.access.require(actor,club);await this.campaign(campaign,club);if(!['chairperson','head'].includes(ctx.membership.role))throw new ForbiddenException('Chỉ chủ nhiệm và trưởng ban được xem đơn.');return ctx;}
 async applications(actor:string,club:string,campaign:string,q:RecruitmentQuery){const ctx=await this.reviewer(actor,club,campaign);const ds=await this.db.from('recruitment_departments').select('recruitment_department_id').eq('campaign_id',campaign).eq('department_id',ctx.membership.department_id);this.check(ds.error);const b=this.db.from('recruitment_applications').select('application_id,campaign_id,recruitment_department_id,status,profile_snapshot,submitted_at,result_message,updated_at',{count:'exact'}).eq('campaign_id',campaign).in('status',q.status==='all'?['submitted','interviewing','accepted','rejected']:q.status==='submitted'?['submitted','interviewing']:[q.status]);if(ctx.membership.role==='head')b.in('recruitment_department_id',(ds.data||[]).map(d=>d.recruitment_department_id));return this.page(await b.order('submitted_at',{ascending:false}).order('application_id').range((q.page-1)*q.limit,q.page*q.limit-1),q);}
 async application(actor:string,id:string,scope?:{club:string;campaign:string}){
  const b=this.db.from('recruitment_applications').select('*').eq('application_id',id);if(!scope)b.eq('applicant_id',actor);else{await this.reviewer(actor,scope.club,scope.campaign);b.eq('campaign_id',scope.campaign);}
  const r=await b.maybeSingle();this.check(r.error);if(!r.data)throw new NotFoundException('Không tìm thấy đơn của bạn.');
  const dept=await this.db.from('recruitment_departments').select('department_id,club_departments(name)').eq('recruitment_department_id',r.data.recruitment_department_id).single();this.check(dept.error);
  if(scope){const ctx=await this.access.require(actor,scope.club);if(ctx.membership.role==='head'&&ctx.membership.department_id!==dept.data!.department_id)throw new ForbiddenException('Đơn không thuộc ban bạn phụ trách.');}
  const [questions,answers,files]=await Promise.all([this.questions(r.data.form_version_id),this.db.from('application_answers').select('question_id,answer_value').eq('application_id',id),this.db.from('recruitment_files').select('file_id,file_name,question_id,size_bytes').eq('application_id',id).eq('state','attached')]);this.check(answers.error);this.check(files.error);
  return {item:r.data,department:dept.data,questions,answers:answers.data||[],files:files.data||[]};
 }
 async mine(actor:string,q:RecruitmentQuery){return this.page(await this.db.from('recruitment_applications').select('application_id,campaign_id,status,result_message,submitted_at,recruitment_campaigns(title,club_id)',{count:'exact'}).eq('applicant_id',actor).in('status',['submitted','interviewing','accepted','rejected']).order('submitted_at',{ascending:false}).order('application_id').range((q.page-1)*q.limit,q.page*q.limit-1),q);}
 async decide(actor:string,club:string,campaign:string,id:string,b:DecisionInput){await this.application(actor,id,{club,campaign});return {item:await this.rpc('recruitment_v3_decide',{p_actor:actor,p_club:club,p_campaign:campaign,p_application:id,p_expected:b.expected_updated_at,p_approve:b.approve,p_reason:b.reason?.trim()||null})};}
}
