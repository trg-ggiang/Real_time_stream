const assert=require('node:assert/strict');const {test}=require('node:test');require('reflect-metadata');
const {createClient}=require('@supabase/supabase-js');
const {RecruitmentService}=require('../dist/recruitment/recruitment.service');
const {RecruitmentFiles}=require('../dist/recruitment/recruitment-files.service');
const {validateAnswers,validateQuestions,sniffMime}=require('../dist/recruitment/recruitment.validation');
const {PublicContentService}=require('../dist/public-content/public-content.service');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const question=(type='short_text',validation={},options=[])=>({question_id:id(1),question_text:'Question',question_type:type,is_required:true,options,validation});
function fixture(role='head',respond=()=>[]){const calls=[];const client=createClient('https://test.invalid','fake',{global:{fetch:async(input,options)=>{const url=new URL(input),table=url.pathname.split('/').at(-1);calls.push({table,url,options,body:options.body&&JSON.parse(options.body)});return Response.json(await respond(table,url,options));}}});const service=new RecruitmentService({client},{},{require:async()=>({membership:{role,department_id:id(202)}})});return {service,calls,client};}
test('typed answer validation preserves zero and rejects forged choices, dates and unknown questions',()=>{
 assert.doesNotThrow(()=>validateAnswers([question('number',{min:0,max:5})],[{question_id:id(1),value:0}]));
 for(const [type,value] of [['number','0'],['rating',6],['date','2026-02-30'],['email','bad@'],['phone','abc'],['file',['bad']],['checkboxes',[id(2),id(2)]]])assert.throws(()=>validateAnswers([question(type)],[{question_id:id(1),value}]));
 assert.throws(()=>validateAnswers([question()],[{question_id:id(99),value:'forged'}]));
 assert.throws(()=>validateAnswers([question()],[{question_id:id(1),value:'yes'},{question_id:id(1),value:'yes'}]));
});
test('builder rejects invalid choices, unbounded files and unknown rules',()=>{
 for(const q of [question('dropdown',{},[{option_id:id(2),label:'Only one'}]),question('file',{max_files:6}),question('short_text',{min_length:10,max_length:2}),question('file',{allowed_mime_types:['text/html']}),question('paragraph',{arbitrary_sql:true})])assert.throws(()=>validateQuestions([q]));
 assert.doesNotThrow(()=>validateQuestions([question(),question()]));
 assert.throws(()=>validateQuestions([{...question(),field_id:id(1)},{...question(),field_id:id(1)}]));
});
test('head application queue is restricted to recruiting departments matching their membership',async()=>{
 const f=fixture('head',t=>t==='recruitment_campaigns'?[{campaign_id:id(401),club_id:id(101)}]:t==='recruitment_departments'?[{recruitment_department_id:id(501)}]:[]);
 await f.service.applications(id(2),id(101),id(401),{page:1,limit:12,status:'all'});
 const dept=f.calls.find(c=>c.table==='recruitment_departments'),apps=f.calls.find(c=>c.table==='recruitment_applications');
 assert.equal(dept.url.searchParams.get('department_id'),'eq.'+id(202));assert.equal(apps.url.searchParams.get('recruitment_department_id'),'in.('+id(501)+')');
});
test('ordinary members cannot access application queues',async()=>{
 const f=fixture('member',t=>t==='recruitment_campaigns'?[{campaign_id:id(401)}]:[]);
 await assert.rejects(f.service.applications(id(8),id(101),id(401),{page:1,limit:12,status:'all'}),e=>e.getStatus()===403);
 assert.equal(f.calls.some(c=>c.table==='recruitment_applications'),false);
});
test('head cannot read another department application or obtain its attachments',async()=>{
 const f=fixture('head',t=>t==='recruitment_campaigns'?[{campaign_id:id(401)}]:t==='recruitment_applications'?[{application_id:id(701),recruitment_department_id:id(501)}]:t==='recruitment_departments'?[{department_id:id(203)}]:[]);
 await assert.rejects(f.service.application(id(2),id(701),{club:id(101),campaign:id(401)}),e=>e.getStatus()===403);
 assert.equal(f.calls.some(c=>['application_answers','recruitment_files'].includes(c.table)),false);
});
test('student detail scopes query to authenticated applicant',async()=>{
 const f=fixture();await assert.rejects(f.service.application(id(5),id(701)),e=>e.getStatus()===404);assert.equal(f.calls[0].url.searchParams.get('applicant_id'),'eq.'+id(5));
});
test('file download checks ownership and review permission before requesting signed URL',async()=>{
 const f=fixture('member',t=>t==='recruitment_files'?[{file_id:id(801),uploaded_by:id(5),application_id:id(701),campaign_id:id(401)}]:t==='recruitment_campaigns'?[{campaign_id:id(401),club_id:id(101)}]:[]);
 await assert.rejects(new RecruitmentFiles(f.service).download(id(8),id(801)),e=>e.getStatus()===403);assert.equal(f.calls.some(c=>c.url.pathname.includes('/storage/')),false);
});
test('cleanup cannot delete an object when submission wins the row claim',async()=>{
 const f=fixture('member',(_t,_u,options)=>options.method==='GET'?[{file_id:id(801),state:'staged',bucket:'private',object_path:'object'}]:[]);await new RecruitmentFiles(f.service).cleanup();assert.deepEqual(f.calls.map(c=>c.options.method),['GET','PATCH']);
});
test('database errors expose no SQL details and form conflicts have an actionable code',()=>{
 const f=fixture();assert.throws(()=>f.service.check({code:'40001',message:'FORM_CHANGED'}),e=>e.getResponse().code==='FORM_CHANGED');assert.throws(()=>f.service.check({code:'XX000',message:'credential=secret'}),e=>e.getStatus()===503&&!e.message.includes('secret'));
});
test('media sniffing rejects renamed content before upload',()=>{assert.equal(sniffMime(Buffer.from('<html>fake.pdf</html>')),null);assert.equal(sniffMime(Buffer.from('%PDF-1.7')),'application/pdf');});
test('upcoming activities query includes currently-open recruitment, not only future starts',async()=>{
 const f=fixture();await new PublicContentService({client:f.client}).list('activities',1,3,{period:'upcoming'});const c=f.calls[0];assert.equal(c.table,'public_activity_feed');assert.match(c.url.searchParams.get('or'),/entry_type.eq.recruitment,ends_at.gt/);assert.match(c.url.searchParams.get('or'),/entry_type.eq.activity,starts_at.gte/);
});

test('managed recruitment filters by the acceptance window before paginating', async () => {
 for (const [status, constraint] of [
  ['open', ['application_opens_at', 'lte.']],
  ['waiting', ['application_opens_at', 'gt.']],
  ['closed', ['or', '(status.in.(closed,completed),and(status.eq.open,application_closes_at.lte.']],
 ]) {
  const {service,calls}=fixture('chairperson');
  await service.managed(id(1),id(101),{campaign_status:status,page:2,limit:8});
  const params=calls[0].url.searchParams;
  assert.ok(params.get(constraint[0]).startsWith(constraint[1]));
  assert.equal(params.get('deleted_at'),'is.null');
  assert.equal(params.get('offset'),'8');
  assert.equal(params.get('limit'),'8');
 }
});
