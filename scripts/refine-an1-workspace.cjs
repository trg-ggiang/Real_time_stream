// Refine only records tracked by the previous seed manifest. Never deletes rows.
require('reflect-metadata');
process.loadEnvFile('backend/.env');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../backend/dist/app.module');
const { SupabaseService } = require('../backend/dist/supabase/supabase.service');
const { WorkspaceContent } = require('../backend/dist/workspace/workspace-content.service');
const { UsersService } = require('../backend/dist/users/users.service');
const fs = require('node:fs/promises');
const manifest = require('../data/an1-workspace-demo.json');
const apply = process.argv.includes('--apply');
const names = ['Nguyễn Khánh Linh','Trần Minh Nam','Lê Ngọc Mai'];
const posts = [
  ['Chào mừng đến không gian AE 18','Cùng cập nhật bảng tin, trao đổi với các ban và theo dõi lịch sinh hoạt của CLB.',
    'Chào mừng các bạn đến với AE 18!\n\nKênh Chung dành cho trao đổi hằng ngày; thông tin theo từng ban được cập nhật tại kênh tương ứng. Lịch sinh hoạt và các đề xuất mới nằm trong mục Hoạt động.\n\nCác bạn giới thiệu ngắn về bản thân, sở thích và điều muốn cùng CLB thực hiện trong tháng này nhé.'],
  ['Kế hoạch sinh hoạt tuần tới','Các ban thống nhất nội dung chia sẻ, chuẩn bị tài liệu và phân công công việc cho buổi sinh hoạt cuối tuần.',
    'Buổi sinh hoạt tuần này tập trung vào kết nối thành viên và phối hợp giữa các ban.\n\nBan văn nghệ chuẩn bị phần giao lưu mở đầu. Ban truyền thông tổng hợp hình ảnh và thông tin chương trình. Các nhóm gửi danh sách người tham gia và những hỗ trợ cần thiết trước tối thứ Sáu.\n\nMọi góp ý về nội dung vui lòng trao đổi trong kênh Chung để ban chủ nhiệm tổng hợp.'],
  ['Đề xuất buổi chia sẻ kỹ năng thuyết trình','Một buổi chia sẻ giúp thành viên luyện cách trình bày ý tưởng, phản hồi và phối hợp khi làm việc nhóm.',
    'Em đề xuất tổ chức buổi chia sẻ kỹ năng thuyết trình cho các thành viên mới. Nội dung gồm xây dựng dàn ý, trình bày trong ba phút và nhận góp ý từ các nhóm.\n\nMỗi nhóm chuẩn bị một chủ đề gần gũi với hoạt động CLB. Em có thể phụ trách slide hướng dẫn và tổng hợp câu hỏi. Mong ban chủ nhiệm xem xét thời gian phù hợp.'],
  ['Tổng kết hoạt động tháng 11','Tổng hợp những việc đã hoàn thành, các nội dung cần cải thiện và kế hoạch phối hợp trong tháng tới.',
    'Trong tháng 11, các ban đã hoàn thành việc phân công đầu mối và thống nhất lịch sinh hoạt chung. Các thành viên tích cực chia sẻ ý tưởng và đăng ký tham gia những nhóm phù hợp.\n\nPhần cần bổ sung: số người tham dự từng buổi, phản hồi của các ban và danh sách nhiệm vụ chuyển sang tháng sau. Ban chủ nhiệm sẽ hoàn thiện nội dung sau khi nhận báo cáo.'],
  ['Góc sinh hoạt AE siêu nhân','Cập nhật lịch gặp mặt và những việc các thành viên AE siêu nhân đang cùng chuẩn bị.',
    'Không gian này giúp các thành viên AE siêu nhân giữ liên lạc và phối hợp công việc giữa các buổi gặp mặt.\n\nMọi người theo dõi bảng tin để nắm các thông báo chung, trao đổi ý tưởng trong kênh Chung và kiểm tra lịch họp trước khi đăng ký tham gia. Các đề xuất mới luôn được chào đón.'],
  ['Ý tưởng tổ chức ngày hoạt động nhóm','Đề xuất một buổi kết nối thành viên qua các nhiệm vụ nhỏ, trò chơi phối hợp và chia sẻ kinh nghiệm.',
    'Em đề xuất dành một buổi cuối tuần cho hoạt động nhóm. Các đội lần lượt thực hiện nhiệm vụ cần phối hợp, sau đó chia sẻ cách phân công và giải quyết tình huống.\n\nChương trình dự kiến kéo dài khoảng hai giờ. Em xin nhận phần chuẩn bị thể lệ và danh sách dụng cụ; mong các ban góp ý thêm về địa điểm và cách chia nhóm.'],
];
const activities = [
  ['Giao lưu thành viên AE 18','Gặp gỡ các thành viên, làm quen với các ban và cùng xây dựng kế hoạch sinh hoạt cuối tháng.', 'Buổi giao lưu gồm giới thiệu thành viên, chia nhóm theo sở thích và trao đổi mong muốn khi tham gia CLB. Mỗi nhóm chuẩn bị phần giới thiệu ngắn và một ý tưởng muốn thực hiện trong tháng tới.'],
  ['Chia sẻ kỹ năng làm việc nhóm','Cùng luyện cách phân công nhiệm vụ, trao đổi ý tưởng và phối hợp để hoàn thành một dự án nhỏ.', 'Các nhóm thực hành lập kế hoạch, phân chia vai trò và thống nhất cách theo dõi tiến độ. Sau phần làm việc chung, mỗi nhóm chia sẻ điều đã làm tốt và khó khăn cần tháo gỡ. Thành viên mang theo sổ ghi chép hoặc máy tính nếu thuận tiện.'],
  ['Thực hành tổ chức chương trình','Buổi thực hành xây dựng kịch bản, phân công đầu mối và xử lý những tình huống thường gặp khi tổ chức sự kiện.', 'Thành viên chia thành các nhóm phụ trách nội dung, hậu cần và truyền thông. Mỗi nhóm chuẩn bị một phần của chương trình ngắn, sau đó phối hợp chạy thử và góp ý cho nhau. Ban chủ nhiệm sẽ tổng hợp phương án trước khi chốt kế hoạch.'],
  ['Sinh hoạt tổng kết cuối tháng','Nhìn lại hoạt động tháng 11, ghi nhận đóng góp của thành viên và chuẩn bị kế hoạch tháng tiếp theo.', 'Các ban chuẩn bị báo cáo ngắn về công việc đã hoàn thành và những điều cần hỗ trợ. Buổi sinh hoạt dành thời gian cho phản hồi của thành viên, chia sẻ kinh nghiệm và thống nhất các đầu việc ưu tiên trong tháng tới.'],
  ['Sinh hoạt AE siêu nhân','Buổi gặp mặt để cập nhật công việc, kết nối thành viên và thống nhất kế hoạch hoạt động của CLB.', 'Các thành viên cùng trao đổi tiến độ, trình bày ý tưởng mới và đăng ký các nhóm hoạt động phù hợp. Mỗi bạn chuẩn bị một đề xuất hoặc một câu hỏi để buổi gặp có thêm nhiều góc nhìn.'],
];
const messages = [
  'Chào mọi người! Tuần này mình thống nhất kế hoạch cho buổi sinh hoạt cuối tuần nhé.',
  'Em đã đọc bảng tin và lịch sinh hoạt rồi ạ. Em đăng ký hỗ trợ phần đón thành viên mới.',
  'Em vừa gửi đề xuất buổi thực hành tổ chức chương trình, nhờ anh An xem giúp nội dung ạ.',
  'Mọi người xem mục Hoạt động và góp ý trước buổi họp nhé. Nếu cần thêm dụng cụ thì báo mình.',
  'Ban em sẽ chuẩn bị phần giao lưu mở đầu và tổng hợp danh sách người tham gia.',
  'Em có thể phụ trách tài liệu hướng dẫn và chụp lại các đầu việc sau buổi họp.',
  'Cảm ơn mọi người. Các ban gửi thông tin trước tối thứ Sáu để mình chốt lịch nhé.',
  'Dạ, em sẽ cập nhật phương án trong hôm nay. Hẹn gặp mọi người cuối tuần!',
  'Chào cả nhà, buổi gặp mặt tới mình dành thêm thời gian cho các ý tưởng hoạt động nhóm nhé.',
  'Em đã chuẩn bị đề xuất và đăng lên bảng tin rồi ạ. Mong mọi người góp ý thêm.',
  'Mình đã nhận được. Linh bổ sung giúp mình danh sách dụng cụ và số người phụ trách nhé.',
  'Dạ được ạ, em sẽ bổ sung trước buổi họp để mọi người tiện theo dõi.',
  'Mình cần tổng hợp các đề xuất đang chờ duyệt trước buổi sinh hoạt. Các ban rà soát giúp phần của mình nhé.',
  'Ưu tiên chốt nội dung giao lưu và phân công người phụ trách hậu cần trong tuần này.',
  'Sau khi thống nhất, mình sẽ cập nhật lịch và thông báo đến các thành viên trong kênh Chung.',
];
const meetingNames = ['Trao đổi cùng ban chủ nhiệm','Sinh hoạt AE 18 hằng tuần','Gặp mặt thành viên AE siêu nhân'];
const check = (r, op) => { if (r.error) throw new Error(`${op}: ${r.error.code} ${r.error.message}`); return r.data; };

(async()=>{
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
  try {
    const db=app.get(SupabaseService).client, service=app.get(WorkspaceContent);
    const owner=await app.get(UsersService).findByEmail(manifest.owner);
    if (!owner) throw new Error('Existing owner was not found');
    console.log(JSON.stringify({mode:apply?'apply':'dry-run',users:names.length,posts:posts.length,activities:activities.length,messages:messages.length,meetings:meetingNames.length}));
    if (!apply) return;
    for (let i=0;i<manifest.users.length;i++) {
      const user=manifest.users[i];
      check(await db.from('users').update({display_name:names[i]}).eq('user_id',user.user_id).eq('email',user.email),'member name');
      check(await db.from('student_profiles').update({full_name:names[i],bio:'Tham gia tổ chức các buổi sinh hoạt và hỗ trợ hoạt động của CLB.',school_or_faculty:'Đại học Bách khoa Hà Nội',major:'Công nghệ thông tin',cohort:'K69'})
        .eq('user_id',user.user_id),'member profile');
      user.display_name=names[i];
    }
    for (const [kind, values] of [['posts',posts],['activities',activities]]) for(let i=0;i<manifest[kind].length;i++) {
      const tracked=manifest[kind][i], pk=kind==='posts'?'post_id':'activity_id', table=kind==='posts'?'club_posts':'club_activities';
      const row=check(await db.from(table).select('*').eq(pk,tracked[pk]).single(),'read content');
      if (!/demo|giả lập|kiểm thử|dữ liệu mẫu/i.test([row.title,row.summary,row.content,row.description,row.location_name,row.location_address].join(' '))) continue;
      const status=row.publication_status, author=row[kind==='posts'?'author_id':'created_by'];
      if (!['draft','pending_review','published'].includes(status)) throw new Error('Content state changed; left untouched');
      const payload = kind==='posts' ? {post_id:row.post_id,title:values[i][0],summary:values[i][1],content:values[i][2],visibility:row.visibility,cover_url:row.cover_url}
        : Object.assign(Object.fromEntries(['activity_id','starts_at','ends_at','format','join_url','cover_url','capacity','registration_opens_at','registration_closes_at'].map(k=>[k,row[k]])),
          {title:values[i][0],summary:values[i][1],description:values[i][2],location_name:'Phòng sinh hoạt CLB',location_address:'Đại học Bách khoa Hà Nội, số 1 Đại Cồ Việt, Hà Nội'});
      let saved=(await service.save(author,row.club_id,kind,{...payload,expected_updated_at:row.updated_at},row[pk])).item;
      if (status!=='draft') saved=(await service.submit(author,row.club_id,kind,row[pk],saved.updated_at)).item;
      if (status==='published' && saved.publication_status==='pending_review') saved=(await service.review(owner.userId,row.club_id,kind,row[pk],{decision:'published',expected_updated_at:saved.updated_at})).item;
      if (saved.publication_status!==status) throw new Error('Unexpected final publication state');
      tracked.title=saved.title; tracked.status=saved.publication_status;
    }
    for(let i=0;i<manifest.messages.length;i++) {
      const key=manifest.messages[i].message_id;
      const row=check(await db.from('channel_messages').select('message_id,content,sender_membership_id,deleted_at').eq('message_id',key).single(),'read message');
      if(row.deleted_at || !row.content.startsWith('[DEMO]'))continue;
      const sender=check(await db.from('club_memberships').select('user_id').eq('membership_id',row.sender_membership_id).single(),'message author');
      check(await db.from('channel_messages').update({content:messages[i],updated_by:sender.user_id,edited_at:new Date().toISOString()}).eq('message_id',key).eq('content',row.content),'message text');
    }
    for(let i=0;i<manifest.meetings.length;i++) {
      const row=manifest.meetings[i];
      check(await db.from('meetings').update({title:meetingNames[i]}).eq('meeting_id',row.meeting_id).eq('created_by',owner.userId).like('title','[DEMO%'),'meeting name');
      row.title=meetingNames[i];
    }
    manifest.presentation='Nội dung đã chỉnh theo cách trình bày tự nhiên, không gắn nhãn trong giao diện.';
    await fs.writeFile('data/an1-workspace-demo.json',JSON.stringify(manifest,null,2)+'\n');
    console.log('Updated tracked workspace content; original IDs and publication states preserved.');
  } finally { await app.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1});
