// Additive, repeatable demo seed. No deletes; no schema or credential changes.
require('reflect-metadata');
process.loadEnvFile('backend/.env');
const { createHash } = require('node:crypto');
const { writeFile, mkdir } = require('node:fs/promises');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../backend/dist/app.module');
const { SupabaseService } = require('../backend/dist/supabase/supabase.service');
const { UsersService } = require('../backend/dist/users/users.service');
const { WorkspaceContent } = require('../backend/dist/workspace/workspace-content.service');
const { WorkspaceChannels } = require('../backend/dist/workspace/workspace-channels.service');
const { MeetingsService } = require('../backend/dist/meetings/meetings.service');
const apply = process.argv.includes('--apply');
const tag = 'an1-workspace-demo-v1';
const id = key => {
  const h = createHash('sha256').update(`${tag}:${key}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
const report = { dataset: tag, owner: 'an1@gmail.com', clubs: [], users: [], posts: [], activities: [], messages: [], meetings: [] };
function check(result, operation) { if (result.error) throw new Error(`${operation}: ${result.error.code} ${result.error.message}`); return result.data; }

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const db = app.get(SupabaseService).client;
    const content = app.get(WorkspaceContent), chat = app.get(WorkspaceChannels), meetings = app.get(MeetingsService);
    const owner = await app.get(UsersService).findByEmail('an1@gmail.com');
    if (!owner) throw new Error('Existing an1 account was not found');
    const memberships = check(await db.from('club_memberships').select('membership_id,club_id,department_id,role,clubs(name,status)')
      .eq('user_id', owner.userId).eq('status','active').eq('role','chairperson'), 'owner memberships');
    const targets = ['AE 18', 'AE siêu nhân'].map(name => {
      const m = memberships.find(m => m.clubs?.name === name && m.clubs?.status === 'published');
      if (!m) throw new Error(`Owner is not chairperson of published club ${name}`);
      return { ...m, name };
    });
    const departments = check(await db.from('club_departments').select('department_id,club_id,name,is_management,status').in('club_id', targets.map(c=>c.club_id)).eq('status','active'), 'departments');
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', clubs: targets.map(c=>c.name),
      planned: { demo_users: 3, memberships: 4, posts: 6, activities: 5, messages: 15, meetings: 3, sessions: 5 } }));
    if (!apply) return;
    report.clubs = targets.map(c => ({ club_id: c.club_id, name: c.name }));
    const people = [ ['linh','Linh Demo'], ['nam','Nam Demo'], ['mai','Mai Demo'] ];
    for (const [key, display_name] of people) {
      const user_id = id(`user:${key}`), email = `${tag}.${key}@example.invalid`;
      const old = check(await db.from('users').select('user_id,email').eq('user_id',user_id).maybeSingle(),'find demo user');
      if (old && old.email !== email) throw new Error('Demo ID belongs to a different account');
      if (!old) check(await db.from('users').insert({ user_id, email, display_name, role:'student' }), 'insert demo user');
      // These synthetic members intentionally have no password and cannot log in.
      check(await db.from('student_profiles').upsert({ user_id, full_name:display_name,
        student_code:`DEMO-AN1-${key.toUpperCase()}`, school_or_faculty:'Dữ liệu demo', major:'Kiểm thử workspace', cohort:'K-Demo',
        bio:`${tag}: thành viên giả lập để kiểm thử, không phải hồ sơ sinh viên thật.` }, { onConflict:'user_id',ignoreDuplicates:true }), 'demo profile');
      report.users.push({ user_id, display_name, email });
    }
    for (const [clubIndex, personIndex] of [[0,0],[0,1],[0,2],[1,0]]) {
      const club = targets[clubIndex], person = report.users[personIndex];
      const department = departments.find(d=>d.club_id===club.club_id&&!d.is_management) || departments.find(d=>d.department_id===club.department_id);
      if (!department) throw new Error('No valid demo department');
      const existing = check(await db.from('club_memberships').select('membership_id').eq('user_id',person.user_id).eq('club_id',club.club_id).maybeSingle(),'demo membership lookup');
      if (!existing) check(await db.from('club_memberships').insert({ membership_id:id(`membership:${clubIndex}:${personIndex}`), club_id:club.club_id,
        user_id:person.user_id,department_id:department.department_id,role:'member',status:'active' }), 'insert demo membership');
    }
    async function addContent(clubIndex, kind, key, author, desired, values) {
      const club = targets[clubIndex], table = kind === 'posts' ? 'club_posts' : 'club_activities', pk = kind === 'posts' ? 'post_id' : 'activity_id';
      const contentId = id(`${kind}:${key}`);
      let item = check(await db.from(table).select('*').eq(pk,contentId).maybeSingle(), 'existing demo content');
      if (item && (item.club_id !== club.club_id || item.title !== values.title || item[kind==='posts'?'author_id':'created_by'] !== author)) throw new Error('Existing content differs; refusing to overwrite');
      if (!item) item = (await content.save(author,club.club_id,kind,{ [pk]:contentId,...values })).item;
      if (desired !== 'draft' && ['draft','changes_requested'].includes(item.publication_status)) item = (await content.submit(author,club.club_id,kind,contentId,item.updated_at)).item;
      if (desired === 'published' && item.publication_status === 'pending_review') item = (await content.review(owner.userId,club.club_id,kind,contentId,{decision:'published',expected_updated_at:item.updated_at})).item;
      if (item.publication_status !== desired) throw new Error(`Unexpected demo state: ${key} ${item.publication_status}`);
      report[kind].push({ [pk]:contentId,club_id:club.club_id,title:item.title,status:item.publication_status });
    }
    const post = (title, text, visibility='internal') => ({ title:`[DEMO] ${title}`,summary:text,content:`${text}\n\nNội dung giả lập phục vụ kiểm thử workspace của tài khoản an1. Không phải thông báo hoạt động thật.`,visibility,cover_url:null });
    await addContent(0,'posts','welcome',owner.userId,'published',post('Chào mừng đến không gian AE 18','Cùng làm quen với bảng tin, các kênh trao đổi và lịch sinh hoạt của CLB.'));
    await addContent(0,'posts','plan',owner.userId,'published',post('Kế hoạch sinh hoạt tuần tới','Các ban chuẩn bị ý tưởng và trao đổi trước buổi sinh hoạt. Đây là dữ liệu demo.'));
    await addContent(0,'posts','review',report.users[0].user_id,'pending_review',post('Đề xuất buổi chia sẻ kỹ năng','Bài của thành viên đang chờ chủ nhiệm duyệt; bạn có thể thử duyệt hoặc yêu cầu chỉnh sửa.'));
    await addContent(0,'posts','draft',owner.userId,'draft',post('Bản nháp tổng kết tháng','Bản nháp của an1 để thử mở trình soạn thảo, sửa nội dung và gửi duyệt.'));
    await addContent(1,'posts','second-welcome',owner.userId,'published',post('Góc sinh hoạt AE siêu nhân','Bảng tin nội bộ của CLB thứ hai để kiểm tra chuyển đổi workspace và phân tách dữ liệu.'));
    await addContent(1,'posts','second-review',report.users[0].user_id,'pending_review',post('Ý tưởng hoạt động nhóm','Đề xuất đang chờ chủ nhiệm xem xét trong CLB thứ hai; dữ liệu hoàn toàn giả lập.'));
    const activity = (title,date) => ({ title:`[DEMO] ${title}`,summary:'Hoạt động mẫu để kiểm tra danh sách, lịch sắp tới và luồng duyệt trong workspace.',
      description:'Dữ liệu giả lập để thử giao diện và quyền thao tác. Không phải sự kiện thật và không yêu cầu thanh toán hoặc liên hệ bên ngoài.',
      starts_at:`2026-11-${date}T18:30:00+07:00`,ends_at:`2026-11-${date}T20:30:00+07:00`,format:'onsite',
      location_name:'Phòng sinh hoạt demo',location_address:'Địa điểm giả lập, chưa tổ chức thực tế',capacity:30,
      registration_opens_at:'2026-11-19T00:00:00+07:00',registration_closes_at:`2026-11-${date}T17:00:00+07:00`,cover_url:null });
    await addContent(0,'activities','meetup',owner.userId,'published',activity('Giao lưu thành viên',21));
    await addContent(0,'activities','workshop',owner.userId,'published',activity('Chia sẻ kỹ năng làm việc nhóm',23));
    await addContent(0,'activities','proposal',report.users[1].user_id,'pending_review',activity('Đề xuất buổi thực hành',25));
    await addContent(0,'activities','draft',owner.userId,'draft',activity('Bản nháp hoạt động cuối tháng',28));
    await addContent(1,'activities','second-meetup',owner.userId,'published',activity('Sinh hoạt AE siêu nhân',22));
    async function message(clubIndex, author, key, text, management=false) {
      const club = targets[clubIndex];
      const channels = await chat.list(author,club.club_id);
      const channel = channels.items.find(c=>management ? c.department_id===club.department_id : c.kind==='general');
      if (!channel) throw new Error('Demo sender has no accessible target channel');
      const clientId = id(`message:${key}`);
      const old = check(await db.from('channel_messages').select('message_id').eq('channel_id',channel.channel_id).eq('client_message_id',clientId).maybeSingle(),'demo message lookup');
      const item = old || (await chat.send(author,club.club_id,channel.channel_id,{ client_message_id:clientId,content:text })).item;
      report.messages.push({ message_id:item.message_id,channel_id:channel.channel_id });
    }
    const conversation = [
      [owner.userId,'[DEMO] Chào mọi người! Đây là cuộc trò chuyện mẫu để thử workspace.'],
      [report.users[0].user_id,'[DEMO] Em đã đọc bảng tin và lịch sinh hoạt rồi ạ.'],
      [report.users[1].user_id,'[DEMO] Em vừa gửi một đề xuất hoạt động, nhờ chủ nhiệm xem giúp.'],
      [owner.userId,'[DEMO] Mọi người kiểm tra phần Hoạt động và góp ý trước buổi họp nhé.'],
      [report.users[2].user_id,'[DEMO] Ban em sẽ chuẩn bị nội dung và tài liệu chia sẻ.'],
      [report.users[0].user_id,'[DEMO] Mình có thể thử gửi tin nhắn, tải lại trang và chuyển giữa các kênh.'],
      [owner.userId,'[DEMO] Khi dùng xong, nhớ phân biệt dữ liệu mẫu với thông tin CLB thật.'],
      [report.users[1].user_id,'[DEMO] Cảm ơn mọi người, hẹn gặp tại buổi sinh hoạt mẫu!'],
    ];
    for(let i=0;i<conversation.length;i++) await message(0,conversation[i][0],`main-${i}`,conversation[i][1]);
    for(let i=0;i<4;i++) await message(1,i%2?report.users[0].user_id:owner.userId,`second-${i}`,`[DEMO] Trao đổi mẫu ${i+1} của AE siêu nhân, độc lập với CLB AE 18.`);
    for(let i=0;i<3;i++) await message(0,owner.userId,`management-${i}`,`[DEMO] Ghi chú Ban quản trị ${i+1}: chuẩn bị nội dung và kiểm tra các đề xuất đang chờ duyệt.`,true);
    async function meeting(clubIndex,key,title,quick,recurrenceRule=null,start=null,end=null) {
      const club=targets[clubIndex], name=`[DEMO ${tag}] ${title}`;
      let item=check(await db.from('meetings').select('meeting_id,meeting_code,created_by').eq('club_id',club.club_id).eq('title',name).maybeSingle(),'existing demo meeting');
      if(item && item.created_by!==owner.userId) throw new Error('Demo meeting has a different owner');
      if(!item) item=quick?await meetings.createQuickMeeting(owner,{title:name,clubId:club.club_id}):await meetings.createMeeting(owner,{title:name,clubId:club.club_id,recurrenceRule});
      if(!quick){const sessions=check(await db.from('meeting_sessions').select('session_id').eq('meeting_id',item.meeting_id),'demo sessions');if(!sessions.length)await meetings.createSession(owner,item.meeting_id,{scheduledStartAt:start,scheduledEndAt:end});}
      report.meetings.push({meeting_id:item.meeting_id,meeting_code:item.meeting_code,club_id:club.club_id,title:name});
    }
    await meeting(0,'quick','Phòng gọi thử',true);
    await meeting(0,'weekly','Sinh hoạt hằng tuần',false,'FREQ=WEEKLY;COUNT=3','2026-11-21T19:00:00+07:00','2026-11-21T20:00:00+07:00');
    await meeting(1,'single','Hẹn gặp thành viên',false,null,'2026-11-22T19:00:00+07:00','2026-11-22T20:00:00+07:00');
    await mkdir('data',{recursive:true});
    await writeFile('data/an1-workspace-demo.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ verifiedManifest:'data/an1-workspace-demo.json',counts:Object.fromEntries(Object.entries(report).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])) }));
  } finally { await app.close(); }
})().catch(error=>{ console.error(error.message); process.exitCode=1; });
