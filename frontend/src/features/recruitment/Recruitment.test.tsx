// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {ClubContext,type WorkspaceSession} from '../club-workspace/workspace-context';
import {RecruitmentEditor,RecruitmentQueue,RecruitmentApplicationDetail} from './WorkspaceRecruitment';
import {RecruitmentApply} from './PublicRecruitment';
import {FormBuilder,Markdown} from './RecruitmentForm';
import {newQuestion,serialize,type Detail} from './recruitment-api';
import {ActivityCard} from '../discovery/components/PublicContent';
import {notificationTarget} from '../discovery/components/HeadNotifications';
const stamp='2026-11-20T00:00:00.123456+00:00',q={...newQuestion('full_name','Họ tên'),question_id:'question-id',sort_order:1};
const detail:Detail={item:{campaign_id:'campaign',club_id:'club',title:'Tuyển kỹ thuật',description:'Nội dung tuyển thành viên kỹ thuật',application_opens_at:'2020-01-01T00:00:00Z',application_closes_at:'2099-01-01T00:00:00Z',status:'draft',updated_at:stamp},departments:[{department_id:'dept',recruitment_department_id:'rd',current_form_version_id:'version',description:'Công việc kỹ thuật',club_departments:{name:'Ban Kỹ thuật'},questions:[q]}]};
const app={application_id:'application',campaign_id:'campaign',status:'submitted',updated_at:stamp,profile_snapshot:{full_name:'Minh Hải',student_code:'20235703'}};
const session={token:'token',clubId:'club',membership:{role:'chairperson',department_id:'dept'}} as unknown as WorkspaceSession;
let calls:{url:string;options?:RequestInit}[];
function mock(handler:(url:string,options?:RequestInit)=>unknown){vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{calls.push({url,options});return {ok:true,json:async()=>handler(url,options)};}));}
beforeEach(()=>{calls=[];vi.spyOn(window,'scrollTo').mockImplementation(()=>{});vi.spyOn(window,'confirm').mockReturnValue(true);});afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('saves before submitting for review and requires separate approval to publish',async()=>{
 mock((url,o)=>o?.method==='PATCH'?{item:{...detail.item,updated_at:'precise-saved-version'}}:o?.method==='POST'?{item:{...detail.item,status:url.endsWith('/submit-review')?'pending_review':'open',updated_at:'review-version'}}:url.endsWith('/departments')?{items:[{department_id:'dept',name:'Ban Kỹ thuật',status:'active'}]}:detail);
 render(<MemoryRouter initialEntries={['/workspace/club/recruitments/campaign/edit']}><ClubContext.Provider value={session}><Routes><Route path='/workspace/:clubId/recruitments/:campaignId/edit' element={<RecruitmentEditor/>}/></Routes></ClubContext.Provider></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Gửi duyệt'}));fireEvent.click(await screen.findByRole('button',{name:'X\u00e1c nh\u1eadn'}));
 await screen.findByRole('heading',{name:'Đợt tuyển đang chờ duyệt'});expect(calls.some(c=>c.url.endsWith('/publish'))).toBe(false);const writes=calls.filter(c=>c.options?.method==='PATCH'||c.options?.method==='POST');expect(writes.map(c=>c.options?.method)).toEqual(['PATCH','POST']);
 expect(JSON.parse(String(writes[0].options?.body)).departments[0].questions[0].sort_order).toBeUndefined();expect(JSON.parse(String(writes[1].options?.body)).expected_updated_at).toBe('precise-saved-version');
 fireEvent.click(screen.getByRole('button',{name:'Duyệt và đăng'}));
 fireEvent.click(await screen.findByRole('button',{name:'Xác nhận'}));
 await waitFor(()=>expect(calls.some(c=>c.url.endsWith('/publish'))).toBe(true));
 expect(JSON.parse(String(calls.find(c=>c.url.endsWith('/publish'))?.options?.body)).expected_updated_at).toBe('review-version');

});
it('prefills profile, requires review/consent and submits only once with the form version',async()=>{
 mock((_url,o)=>o?.method==='POST'?{item:app}:{...detail,item:{...detail.item,status:'open',accepting_applications:true},profile:{full_name:'Minh Hải'},can_apply:true,application:null});
 render(<MemoryRouter initialEntries={['/recruitments/campaign/apply']}><Routes><Route path='/recruitments/:campaignId/apply' element={<RecruitmentApply token='token'/>}/><Route path='/me/recruitment-applications/:applicationId' element={<h1>Đã nhận đơn</h1>}/></Routes></MemoryRouter>);
 fireEvent.change(await screen.findByLabelText('Chọn ban ứng tuyển'),{target:{value:'rd'}});expect((screen.getByLabelText('Họ tên') as HTMLInputElement).value).toBe('Minh Hải');fireEvent.click(screen.getByText('Xem lại đơn →'));const button=screen.getByText('Xác nhận nộp đơn');expect((button as HTMLButtonElement).disabled).toBe(true);expect(calls.filter(c=>c.options?.method==='POST')).toHaveLength(0);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);fireEvent.click(button);await screen.findByText('Đã nhận đơn');const posts=calls.filter(c=>c.options?.method==='POST');expect(posts).toHaveLength(1);expect(JSON.parse(String(posts[0].options?.body))).toEqual({recruitment_department_id:'rd',form_version_id:'version',answers:[{question_id:'question-id',value:'Minh Hải'}]});
});
it('already-member context never displays a submission form',async()=>{
 mock(()=>({...detail,profile:{},can_apply:false,reason:'ALREADY_MEMBER',application:null}));render(<MemoryRouter initialEntries={['/recruitments/campaign/apply']}><Routes><Route path='/recruitments/:campaignId/apply' element={<RecruitmentApply token='token'/>}/></Routes></MemoryRouter>);await screen.findByText('Bạn đã là thành viên CLB này.');expect(screen.queryByLabelText('Chọn ban ứng tuyển')).toBeNull();
});
it('queue decisions require confirmation, preserve row version and stay in recruitment route',async()=>{
 mock((url,o)=>o?.method==='PATCH'?{item:{...app,status:'accepted'}}:{items:[app],total:1});render(<MemoryRouter initialEntries={['/workspace/club/recruitments/campaign/applications']}><ClubContext.Provider value={{...session,membership:{...session.membership,role:'head'}}}><Routes><Route path='/workspace/:clubId/recruitments/:campaignId/applications' element={<RecruitmentQueue/>}/></Routes></ClubContext.Provider></MemoryRouter>);
 fireEvent.click(await screen.findByText('Duyệt'));expect(calls.some(c=>c.options?.method==='PATCH')).toBe(false);fireEvent.click(within(screen.getByRole('dialog',{name:'Duyệt đơn ứng tuyển?'})).getByText('Xác nhận duyệt'));await waitFor(()=>expect(calls.some(c=>c.options?.method==='PATCH')).toBe(true));const request=calls.find(c=>c.options?.method==='PATCH')!;expect(request.url).toBe('/api/workspace/club/recruitments/campaign/applications/application/decision');expect(JSON.parse(String(request.options?.body))).toEqual({approve:true,expected_updated_at:stamp});expect(screen.getByText('Các đơn ứng tuyển vào ban bạn phụ trách.')).toBeTruthy();
});
it('recruitment cards in the activity feed open the recruitment page',()=>{
 render(<MemoryRouter><ActivityCard item={{activity_id:'campaign',campaign_id:'campaign',entry_type:'recruitment',club_id:'club',title:'Tuyển kỹ thuật',club_name:'CLB',starts_at:'2020-01-01',ends_at:'2099-01-01'}}/></MemoryRouter>);expect(screen.getByRole('link',{name:'Tuyển kỹ thuật'}).getAttribute('href')).toBe('/recruitments/campaign');expect(screen.getByText('Ứng tuyển trực tuyến')).toBeTruthy();
});
it('builder offers eleven types, preview and safe text rendering',()=>{
 const onChange=vi.fn();render(<FormBuilder questions={[q]} onChange={onChange}/>);expect(screen.getByLabelText('Loại trường').querySelectorAll('option')).toHaveLength(11);fireEvent.click(screen.getByText('+ Bộ thông tin sinh viên'));expect(onChange.mock.calls[0][0]).toHaveLength(8);fireEvent.click(screen.getByText('Xem trước form'));expect((screen.getByLabelText('Họ tên') as HTMLInputElement).disabled).toBe(true);render(<Markdown text={'# Title\n<img src=x onerror=alert(1)>\n[bad](javascript:alert(1))\n[good](https://example.com)'}/>);expect(document.querySelector('img')).toBeNull();expect(document.querySelector('a[href^="javascript:"]')).toBeNull();expect(screen.getByRole('link',{name:'good'}).getAttribute('rel')).toBe('noopener noreferrer');
});
it('notification destinations distinguish reviewer and applicant and reject external targets',()=>{
 expect(notificationTarget({href:'/me/recruitment-applications/app',club_id:'club'})).toBe('/me/recruitment-applications/app');expect(notificationTarget({href:'/workspace/club/recruitments/campaign/applications/app'})).toBe('/workspace/club/recruitments/campaign/applications/app');expect(notificationTarget({href:'https://evil.invalid'})).toBe('/me/recruitment-applications');
});

it('keeps answers when the applicant returns from review', async () => {
 mock(()=>({...detail,profile:{full_name:'Minh Hải'},can_apply:true,application:null}));
 render(<MemoryRouter initialEntries={['/recruitments/campaign/apply']}><Routes><Route path='/recruitments/:campaignId/apply' element={<RecruitmentApply token='token'/>}/></Routes></MemoryRouter>);
 fireEvent.change(await screen.findByLabelText('Chọn ban ứng tuyển'),{target:{value:'rd'}});
 fireEvent.change(screen.getByLabelText('Họ tên'),{target:{value:'Minh Hải Nguyễn'}});
 fireEvent.click(screen.getByRole('button',{name:/Xem lại đơn/}));
 expect(screen.getByText('Kiểm tra và nộp').getAttribute('aria-current')).toBe('step');
 fireEvent.click(screen.getByRole('button',{name:/Chỉnh sửa/}));
 expect((screen.getByLabelText('Họ tên') as HTMLInputElement).value).toBe('Minh Hải Nguyễn');
 expect(screen.getByText('Điền đơn').getAttribute('aria-current')).toBe('step');
});

it('opens the pending queue first and preserves the active filter in applicant detail links', async () => {
 mock(url=>({items:[{...app,status:url.includes('status=accepted')?'accepted':'submitted'}],total:1}));
 render(<MemoryRouter initialEntries={['/workspace/club/recruitments/campaign/applications']}><ClubContext.Provider value={session}><Routes><Route path='/workspace/:clubId/recruitments/:campaignId/applications' element={<RecruitmentQueue/>}/></Routes></ClubContext.Provider></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Chờ duyệt'}).getAttribute('aria-pressed')).toBe('true');
 await screen.findByRole('link',{name:/Xem chi tiết đơn/});
 fireEvent.click(screen.getByRole('button',{name:'Đã duyệt'}));
 const detailLink=await screen.findByRole('link',{name:/Xem chi tiết đơn/});
 expect(detailLink.getAttribute('href')).toContain('status=accepted');
 expect(calls.some(({url})=>url.includes('status=submitted'))).toBe(true);
 expect(calls.some(({url})=>url.includes('status=accepted'))).toBe(true);
});
