import { ConfirmationDialog } from '../../shared/components/ConfirmationDialog';
import { ImageFilePicker } from '../../shared/components/ImageFilePicker';
import { PersonalState } from '../personal/components/PersonalState';
import { ContentImage } from '../discovery/components/PublicContent';
import { PaginationButton } from "../../shared/components/PaginationButton";
import { confirmAction } from '../../shared/lib/confirm-action';
import { useState,type FormEvent } from 'react';
import { Link,useNavigate,useParams,useSearchParams } from 'react-router-dom';
import { accountRequest } from '../../shared/api/account-http';
import { useClub } from '../club-workspace/workspace-context';
import type { Department,WorkspaceList } from '../club-workspace/services/workspace-api';
import { FormBuilder,AnswerSummary } from './RecruitmentForm';
import { dateLabel,downloadFile,newQuestion,serialize,statusLabel,upload,useRecruitment,useWrite,write,type Application,type ApplicationDetail,type Campaign,type Detail,type Page,type RecruitingDepartment } from './recruitment-api';
import './recruitment.css';
export function State({data,error,retry}:{data?:unknown;error?:string;retry:()=>void}){return data?null:error?<div role="alert"><p>{error}</p><button type="button" onClick={retry}>Thử lại</button></div>:<p role="status">Đang tải…</p>;}
export function Pager({page,more,onPage}:{page:number;more?:boolean;onPage:(page:number)=>void}){return <nav className="recruit-toolbar" aria-label="Phân trang"><PaginationButton direction="previous" disabled={page<=1} onClick={()=>onPage(page-1)} /><span>Trang {page}</span><PaginationButton direction="next" disabled={!more} onClick={()=>onPage(page+1)} /></nav>;}
function campaignDisplayStatus(campaign: Campaign) {
 if (campaign.status !== 'open') return campaign.status;
 const now = Date.now();
 if (Date.parse(campaign.application_closes_at) <= now) return 'closed';
 if (Date.parse(campaign.application_opens_at) > now) return 'upcoming';
 return 'open';
}

function CampaignBadge({ campaign }: { campaign: Campaign }) {
 const status = campaignDisplayStatus(campaign);
 return <span className="recruit-badge" data-status={status}>{{upcoming:'Sắp mở',open:'Đang tuyển'}[status]??statusLabel(status)}</span>;
}

const campaignFilters = { all: 'Tất cả', open: 'Đang tuyển', waiting: 'Đang chờ', closed: 'Đã đóng' } as const;

export function WorkspaceRecruitment() {
 const {token,clubId,membership}=useClub();
 const [params,setParams]=useSearchParams();
 const rawPage=Number(params.get('page')||1);
 const page=Number.isInteger(rawPage)?Math.max(1,Math.min(10000,rawPage)):1;
 const base=`/workspace/${clubId}/recruitments`;
 const requested=params.get('campaign_status');
 const filter=requested&&Object.hasOwn(campaignFilters,requested)?requested:'all';
 const canCreate=membership.role==='chairperson';
 const state=useRecruitment<Page<Campaign>>(`workspace/${clubId}/recruitments?page=${page}&campaign_status=${filter}`,token);

 const loading=!state.data&&!state.error;
 return <section className="recruit recruit-workspace recruit-campaigns">
  <header className="cw-heading">
   <div><h1>Tuyển thành viên</h1><p>Xem các đợt tuyển và hồ sơ ứng tuyển của CLB.</p></div>
   {canCreate&&<Link className="cw-primary" to={`${base}/new`}>Tạo đợt tuyển ↗</Link>}
  </header>
  <nav className="cw-tabs recruit-campaign-filters" aria-label="Lọc đợt tuyển">
   {Object.entries(campaignFilters).map(([value,label])=><Link key={value}
    to={value==='all'?base:`${base}?campaign_status=${value}`} aria-current={filter===value?'page':undefined}>{label}</Link>)}
  </nav>
  {state.data?.items.length ? <div className="cw-content-list recruit-campaign-cards">{state.data.items.map(campaign=>{
    const href=`${base}/${campaign.campaign_id}`;
    return <article key={campaign.campaign_id}>
     <ContentImage src={campaign.cover_url} alt="" />
     <div className="recruit-campaign-copy">
      <CampaignBadge campaign={campaign} />
      <h2><Link to={`${href}/edit`}>{campaign.title}</Link></h2>
      {campaign.summary&&<p>{campaign.summary}</p>}
      <small>Mở lúc <time dateTime={campaign.application_opens_at}>{dateLabel(campaign.application_opens_at)}</time></small>
      <small>Hạn nộp <time dateTime={campaign.application_closes_at}>{dateLabel(campaign.application_closes_at)}</time></small>
     </div>
     <Link className="recruit-queue-link" to={`${href}/${['draft','pending_review'].includes(campaign.status)?'edit':'applications'}`}>
      {campaign.status==='pending_review'?'Xem đợt chờ duyệt':campaign.status==='draft'?'Mở bản nháp':'Đơn ứng tuyển'} →<span className="recruit-sr"> {campaign.title}</span>
     </Link>
    </article>;
   })}</div>:<PersonalState {...state} loading={loading} empty="Chưa có đợt tuyển trong mục này." showDiscoveryLink={false} />}
  <nav className="cw-pagination" aria-label="Phân trang đợt tuyển">
   <PaginationButton direction="previous" disabled={page===1||loading} onClick={()=>setParams({campaign_status:filter,page:String(page-1)})} />
   <span>Trang {page}</span>
   <PaginationButton direction="next" disabled={!state.data?.hasMore||loading} onClick={()=>setParams({campaign_status:filter,page:String(page+1)})} />
  </nav>
 </section>;
}
export function RecruitmentEditor(){const {campaignId}=useParams(),{token,clubId,membership}=useClub();if(membership.role!=='chairperson'&&(!campaignId||membership.role!=='head'))return <p>Chỉ chủ nhiệm được tạo đợt tuyển.</p>;return campaignId?<LoadEditor key={campaignId} {...{token,clubId,campaignId}} readOnly={membership.role!=='chairperson'} />:<Editor key="new" {...{token,clubId}} />;}
function LoadEditor({token,clubId,campaignId,readOnly}:{token:string;clubId:string;campaignId:string;readOnly?:boolean}){const s=useRecruitment<Detail>(`workspace/${clubId}/recruitments/${campaignId}`,token);return s.data?<Editor {...{token,clubId}} initial={s.data} readOnly={readOnly} />:<State {...s} />;}
const localDate=(d?:string)=>d?new Date(Date.parse(d)-new Date(d).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
function Editor({token,clubId,initial,readOnly=false}:{token:string;clubId:string;initial?:Detail;readOnly?:boolean}){
 const navigate=useNavigate(),mutation=useWrite(),[c,setC]=useState(initial?.item),[title,setTitle]=useState(initial?.item.title||''),[summary,setSummary]=useState(initial?.item.summary||''),[description,setDescription]=useState(initial?.item.description||''),[opens,setOpens]=useState(localDate(initial?.item.application_opens_at)),[closes,setCloses]=useState(localDate(initial?.item.application_closes_at)),[departments,setDepartments]=useState<RecruitingDepartment[]>(initial?.departments||[]),[selected,setSelected]=useState(''),[cover,setCover]=useState<File>(),[message,setMessage]=useState('');
 const depts=useRecruitment<WorkspaceList<Department>>(`workspace/${clubId}/departments`,token),base=`/workspace/${clubId}/recruitments`,path=`workspace/${clubId}/recruitments`,frozen=readOnly||!!c&&c.status!=='draft';
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const publish=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='publish';if(publish&&!(await confirmAction('Gửi đợt tuyển để chủ nhiệm CLB duyệt?'))
    )return;setMessage('');await mutation.run(async()=>{
  if(!departments.length||departments.some(d=>!d.questions.length))throw Error('Thêm ít nhất một ban và một câu hỏi cho mỗi ban.');
  if(Date.parse(closes)<=Date.parse(opens))throw Error('Hạn tuyển phải sau thời điểm bắt đầu.');
  let item=(await write<{item:Campaign}>(token,path+(c?`/${c.campaign_id}`:''),{title,summary,description,application_opens_at:new Date(opens).toISOString(),application_closes_at:new Date(closes).toISOString(),cover_url:c?.cover_url||null,departments:serialize(departments),...(c&&{expected_updated_at:c.updated_at})},c?'PATCH':'POST')).item;setC(item);
  if(cover){const result=await upload(token,item.campaign_id,cover,'cover',item.updated_at);item=result.campaign!;setC(item);setCover(undefined);}
  if(publish){item=(await write<{item:Campaign}>(token,`${path}/${item.campaign_id}/submit-review`,{expected_updated_at:item.updated_at})).item;setC(item);}
  setMessage(publish?'Đã gửi đợt tuyển để duyệt.':'Đã lưu bản nháp.');
  if(!initial)navigate(`${base}/${item.campaign_id}/edit`,{replace:true});
 });}
 async function changeCampaign(action:'publish'|'close'|'return-draft') {
  if(!c||mutation.busy)return;
  const prompts={publish:'Duyệt và đăng đợt tuyển công khai?',close:'Đóng nhận đơn ngay?', 'return-draft':'Đưa đợt tuyển về bản nháp để chỉnh sửa?'};
  if(!await confirmAction(prompts[action]))return;
  setMessage('');
  await mutation.run(async()=>{
   const result=await write<{item:Campaign}>(token,`${path}/${c.campaign_id}/${action}`,{expected_updated_at:c.updated_at});
   setC(result.item);
   setMessage({publish:'Đã duyệt và đăng đợt tuyển.',close:'Đã đóng nhận đơn.','return-draft':'Đã đưa đợt tuyển về bản nháp.'}[action]);
  });
 }
 function addDepartment(){const d=depts.data?.items.find(d=>d.department_id===selected);if(!d)return;setDepartments([...departments,{department_id:d.department_id,club_departments:{name:d.name},description:'',questions:[newQuestion()]}]);setSelected('');}
 return <section className="recruit recruit-workspace recruit-editor"><Link className="recruit-back" to={base}>← Tuyển thành viên</Link><div className="recruit-workspace-heading"><h1>{c?c.title:'Tạo đợt tuyển mới'}</h1>{c&&<CampaignBadge campaign={c} />}</div> {frozen&&c&&<section className="recruit-panel">
  {c.status==='pending_review'?<>
   <h2>Đợt tuyển đang chờ duyệt</h2>
   {!readOnly&&<div className="recruit-actions recruit-editor-actions">
    <button type="button" disabled={mutation.busy} onClick={()=>void changeCampaign('return-draft')}>Đưa về bản nháp</button>
    <button type="button" className="recruit-primary" disabled={mutation.busy} onClick={()=>void changeCampaign('publish')}>Duyệt và đăng</button>
   </div>}
  </>:c.status==='draft'?<p>Đợt tuyển đang là bản nháp.</p>:<>
   <div className="recruit-actions">
    {['open','closed','completed'].includes(c.status)&&<Link to={`/recruitments/${c.campaign_id}`}>Xem bài tuyển công khai</Link>}
    <Link className="recruit-primary" to={`${base}/${c.campaign_id}/applications`}>Đơn ứng tuyển</Link>
    {!readOnly&&c.status==='open'&&<button type="button" disabled={mutation.busy} onClick={()=>void changeCampaign('close')}>Đóng nhận đơn</button>}
   </div>
  </>}
 </section>}
<nav className="recruit-section-links" aria-label="Các phần của đợt tuyển"><a href="#recruit-campaign-info">Thông tin đợt tuyển</a><a href="#recruit-campaign-forms">Ban và biểu mẫu</a></nav><form onSubmit={save}><fieldset disabled={mutation.busy||frozen} className="recruit-fields"><section className="recruit-panel" id="recruit-campaign-info"><h2>Thông tin đợt tuyển</h2><label>Tiêu đề đợt tuyển<input required minLength={2} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} /></label><label>Tóm tắt<textarea maxLength={500} value={summary} onChange={e=>setSummary(e.target.value)} /></label><div className="recruit-grid"><label>Bắt đầu nhận đơn<input required type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)} /></label><label>Kết thúc nhận đơn<input required type="datetime-local" value={closes} onChange={e=>setCloses(e.target.value)} /></label></div><label>Nội dung chi tiết (hỗ trợ Markdown)<textarea required minLength={10} maxLength={50000} rows={8} value={description} onChange={e=>setDescription(e.target.value)} /></label><label>Ảnh bìa (JPG, PNG, WebP, tối đa 5 MB)<ImageFilePicker hasImage={Boolean(cover||c?.cover_url)} accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f&&f.size>5242880){mutation.setError('Ảnh tối đa 5 MB.');e.target.value='';return;}setCover(f);}} /></label>{cover&&<p>Ảnh đã chọn: {cover.name}. Ảnh được tải khi lưu.</p>}{c?.cover_url&&<img className="recruit-cover" src={c.cover_url} alt="Ảnh bìa đợt tuyển" />}</section>
 <section className="recruit-panel" id="recruit-campaign-forms"><h2>Ban và biểu mẫu ứng tuyển</h2><p>Chọn ban thường đang hoạt động. Mỗi ban có biểu mẫu ứng tuyển riêng.</p><State {...depts} /><div className="recruit-department-picker"><label>Chọn ban<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn ban</option>{depts.data?.items.filter(d=>d.status==='active'&&!d.is_management&&!departments.some(x=>x.department_id===d.department_id)).map(d=><option key={d.department_id} value={d.department_id}>{d.name}</option>)}</select></label><button type="button" disabled={!selected} onClick={addDepartment}>Thêm ban</button></div>{depts.data&&!depts.data.items.some(d=>!d.is_management&&d.status==='active')&&<p>Chưa có ban thường hoạt động. Tạo ban tại Khác → Cơ cấu CLB trước.</p>}
 {departments.map((d,i)=><details className="recruit-department" key={d.department_id} open={i===0||undefined} onInvalidCapture={e=>{ e.currentTarget.open=true; }}><summary>{d.club_departments?.name||depts.data?.items.find(x=>x.department_id===d.department_id)?.name||'Ban tuyển'}</summary><label>Mô tả công việc của ban<textarea required maxLength={20000} value={d.description} onChange={e=>setDepartments(old=>old.map((x,n)=>n===i?{...x,description:e.target.value}:x))} /></label><FormBuilder questions={d.questions} disabled={mutation.busy||frozen} onChange={questions=>setDepartments(old=>old.map((x,n)=>n===i?{...x,questions}:x))} />{!d.recruitment_department_id&&<button type="button" onClick={async()=>{if(await confirmAction('Gỡ ban và biểu mẫu của ban khỏi bản nháp?',true))setDepartments(old=>old.filter(item=>item.department_id!==d.department_id));}}>Gỡ ban khỏi bản nháp</button>}</details>)}</section>
 {!frozen&&<div className="recruit-actions recruit-editor-actions"><button disabled={!departments.length} type="submit" value="draft">Lưu nháp</button><button disabled={!departments.length} className="recruit-primary" type="submit" value="publish">Gửi duyệt</button></div>}</fieldset></form>
 {mutation.error&&<p className="recruit-error" role="alert">{mutation.error} {c&&<button onClick={()=>window.location.reload()}>Tải lại dữ liệu</button>}</p>}{message&&<p role="status">{message}</p>}</section>;
}
const reviewFilters = { submitted: 'Chờ duyệt', all: 'Tất cả', accepted: 'Đã duyệt', rejected: 'Từ chối' } as const;

export function RecruitmentQueue() {
 const {token,clubId,membership}=useClub();
 const {campaignId=''}=useParams();
 const [params,setParams]=useSearchParams();
 const page=Math.max(1,Number(params.get('page'))||1);
 const requested=params.get('status');
 const status=requested && Object.hasOwn(reviewFilters,requested) ? requested : 'submitted';
 const base=`/workspace/${clubId}/recruitments/${campaignId}`;
 const path=`workspace/${clubId}/recruitments/${campaignId}`;
 const state=useRecruitment<Page<Application>>(`${path}/applications?page=${page}&status=${status}`,token);

 return <section className="recruit recruit-workspace recruit-queue">
  <Link className="recruit-back" to={`/workspace/${clubId}/recruitments`}>← Các đợt tuyển</Link>
  <header className="cw-heading"><div><h1>Đơn ứng tuyển</h1>
   {membership.role==='head'&&<p>Các đơn ứng tuyển vào ban bạn phụ trách.</p>}
  </div></header>
  <div className="recruit-filter-bar" role="group" aria-label="Lọc đơn theo trạng thái">
   {Object.entries(reviewFilters).map(([value,label])=><button key={value} type="button" aria-pressed={status===value}
    onClick={()=>setParams({status:value,page:'1'})}>{label}</button>)}
  </div>
  <State {...state} />
  {state.data&&<>
   <p className="recruit-result-count" role="status">{state.data.total} đơn</p>
   {state.data.items.length ? <div className="recruit-rows">{state.data.items.map(a=>
    <article className="recruit-panel recruit-row" key={a.application_id+':'+a.updated_at}>
     <div><span className="recruit-badge" data-status={a.status}>{statusLabel(a.status)}</span>
      <h2>{a.profile_snapshot?.full_name||'Ứng viên'}</h2>
      <p>{[a.profile_snapshot?.student_code,a.profile_snapshot?.email].filter(Boolean).join(' · ')}</p>
      <p className="recruit-muted">Ngày nộp {dateLabel(a.submitted_at)}</p>
     </div>
     <DecisionControls application={a} path={path} token={token} reload={state.retry}
      detailHref={`${base}/applications/${a.application_id}?${new URLSearchParams({status,page:String(page)})}`} />
    </article>)}</div> : <div className="recruit-panel recruit-empty"><h2>{status==='submitted'?'Đã hết đơn chờ duyệt':'Chưa có đơn ở trạng thái này'}</h2>
    {status!=='all'&&<button type="button" onClick={()=>setParams({status:'all',page:'1'})}>Xem tất cả đơn</button>}
   </div>}
   {(page>1||state.data.hasMore)&&<Pager page={page} more={state.data.hasMore} onPage={n=>setParams({status,page:String(n)})} />}
  </>}
 </section>;
}
export function DecisionControls({application:a,path,token,reload,detailHref}:{application:Application;path:string;token:string;reload:()=>void;detailHref?:string}) {
 const mutation=useWrite();
 const [decision,setDecision]=useState<boolean|null>(null);
 const [reason,setReason]=useState('');
 const detailButton=detailHref?<Link className="recruit-button recruit-review-detail" to={detailHref}>Xem chi tiết đơn →</Link>:null;
 if(!['submitted','interviewing'].includes(a.status))return detailButton?<div className="recruit-review-actions recruit-review-completed">{detailButton}</div>:null;

 async function decide() {
  if(decision===null)return;
  const result=await mutation.run(()=>write(token,`${path}/applications/${a.application_id}/decision`,{
   approve:decision,expected_updated_at:a.updated_at,...(!decision&&reason.trim()&&{reason:reason.trim()}),
  },'PATCH'));
  if(result){setDecision(null);reload();}
 }
 function openDecision(approve:boolean){
  setReason('');
  mutation.setError('');
  setDecision(approve);
 }

 return <div className="recruit-review-actions">
  <div className="recruit-decision-buttons">
   <button type="button" className="recruit-primary" disabled={mutation.busy} onClick={()=>openDecision(true)}>Duyệt</button>
   <button type="button" className="recruit-danger" disabled={mutation.busy} onClick={()=>openDecision(false)}>Từ chối</button>
  </div>
  {detailButton}
  {decision!==null&&<ConfirmationDialog
   title={decision?'Duyệt đơn ứng tuyển?':'Từ chối đơn ứng tuyển?'}
   confirmLabel={decision?'Xác nhận duyệt':'Xác nhận từ chối'} danger={!decision} busy={mutation.busy}
   onConfirm={()=>void decide()} onCancel={()=>setDecision(null)}>
   {!decision&&<label>Lý do (không bắt buộc)
    <textarea maxLength={5000} value={reason} disabled={mutation.busy} onChange={e=>setReason(e.target.value)} />
   </label>}
   {mutation.error&&<p className="recruit-error" role="alert">{mutation.error} <button type="button" onClick={reload}>Tải lại trạng thái</button></p>}
  </ConfirmationDialog>}
 </div>;
}
export function ApplicationReadout({data,token}:{data:ApplicationDetail;token:string}){const mutation=useWrite();return <article className="recruit-panel"><header className="recruit-readout-heading"><div><h2>{data.item.profile_snapshot?.full_name||'Thông tin ứng viên'}</h2><p>{data.department?.club_departments?.name}</p></div><span className="recruit-badge" data-status={data.item.status}>{statusLabel(data.item.status)}</span></header>{data.item.result_message&&<p className="recruit-outcome" role="status">{data.item.result_message}</p>}<h3>Hồ sơ lúc nộp đơn</h3><dl className="recruit-answers">{Object.entries(data.item.profile_snapshot||{}).map(([k,v])=><div key={k}><dt>{({full_name:'Họ tên',student_code:'MSSV',email:'Email',phone:'Điện thoại',school_or_faculty:'Trường / khoa',major:'Ngành',cohort:'Khóa'} as Record<string,string>)[k]||k}</dt><dd>{v||'—'}</dd></div>)}</dl><h3>Câu trả lời đã nộp</h3><AnswerSummary questions={data.questions} values={Object.fromEntries(data.answers.map(a=>[a.question_id,a.answer_value]))} />{data.files.map(f=><p key={f.file_id}><button disabled={mutation.busy} onClick={()=>void mutation.run(()=>downloadFile(token,f.file_id))}>{f.file_name}</button> · {Math.ceil(f.size_bytes/1024)} KB</p>)}{mutation.error&&<p role="alert">{mutation.error}</p>}</article>;}
export function RecruitmentApplicationDetail() {
 const {token,clubId}=useClub();
 const {campaignId='',applicationId=''}=useParams();
 const [query]=useSearchParams();
 const path=`workspace/${clubId}/recruitments/${campaignId}`;
 const state=useRecruitment<ApplicationDetail>(`${path}/applications/${applicationId}`,token);
 const application=state.data?.item;
 return <section className="recruit recruit-workspace recruit-review-page">
  <Link className="recruit-back" to={`/workspace/${clubId}/recruitments/${campaignId}/applications?${query}`}>← Đơn ứng tuyển</Link>
  <header className="cw-heading recruit-review-heading">
   <h1>Chi tiết đơn ứng tuyển</h1>
   {application&&<DecisionControls key={application.updated_at} application={application} path={path} token={token} reload={state.retry} />}
  </header>
  <State {...state} />
  {state.data&&<ApplicationReadout data={state.data} token={token} />}
 </section>;
}
