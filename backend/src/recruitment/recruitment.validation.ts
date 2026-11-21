import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { FormQuestion } from './recruitment.dto';
const choice=new Set(['single_choice','checkboxes','dropdown']);
export const mimeTypes=['application/pdf','image/jpeg','image/png','image/webp'];
export function validateQuestions(questions:FormQuestion[]) {
 const fieldIds=questions.flatMap(q=>q.field_id?[q.field_id]:[]);
 if(new Set(fieldIds).size!==fieldIds.length) throw new BadRequestException('Mã câu hỏi bị trùng.');
 for(const q of questions){
  const r=q.validation;
  if(!q.question_text.trim()) throw new BadRequestException('Nhập nội dung câu hỏi.');
  if(choice.has(q.question_type) && (q.options.length<2||new Set(q.options.map(o=>o.option_id)).size!==q.options.length||q.options.some(o=>!o.label.trim()))) throw new BadRequestException('Câu hỏi lựa chọn cần ít nhất hai phương án có mã riêng.');
  if(!choice.has(q.question_type)&&q.options.length) throw new BadRequestException('Loại câu hỏi không có phương án lựa chọn.');
  const allowed=['min_length','max_length','min','max','max_files','max_size_bytes','allowed_mime_types'];
  if(Object.keys(r).some(k=>!allowed.includes(k))) throw new BadRequestException('Quy tắc biểu mẫu không hợp lệ.');
  for(const k of ['min_length','max_length','min','max','max_files','max_size_bytes']) if(r[k]!==undefined && (typeof r[k]!=='number'||!Number.isFinite(r[k]))) throw new BadRequestException('Giới hạn câu trả lời phải là số.');
  for(const k of ['min_length','max_length','max_files','max_size_bytes']) if(r[k]!==undefined&&!Number.isInteger(r[k])) throw new BadRequestException('Giới hạn phải là số nguyên.');
  if((r.min_length as number??0)<0||(r.max_length as number??10000)>10000||(r.max_length as number??1)<1||(r.min_length as number??0)>(r.max_length as number??10000)||(r.min as number??-1e12)>(r.max as number??1e12)||(r.max_files as number??1)<1||(r.max_files as number??1)>5||(r.max_size_bytes as number??5242880)<1||(r.max_size_bytes as number??5242880)>5242880) throw new BadRequestException('Giới hạn biểu mẫu chưa phù hợp.');
  if(r.allowed_mime_types!==undefined&&(!Array.isArray(r.allowed_mime_types)||!r.allowed_mime_types.length||r.allowed_mime_types.some(m=>!mimeTypes.includes(m)))) throw new BadRequestException('Loại file chưa hợp lệ.');
  if(q.profile_field&&!['short_text','paragraph','email','phone'].includes(q.question_type)) throw new BadRequestException('Chỉ trường văn bản có thể điền sẵn hồ sơ.');
 }
}
export function validateAnswers(questions:any[],answers:{question_id:string;value?:unknown}[]) {
 const fields:Record<string,string>={};
 if(new Set(answers.map(a=>a.question_id)).size!==answers.length||answers.some(a=>!questions.some(q=>q.question_id===a.question_id))) throw new BadRequestException('Câu trả lời trùng hoặc không thuộc biểu mẫu.');
 for(const q of questions){
  const v=answers.find(a=>a.question_id===q.question_id)?.value,r=q.validation||{};
  if(v==null||typeof v==='string'&&!v.trim()||Array.isArray(v)&&!v.length){if(q.is_required)fields[q.question_id]='Vui lòng trả lời câu hỏi này.';continue;}
  let invalid=false;
  if(['number','rating'].includes(q.question_type)) invalid=typeof v!=='number'||!Number.isFinite(v)||v<(r.min??-1e12)||v>(r.max??1e12)||q.question_type==='rating'&&(!Number.isInteger(v)||v<1||v>5);
  else if(choice.has(q.question_type)){const xs=q.question_type==='checkboxes'?v:[v];invalid=!Array.isArray(xs)||new Set(xs).size!==xs.length||xs.some(x=>!q.options.some((o:any)=>o.option_id===x));}
  else if(q.question_type==='file') invalid=!Array.isArray(v)||v.length>(r.max_files??1)||new Set(v).size!==v.length||v.some(x=>typeof x!=='string'||! /^[0-9a-f-]{36}$/i.test(x));
  else invalid=typeof v!=='string'||v.length<(r.min_length??0)||v.length>(r.max_length??10000)||q.question_type==='email'&&!isEmail(v)||q.question_type==='phone'&&!/^\+?[0-9][0-9 .()-]{7,24}$/.test(v)||q.question_type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v);
  if(invalid)fields[q.question_id]='Câu trả lời chưa đúng định dạng hoặc giới hạn.';
 }
 if(Object.keys(fields).length)throw new BadRequestException({message:'Kiểm tra các câu trả lời được đánh dấu.',code:'FORM_INVALID',fields});
}
export function sniffMime(b:Buffer){
 if(b.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'image/webp';
 return null;
}
