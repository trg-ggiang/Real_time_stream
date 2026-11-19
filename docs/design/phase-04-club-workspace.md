# Phase 4 — Không gian sinh hoạt và quản lý CLB

## Người mới khám phá và đăng ký hoạt động (2026-11-19)

Từ trang Không gian sinh hoạt khi chưa tham gia CLB, người dùng có liên kết Hoạt động ở sidebar, nút Khám phá hoạt động ở nội dung chính và liên kết ở panel phải. Các điểm vào đều mở danh sách hoạt động công khai `/activities`; trang chi tiết hiện hành cho phép tài khoản đăng ký nếu hồ sơ sinh viên hoàn chỉnh và hoạt động còn mở. Việc đăng ký hoạt động không yêu cầu membership CLB. [Work log](../work-logs/2026-11-19-12-phase-04-guest-activity-registration.mdx).

## Chuyển đơn tuyển tới trưởng ban — 2026-11-19

Khi ứng viên nộp đơn, backend tạo draft với `profile_snapshot = NULL`; câu trả lời được ghi vào `application_answers`. Khi chuyển sang `submitted`, trigger tự xác thực hồ sơ và dựng `profile_snapshot`. Hồ sơ sau đó xuất hiện trong hàng chờ trưởng ban phụ trách `recruitment_department_id`. Đánh giá dùng `application_reviews` và kết quả gửi ứng viên dùng `result_message`. [Work log](../work-logs/2026-11-19-17-phase-04-recruitment-trigger-snapshot.mdx).

Trigger DB trả `P0001: Create application as own empty draft` nếu bản ghi mới không phải draft rỗng. `profile_snapshot` phải để `NULL` lúc insert; trigger sẽ tự dựng snapshot khi submit. Backend không còn tự cập nhật snapshot trước bước này. Đã typecheck; trigger trên DB thật chưa được thử lại. [Work log](../work-logs/2026-11-19-17-phase-04-recruitment-trigger-snapshot.mdx).

Lỗi `PGRST204` lần này do API cũ gửi `user_id`, `full_name`, `student_code`, `answers`, `portfolio_url` vào `recruitment_applications`, trong khi schema bạn gửi dùng `applicant_id`, `profile_snapshot` và bảng câu trả lời riêng. Không cần đổi DB hoặc reload cache để chữa sai lệch cột này; backend đã được chỉnh để theo đúng schema. Chưa xác minh với Supabase live. [Work log](../work-logs/2026-11-19-15-phase-04-match-recruitment-db-schema.mdx).

## Trưởng ban — trạng thái hiện tại

Role head có lối vào **Tuyển thành viên** ngay dưới **Thành viên**. Trang hiển thị hàng chờ và chi tiết đơn thuộc ban được gán; trưởng ban có thể lưu đánh giá, từ chối hoặc cho qua vòng đơn. Chủ nhiệm vẫn là người tạo campaign.

## Trưởng ban tuyển thành viên

Role `head` có lối vào **Tuyển thành viên** ngay dưới **Thành viên**. Danh sách và chi tiết chỉ trả hồ sơ thuộc department được gán; API xác thực role/department trước khi đọc hoặc ghi quyết định. Màn hình theo khung danh sách bên trái và chi tiết/đánh giá bên phải, dùng màu, viền và typography của workspace. Chủ nhiệm giữ quyền tạo campaign nhiều ban.

## Chọn ban ứng tuyển

Trang chi tiết tuyển hiển thị một bộ chọn gồm các ban đang mở. Chọn một ban mới mở form duy nhất với các câu hỏi của đúng ban đó; khi đổi lựa chọn, câu trả lời form trước không được gửi kèm.

## Ứng tuyển đợt tuyển

Trang Hoạt động công khai liệt kê các campaign `open`, trang chi tiết chỉ đọc campaign đã công khai, và bộ chọn ban chỉ hiển thị một biểu mẫu ứng tuyển tại một thời điểm. Người dùng đăng nhập và có hồ sơ đầy đủ; câu trả lời đọc từ `recruitment_questions`, hồ sơ lấy từ `student_profiles`; đơn ghi vào `recruitment_applications`, câu trả lời vào `application_answers`. Hàng chờ chỉ trả ứng viên có department thuộc trưởng ban hiện tại. Đánh giá lưu riêng trong `application_reviews`. Không áp dụng hai migration 001/002 cũ vì chúng mô tả cấu trúc khác với schema đã cung cấp. Chưa truy vấn DB live.

## Tải lại biểu mẫu tuyển

Tải lại browser trên trang tạo đợt tuyển xóa bản khôi phục từ `sessionStorage` và sinh campaign/form IDs mới. Lưu nháp, chuyển trong SPA và retry lỗi trong cùng trang vẫn giữ dữ liệu/ID hiện tại.

## Bài viết công khai

Bài viết mới và bài được sửa luôn lưu với `visibility = public`; form không có lựa chọn nội bộ. Bài xuất hiện cho mọi người xem sau khi chủ nhiệm duyệt. Bài nội bộ đã có từ trước không tự động đổi phạm vi.

## Đăng đợt tuyển — 2026-11-19

Cập nhật: chỉ ban active không có `is_management` mới xuất hiện trong form; nháp cũ được lọc lại. API cũng chặn ban quản lý trước mọi write. [Sửa điều kiện ban tuyển](../work-logs/2026-11-19-04-phase-04-recruitment-management.mdx).

Chủ nhiệm vào Tuyển thành viên, điền thông tin và mẫu câu hỏi cho từng ban rồi bấm **Đăng đợt tuyển**. API lưu các bảng `recruitment_campaigns`, `recruitment_departments`, `recruitment_questions` hiện có, sau đó mở campaign (`draft` → `open`). Thành công chuyển về **Hoạt động CLB → Đã đăng**, có mục Đợt tuyển thành viên và detail đọc mẫu đã lưu. Tab Của tôi bao gồm các bản lưu dở của chính người gọi; tuyển và hoạt động thường có phân trang riêng.

Các API dưới `/api/workspace/:clubId`: GET/POST `/recruitment`, GET `/recruitment/:id`, POST multipart `/recruitment-cover`. JWT/profile và membership được kiểm tra; chỉ chủ nhiệm được ghi, ban phải active và thuộc CLB. Người dùng khác không được đọc draft. ID giữ qua retry; chỉ mở sau khi đối chiếu đủ dữ liệu. REST writes không phải transaction liên bảng; bản lưu dở không nằm trong feed đã đăng. Retry cùng nội dung tiếp tục được, thay đổi nội dung một bản đã lưu trả conflict để tránh ghi đè.

Ảnh PNG/JPG tùy chọn, tối đa 10 MB, được kiểm tra MIME/chữ ký. Backend dùng Supabase Storage, tạo public bucket `recruitment-covers` ở lần upload đầu khi chưa tồn tại; DB chỉ giữ HTTPS URL. Backend cần secret key có quyền Storage. Nháp vẫn lưu theo tab; ngày mở là đầu ngày, ngày đóng là hết ngày Việt Nam. Đã có API ứng tuyển và hàng chờ xét duyệt; cần áp dụng hai migration recruitment trước khi ghi DB thật. Chưa có chỉnh sửa campaign đã lưu hoặc dọn ảnh thừa.

Typecheck/build và 27 tests liên quan đạt (16 backend, 11 frontend); chỉ đọc metadata Supabase, không tạo dữ liệu/bucket live. Khởi động lại backend trước khi thử form thực tế. Phase 04 In Progress. [Work log](../work-logs/2026-11-19-03-phase-04-publish-recruitment.mdx). Các mô tả tuyển dụng chưa có API bên dưới là lịch sử trước cập nhật này.

## Bản chính Real_time_stream1 — 2026-11-19

Cập nhật màn hình Thành viên: member/head xem bảng năm cột Họ và tên, Ban, Vai trò, Ngày tham gia, Trạng thái theo mẫu; avatar tròn với chữ viết tắt khi thiếu ảnh, ngày dd/mm/yyyy và badge xanh cho membership active. Chủ nhiệm có thêm cột Thao tác. Bảng cuộn ngang khi thiếu chiều rộng. Không đổi API hoặc phân trang. [Work log](../work-logs/2026-11-19-02-phase-04-member-directory-table.mdx).

`C:/Real_time_stream1` là bản chính cho yêu cầu này. Không gian sinh hoạt lấy từ `E:/Real_time_stream`; các phần còn lại tiếp tục dùng code bản C. Những mô tả selector/bố cục cũ bên dưới được giữ làm lịch sử.

- Header desktop/mobile có lối vào Không gian sinh hoạt (`/workspace`). Trang này mở ngay khung CLB và chuyển vào kênh thảo luận của CLB đầu tiên đã tham gia; nếu chưa có CLB, hiển thị trạng thái trống và lối khám phá/tạo CLB. Khách được yêu cầu đăng nhập, giữ đích quay lại.
- `/workspace/:clubId` hiển thị tổng quan; dải avatar trái chuyển CLB; sidebar có kênh, Các ban, Thành viên, tuyển dụng theo quyền và công việc CLB. Cột phải có thông tin, lịch chưa đồng bộ và hoạt động sắp tới.
- Quản lý ban/thành viên dùng API workspace được chuyển cùng frontend: `GET /member-candidates?q=...` chỉ cho chủ nhiệm, tối đa 8 kết quả chưa có membership; `POST /members` nhận role member/head (mặc định member), cấm head trong ban quản lý; `GET /members` hỗ trợ `department_id`; DTO ban hỗ trợ `is_management`. Kiểm tra CLB/quyền ở backend, không có thay đổi schema.
- Chat/kênh vẫn là xem trước, bản nháp kênh theo phiên trình duyệt; tuyển dụng có form/preview/nháp nhưng chưa có API lưu đợt tuyển. Lối họp mở công cụ hiện có, chưa tự gắn meeting vào CLB.
- Giữ nguyên `/me/clubs`, trang chủ, personal, admin, auth và meeting bản C. Không đổi component ảnh chung, dependency hoặc `.env`.

Build backend/frontend, 106 frontend tests và 9 backend workspace tests đạt. Chưa chạy browser/DB thật; bản C chưa có `.env`. Phase 04 In Progress. [Work log](../work-logs/2026-11-19-01-phase-04-import-club-workspace.mdx).

2026-11-16: The unfollow dropdown now sits close to the follow button in a compact panel. Phase remains In Progress. [Session log](/work-logs/2026-11-16-26-compact-follow-menu).

2026-11-16: Follow/unfollow state is reflected by the button without an extra confirmation line. Phase remains In Progress. [Session log](/work-logs/2026-11-16-25-hide-follow-confirmations).

2026-11-16: Unfollowing a club no longer displays an extra confirmation line. Phase remains In Progress. [Session log](/work-logs/2026-11-16-24-phase-04-hide-unfollow-message).

2026-11-16: The active club follow button now exposes a separate remove action in a dropdown. Phase remains In Progress. [Session log](/work-logs/2026-11-16-23-phase-04-follow-menu).

2026-11-16: Tightened spacing between adjacent discovery story cards. Phase remains In Progress. [Session log](/work-logs/2026-11-16-22-phase-04-story-card-spacing).

2026-11-16: Fixed fallback logo dimensions in followed club cards; phase remains In Progress. [Session log](/work-logs/2026-11-16-21-phase-04-followed-club-logo-fallback).

2026-11-16: `/me/follows` now presents followed clubs as responsive image cards. Phase remains In Progress. [Session log](/work-logs/2026-11-16-20-phase-04-followed-club-image-cards).

2026-11-16: `/me/clubs` now presents joined, managed and pending entries as responsive image cards. Phase remains In Progress. [Session log](/work-logs/2026-11-16-19-phase-04-personal-club-image-cards).

Ngày 16/11/2026. Đã triển khai trong workspace; sẵn sàng để nhóm review. Đây là Phase 4 của kế hoạch redesign, không đồng nghĩa toàn bộ roadmap hay UI đã final.

## Cách mở và luồng chính

Chạy backend và frontend như trước (`npm run dev:backend`, `npm run dev:frontend` ở hai terminal). Đăng nhập, hoàn thiện hồ sơ → Không gian của tôi → CLB tham gia → Mở không gian. URL `/workspace/:clubId` có thể refresh trực tiếp; môi trường deploy cần SPA rewrite. Phải là membership active trong CLB published. Tài khoản chưa thuộc CLB sẽ thấy danh sách trống; không tự tạo membership demo.

Mỗi CLB có không gian riêng, selector đổi CLB và vai trò lấy lại từ backend. Một người có thể là chủ nhiệm ở CLB này và thành viên ở CLB khác. Đăng nhập admin không tự được quyền thao tác workspace của CLB không tham gia. Shell công khai, cá nhân và CLB tách nhau; admin vẫn dùng module cũ, dành cho Phase 5.

| Trang | Thành viên | Chủ nhiệm |
| --- | --- | --- |
| Tổng quan | Bài đã đăng, hoạt động, lối vào họp | Thêm lối vào hàng đợi duyệt |
| Bài viết | Đọc public/internal của CLB; soạn/sửa nội dung của mình, lưu nháp/gửi duyệt | Xét duyệt, yêu cầu chỉnh sửa có lý do; bài của chủ nhiệm vẫn có bước duyệt rõ ràng |
| Hoạt động | Đọc, soạn/sửa đề xuất của mình và gửi duyệt | Tự tạo và đăng ngay; duyệt đề xuất của thành viên |
| Thành viên | Xem danh sách thành viên active và ban | Thêm tài khoản bằng email có sẵn, chuyển ban, gỡ thành viên, chuyển chủ nhiệm |
| Cơ cấu CLB | Xem tên, mô tả, trạng thái và thuộc tính ban | Tạo/sửa ban, cờ private và trạng thái; không được tắt Ban quản trị |
| Thông tin CLB | Có thể đọc bằng route trực tiếp, form không cho lưu | Chỉ sửa liên hệ/URL ảnh; không sửa tên, mô tả, sứ mệnh |
| Phòng họp | Mở module meeting hiện có và quay về đúng trang | Tương tự; quyền host độc lập role CLB |

Thêm thành viên bằng email là thao tác quản trị trực tiếp, chưa phải lời mời có bước chấp nhận hoặc pipeline tuyển dụng. Không xóa vật lý membership: gỡ đặt removed/left_at. Muốn gỡ chủ nhiệm phải chuyển chủ nhiệm trước. RPC chuyển chủ nhiệm dùng lại `clubspace_transfer_chair`; không mô phỏng bằng hai UPDATE rời nhau.

## Luồng nội dung

1. Frontend tạo UUID ổn định cho bản soạn mới; giữ cùng ID trong lần gửi lại sau lỗi, không tự retry mutation.
2. API xác thực JWT + hồ sơ, lấy actor từ token; kiểm tra membership active và CLB published.
3. Lưu nháp vào club_posts/club_activities với author_id/created_by do backend gán. Chỉ tác giả được sửa nội dung của mình. Chủ nhiệm duyệt, không sửa thay tác giả.
4. Sửa yêu cầu expected_updated_at. UPDATE lọc cùng club, ID, tác giả, trạng thái và phiên bản; nếu không còn đúng trả 409 để tránh ghi đè. Lưu bài đã đăng sẽ ẩn bản công khai và đưa về draft; chưa có revision song song.
5. Gửi bản vừa lưu: draft → pending_review. Với hoạt động do chủ nhiệm tạo, backend tiếp tục bước duyệt đăng. Đây là hai thao tác: nếu bước sau lỗi thì có thể còn pending; kiểm tra Của tôi/hàng đợi trước khi gửi lại.
6. Chủ nhiệm quyết định pending_review → published hoặc changes_requested, kèm reviewed_by/reviewed_at/review_note và published_at. Yêu cầu sửa bắt buộc có lý do. Backend hỗ trợ legacy rejected chỉ khi CHECK publication_status từ chối changes_requested; không retry lỗi mạng.
7. Nội dung public đã published xuất hiện qua API khám phá hiện có khi tải lại. Internal chỉ đọc trong workspace có membership, không đẩy vào public. Không có realtime đồng bộ bài/hoạt động giữa các tab.

Hoạt động có thời gian bắt đầu/kết thúc, hình thức onsite/online/hybrid, địa điểm/link, ảnh, sức chứa và cửa sổ đăng ký. Form nhập giờ Việt Nam; API lưu ISO timestamp. Join URL chỉ trả trong workspace cho người tạo/chủ nhiệm; không coi thành viên CLB tự động là người đăng ký hoạt động. Luồng đăng ký công khai hiện có vẫn độc lập.

## Tổ chức code

```text
backend/src/workspace/
  workspace.controller          route, guards, DTO, no-store
  workspace-access.service      kiểm tra phạm vi và quyền theo CLB
  workspace-people.service      ban, membership, chuyển chủ nhiệm, liên hệ
  workspace-content.service     draft, submit, review, phiên bản
  workspace.dto / module        validation và dependency injection
frontend/src/features/club-workspace/
  WorkspaceApp                  shell, routing, selector, menu mobile
  workspace-context             context riêng từng token + CLB
  pages/WorkspaceHome           overview, meeting entry, thông tin, review hub
  pages/WorkspaceContent        list, detail, editor posts/activities
  pages/WorkspacePeople         members, departments
  services/workspace-api        private contract
  use-workspace-mutation        khóa gửi lặp, hủy khi unmount, hiển thị lỗi
  workspace.css                 CSS chỉ trong scope cw-app
```

Tái sử dụng account-http, usePersonalQuery, ProfileGuard, ContentImage, định dạng ngày/link và unsaved-changes. Không tạo bộ auth hay Supabase client ở trình duyệt. Private GET no-store; phân trang tối đa 24. 401 quay lại auth; thiếu hồ sơ quay lại onboarding. Không nhận role, actor hoặc club_id tùy chọn trong body để cấp quyền.

### API mới

Tất cả dưới `/api/workspace/:clubId`, yêu cầu JWT và profile hoàn chỉnh.

| Method / suffix | Mục đích |
| --- | --- |
| GET / | Club context và role của người gọi |
| GET /departments; POST /departments; PATCH /departments/:id | Đọc/tạo/sửa ban |
| GET /members; POST /members | Danh sách, thêm tài khoản đã có |
| PATCH /members/:id/department; POST /members/:id/remove | Chuyển ban, soft remove |
| POST /transfer-chair; PATCH /contact | Chuyển chủ nhiệm nguyên tử, sửa liên hệ/ảnh |
| GET /content/:kind; GET /content/:kind/:id | Published/mine/review và detail, kind posts hoặc activities |
| POST /posts hoặc /activities; PATCH /posts/:id hoặc /activities/:id | Lưu bản soạn mới/sửa |
| POST /content/:kind/:id/submit | Gửi bản hiện tại |
| PATCH /content/:kind/:id/review | Duyệt hoặc yêu cầu sửa |

Các route `my-clubs` cũ vẫn giữ tương thích; shell mới không sử dụng UI quản lý cũ. Club hash cũ được chuyển sang route mới. Legacy admin chưa được thiết kế lại.

## Kiểm chứng

- Backend: 57 tests passed. Thêm test quyền theo CLB, bản nháp riêng tư, ẩn join URL, compare-and-set, UUID chống bản soạn trùng khác nội dung, review actor/trạng thái, transfer RPC, allowlist liên hệ và HTTP guards/validation.
- Frontend: 70 tests passed. Có chuyển CLB đổi quyền, save → submit đúng phiên bản nhận về, giữ form khi lỗi mạng/không tự retry, hủy đổi CLB khi chưa lưu.
- Typecheck và production build đạt; còn cảnh báo chunk MeetingRoom lớn đã có từ trước.
- Trình duyệt thật với API fixtures: 45 checks ở 1440/768/390/320px; không tràn ngang, ảnh hỏng, console error hoặc lỗi flow; app-screen probes 0 FAIL. Đã sửa overflow datetime trên tablet, xem screenshot desktop/mobile và chỉnh khoảng cách link.
- Browser kiểm tra trực tiếp soạn/gửi/duyệt bài, đổi CLB đổi role, member mở review URL bị chặn, menu mobile. Ba mutation đều được fulfill bởi fixture, **0 live writes**. Đây không phải kiểm thử tích hợp ghi Supabase thật hoặc tải đồng thời.
- Chỉ đọc metadata Supabase để đối chiếu cột và sự tồn tại RPC. Không chạy migration/seed, không sửa dữ liệu, không commit/push. Có script SQL chỉ đọc `supabase/verification/phase-04-workspace-preflight.sql` cho nhóm kiểm tra catalog.
- Artifact cục bộ: output/phase-04-workspace/checks.json và screenshot; output/phase-04-tests.txt (backend), phase-04-frontend-final.txt (frontend), phase-04-typecheck.txt, phase-04-build.txt. Không cần đưa output vào source control.

## Giới hạn cần hiểu

- Chưa nghiệm thu thao tác ghi với tài khoản thật trên Supabase. Trigger constraint/RPC bản live cần kiểm tra theo catalog và thử trong môi trường test; thấy endpoint RPC không chứng minh thân hàm/transaction đúng phiên bản.
- Membership được kiểm tra đầu request; thao tác chuyển chủ nhiệm dùng RPC nguyên tử, nhưng không bảo đảm mọi mutation khác nguyên tử với việc thu hồi quyền diễn ra đồng thời. Chưa có load test hay row-lock toàn bộ policy.
- Chưa có upload ảnh, quản lý danh sách người đăng ký/điểm danh hoạt động, thay đổi vòng đời hoạt động, thông báo hoặc realtime feed. Không giả lập các mục này thành chức năng đã hoàn thành.
- Chưa có lời mời thành viên, tự tham gia CLB, tuyển dụng hay chat ban. is_private mới là thuộc tính chuẩn bị cho channel; xem metadata ban không có nghĩa được đọc tin nhắn ban.
- Chưa sửa tên/nội dung giới thiệu CLB published: chờ thiết kế revision/admin approval. Phải giữ bản công khai hiện tại khi bổ sung luồng đó.
- Meeting chưa có club_id: lối vào workspace không đồng nghĩa phòng đã gắn CLB hoặc bị chặn bởi membership CLB. Quyền cuộc họp vẫn theo module meeting hiện tại.
- Cảnh báo chưa lưu hỗ trợ link, logout, reload/close và selector CLB; nút Back/Forward SPA chưa chặn đầy đủ.
- Selector lấy 24 CLB đầu, có link Tất cả CLB của tôi để dùng danh sách phân trang.

## Nhóm review tiếp

Mở bằng ít nhất hai membership khác role, xem desktop/mobile; thử bản nháp, trả sửa, duyệt và làm rõ policy sửa bài đã đăng. Sau review, Phase 5 xử lý shell admin và kiểm tra xuyên suốt sản phẩm. Không tự nâng trạng thái toàn dự án thành Done.
