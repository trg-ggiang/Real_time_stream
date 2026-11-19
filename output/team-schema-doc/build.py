import json
from pathlib import Path
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
ROOT=Path(r'D:/Project/Livekit project/Real_time_stream');OUT=ROOT/'output/team-schema-doc'
columns=json.loads((ROOT/'output/schema-v2/columns.json').read_text(encoding='utf-8-sig'))
D=Document();sec=D.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11)
sec.top_margin=sec.bottom_margin=Inches(.65);sec.left_margin=sec.right_margin=Inches(.75)
sec.header_distance=sec.footer_distance=Inches(.27)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3']:
 s=D.styles[name];s.font.name='Arial';s.font.color.rgb=RGBColor(0,0,0)
 lang=OxmlElement('w:lang');lang.set(qn('w:val'),'vi-VN');s._element.get_or_add_rPr().append(lang)
D.styles['Normal'].font.size=Pt(11);D.styles['Normal'].paragraph_format.line_spacing=1.12;D.styles['Normal'].paragraph_format.space_after=Pt(6)
for name,size in [('Title',25),('Heading 1',17),('Heading 2',12.5),('Heading 3',11.5)]:
 s=D.styles[name];s.font.size=Pt(size);s.font.bold=True;s.paragraph_format.space_before=Pt(9);s.paragraph_format.space_after=Pt(8);s.paragraph_format.keep_with_next=True
D.styles['Title'].paragraph_format.space_before=Pt(0);D.styles['Subtitle'].font.size=Pt(11)
for n in ['List Bullet','List Number']:
 s=D.styles[n];s.font.name='Arial';s.font.size=Pt(10.8);s.paragraph_format.space_after=Pt(4);s.paragraph_format.line_spacing=1.08
h=sec.header.paragraphs[0];h.text='uniCircle    Tài liệu đồng bộ database và nghiệp vụ'
for r in h.runs:r.font.size=Pt(9)
f=sec.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.RIGHT
f.add_run('Phiên bản 17 tháng 11 năm 2026    Trang ').font.size=Pt(9)
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');f._p.append(fld)
D.core_properties.title='Thay đổi database và quy ước triển khai uniCircle';D.core_properties.author='Nhóm phát triển uniCircle'
def p(text='',style=None):return D.add_paragraph(text,style)
def bullet(text):return p(text,'List Bullet')
def title(text):return p(text,'Heading 1')
def sub(text):return p(text,'Heading 2')
def newpage(text):D.add_page_break();title(text)
def table(headers,rows,widths,codecols=(),small=10.2):
 t=D.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 for c,w in zip(t.columns,widths):c.width=Inches(w)
 def fmt(row,vals,head=False,idx=0):
  pr=row._tr.get_or_add_trPr();pr.append(OxmlElement('w:cantSplit'))
  if head:pr.append(OxmlElement('w:tblHeader'))
  for k,(c,text,w) in enumerate(zip(row.cells,vals,widths)):
   c.width=Inches(w);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER;tcpr=c._tc.get_or_add_tcPr()
   shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'20354D' if head else ('F2F5F8' if idx%2 else 'FFFFFF'));tcpr.append(shade)
   mar=OxmlElement('w:tcMar')
   for edge,val in [('top','65'),('bottom','65'),('left','85'),('right','85')]:
    x=OxmlElement('w:'+edge);x.set(qn('w:w'),val);x.set(qn('w:type'),'dxa');mar.append(x)
   tcpr.append(mar);a=c.paragraphs[0];a.paragraph_format.space_after=Pt(0);a.paragraph_format.line_spacing=1.07
   if headers[k]=='NULL':a.alignment=WD_ALIGN_PARAGRAPH.CENTER
   r=a.add_run(str(text));r.font.name='Consolas' if k in codecols and not head else 'Arial';r.font.size=Pt(9.4 if k in codecols and not head else small);r.font.bold=head;r.font.color.rgb=RGBColor(255,255,255) if head else RGBColor(0,0,0)
 fmt(t.rows[0],headers,True)
 for i,row in enumerate(rows):fmt(t.add_row(),row,idx=i)
 borders=OxmlElement('w:tblBorders')
 for e in ['top','left','bottom','right','insideH','insideV']:
  x=OxmlElement('w:'+e);x.set(qn('w:val'),'single');x.set(qn('w:sz'),'5');x.set(qn('w:color'),'D9D9D9');borders.append(x)
 t._tbl.tblPr.append(borders);p('').paragraph_format.space_after=Pt(1);return t
p('Thay đổi database và quy ước triển khai uniCircle','Title')
p('Bản bàn giao cho nhóm phát triển ngày 17 tháng 11 năm 2026','Subtitle')
p('Migration đã được import lên Supabase. Kết quả postflight do nhóm cung cấp đã xác nhận đủ cấu trúc, RLS và quyền thực thi. Tài liệu thống nhất cách hiểu dữ liệu và chỉ ra các phần code phải cập nhật để làm việc với schema mới.')
p('Cần phân biệt: database đã hỗ trợ nghiệp vụ, nhưng các API, giao diện và worker mới chưa được triển khai đầy đủ. Có bảng hoặc RPC không đồng nghĩa chức năng đã sẵn sàng cho người dùng.')
sub('1 Phạm vi đã áp dụng')
table(['Nhóm','Nội dung','Bảng mới'],[
 ['Tuyển dụng và phỏng vấn','Đợt tuyển, ban tuyển, câu hỏi, hồ sơ, câu trả lời, đánh giá, lịch và panel','8'],
 ['Sinh hoạt nội bộ','Channel, quyền bổ sung, tin nhắn và mốc đọc','4'],
 ['Thông báo','Công việc nền và hộp thông báo','2'],['Duyệt sửa CLB','Đề nghị thay đổi thông tin công khai','1'],['Lịch sử','Audit sự kiện quan trọng','1']],[1.35,4.75,.9])
p('Ngoài 16 bảng mới, migration có 14 RPC, 2 view tuyển dụng và thay đổi cấu trúc hoặc hành vi trên 9 bảng hiện có. Không tạo lại bảng nền, không đổi mật khẩu và không tự chỉ định head.')
sub('Cách đọc tài liệu')
bullet('Mục 2 và 3 dành cho cả nhóm: ảnh hưởng tới code, quyền và vòng đời nghiệp vụ.')
bullet('Mục 4 mô tả đầy đủ các cột và ràng buộc chính của 16 bảng mới.')
bullet('Mục 3 tổng hợp RPC và thông báo; mục 5 là checklist triển khai.')
p('Nguồn đối chiếu: migration 20261117000100_club_platform_extension.sql, catalog kiểm thử và postflight Supabase. Trước import có 84 tình huống SQL đạt trên PostgreSQL tạm; chưa phải nghiệm thu mọi API trên DB thật.')
newpage('2 Các bảng hiện có đã thay đổi')
p('Một số bảng giữ nguyên cột nhưng thay đổi trigger, quyền ghi hoặc quy ước cập nhật. Nhóm cần rà soát cả schema lẫn endpoint đang sử dụng chúng.')
table(['Bảng','Thay đổi sau migration','Tác động khi code'],[
 ['club_memberships','Role chairperson, head, member; chặn INSERT trực tiếp; chỉ UPDATE trực tiếp department_id, status, left_at.','Bỏ thêm bằng email. Đổi role qua RPC. Giữ một membership active mỗi người trong CLB.'],
 ['club_departments','is_private đổi qua RPC head; UPDATE trực tiếp name, description, status; version đơn điệu.','Tách metadata và privacy. Không gửi is_private trong payload sửa metadata.'],
 ['meetings','Thêm club_id nullable và FK; meeting đã gắn không đổi CLB hoặc owner.','Phòng cũ giữ NULL; tạo phòng CLB cần kiểm tra membership.'],
 ['clubs','Khóa sửa thông tin cốt lõi published nếu chưa duyệt revision; channel, outbox và version.','Liên hệ và ảnh theo API hiện tại; tên và mô tả qua revision.'],
 ['club_posts','Outbox và version đơn điệu.','Chỉ fanout bài vẫn public, published; không gửi bài internal cho follower.'],
 ['club_activities','Outbox, reminder và vô hiệu hóa job cũ; version đơn điệu.','Đổi lịch hoặc unpublish cần xét lại job, kiểm tra trạng thái trước gửi.'],
 ['activity_registrations','Phát sự kiện đăng ký hoặc hủy vào outbox.','Worker phải tạo thông báo; DB chưa tự hiển thị thông báo.'],
 ['meeting_sessions','Kiểm tra lịch phỏng vấn; purge chat khi end hoặc cancel.','Đổi lịch session và appointment cùng transaction.'],
 ['meeting_messages','Chỉ INSERT khi ongoing; purge theo phiên ở các lần end hoặc cancel sau import.','Chat meeting tạm thời; không bảo đảm lấy lại được tin đã purge.'],
],[1.7,2.85,2.45],codecols=(0,),small=9.8)
p('users.role không thêm head. Admin nền tảng vẫn nằm ở users.role; hồ sơ vẫn ở student_profiles. Các bảng hoạt động, đăng ký và điểm danh hiện có được giữ, không tạo lại nghiệp vụ trùng.')
import re
newpage('3 Quy ước nghiệp vụ và phân quyền mới')
source=(ROOT/'docs/database/20261117-platform-migration.md').read_text(encoding='utf-8-sig')
source=source[source.index('## Đối chiếu nghiệp vụ'):]
source=source[:source.index('## Tham chiếu kỹ thuật')]
source=source.replace('Chưa thay DB live, chưa code API/worker/FE mới, chưa commit hoặc push.','Nhóm đã import lên Supabase và postflight khớp. API, worker và FE mới vẫn cần triển khai; không suy ra chức năng đã hoàn thành từ việc có schema.')
source=source.replace('## Kết quả kiểm chứng','## Kết quả kiểm chứng và xác nhận sau import')
def clean(s):return re.sub(r'\*\*|`','',s).strip()
lines=source.splitlines();i=0
while i<len(lines):
 line=lines[i].strip()
 if not line:i+=1;continue
 if line.startswith('|'):
  data=[]
  while i<len(lines) and lines[i].strip().startswith('|'):
   vals=[clean(x) for x in lines[i].strip().strip('|').split('|')]
   if not all(re.fullmatch(r'[:\-\s]+',x or '-') for x in vals):data.append(vals)
   i+=1
  if len(data)>1:
   n=len(data[0]);widths=[2.3,4.7] if n==2 else [2.2,4.8] if n==2 else [7/n]*n
   table(data[0],data[1:],widths,small=10)
  continue
 if line.startswith('#'):
  name=clean(line.lstrip('#'));name=re.sub(r'[^\w\sÀ-ỹ]',' ',name);name=name.replace('_',' ')
  sub(name)
 elif line.startswith('- '):bullet(clean(line[2:]))
 else:p(clean(line))
 i+=1
p('Xác nhận postflight thực tế: 16 bảng mới đều bật RLS; 14 RPC đúng quyền service_role; browser roles không được EXECUTE; hai view và channel metadata đã có đủ. Không chạy lại migration chính.')
labels={'recruitment_campaigns':'Đợt tuyển thành viên','recruitment_departments':'Ban tham gia đợt tuyển','recruitment_questions':'Câu hỏi vòng đơn','recruitment_applications':'Hồ sơ ứng tuyển','application_answers':'Câu trả lời vòng đơn','application_reviews':'Đánh giá nội bộ','interview_appointments':'Lịch phỏng vấn','interview_panel_members':'Người phỏng vấn','club_channels':'Kênh sinh hoạt nội bộ','channel_members':'Quyền truy cập bổ sung','channel_messages':'Tin nhắn chat nội bộ','channel_read_states':'Mốc đã đọc','notification_jobs':'Công việc tạo thông báo','notifications':'Thông báo từng tài khoản','club_change_requests':'Đề nghị sửa thông tin CLB','audit_logs':'Lịch sử thao tác'}
desc={'recruitment_department_id':'Ban tuyển trong một đợt, khác với department_id của ban gốc.','admitted_membership_id':'Membership được tạo khi accepted, cùng transaction với kết quả.','last_read_message_id':'FK kép cùng channel_id tới channel_messages; phải thuộc đúng kênh.','created_at':'Thời điểm tạo bản ghi.','updated_at':'Version cập nhật do DB duy trì; giữ nguyên chuỗi khi làm CAS.','created_by':'Người tạo, backend lấy từ JWT.','updated_by':'Actor của thao tác cập nhật, backend xác minh từ JWT.','role':'Vai trò theo CLB, không phải role nền tảng.','title':'Tiêu đề hiển thị.','description':'Mô tả chi tiết nghiệp vụ.','cover_url':'Đường dẫn ảnh HTTP hoặc HTTPS.','application_opens_at':'Bắt đầu nhận đơn.','application_closes_at':'Hạn nhận đơn, phải sau thời điểm mở.','status':'Trạng thái vòng đời; xem quy ước nghiệp vụ ở phần trước.','requirements':'Yêu cầu tuyển dụng của ban trong đợt này.','target_quantity':'Chỉ tiêu dự kiến lớn hơn 0, chưa là giới hạn cứng.','question_text':'Nội dung câu hỏi vòng đơn, tối đa 2000 ký tự.','help_text':'Hướng dẫn trả lời bổ sung.','is_required':'Bắt buộc phải trả lời khi nộp.','max_length':'Giới hạn câu trả lời từ 1 đến 10000 ký tự.','sort_order':'Thứ tự dương trong bộ câu hỏi.','profile_snapshot':'JSONB chụp năm trường profile khi nộp; không đổi theo profile sau đó.','submitted_at':'Thời điểm nộp đơn do DB đặt.','withdrawn_at':'Thời điểm rút đơn.','decided_by':'Head quyết định kết quả cuối.','decided_at':'Thời điểm quyết định kết quả cuối.','result_message':'Thông báo kết quả cho ứng viên; không phải nhận xét nội bộ.','answer_text':'Câu trả lời văn bản, phải theo max_length của câu hỏi.','stage':'application hoặc interview.','score':'Điểm tùy chọn từ 0 đến 100.','recommendation':'pass, fail hoặc undecided; là đề xuất, không là quyết định cuối.','internal_note':'Nhận xét nội bộ, không trả cho ứng viên hoặc public.','scheduled_start_at':'Thời điểm bắt đầu phỏng vấn; khớp session.','scheduled_end_at':'Thời điểm kết thúc, sau bắt đầu và khớp session.','candidate_note':'Hướng dẫn được phép cho ứng viên xem.','cancelled_at':'Thời điểm hủy.','cancellation_reason':'Lý do hủy.','assigned_by':'Head phân công người phỏng vấn.','kind':'general hoặc department; quyết định cách suy ra quyền.','name':'Tên kênh không trống.','added_by':'Head cấp quyền bổ sung vào channel.','joined_at':'Thời điểm cấp quyền.','removed_at':'Thời điểm thu hồi; NULL nghĩa là grant chưa bị thu hồi.','removed_by':'Head thu hồi quyền.','client_message_id':'UUID client giữ nguyên qua retry để chống gửi trùng.','content':'Nội dung tin nhắn không trống, tối đa 5000 ký tự.','edited_at':'Thời điểm chỉnh sửa tin.','deleted_at':'Thời điểm soft delete; history RPC che nội dung.','deleted_by':'Sender hoặc head thực hiện soft delete.','last_read_at':'Thời điểm cập nhật mốc đọc.','event_type':'Tên sự kiện nghiệp vụ để worker định tuyến.','entity_type':'Loại đối tượng tham chiếu; không phải một FK chung.','entity_id':'ID đối tượng theo entity_type; tham chiếu đa loại.','payload':'JSONB dữ liệu định tuyến tối thiểu của job.','deduplication_key':'Khóa chống trùng; notifications unique theo recipient và khóa này.','run_at':'Thời điểm job được phép xử lý.','attempt_count':'Số lần nhận xử lý; worker giới hạn năm lần thử.','claim_token':'Token của lần nhận job, chỉ tồn tại khi processing.','locked_until':'Hạn lease; token hết hạn không được hoàn tất job.','processed_at':'Thời điểm job hoàn tất.','last_error':'Lỗi gần nhất, không ghi token hoặc mật khẩu.','actor_id':'Người gây ra sự kiện; NULL nếu hệ thống hoặc không có actor đáng tin.','type':'Loại thông báo nghiệp vụ.','body':'Nội dung thông báo hiển thị cho người nhận.','data':'JSONB ID đối tượng để điều hướng; quyền vẫn phải kiểm tra khi mở.','read_at':'NULL là chưa đọc; người nhận đánh dấu qua RPC.','requested_by':'Chủ nhiệm gửi đề nghị thay đổi.','proposed_data':'JSONB chỉ cho name, summary, description, mission.','base_club_updated_at':'Version CLB lúc gửi; phải khớp khi duyệt.','reviewed_by':'Admin quyết định revision.','reviewed_at':'Thời điểm admin quyết định.','review_note':'Lý do hoặc phản hồi xét duyệt.','action':'Tên thao tác được ghi nhận.','change_data':'JSONB metadata thay đổi, không ghi password, JWT hoặc toàn bộ câu trả lời.'}
cons=json.loads((ROOT/'output/schema-v2/constraints.json').read_text())
for num,(name,label) in enumerate(labels.items(),1):
 newpage(f'4 {num} {label}')
 a=p(name);a.runs[0].font.name='Consolas';a.runs[0].font.size=Pt(11)
 cc=[x for x in columns if x['table_name']==name];constraints=[x['definition'] for x in cons if x['table_name']==name]
 rows=[]
 for c in cc:
  key=c['column_name'];meaning=desc.get(key)
  if meaning is None:
   fk=next((x for x in constraints if x.startswith('FOREIGN KEY ('+key+')')),None)
   if fk:meaning='Tham chiếu '+fk.split('REFERENCES ',1)[1]+'.'
   elif any(x=='PRIMARY KEY ('+key+')' for x in constraints):meaning='Khóa chính, định danh bản ghi.'
   else:meaning='ID liên kết theo phạm vi nghiệp vụ của bảng.'
  if c['column_default']:meaning+=' Mặc định '+c['column_default'].replace('::text','')+'.'
  dtype={'timestamp with time zone':'timestamptz','numeric':'numeric(5,2)'}.get(c['data_type'],c['data_type'])
  rows.append([key,dtype,'Có' if c['is_nullable']=='YES' else 'Không',meaning])
 table(['Cột','Kiểu','NULL','Ý nghĩa và mặc định'],rows,[1.85,.9,.55,3.7],codecols=(0,),small=10)
 sub('Khóa và ràng buộc chính')
 for x in constraints:
  if x.startswith('PRIMARY KEY') or x.startswith('UNIQUE'):bullet(x)
 if name=='recruitment_applications':bullet('Head đúng ban quyết định. Accepted và tạo membership cùng transaction; unique campaign_id và applicant_id áp dụng cả đơn đã rút hoặc trượt.')
 if name=='channel_members':bullet('Chỉ head thêm hoặc gỡ người ngoài ban. Không có ủy quyền quản lý; membership phải active cùng CLB. Gia nhập lại không kế thừa grant cũ.')
 if name=='notification_jobs':bullet('Outbox không tự chạy. Worker phải claim lease, xác định lại người nhận và dùng RPC giao dịch để ghi batch an toàn.')
 if name=='club_change_requests':bullet('Một pending mỗi CLB; kiểm tra base version khi duyệt. Không thay bản công khai trong lúc chờ.')
 if name=='interview_appointments':bullet('Một appointment scheduled mỗi hồ sơ; một session chỉ gắn một appointment. Đổi lịch cả session và appointment cùng transaction.')
 if name=='channel_messages':bullet('Chỉ sender sửa nội dung; sender hoặc head soft-delete. RPC history che body đã xóa. Chat này lưu lâu dài, khác chat meeting.')
 p('NULL Có là được để trống theo cấu trúc. Ở một trạng thái nghiệp vụ cụ thể, CHECK hoặc trigger vẫn có thể bắt buộc giá trị. SQL migration là nguồn chuẩn cho giới hạn và ràng buộc đầy đủ.').runs[0].font.size=Pt(9.5)
newpage('5 Checklist bàn giao cho cả nhóm')
for x in ['Bỏ endpoint và nút thêm thành viên trực tiếp bằng email; gia nhập qua kết quả ứng tuyển.','Tách metadata ban khỏi privacy; metadata không gửi is_private. Privacy và bổ nhiệm head dùng RPC, đúng actor và version.','Giữ nguyên timestamp PostgreSQL dạng chuỗi; không làm mất microsecond khi chuyển qua JS Date.','API và websocket kiểm tra quyền ở server khi đọc, subscribe, gửi và broadcast. Ẩn UI không thay thế phân quyền.','Không trả internal_note hoặc toàn bộ profile snapshot qua endpoint public. Không đưa service key vào frontend.','Triển khai worker, hộp thông báo và các API mới; schema và postflight không đồng nghĩa chức năng đã hoàn tất.','Không chạy lại migration chính. Mọi điều chỉnh tiếp theo tạo migration mới, kiểm tra dữ liệu đang có trước khi sửa hoặc bỏ constraint.']:
 bullet(x)
p('Các nguồn cần dùng chung trong repository:')
for x in ['supabase/migrations/20261117000100_club_platform_extension.sql','supabase/verification/20261117_platform_postflight.sql','docs/database/20261117-platform-migration.md','docs/database/20261117-platform-schema-dictionary.md']:
 a=p(x);a.runs[0].font.name='Consolas';a.runs[0].font.size=Pt(9)
p('Tài liệu không chứa mật khẩu, token hoặc dữ liệu hồ sơ thật. Quyền và cấu trúc đã được xác nhận bằng postflight; kiểm thử end-to-end, kiểm thử đồng thời và code cho module mới vẫn là công việc tiếp theo.')
path=OUT/'uniCircle_Thay_doi_database_va_quy_uoc_nhom_2026-11-17.docx';
for el in list(D.styles.element.iter(qn('w:pBdr'))):
 el.getparent().remove(el)
for el in list(D.element.iter(qn('w:pBdr'))):
 el.getparent().remove(el)
D.save(path)
print(str(path))
