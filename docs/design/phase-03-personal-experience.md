# Phase 3 — Tài khoản và không gian cá nhân

Ngày 16/11/2026. Đã triển khai mã nguồn và kiểm tra; chờ nhóm review giao diện/nghiệp vụ. Không phải thiết kế final của toàn sản phẩm. Phase này thuộc kế hoạch redesign mới, không thay trạng thái lịch sử Phase 03 database/auth của roadmap cũ.

## Đã làm

- Không gian cá nhân `/me`: tổng quan CLB, đề nghị và đăng ký gần đây, dùng dữ liệu theo tài khoản.
- `/me/clubs`: membership active của CLB đã published, phân biệt chairperson/member theo từng CLB. Không coi follow là membership.
- `/me/follows`: danh sách quan tâm; trang chi tiết CLB có quan tâm/bỏ quan tâm thực qua API.
- `/me/registrations`: cả đăng ký/hủy; chi tiết hoạt động có đăng ký, hủy xác nhận và đăng ký lại. Hoạt động bị ẩn giữ lịch sử nhưng không lộ nội dung riêng tư.
- `/me/club-requests`: lịch sử đầy đủ có phân trang, không chỉ lấy items[0]. Detail có trạng thái, ngày xét duyệt và lý do. Từ chối dẫn sang tạo đề nghị mới, không sửa/gửi lại hồ sơ cũ.
- `/me/club-requests/new`: form tạo đề nghị gửi thật qua API có sứ mệnh và URL logo/cover. Không có upload/đơn vị/fanpage giả chưa lưu được. Bản pending chưa xuất hiện public và chưa mở workspace.
- `/me/profile`: sửa hồ sơ; component/form dùng chung với onboarding. Trim dữ liệu, bắt đủ năm trường, student_code tối đa 32 thống nhất DB, lỗi trùng mã trả 409. Lỗi lưu giữ giá trị đang sửa.
- Đăng ký/login không có đích riêng → hoàn thiện hồ sơ → /me. Login từ detail giữ pathname và search khi bỏ mode; không tự POST lại hành động sau chuyển hướng. Account cũ thiếu hồ sơ cũng phải hoàn thiện.
- Layout cá nhân riêng, sidebar sáng/sticky trên desktop, menu thu gọn mobile, skip link/focus và Escape. Navy/xanh/Be Vietnam Pro thống nhất public.

## Ranh giới module

```text
features/personal/
  PersonalApp                   shell và route cá nhân
  pages/PersonalLists            tổng quan, membership, follows, registrations, requests
  pages/ClubRequestPages         tạo và theo dõi đề nghị
  components/AccountAction       trạng thái và mutation tại public detail
  components/PersonalState       loading/error/empty
  services/personal-api          private DTO và contract
  use-personal-query             identity/token, cancel và reload
  personal.css
features/profile/
  ProfileForm + profile-model    form và điều kiện hoàn thiện dùng chung
shared/api/account-http          timeout, no-store, auth errors, không retry mutation
shared/lib/use-unsaved-changes   xác nhận rời link/logout/meeting và beforeunload
backend/src/personal/            controller/service riêng, không trộn vào public-content
backend/src/users/complete-profile.guard.ts
```

DiscoveryApp chuyển sang PersonalApp khi pathname thuộc /me, vẫn ở BrowserRouter hiện tại. LegacyGuestArea chỉ giữ workflow CLB/admin chưa được thay shell. Meeting không bị viết lại. Có thể mở các link /me trực tiếp hoặc refresh; host deploy cần SPA rewrite theo hướng dẫn Phase 2.

## API mới

Tất cả `/api/me/*` yêu cầu JWT và CompleteProfileGuard. Danh tính lấy từ req.user, không nhận user_id do client chọn. GET private có Cache-Control private, no-store và phân trang page/limit tối đa 24.

| Method / path | Vai trò |
| --- | --- |
| GET /me/clubs | CLB active/published của người gọi |
| GET /me/follows | CLB đang quan tâm, chỉ nội dung published |
| GET /me/follows/:clubId | Trạng thái quan tâm |
| PUT /me/follows/:clubId | Quan tâm, chịu unique duplicate |
| DELETE /me/follows/:clubId | Bỏ quan tâm, idempotent |
| GET /me/registrations | Lịch sử đăng ký của người gọi |
| GET /me/registrations/:activityId | Trạng thái đăng ký |
| PUT /me/registrations/:activityId | Tạo/đăng ký lại trên cùng bản ghi |
| DELETE /me/registrations/:activityId | Soft cancel, không DELETE hàng |
| GET /me/club-requests | Lịch sử đề nghị theo created_by |
| GET /me/club-requests/:clubId | Chỉ hồ sơ do người gọi tạo, không thấy trả 404 |

Tạo đề nghị vẫn POST `/api/public/clubs` nhưng đã thêm guard hồ sơ; prefix cũ không có nghĩa là được POST ẩn danh. Hồ sơ GET/PATCH `/api/users/me/profile` không bị guard hoàn thiện để account còn onboarding tự hoàn tất được; các response này cũng no-store.

Guard được áp dụng thêm ở tạo/join meeting, cấp token LiveKit và module hoạt động CLB. Không chặn leave/end bằng guard mới để vẫn dọn cuộc gọi được. Public, health, auth và đọc/cập nhật profile vẫn hoạt động đúng mục đích. Chưa chuẩn hóa toàn bộ policy admin cũ; phần đó thuộc Phase 5.

CORS thêm PUT/DELETE/OPTIONS để các thao tác private hoạt động cả khi frontend gọi API khác origin.

## Đăng ký hoạt động và database

- Kiểm tra publication, CLB published, lifecycle, thời gian mở/đóng ở server để trả lỗi sớm.
- Capacity và chống race dựa vào trigger guard_registration trong migration CLB hiện có: khóa activity FOR UPDATE, kiểm tra số chỗ/window; unique(activity_id,user_id) chống duplicate. Không dùng count phía frontend để giữ chỗ.
- Đã registered thì trả lại cùng bản ghi, không đổi timestamp. Canceled thì UPDATE cùng registration_id có điều kiện owner/status; race unique đọc lại trạng thái. Cancel có điều kiện owner/status, DB từ chối nếu đã check-in.
- Không tạo migration/schema hay sửa grants ở phase này. Read-only OpenAPI xác nhận các bảng/cột cần thiết có trên project đang cấu hình. Không thể xác nhận function body/trigger qua OpenAPI.
- File `supabase/verification/phase-03-personal-preflight.sql` chỉ đọc catalog/privileges để nhóm kiểm tra trigger, unique và grants khi triển khai. Chưa thực thi file này trên Supabase. Nếu DB không có guard_registration đúng như migration đã import thì phải xử lý DB trước khi tin vào chống vượt sức chứa đồng thời.
- Không gọi join_url qua public/personal list. Chưa làm điểm danh hoặc link tham gia online có điều kiện; module đó cần endpoint kiểm tra riêng.

## Phiên và lỗi

Private GET bị hủy khi đổi route/token, state có identity theo token + URL; không lưu cache private trong localStorage. Cây public/personal remount khi token đổi. Mutation có controller/ref khóa gửi lặp và hủy tác động UI sau unmount; abort trình duyệt không đảm bảo server chưa ghi.

401 xóa phiên/hiện đăng nhập; PROFILE_INCOMPLETE đưa về onboarding. Vai trò được đọc lại bằng auth/me khi token/session khởi tạo, backend vẫn là nguồn quyền chính. Không đặt JWT trong URL.

Follow/register là PUT với xử lý idempotency; không tự retry mutation. Đề nghị CLB là POST cũ chưa có idempotency key: nếu mạng/5xx khiến không rõ kết quả thì khóa gửi lại, hướng sang lịch sử để kiểm tra trước. Điều này không ngăn tuyệt đối hai POST từ hai thiết bị; chưa áp chính sách một pending/giới hạn số CLB khi nhóm chưa chốt.

Unsaved form được cảnh báo khi bấm link, logout/meeting hoặc reload/đóng tab. Điều hướng Back/Forward nội bộ SPA chưa dùng blocker data-router; có thể mất chỉnh sửa nếu người dùng bấm Back. Chưa lưu draft cá nhân lên server/localStorage. Đây là giới hạn cần biết, không coi đã bảo vệ mọi cách rời trang.

## Kiểm tra và bằng chứng

- npm run typecheck, npm run build: đạt; cảnh báo chunk meeting/LiveKit lớn vẫn hiện hữu.
- npm test: 47 backend + 67 frontend đạt. Bao gồm JWT/profile gate HTTP, CORS PUT/DELETE, owner spoof, scope request, duplicate registration/capacity error mapping, hidden activity, role theo CLB, late response đổi account, save conflict và uncertain POST.
- 41 kiểm tra browser ở 1440/768/390/320: tám route cá nhân; follow, cancel/re-register, save profile, create request → detail; incomplete/expired/guest; không overflow, ảnh hỏng hoặc JS exception.
- Browser dùng fixture API qua CDP và JWT giả chỉ ở trình duyệt kiểm thử; mọi API request đều bị chặn/fulfill trong harness. Có năm mutation giả lập; số ghi live bằng 0. Screenshot không phải tài khoản/thông tin thật từ Supabase.
- Đo app-screen trên overview/profile tại bốn viewport bằng probe/judge của design skill: 0 FAIL. Đã mở ảnh tổng hợp route desktop/tablet/mobile, xem trực tiếp form/profile/requests và giữ navigation nhất quán.
- Live read-only smoke: health 200; private endpoint không token trả 401. Chưa đăng ký/login thật hoặc tạo dữ liệu test vào Supabase trong phiên này, chưa load-test capacity hay gọi LiveKit hai thiết bị.
- Artifacts cục bộ: output/phase-03-personal, output/phase-03-final-tests.txt, output/phase-03-build.txt. Không chứa credential thực.

## Duyệt thị giác

App shell ưu tiên đọc và xử lý công việc: sidebar sáng, một title vừa phải, row cho membership/request, status có chữ. Không thêm KPI/chart vô nghĩa khi dữ liệu ít. Tự đánh giá tham khảo: design 7.5, usability 8, creativity 6.5, content 7.5 → overall 7.5; cần nhóm dùng thử để nghiệm thu.

Public images giữ nguyên nguồn như Phase 2; ảnh fixture chỉ dùng logo/cover sẵn có cho screenshot. Không thêm ảnh ngoài hoặc insert data live. Không tạo thêm hướng màu/font, không đổi nhận diện đã chốt.

## Cách thử với dữ liệu của nhóm

1. Chạy backend/frontend như cũ, đăng nhập tài khoản thật. Thiếu hồ sơ sẽ phải bổ sung.
2. Vào menu tài khoản → Không gian của tôi hoặc /me.
3. Mở CLB public → Quan tâm → /me/follows kiểm tra; bỏ quan tâm ở trang chi tiết.
4. Đăng ký chỉ thành công với hoạt động published đang trong cửa sổ đăng ký và còn sức chứa. Hoạt động lịch sử/quá hạn không được biến thành hoạt động tương lai để test. Tạo hoạt động tương lai qua workflow CLB nếu cần dữ liệu phù hợp.
5. Gửi đề nghị ở /me/club-requests/new, theo dõi trạng thái. Quyền admin và xử lý xét duyệt vẫn dùng module cũ cho tới Phase 5.

## Còn lại cho các phase sau

Không gian CLB hoàn chỉnh, quản lý ban/thành viên, duyệt bài, private channels, admin shell, upload/storage và taxonomy chưa triển khai mới. Các lối Mở không gian tiếp tục bridge sang module CLB hiện có. Phase 3 đã có mã nguồn có thể dùng, chưa phải mọi màn hình final hay nghiệm thu tải production.
