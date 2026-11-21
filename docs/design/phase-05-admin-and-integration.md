# Phase 5 — Quản trị hệ thống và kiểm tra liên thông

Ngày 16/11/2026, Asia/Bangkok. Hoàn thành phạm vi code của Phase 5 redesign, sẵn sàng để nhóm review. Không đồng nghĩa toàn hệ thống production-ready hoặc đã nghiệm thu ghi dữ liệu thật. Historical roadmap Phase 03/04/05 không tự đổi thành Done.

## Đã hoàn thiện

Admin shell hiện có sidebar navy, breadcrumb, menu tài khoản và dashboard dùng số liệu hiện có. Menu tài khoản chỉ có thao tác đăng xuất. [Work log](/work-logs/2026-11-16-52-phase-04-admin-menu-cleanup).

Admin có shell riêng, không nằm trong trang khám phá hoặc workspace của một CLB. Sidebar sáng, navy/xanh và Be Vietnam Pro thống nhất toàn sản phẩm; mobile thu gọn điều hướng, có skip link, focus, Escape và thông báo trạng thái.

| Route | Nội dung |
| --- | --- |
| /admin | Số đề nghị pending, CLB published, đề nghị rejected; năm hồ sơ chờ mới nhất và lối xét duyệt |
| /admin/club-requests | Queue có trạng thái, tìm theo tên và phân trang server; tham số nằm trên URL |
| /admin/club-requests/:id | Nội dung hồ sơ, sứ mệnh, liên hệ, người gửi, ngày gửi/cập nhật và quyết định |
| /admin/clubs | Directory các CLB published/suspended/archived, tách khỏi hồ sơ pending/rejected |
| /admin/clubs/:id | Chi tiết và kết quả đã ghi nhận; CLB published có link trang công khai |

Chỉ pending có nút quyết định. Từ chối bắt buộc lý do, có xác nhận; lỗi giữ nội dung phản hồi, không tự retry mutation. Hồ sơ đã xử lý hiển thị trạng thái/người duyệt/thời điểm/lý do hiện có; không cho quyết định lại.

Đã chuyển link Quản trị hệ thống ở public account menu và không gian cá nhân sang /admin. Link #admin-clubs cũ được chuyển về /admin/club-requests. Guest thấy lối đăng nhập; student/chủ nhiệm thấy trang không có quyền. Không thêm lựa chọn role ở đăng ký, không tự cấp admin cho tài khoản nào.

## Luồng xử lý

1. Account đăng nhập và hoàn thiện profile theo quy tắc chung. Role nền tảng được đọc lại từ backend.
2. Mỗi API admin chạy JWT guard và profile guard. JwtStrategy tìm user hiện tại trong DB; AdminService kiểm tra role admin trước khi truy vấn. Role giả trong JWT/body và role chairperson của CLB không cấp quyền admin.
3. GET private dùng no-store. Queue phân trang page/limit tối đa 24, sort created_at + club_id; tìm kiếm ở database. Summary là các trạng thái toàn nền tảng, không phải tổng của trang đang lọc.
4. Admin đọc detail độc lập theo UUID, không phụ thuộc đã tải row ở list. Chỉ chọn cột cần thiết; không lấy password_hash hoặc toàn bộ hồ sơ sinh viên. Email người gửi chỉ xuất hiện trong khu admin.
5. Frontend gửi decision, expected_updated_at và reason khi từ chối; actor do backend gán từ user hiện tại.
6. Khi approve, service kiểm tra chủ nhiệm active thuộc Ban quản trị active cùng CLB. Cấu trúc CLB được tạo bởi trigger khởi tạo sẵn có. Thiếu cấu trúc trả 409, không tự chắp vá bằng insert membership.
7. Một UPDATE chỉ khớp club_id + status pending + updated_at đã xem. UPDATE đặt status, reviewed_by, reviewed_at, review_note và published_at. Nếu hồ sơ đổi/đã xử lý trả 409; lỗi DB chung không lộ nội dung nội bộ.
8. Sau quyết định, tải lại detail. Published hiện qua public view khi tải lại trang khám phá; rejected hiện lý do ở lịch sử đề nghị của người gửi, dẫn tới Tạo đề nghị mới. Không sửa/gửi lại cùng hồ sơ đã từ chối.

Đã bỏ logic approve cũ trong PublicContentService: insert membership rồi DELETE bù khi publish lỗi. Các URL /api/public/admin/clubs cũ chuyển sang cùng AdminService và profile policy; endpoint quyết định cũ cũng yêu cầu body phiên bản/decision theo DTO mới, không còn nhận empty body như UI cũ. Đây là alias có nâng contract, không bảo đảm tương thích payload client cũ. Frontend mới chỉ dùng /api/admin.

## API

| Method | Path | Contract |
| --- | --- | --- |
| GET | /api/admin/summary | pending, published, rejected |
| GET | /api/admin/clubs | scope=requests hoặc directory; status, q, page, limit |
| GET | /api/admin/clubs/:id | item, creator, reviewer |
| PATCH | /api/admin/clubs/:id/decision | decision approve/reject, expected_updated_at, reason nếu reject |

Directory không cho tự động nâng quyền quản lý một CLB. Admin không được sửa tên/mô tả CLB published ở phase này; vẫn theo quyết định chỉ cho chủ nhiệm sửa liên hệ/ảnh và để revision workflow làm sau.

## Tổ chức module

```text
backend/src/admin/
  admin.controller      HTTP, JWT/profile guard, UUID/DTO, no-store
  admin.dto             query, phiên bản và lý do quyết định
  admin.service         quyền admin, đọc hồ sơ, summary, quyết định có điều kiện
  admin.module          dependency injection; export service cho alias cũ
frontend/src/features/admin/
  AdminApp              route và cổng quyền
  AdminLayout           sidebar, header, footer và Outlet
  admin-model           kiểu summary/list/detail và nhãn trạng thái
  pages/AdminOverview   số liệu và hàng đợi ngắn
  pages/ClubList        search/filter/pagination trên URL
  pages/ClubRequestDetail  hồ sơ và quyết định
  admin.css             scoped ad-app, responsive
shared/lib/use-account-mutation  khóa gửi lặp, abort, không retry write
```

Workspace giữ adapter useWorkspaceMutation trỏ vào hook dùng chung; không nhập nghiệp vụ CLB vào admin. Tái sử dụng usePersonalQuery (private query generic), account-http, ContentImage/LinkedText và trạng thái loading/error/empty. LegacyGuestArea/ClubManagementPage cũ còn trong source làm ngữ cảnh chuyển đổi, không còn được app mới import hoặc bundle.

## Kiểm tra và bằng chứng

| Kiểm tra | Kết quả |
| --- | --- |
| npm run typecheck | Passed |
| npm run build | Passed; cảnh báo chunk MeetingRoom hơn 500 kB còn hiện hữu |
| npm test | 65 backend + 75 frontend passed |
| Admin browser fixtures | 35 checks, 1440/768/390/320px, 0 failures |
| Personal browser regression | 41 checks, 0 failures |
| Workspace browser regression | 45 checks, 0 failures |
| App-screen probe | 0 FAIL trên các màn đo; đã xem screenshot desktop/tablet/mobile |
| Source design lint | 0 FAIL, 1 WARN do box-shadow: none, không có shadow thật |
| Local HTTP read-only smoke | health 200, admin/clubs và admin/summary không JWT trả 401 |
| git diff --check / docs JSON | Passed; Git nhắc LF/CRLF, không lỗi whitespace |

Backend tests mới kiểm tra role trước truy vấn, page/order/scope/search, actor server, version/trạng thái pending, thiếu cấu trúc không ghi dở, không insert/delete membership, reason không trống, conflict, lỗi DB không lộ dữ liệu, HTTP profile/JWT/UUID/DTO và alias cũ. Frontend tests kiểm tra cổng admin, quyết định đúng phiên bản, trạng thái khóa sau xử lý, giữ lý do khi conflict, server search và history read-only.

Browser đi qua duyệt → public detail, từ chối → người gửi xem lý do/tạo mới, pagination thật trong fixture, empty/error/404/conflict, guest/student gates và mobile menu. Tổng 121 checks; mọi API bị intercept và mutation được fulfill bởi fixture, **0 live writes**. Không dùng fake token gọi vào backend thật.

Artifact ở output/phase-05-admin: tests.txt, typecheck.txt, build.txt, checks.json, screenshot và browser-result.txt; personal/workspace regression có kết quả riêng. Đây là artifact cục bộ, không cần push output. Docs navigation còn 11 work log lịch sử đã thiếu từ trước, không tạo lại nội dung không có bằng chứng; hai trang Phase 5 mới có đầy đủ.

### Ghi chú thiết kế

Tham chiếu Achromatic ledger, seed 825521600; giữ palette/type theo lựa chọn nhóm, không redraw. Câu hỏi chính: hồ sơ nào cần xử lý; list trả lời ai/CLB nào, detail trả lời có đủ thông tin để quyết định không. Dấu ấn là hồ sơ cộng đồng Bách khoa, ảnh/logo và người gửi; không thêm biểu đồ hay số tăng trưởng giả. Số liệu demo được tính từ 15 hồ sơ fixture, không seed DB. Ảnh fixture tái sử dụng asset SINNO để kiểm tra layout, không khẳng định các CLB minh họa dùng logo SINNO ngoài đời. App thật lấy URL ảnh của từng bản ghi.

## Giới hạn và bước nghiệm thu của nhóm

- Không chạy migration, seed, cấp role, duyệt/từ chối hoặc ghi Supabase thật trong phiên này; chưa xác minh toàn bộ trigger live bằng giao dịch ghi. Dùng preflight Phase 4 để xem catalog khi nghiệm thu; không cần migration mới cho code Phase 5.
- Duyệt yêu cầu cấu trúc CLB đã khởi tạo đúng, updated_at/structure triggers như schema đã chốt. Hồ sơ cũ thiếu ban/chủ nhiệm phải kiểm tra và sửa bằng quy trình dữ liệu riêng, không tự sinh ngầm khi duyệt.
- Conditional UPDATE bảo vệ quyết định cạnh tranh trên cùng hồ sơ. Kiểm tra actor/membership diễn ra trước đó, chưa row-lock tất cả dữ liệu/quyền liên quan; chưa load-test hoặc chứng minh mọi tình huống thu hồi quyền đồng thời.
- Chưa có thông báo realtime/email, upload ảnh, revision thông tin CLB, suspend/unarchive thao tác, trang quản lý toàn bộ người dùng hoặc bảng audit nhiều phiên bản. Directory chỉ đọc các trạng thái này nếu DB đã có.
- Lịch sử hiện dùng reviewed_by/reviewed_at/review_note/status trên hồ sơ, không phải nhật ký mọi lần sửa. Không tự cho mở lại hồ sơ đã có kết quả.
- Back/Forward khi form chưa lưu còn giới hạn đã nêu ở Phase 3/4. Meeting chưa liên kết CLB và chưa thử media hai thiết bị trong phiên này.
- UI đã có khung và chức năng theo năm phase; vẫn cần nhóm review thị giác và thử tích hợp bằng tài khoản thật trên môi trường test trước khi coi final.

Checklist nhóm: dùng một admin đã có role hợp lệ và profile đầy đủ, một student gửi đề nghị; thử duyệt/từ chối hai hồ sơ khác nhau; kiểm tra public/workspace/owner history; thử hai admin xử lý cùng hồ sơ; kiểm tra role bị thu hồi; test tunnel/meeting riêng. Không dùng dữ liệu production để thử xóa hoặc tạo bừa.

### Bổ sung sau review: đích đăng nhập

Đã sửa mặc định từ trang gốc: admin vào /admin, sinh viên vào /me sau hoàn thiện profile và refresh role. Giữ nguyên link đích cụ thể khi đăng nhập. Tab đang ở /me không bị ép rời không gian cá nhân; chọn Quản trị hệ thống hoặc mở /admin. Kiểm tra bổ sung: 77 frontend tests, typecheck/build và browser cache role cũ→admin shell đạt. [Work log](/work-logs/2026-11-16-06-phase-04-admin-login-routing).
# Visual follow-up — account dropdown (2026-11-16)

The signed-in public header account dropdown now follows the supplied compact menu reference: initials avatar trigger, rounded floating panel, identity heading, icon-led actions and separated red sign-out row. Existing destinations and click handlers are retained. Frontend source only; no API, auth, database or room behavior changed. See [work log](/work-logs/2026-11-16-07-phase-04-account-menu-visual).
