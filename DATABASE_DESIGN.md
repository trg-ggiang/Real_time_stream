# Thiết kế database sinh viên và CLB

> Tài liệu này lưu thiết kế ban đầu ngày 14/11. Để triển khai hoặc đối chiếu tên bảng, cột, chức năng và quyền hiện hành, xem [từ điển schema mở rộng](output/unicircle-platform-migration-20261117/docs/database/20261117-platform-schema-dictionary.md), [gói migration](output/unicircle-platform-migration-20261117/README.md) và [bàn giao workspace](docs/design/phase-04-club-workspace.md).

Ngày tổng hợp: 14/11/2026 (Asia/Saigon). Tài liệu thảo luận, chưa phải migration và chưa thay đổi database. Kiểu dữ liệu, tên cột và ràng buộc mới là đề xuất kỹ thuật để review.

## Quy ước

PK: khóa chính. FK: khóa ngoại. UNIQUE: không trùng. UUID mới mặc định gen_random_uuid(); thời gian dùng timestamptz. Cột có dấu * là bắt buộc dự kiến. Cột thời gian tạo mặc định now(); updated_at cập nhật mỗi lần sửa.

## 1. users — tài khoản chung

Bảy cột hiện hữu đã được đọc từ metadata Supabase; chỉ role là bổ sung mới.

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| user_id * | uuid | PK; tự tạo UUID |
| email * | text | Email đăng nhập; chuẩn hóa lowercase. Code yêu cầu duy nhất, cần đối chiếu constraint |
| display_name * | text | Tên hiển thị |
| avatar_url | text | URL ảnh đại diện |
| created_at * | timestamptz | Thời điểm tạo, mặc định now() |
| password_hash | text | Hash mật khẩu; không trả về client |
| email_verified_at | timestamptz | Thời điểm xác minh, có thể trống |
| role * | text | Mới: admin hoặc user, mặc định user |

Không yêu cầu email thật/xác minh email; vẫn kiểm tra định dạng và không trùng. Quyền admin CLB nằm trong club_members, không lặp lại tại users.role.

## 2. student_profiles — hồ sơ sinh viên

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| user_id * | uuid | PK và FK → users.user_id; quan hệ 1–1 |
| full_name * | text | Họ tên đầy đủ |
| student_code * | text | MSSV; UNIQUE; giữ số 0 đầu |
| phone_number * | text | Số điện thoại |
| faculty | text | Khoa, tùy chọn |
| major | text | Ngành, tùy chọn |
| cohort | text | Khóa học, tùy chọn |
| date_of_birth | date | Ngày sinh, tùy chọn |
| bio | text | Giới thiệu, tùy chọn |
| created_at * | timestamptz | Thời điểm tạo |
| updated_at * | timestamptz | Lần cập nhật gần nhất |

Email và ảnh lấy từ users. Sau đăng ký, sinh viên hoàn thiện hồ sơ rồi xác nhận bằng popup. Popup chưa yêu cầu cột riêng. Đề xuất tạo hồ sơ khi gửi đủ trường bắt buộc; lưu nháp chưa chốt.

## 3. clubs — hồ sơ CLB

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| club_id * | uuid | PK |
| name * | text | Tên CLB |
| description | text | Giới thiệu, bao gồm lĩnh vực hoạt động |
| logo_url | text | URL logo |
| cover_url | text | URL ảnh bìa |
| contact_email | text | Email liên hệ CLB |
| contact_phone | text | Điện thoại liên hệ CLB |
| fanpage_url | text | Link fanpage |
| status * | text | Đề xuất active / inactive |
| created_at * | timestamptz | Thời điểm tạo |
| updated_at * | timestamptz | Lần cập nhật gần nhất |

Không thêm cột lĩnh vực riêng. Danh sách admin được quản lý qua club_members.

## 4. club_members — thành viên và quyền trong CLB

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| club_member_id * | uuid | PK |
| club_id * | uuid | FK → clubs.club_id |
| user_id * | uuid | FK → users.user_id |
| role * | text | club_admin / member |
| status * | text | Đề xuất active / left |
| joined_at * | timestamptz | Lần tham gia gần nhất |
| left_at | timestamptz | Thời điểm rời CLB |

UNIQUE (club_id, user_id). Admin tổng chỉ định admin CLB đầu tiên; admin CLB có thể bổ nhiệm thêm admin cùng CLB. Người được duyệt đơn trở thành thành viên; tái gia nhập thì kích hoạt lại bản ghi. Đề xuất tái gia nhập với role member. Không coi bảng này là lịch sử đầy đủ các lần vào–rời.

## 5. club_application_questions — câu hỏi ứng tuyển

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| question_id * | uuid | PK |
| club_id * | uuid | FK → clubs.club_id |
| question_text * | text | Nội dung câu hỏi |
| question_type * | text | Đề xuất short_text / long_text / single_choice / multiple_choice |
| options | jsonb | Danh sách lựa chọn có mã ổn định; dùng cho câu hỏi lựa chọn |
| is_required * | boolean | Có bắt buộc trả lời |
| sort_order * | integer | Thứ tự hiển thị, không âm |
| is_active * | boolean | Có dùng trong form mới không |
| created_at * | timestamptz | Thời điểm tạo |
| updated_at * | timestamptz | Lần cập nhật |

Mỗi CLB tự tạo form trong ứng dụng. Đề xuất giữ nguyên nội dung câu hỏi đã có câu trả lời; muốn sửa thì tạo question_id mới và tắt câu cũ. Cách này bảo toàn đơn cũ mà không thêm bảng phiên bản. Các loại câu hỏi cụ thể chưa chốt cuối cùng.

## 6. club_applications — đơn ứng tuyển CLB

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| application_id * | uuid | PK |
| club_id * | uuid | FK → clubs.club_id |
| user_id * | uuid | FK → users.user_id |
| status * | text | pending / approved / rejected; mặc định pending |
| submitted_at * | timestamptz | Thời điểm gửi |
| reviewed_by | uuid | FK → users.user_id; người xử lý |
| reviewed_at | timestamptz | Thời điểm xử lý |
| rejection_reason | text | Lý do từ chối tùy chọn; sinh viên được xem |

Tối đa một đơn pending cho mỗi cặp (club_id, user_id), bằng ràng buộc duy nhất có điều kiện. Cho ứng tuyển lại sau từ chối hoặc rời CLB; giữ đơn cũ. Đơn đã xử lý cần người/thời điểm duyệt. Duyệt đơn và tạo/kích hoạt thành viên phải nhất quán. Gửi thành công chưa có nghĩa là đã trở thành thành viên.

## 7. club_application_answers — câu trả lời ứng tuyển

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| application_id * | uuid | FK → club_applications.application_id; phần PK |
| question_id * | uuid | FK → club_application_questions.question_id; phần PK |
| answer_value * | jsonb | Chuỗi cho văn bản/một lựa chọn; mảng mã cho nhiều lựa chọn |

PK (application_id, question_id). Câu hỏi phải thuộc CLB của đơn. Kiểm tra kiểu trả lời, lựa chọn hợp lệ và đủ câu bắt buộc khi gửi. Đơn và câu trả lời cần được lưu cùng nhau. Đề xuất không sửa sau khi gửi; chính sách sửa/rút đơn chưa chốt.

## 8. club_activities — hoạt động CLB

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| activity_id * | uuid | PK |
| club_id * | uuid | FK → clubs.club_id |
| title * | text | Tên hoạt động |
| description | text | Nội dung hoạt động |
| start_at * | timestamptz | Thời gian bắt đầu |
| end_at * | timestamptz | Kết thúc, sau start_at |
| location | text | Địa điểm hoặc link trực tuyến |
| registration_deadline | timestamptz | Hạn đăng ký |
| capacity | integer | Giới hạn dương; NULL là không giới hạn |
| form_url | text | Link Google Form |
| status * | text | Đề xuất draft / published / cancelled / completed |
| created_at * | timestamptz | Thời điểm tạo |
| updated_at * | timestamptz | Lần cập nhật |

Admin CLB đăng trực tiếp, không cần admin tổng duyệt. Hoạt động công khai dành cho sinh viên toàn trường. Câu hỏi và câu trả lời nằm trong Google Form, không thêm bảng lưu chúng trong ứng dụng. Form cần hỏi MSSV để đối chiếu. Capacity, hạn đăng ký, giá trị status và mức bắt buộc của từng trường là đề xuất, cần review tiếp.

## 9. activity_registrations — đăng ký tham gia hoạt động

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| registration_id * | uuid | PK |
| activity_id * | uuid | FK → club_activities.activity_id |
| user_id * | uuid | FK → users.user_id |
| status * | text | pending / approved / rejected; mặc định pending |
| submitted_at * | timestamptz | Thời điểm xác nhận đăng ký trên ứng dụng |
| reviewed_by | uuid | FK → users.user_id; admin xử lý |
| reviewed_at | timestamptz | Thời điểm xử lý |
| rejection_reason | text | Đề xuất lý do từ chối, chưa chốt riêng cho hoạt động |

Sinh viên điền Google Form, quay lại bấm xác nhận đã điền form và đăng ký. Hệ thống tạo pending; admin đối chiếu MSSV rồi duyệt/từ chối. Link form không giúp hệ thống tự biết ai đã điền. Đề xuất UNIQUE (activity_id, user_id). Việc đăng ký lại/rút đăng ký chưa chốt. Nếu giới hạn chỗ, đề xuất chỉ approved chiếm chỗ và kiểm soát duyệt đồng thời.

## 10. club_favorites — quan tâm CLB

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| user_id * | uuid | FK → users.user_id; phần PK |
| club_id * | uuid | FK → clubs.club_id; phần PK |
| created_at * | timestamptz | Thời điểm đánh sao |

PK (user_id, club_id), mỗi người tối đa một sao cho cùng CLB. Nhấn lần nữa để bỏ sao.

## 11. activity_favorites — quan tâm hoạt động

| Thuộc tính | Kiểu | Thông tin |
|---|---|---|
| user_id * | uuid | FK → users.user_id; phần PK |
| activity_id * | uuid | FK → club_activities.activity_id; phần PK |
| created_at * | timestamptz | Thời điểm đánh sao |

PK (user_id, activity_id). Trang Đã quan tâm có hai mục CLB/Hoạt động, đọc từ hai bảng favorites.

## Phân quyền và quan hệ

- users → student_profiles: 1–0..1. users ↔ clubs: nhiều–nhiều qua club_members.
- clubs có nhiều câu hỏi, đơn ứng tuyển và hoạt động. Đơn có nhiều câu trả lời. Hoạt động có nhiều đăng ký.
- Admin tổng quản lý toàn hệ thống. Admin CLB chỉ quản lý CLB mình được giao và các đơn/hoạt động thuộc CLB đó.
- User quản lý hồ sơ, sao và đơn của mình; không tự cấp quyền hoặc tự duyệt.
- Khách xem thông tin public và luôn có nút đăng nhập/đăng ký. Đánh sao/ứng tuyển yêu cầu đăng nhập; sau đăng ký hoàn thiện hồ sơ và popup xác nhận.
- MSSV, điện thoại, hồ sơ và câu trả lời không công khai mặc định. Admin CLB chỉ được xem thông tin cần thiết cho nghiệp vụ liên quan.
- Hệ thống hiện dùng JWT do NestJS cấp và kết nối Supabase phía backend. Cần kiểm tra quyền backend và thiết kế RLS/grants tương thích; không giả định auth.uid() tự nhận biết JWT riêng.

## Chuẩn hóa và triển khai

Thông tin tài khoản, sinh viên, CLB và quan hệ thành viên tách theo chủ thể. Không lặp email tài khoản trong hồ sơ, tên CLB trong thành viên hoặc club_admin trong users.role. Kết luận 3NF chính thức cần rà soát khóa và phụ thuộc hàm của schema cuối cùng.

Giữ các bảng họp hiện có; club_members khác meeting_members. Ngoài users, cần đối chiếu schema thực tế trước khi quyết định tạo các bảng mới. Khi triển khai cần index FK/truy vấn thường dùng, kiểm soát giao dịch khi duyệt và không xóa dây chuyền lịch sử khi chưa có chính sách lưu giữ.

## Những điểm còn mở

- Admin có cần hồ sơ sinh viên khi chỉ quản trị không; đánh sao cần hồ sơ hoàn chỉnh hay chỉ đăng nhập.
- Sau đăng nhập có tự thực hiện thao tác sao trước đó hay người dùng nhấn lại.
- Ai tạo CLB đầu tiên, xử lý admin cuối cùng và lịch sử thay đổi quyền.
- Loại câu hỏi, giới hạn độ dài/số lượng, sửa hoặc rút đơn ứng tuyển.
- Phạm vi hoạt động ngoài public; trường bắt buộc, hạn đăng ký và giới hạn số người.
- Đăng ký lại/rút đăng ký hoạt động, yêu cầu form_url và lý do từ chối hoạt động.

Đây là tài liệu tổng hợp 1 bảng hiện hữu được mở rộng và 10 bảng mới dự kiến. Những điểm còn mở không được coi là đã phê duyệt. Chưa tạo migration hay cập nhật database.
