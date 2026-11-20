import { useEffect,useRef,useState } from 'react';
import { accountRequest } from '../../shared/api/account-http';
import { publicGet } from '../../shared/api/public-http';
export const types={short_text:'Trả lời ngắn',paragraph:'Đoạn văn',single_choice:'Trắc nghiệm một đáp án',checkboxes:'Hộp kiểm',dropdown:'Danh sách thả xuống',number:'Số',email:'Email',phone:'Điện thoại',date:'Ngày',file:'Tải file',rating:'Thang điểm 1–5'};
export interface Question {question_id?:string;field_id:string;question_text:string;help_text?:string;question_type:keyof typeof types;is_required:boolean;options:{option_id:string;label:string}[];validation:{min_length?:number;max_length?:number;min?:number;max?:number;max_files?:number;max_size_bytes?:number;allowed_mime_types?:string[]};profile_field?:string}
export interface RecruitingDepartment {department_id:string;recruitment_department_id?:string;description:string;current_form_version_id?:string;club_departments?:{name:string};questions:Question[]}
export interface Campaign {campaign_id:string;club_id:string;club_name?:string;title:string;summary?:string;description:string;cover_url?:string|null;status:string;updated_at:string;application_opens_at:string;application_closes_at:string;accepting_applications?:boolean}
export interface Detail {item:Campaign;departments:RecruitingDepartment[]}
export interface Application {application_id:string;campaign_id:string;recruitment_department_id?:string;status:string;updated_at:string;submitted_at?:string;result_message?:string;profile_snapshot?:Record<string,string>;recruitment_campaigns?:{title:string;club_id:string}}
export interface FileItem {file_id:string;file_name:string;question_id?:string;size_bytes:number}
export interface ApplicationDetail {item:Application;questions:Question[];answers:{question_id:string;answer_value:unknown}[];files:FileItem[];department?:{club_departments?:{name:string}}}
export interface Context extends Detail {profile:Record<string,string>;application:Application|null;can_apply:boolean;reason:string|null}
export interface Page<T>{items:T[];total:number;page:number;hasMore:boolean}
export const statusLabel=(s:string)=>({draft:'Bản nháp',open:'Đã đăng',closed:'Đã đóng',completed:'Hoàn tất',cancelled:'Đã hủy',submitted:'Chờ duyệt',interviewing:'Chờ duyệt',accepted:'Đã duyệt',rejected:'Từ chối'})[s]||s;
export const dateLabel=(d?:string)=>d?new Date(d).toLocaleString('vi-VN'):'—';
export const profileLabels={full_name:'Họ tên',student_code:'MSSV',email:'Email',phone:'Điện thoại',school_or_faculty:'Trường / khoa',major:'Ngành',cohort:'Khóa'};
export function useRecruitment<T>(path:string,token?:string){
 const key=`${token||'public'}:${path}`,[attempt,setAttempt]=useState(0),[state,setState]=useState<{key:string;data?:T;error?:string}>({key});
 useEffect(()=>{const abort=new AbortController();setState({key});const req=token?accountRequest<T>(token,path,{signal:abort.signal}):publicGet<T>(path,abort.signal);void req.then(data=>{if(!abort.signal.aborted)setState({key,data});}).catch(e=>{if(!abort.signal.aborted)setState({key,error:e.message});});return()=>abort.abort();},[key,attempt]);
 const current=state.key===key?state:{key};
 return {data:current.data,error:current.error,retry:()=>setAttempt(n=>n+1)};
}
export function useWrite(){const lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');async function run<T>(action:()=>Promise<T>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{return await action();}catch(e){setError(e instanceof Error?e.message:'Chưa thực hiện được thao tác.');}finally{lock.current=false;setBusy(false);}}return {run,busy,error,setError};}
export const write=<T,>(token:string,path:string,body:unknown,method='POST')=>accountRequest<T>(token,path,{method,body:JSON.stringify(body)});
export async function upload(token:string,id:string,file:File,purpose:'answer'|'cover',questionOrVersion:string){const body=new FormData();body.append('file',file);body.append('purpose',purpose);body.append(purpose==='answer'?'question_id':'expected_updated_at',questionOrVersion);return accountRequest<{file:FileItem;campaign?:Campaign}>(token,`recruitments/${id}/files`,{method:'POST',body});}
export async function downloadFile(token:string,id:string){const tab=window.open('about:blank','_blank');if(!tab)throw Error('Cho phép mở tab mới để xem file.');tab.opener=null;try{const {url}=await accountRequest<{url:string}>(token,`recruitment-files/${id}/download`);if(!['https:','http:'].includes(new URL(url).protocol))throw Error('Đường dẫn file chưa hợp lệ.');tab.location.replace(url);}catch(e){tab.close();throw e;}}
export const questionKey=(q:Question)=>q.question_id||q.field_id;
export const newQuestion=(field?:string,label=''):Question=>({field_id:crypto.randomUUID(),question_text:label,question_type:field==='email'?'email':field==='phone'?'phone':'short_text',is_required:true,options:[],validation:{},...(field&&{profile_field:field})});
export function prefill(qs:Question[],profile:Record<string,string>={}){return Object.fromEntries(qs.map(q=>[questionKey(q),q.profile_field?profile[q.profile_field]||'':['checkboxes','file'].includes(q.question_type)?[]:'']));}
export function serialize(departments:RecruitingDepartment[]){return departments.map(d=>({department_id:d.department_id,description:d.description,questions:d.questions.map(({field_id,question_text,help_text,question_type,is_required,options,validation,profile_field})=>({field_id,question_text,help_text,question_type,is_required,options,validation,...(profile_field&&{profile_field})}))}));}
export function answerLabel(q:Question,v:unknown){if(v==null||v===''||Array.isArray(v)&&!v.length)return 'Chưa trả lời';if(['checkboxes','dropdown','single_choice'].includes(q.question_type))return (Array.isArray(v)?v:[v]).map(x=>q.options.find(o=>o.option_id===x)?.label||'Phương án cũ').join(', ');return Array.isArray(v)?`${v.length} file đính kèm`:String(v);}
