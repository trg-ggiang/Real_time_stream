import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RecruitmentService } from './recruitment.service';
import { UploadPurpose } from './recruitment.dto';
import { sniffMime } from './recruitment.validation';
@Injectable()
export class RecruitmentFiles implements OnModuleInit,OnModuleDestroy {
 private timer?:ReturnType<typeof setInterval>; private busy=false;
 constructor(private readonly service:RecruitmentService){}
 onModuleInit(){this.timer=setInterval(()=>{void this.cleanup().catch(()=>{});},900000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async upload(actor:string,id:string,b:UploadPurpose,f?:{buffer:Buffer;size:number;mimetype:string;originalname:string}){
  if(!f?.buffer?.length||f.size!==f.buffer.length||f.size>5242880)throw new BadRequestException('File tối đa 5 MB.');
  const mime=sniffMime(f.buffer);if(!mime||mime!==f.mimetype)throw new BadRequestException('Chỉ nhận PDF, JPG, PNG hoặc WebP đúng định dạng.');
  const c=await this.service.campaign(id);
  if(b.purpose==='cover'){
   // Use the management RPC's chair check again at the final attachment mutation.
   const r=await this.service.db.from('club_memberships').select('membership_id').eq('club_id',c.club_id).eq('user_id',actor).eq('status','active').eq('role','chairperson').maybeSingle();this.service.check(r.error);
   if(!r.data)throw new ForbiddenException();
   if(mime==='application/pdf'||c.status!=='draft'||!b.expected_updated_at)throw new BadRequestException('Lưu ảnh bìa cho đợt nháp với phiên bản hiện tại.');
  }else{
   const ctx=await this.service.context(actor,id);if(!ctx.can_apply)throw new ForbiddenException('Không thể tải file cho đợt tuyển này.');
   const q=ctx.departments.flatMap(d=>d.questions).find(q=>q.question_id===b.question_id&&q.question_type==='file');if(!q)throw new BadRequestException('Câu hỏi tải file không còn hợp lệ.');
   const rules=q.validation||{};if(f.size>(rules.max_size_bytes??5242880)||rules.allowed_mime_types&&!rules.allowed_mime_types.includes(mime))throw new BadRequestException('File không đáp ứng quy tắc của câu hỏi.');
  }
  const fileId=randomUUID(),bucket=b.purpose==='cover'?'recruitment-covers':'recruitment-attachments',ext=mime==='application/pdf'?'pdf':mime.split('/')[1],path=`${id}/${fileId}.${ext}`;
  const stored=await this.service.db.storage.from(bucket).upload(path,f.buffer,{contentType:mime,upsert:false});if(stored.error)throw new ServiceUnavailableException('Chưa tải được file lên.');
  const name=f.originalname.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,200)||'attachment';
  const saved=await this.service.db.from('recruitment_files').insert({file_id:fileId,campaign_id:id,uploaded_by:actor,question_id:b.purpose==='answer'?b.question_id:null,purpose:b.purpose,bucket,object_path:path,file_name:name,mime_type:mime,size_bytes:f.size}).select('file_id,file_name,size_bytes,mime_type').single();
  if(saved.error){await this.service.db.storage.from(bucket).remove([path]);this.service.check(saved.error);}
  if(b.purpose==='cover'){
   const url=this.service.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
   const campaign=await this.service.rpc('recruitment_v3_cover',{p_actor:actor,p_id:id,p_expected:b.expected_updated_at,p_file:fileId,p_url:url});return {file:saved.data,campaign};
  }
  return {file:saved.data};
 }
 async download(actor:string,id:string){
  const r=await this.service.db.from('recruitment_files').select('*').eq('file_id',id).neq('state','deleting').maybeSingle();this.service.check(r.error);if(!r.data)throw new NotFoundException();const f=r.data;
  if(f.uploaded_by!==actor){if(!f.application_id)throw new ForbiddenException();const c=await this.service.campaign(f.campaign_id);await this.service.application(actor,f.application_id,{club:c.club_id,campaign:c.campaign_id});}
  if(f.state==='staged'&&Date.parse(f.expires_at)<=Date.now())throw new NotFoundException('File chờ đã hết hạn.');
  const signed=await this.service.db.storage.from(f.bucket).createSignedUrl(f.object_path,60,{download:f.file_name});if(signed.error)throw new ServiceUnavailableException('Chưa mở được file.');return {url:signed.data.signedUrl};
 }
 async cleanup(){
  if(this.busy)return;this.busy=true;
  try{const now=new Date().toISOString(),db=this.service.db;const r=await db.from('recruitment_files').select('file_id,bucket,object_path,state').in('state',['staged','deleting']).is('application_id',null).lte('expires_at',now).limit(50);this.service.check(r.error);
   for(const f of r.data||[]){const claim=await db.from('recruitment_files').update({state:'deleting'}).eq('file_id',f.file_id).eq('state',f.state).is('application_id',null).lte('expires_at',now).select('file_id').maybeSingle();this.service.check(claim.error);if(!claim.data)continue;const removed=await db.storage.from(f.bucket).remove([f.object_path]);if(!removed.error)await db.from('recruitment_files').delete().eq('file_id',f.file_id).eq('state','deleting');}
  }finally{this.busy=false;}
 }
}
