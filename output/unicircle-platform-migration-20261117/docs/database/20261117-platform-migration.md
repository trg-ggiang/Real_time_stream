# Migration tổng thể bổ sung nền tảng CLB — 17/11/2026

## Dùng bản nào?

File chính: `supabase/migrations/20261117000100_club_platform_extension.sql`.

Đây là **migration bổ sung cho database Supabase hiện có**, không phải script tạo database rỗng. Không chạy lại schema core cũ, không chạy toàn bộ thư mục migrations một cách tự động. Bản này không tạo lại users, clubs, activity hoặc meeting; không sửa mật khẩu/role nền tảng, không seed tài khoản, không tự chỉ định head.

Migration không được tự chạy trên Supabase trong phiên chuẩn bị. Đã đọc metadata qua REST để đối chiếu các cột hiện tại; không thể kết luận thân mọi function live giống fixture chỉ từ metadata đó. Các precondition trong SQL sẽ chặn thiếu bảng/function hoặc tên đã tồn tại.

## Những tác động cần đọc trước khi import

1. **Chỉ tuyển dụng mới thêm membership thông thường.** Service role bị thu hồi INSERT trực tiếp vào club_memberships; trigger khởi tạo chủ nhiệm và trigger tuyển thành công vẫn hoạt động. Backend/UI hiện có thao tác Thêm thành viên bằng email phải bỏ/thay thế. Nếu gọi endpoint cũ sau import, DB sẽ từ chối. Đây là thay đổi chủ đích theo nghiệp vụ chỉ ứng tuyển, không phải lỗi kết nối.
2. Service role chỉ UPDATE trực tiếp department_id/status/left_at trong membership; đổi role đi qua RPC có kiểm tra chủ nhiệm. Role head thuộc CLB/ban, không thuộc users.role.
3. **Sửa độ riêng tư của ban đi qua head.** Service role chỉ sửa trực tiếp name/description/status; không sửa is_private. API sửa ban hiện gửi cả is_private nên phải tách payload metadata khỏi thao tác privacy, dùng RPC head cho privacy. Điều này tránh chủ nhiệm tự đổi private thành public để vào đọc.
4. **Chat meeting là tạm thời:** từ sau import, chuyển session sang ended/cancelled sẽ xóa meeting_messages của đúng session đó. DB chặn tin nhắn đến muộn vào phiên không ongoing. Không xóa hàng loạt tin nhắn đã có lúc import; lịch sử của phiên kết thúc từ trước không được backfill purge tự động. Chat nội bộ channel được lưu lâu dài.
5. Tên/summary/description/mission của CLB published chỉ đổi qua revision được admin duyệt đúng phiên bản. Liên hệ/ảnh vẫn sửa bằng luồng hiện tại. Không thay đổi các public view CLB hiện hữu.
6. Các bảng channel được tạo và **backfill metadata** một kênh chung/CLB, một kênh/ban cho dữ liệu đã có. Không tạo tin nhắn hoặc cấp thêm quyền cá nhân.
7. Schema không tự tạo API, giao diện hay worker. Chưa có màn/API tuyển dụng, chat nội bộ, notifications, đổi head hoặc revisions trong code hiện tại. Cần implement backend/FE tiếp theo trước khi sử dụng đầy đủ.

## Cách import

1. Lưu bản backup/snapshot DB theo quy trình của nhóm. Thực hiện trên môi trường test trước.
2. Trong Supabase SQL Editor, chạy toàn bộ `supabase/verification/20261117_platform_preflight.sql`. File chỉ đọc, trả một bảng kết quả có section/result.
3. Kiểm tra: đủ bảng nền; extension chưa cài; meetings chưa có club_id; các trigger core khởi tạo CLB/cấu trúc còn bật. Không chạy nếu DB đã có bảng mới cùng tên hoặc schema đã tùy biến khác.
4. Tạo query mới, dán **toàn bộ** file migration chính từ BEGIN đến COMMIT, chạy một lần bằng database owner/postgres. Chọn thời điểm ít thao tác ghi. Không chạy từng đoạn hoặc bỏ qua lỗi.
5. Chạy `supabase/verification/20261117_platform_postflight.sql`. Đây cũng là file chỉ đọc, trả một bảng kết quả.
6. Lưu kết quả postflight để nhóm đối chiếu. Nếu gặp lỗi, gửi nguyên thông báo lỗi; không tự DROP TABLE, tắt trigger hoặc xóa constraint để chạy tiếp.

Migration có một transaction và lock chống chạy đồng thời. Nếu lỗi trong transaction, các thay đổi của lần chạy đó không được commit. Nếu SQL Editor báo transaction đang aborted, dùng ROLLBACK để kết thúc transaction lỗi trước khi thử lại. Chạy lại sau lần đã thành công sẽ chủ động báo đã tồn tại, không giả vờ cài lại thành công. Không có script rollback phá hủy sau khi dữ liệu nghiệp vụ mới đã phát sinh; khi cần điều chỉnh dùng migration tiếp theo.

## Tổng quan thay đổi

### Bảng nền

- club_memberships.role: chairperson/head/member. Một membership active vẫn thuộc một ban, một người chỉ có một membership active trong một CLB; chủ nhiệm vẫn ở Ban quản trị.
- meetings.club_id: FK nullable; meeting cũ giữ NULL, không tự gắn vào một CLB. Meeting đã gắn không được đổi CLB/owner.
- Thêm timestamp version đơn điệu cho clubs/memberships/posts/activities để cập nhật liên tiếp cùng transaction vẫn có token khác nhau. Các trigger khởi tạo, kiểm tra cấu trúc và publication hiện có được giữ.
- Head được bổ nhiệm từ thành viên active qua RPC của chủ nhiệm. **Không khóa cứng một head/ban** vì số lượng chưa được nhóm quyết định. Head Ban quản trị cũng phải được bổ nhiệm rõ ràng nếu muốn có người quản trị channel của ban đó; chairperson không tự trở thành head.

### 16 bảng mới

| Nhóm | Bảng | Vai trò |
| --- | --- | --- |
| Tuyển dụng | recruitment_campaigns | Đợt tuyển, thời hạn, trạng thái |
| Tuyển dụng | recruitment_departments | Ban tuyển trong từng đợt; yêu cầu, chỉ tiêu dự kiến |
| Tuyển dụng | recruitment_questions | Bộ câu hỏi văn bản theo ban/đợt |
| Tuyển dụng | recruitment_applications | Một hồ sơ mỗi sinh viên/đợt, snapshot và kết quả |
| Tuyển dụng | application_answers | Câu trả lời đúng bộ câu hỏi |
| Tuyển dụng | application_reviews | Nhận xét/điểm nội bộ |
| Phỏng vấn | interview_appointments | Lịch của một ứng viên, gắn session |
| Phỏng vấn | interview_panel_members | Người phỏng vấn được phân công |
| Thông báo | notification_jobs | Outbox và công việc nhắc lịch bền vững |
| Thông báo | notifications | Hộp thông báo, chống trùng, đã đọc |
| Quản trị | club_change_requests | Bản đề xuất thay đổi thông tin CLB |
| Nội bộ | club_channels | Kênh chung và kênh theo ban |
| Nội bộ | channel_members | Quyền bổ sung của người ngoài ban |
| Nội bộ | channel_messages | Chat lâu dài, idempotency và soft delete |
| Nội bộ | channel_read_states | Mốc đã đọc theo membership |
| Lịch sử | audit_logs | Nhật ký append-only, metadata không chứa bí mật |

Thêm hai public projection backend-only: public_recruitment_campaigns và public_recruitment_departments. Chỉ lấy CLB published và các đợt đã open/closed/completed; không có đơn, câu trả lời hoặc đánh giá nội bộ.

Chi tiết toàn bộ cột/default/nullability/constraint được xuất tại `20261117-platform-schema-dictionary.md` cùng thư mục.

## Đối chiếu nghiệp vụ

### Tuyển dụng

- UNIQUE(campaign_id, applicant_id) trên applications: chỉ một hồ sơ/một ban trong một đợt, kể cả hồ sơ withdrawn/rejected vẫn giữ lịch sử và khóa chống trùng.
- Draft có thể đổi ban sau khi xóa câu trả lời cũ bằng RPC; không đổi ban sau nộp.
- Campaign draft → open → closed → completed; có thể cancelled từ draft/open/closed. Closed ngừng nhận đơn nhưng vẫn xét tuyển. Completed yêu cầu không còn submitted/interviewing.
- Campaign mở yêu cầu ban active thông thường, có câu hỏi và head. Không mở tuyển vào Ban quản trị trong flow thành viên này.
- Câu hỏi/bộ yêu cầu chỉ cấu hình khi campaign draft, bị khóa sau mở. Đợt sau có thể sao chép bộ câu hỏi vào các bản ghi mới.
- Bản đầu chỉ câu trả lời văn bản: max_length và is_required. Chưa có trắc nghiệm, CV hay upload file.
- Nộp yêu cầu đủ profile, đúng thời hạn, đủ câu bắt buộc, chưa là thành viên active của CLB. Snapshot gồm đúng năm trường hồ sơ; sửa profile sau đó không sửa snapshot.
- Status: draft → submitted → interviewing → accepted/rejected; submitted cũng có thể rejected ở vòng đơn. Applicant có thể withdrawn trước kết quả cuối.
- Chỉ head active của ban được đổi kết quả, không tự cấp quyền này cho chair/admin/interviewer. Result_message cho ứng viên tách khỏi internal_note.
- Accepted tạo membership role member trong đúng ban cùng transaction với kết quả. Lỗi unique membership làm rollback cả quyết định; không có trạng thái accepted nhưng chưa tạo được membership.
- Chỉ tiêu target_quantity là mục tiêu dự kiến, chưa phải giới hạn cứng tự động.

### Phỏng vấn / meeting

- Một ứng viên có tối đa một appointment scheduled tại một thời điểm. Có thể xếp lại buổi mới sau khi buổi cũ hoàn thành/hủy.
- Một session chỉ gắn một appointment để tránh trộn ứng viên trong phòng riêng. Head phân công nhiều interviewer qua panel_members; người được phân công chỉ đánh giá, không có quyền quyết định cuối.
- Session phải thuộc meeting có club_id đúng CLB tuyển. Appointment và session phải khớp thời gian khi commit; đổi lịch cả hai trong một transaction. Có kiểm tra trùng lịch ứng viên và interviewer bằng khóa dữ liệu và truy vấn.
- Backend vẫn phải triển khai việc tạo meeting/session, gán meeting_members đúng ứng viên/panel và quyền host/moderator. Chỉ tạo FK không tự cấp quyền vào phòng.
- Để tương thích module họp hiện tại, kết thúc session không bị chặn chỉ vì appointment chưa được head cập nhật completed. Backend phải đồng bộ lifecycle appointment sau đó và ngừng reminder không còn hợp lệ.
- Chat meeting bị purge khi kết thúc/hủy từ sau import; không ảnh hưởng chat channel.

### Channel private

- Kênh chung: thành viên active CLB published. Kênh ban public: thành viên active CLB. Kênh ban private: thành viên thuộc ban hoặc được thêm rõ ràng.
- Chỉ head của ban sở hữu channel được thêm/gỡ người ngoài ban. Không có role trưởng nhóm khác, can_manage_members, cơ chế ủy quyền hoặc quyền quản trị tự động của người được thêm.
- Chairperson/admin nền tảng không có private-read bypass. Chủ nhiệm đọc được channel của Ban quản trị vì thuộc ban đó, không phải vì có quyền xem mọi kênh.
- channel_members tham chiếu membership_id, chỉ thêm người đang active cùng CLB. Người được thêm không đổi ban/role. Người đã rời CLB không đọc được; gia nhập lại tạo membership mới không kế thừa grant cũ.
- Quyền head suy ra từ role/department hiện tại; demote/chuyển ban thì mất quyền quản trị ban cũ. Không tự chỉ định head khi import. Gỡ người ngoài ban chỉ thu hồi grant bổ sung; không dùng grant để loại một thành viên vẫn thuộc ban khỏi quyền truy cập mặc định. Chưa có channel blacklist.
- Grant/revoke giữ lịch sử. Khi được thêm vào kênh, mặc định đọc được lịch sử còn lưu của kênh; chưa có giới hạn chỉ xem tin từ ngày gia nhập.
- Chỉ sender active sửa nội dung mình; sender hoặc head sở hữu channel soft-delete. History RPC che body của tin đã xóa. Backend dùng RPC/kiểm tra access trước SELECT, trước subscribe và trước broadcast; không chỉ ẩn menu frontend.

### Duyệt sửa CLB / audit

- Chủ nhiệm gửi một pending revision/CLB với proposed_data chỉ gồm name/summary/description/mission; không nhận role, status, membership hoặc trường tùy ý.
- Admin duyệt/từ chối, chủ nhiệm có thể hủy. Proposal không sửa sau gửi; muốn thay đổi thì hủy và gửi bản mới.
- Pending không thay bản công khai. Approved cập nhật clubs cùng transaction, có kiểm tra base_club_updated_at; xung đột giữ request pending và không ghi đè.
- Liên hệ/ảnh vẫn cập nhật theo endpoint hiện tại, nhưng sẽ làm version club thay đổi; pending revision cũ phải được xem lại/gửi mới.
- Audit tự ghi cho các sự kiện chính và grant/revoke; RPC đổi head ghi actor. Membership thay đổi qua API cũ chưa có actor đáng tin ở SQL được log actor NULL, không bịa người thực hiện. Backend cần bổ sung attribution cho các thao tác khác.
- Service role không UPDATE/DELETE audit_logs. DB owner vẫn có quyền quản trị như thông thường; không coi audit bất biến trước superuser.

## Thông báo: DB có gì và worker phải làm gì?

DB ghi notification_jobs cùng transaction với thay đổi nghiệp vụ. Nó **không tự chạy worker** và không tự gửi email/realtime. Worker backend nhận job qua claim RPC, có lease/token, tối đa năm lần thử, retry có backoff; không hoàn tất được job bằng claim cũ hoặc đã hết hạn.

| Sự kiện | Đối tượng nhận dự kiến |
| --- | --- |
| club.request_submitted | Admin |
| club.published / club.rejected | Người gửi đề nghị |
| recruitment.open | Người quan tâm CLB và đối tượng công khai phù hợp |
| application.submitted | Ứng viên xác nhận và head của ban cần xử lý |
| application.interviewing / accepted / rejected | Ứng viên |
| interview.scheduled / updated / cancelled | Ứng viên và panel liên quan |
| post.published | Người quan tâm CLB, chỉ khi bài vẫn public/published |
| post/activity pending_review hoặc changes_requested | Chủ nhiệm hoặc tác giả theo loại sự kiện |
| registration.registered / cancelled | Người đăng ký |
| activity.published | Người quan tâm CLB |
| activity.updated / cancelled | Người đang đăng ký còn hiệu lực |
| activity.reminder | Người đang đăng ký, hoạt động vẫn hợp lệ và chưa bắt đầu |
| club_change.* | Admin hoặc chủ nhiệm/người gửi theo trạng thái |
| channel.member_added / removed | Thành viên được thêm/gỡ, nội dung thông báo tối thiểu |

Nhắc hoạt động có job trước 24 giờ và 1 giờ nếu mốc đó còn ở tương lai lúc lên lịch. Đổi nội dung/lịch, unpublish, hoàn thành hoặc hủy sẽ vô hiệu hóa reminder cũ; republish tạo mốc mới. Người đăng ký sát giờ cần worker xử lý sự kiện registration.registered để quyết định nhắc ngay trong cửa sổ còn lại, không gửi nhắc cho mốc đã qua.

Worker BẮT BUỘC đọc lại trạng thái, quyền, follows và registrations khi xử lý. Job cũ có thể không còn hợp lệ. Giữ thông báo ít lộ thông tin; không nhúng internal_note/câu trả lời nhạy cảm. Backend kiểm tra quyền lại khi mở đối tượng từ thông báo.

Chống trùng thông báo theo recipient_id + deduplication_key. Dùng khóa nghiệp vụ ổn định, ví dụ post-new:post_id hoặc reminder:activity_id:starts_at:offset; không dùng mỗi job_id cho nhắc lịch vì job có thể được tạo lại sau thay đổi. Worker dùng clubspace_deliver_notification_job để tạo batch notifications và finish job cùng transaction qua Supabase RPC, vẫn dựa unique để xử lý retry. Batch tối đa 1000 người nhận; p_finish=false cho các batch đầu và true ở batch cuối, giữ lease hợp lệ. Khi recipient được xác định từ membership phải kiểm tra active tại thời điểm gửi. Quy tắc một người nhận cả nhánh follower và registrant cần cùng khóa để tránh hai thông báo cùng sự kiện.

## RPC backend-only

| RPC | Công việc |
| --- | --- |
| clubspace_set_department_head | Chủ nhiệm bổ nhiệm/bỏ head, có expected version |
| clubspace_clear_draft_answers | Ứng viên xóa bộ câu trả lời draft trước đổi ban |
| clubspace_transition_application | Submit/withdraw/head decision; atomic admission |
| clubspace_remove_interviewer | Head bỏ phân công interviewer |
| clubspace_can_read_channel | Kiểm tra quyền đọc hiện tại, không có bypass |
| clubspace_update_channel | Head sửa metadata kênh ban; chủ nhiệm sửa kênh chung |
| clubspace_set_department_privacy | Chỉ head đổi private/public của ban, có version và audit |
| clubspace_channel_history | History có kiểm tra quyền, cursor, che soft-deleted body |
| clubspace_mark_channel_read | Mốc đọc đúng channel/membership, không lùi mốc |
| clubspace_decide_club_change | Quyết định/hủy revision có version |
| clubspace_claim_notification_jobs | Worker nhận batch, SKIP LOCKED và lease |
| clubspace_finish_notification_job | Hoàn tất/retry theo claim token còn hiệu lực |
| clubspace_deliver_notification_job | Ghi batch notifications và tùy chọn finish job cùng transaction |
| clubspace_mark_notification_read | Chỉ người nhận đánh dấu đọc |

Giữ nguyên chuỗi timestamp đầy đủ từ PostgreSQL khi gửi expected_updated_at/base_club_updated_at; không chuyển qua JS Date rồi làm mất microsecond.

p_actor/reviewer_id/updated_by/added_by phải do backend lấy từ JWT đã xác minh, không tin body FE. Đây không phải JWT của Supabase Auth; không dùng auth.uid() để đoán danh tính ứng dụng. Anon/authenticated không đọc/ghi bảng mới hoặc execute các RPC này. Service key chỉ nằm backend. service_role bypasses RLS nên RLS không thay thế kiểm tra quyền theo người dùng ở backend.

## Kết quả kiểm chứng

- Đã chạy toàn file trên PostgreSQL tạm qua PGlite, với schema core nền và các role Supabase mô phỏng; không dùng Supabase thật để ghi.
- 84 tình huống SQL đạt: role/private/grant/rejoin, câu hỏi, một đơn/đợt, submit/snapshot, stale version, atomic membership rollback, phỏng vấn/reschedule, revision, outbox/reminders/lease, ACL/RLS, end-chat purge, import lần hai an toàn và postflight.
- Preflight/postflight đều thực thi được. Postflight thấy 16 bảng RLS enabled, 14 RPC security definer backend-only, 2 view; không thiếu channel backfill; không có browser execute; không có service direct admission/role escalation.
- Đây là kiểm thử sequential trên engine PostgreSQL tạm, không phải load test nhiều connection hoặc chứng minh mọi tình huống race trên Supabase live. Các lock/constraint đã được chuẩn bị, backend cần retry transaction khi serialization/deadlock phù hợp và test đồng thời thực tế.
- Chưa thay DB live, chưa code API/worker/FE mới, chưa commit hoặc push.

## Những phần cố ý không thêm

Không club_invitations; không quyền head toàn nền tảng; không lead/trưởng nhóm độc lập; không channel delegation; không hệ thống role/permission tùy biến kiểu Discord đầy đủ; không media upload/CV vì chưa chốt nghiệp vụ tệp. Giữ các bảng hoạt động/đăng ký/điểm danh và auth hiện có; không tạo bảng trùng.

## Tham chiếu kỹ thuật

- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html — điều kiện liên bảng dùng FK/trigger, không nhét truy vấn liên bảng vào CHECK.
- Security definer: https://www.postgresql.org/docs/current/sql-createfunction.html — search_path rỗng, schema-qualified objects và revoke execute mặc định.
- Supabase RLS/service role: https://supabase.com/docs/guides/database/postgres/row-level-security — custom backend phải kiểm tra actor và phạm vi, không để secret ở frontend.
