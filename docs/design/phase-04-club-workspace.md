# Phase 4 — Không gian sinh hoạt và quản lý CLB

> Current workspace implementation (2026-11-19): see [workspace handoff](../work-logs/2026-11-19-04-phase-04-workspace-handoff.mdx). This supersedes older statements below about preview-only channels, disabled chat and meetings without club ownership. Latest UI decisions and acceptance limits are recorded there.


2026-11-19: The application shell and public/personal pages follow `haimoi1`. My Clubs and the authenticated desktop/mobile header link open the `final` club workspace at `/workspace`; `/me/clubs` redirects there. [Work log](/work-logs/2026-11-19-02-phase-04-haimoi1-ui-final-workspace).

## Đối chiếu schema đúng 18/11/2026

Schema người dùng gửi lại khớp hệ thống CLB hiện tại: `users.role` mặc định `student`; `club_memberships` lưu quyền theo CLB; `club_channels` có `club_id`, `department_id` tùy chọn, `kind` và `name`; `channel_members`, `channel_messages`, `channel_read_states` lưu tham gia, tin nhắn và trạng thái đọc. `meetings` có `club_id` tùy chọn và `recurrence_rule`; `meeting_sessions` lưu các buổi. Danh sách cột không đủ để kết luận chính sách RLS, quyền private channel hoặc giá trị hợp lệ của `kind`.

Backend workspace hiện chưa có route đọc/ghi kênh. Các tên kênh trong frontend là bản xem trước, chưa lấy từ `club_channels`. Công cụ họp hiện có đã tạo lịch lặp qua `recurrenceRule`; endpoint tạo cuộc họp chưa nhận/ghi `club_id`, nên cuộc họp tạo từ lối vào CLB vẫn chưa thuộc CLB trong DB. [Work log đối chiếu](/work-logs/2026-11-18-02-phase-04-schema-alignment).

## Cập nhật frontend 18/11/2026

Sinh viên có hồ sơ hoàn chỉnh vào trang chủ `/` sau đăng nhập. Header có lối **Không gian sinh hoạt** tới `/workspace`, mở thẳng kênh `# thảo-luận` của CLB đầu tiên đã tham gia. Nếu chưa có CLB, khung vẫn hiện cùng lối khám phá/tạo CLB. Trong `/workspace/:clubId`, dải ngoài cùng bên trái hiển thị avatar để chuyển CLB; sidebar kế bên chỉ có tên, vai trò, tổng quan và các kênh xem trước `# thông-báo`, `# thảo-luận`, `# tài-liệu`, `# hỏi-đáp`. Bên dưới kênh là công việc: viết bài, bài viết, hoạt động, tạo họp định kỳ; tiếp theo là phòng họp và thành viên. Chủ nhiệm thấy thêm duyệt nội dung, cơ cấu và thông tin CLB. Vai trò được lấy lại theo từng CLB. [Work log avatar](/work-logs/2026-11-18-04-phase-04-club-rail-avatar).

Kênh chiếm toàn bộ vùng nội dung, không có khung thẻ quanh chat. Các kênh chỉ là giao diện xem trước, chưa có API chat hoặc quyền kênh; ô nhắn tin bị vô hiệu hóa. Lối họp định kỳ mở công cụ họp hiện có, chưa gắn cuộc họp với CLB. `/me` chỉ quản lý tài khoản/hoạt động cá nhân và `/me/clubs` chuyển sang `/workspace`. Xem [work log chỉnh UX](/work-logs/2026-11-18-03-phase-04-student-ux-navigation) và [work log đối chiếu schema](/work-logs/2026-11-18-02-phase-04-schema-alignment).

Sidebar có vùng kênh cuộn chung để giữ nhóm Công việc CLB ở đáy; công việc có thể gập. Chủ nhiệm tạo bản nháp kênh văn bản/gọi nhanh trong phiên trình duyệt. Đây chưa phải kênh lưu trên hệ thống vì workspace API chưa có endpoint. “Phòng chung” và “Họp nhóm” dẫn tới công cụ meeting hiện có, chưa là phòng gọi riêng của từng kênh. [Work log sidebar](/work-logs/2026-11-18-05-phase-04-compact-club-sidebar).

Dải CLB dùng nền xanh nhạt; góc trên trái là nút Trang chủ, cuối dải là avatar mở Tài khoản/Đăng xuất. Cột **bên phải** cho mọi thành viên xem thông tin CLB, trạng thái lịch họp và hoạt động sắp tới từ API. Backend chưa có danh sách lịch họp sắp tới theo CLB nên cột này không hiện lịch giả. [Work log dải CLB](/work-logs/2026-11-18-06-phase-04-workspace-rail-quick-view).

Cập nhật sau đó: cột trái ưu tiên kênh và công việc hay dùng (gồm Phòng họp). Cột phải hiển thị giới thiệu ngắn, trạng thái lịch họp và hoạt động sắp tới; nhóm Khác gập được ở cuối cột phải giữ các lối ít dùng. Không hiển thị mục tiêu và liên hệ trong phần xem nhanh. [Work log phân vai hai cột](/work-logs/2026-11-18-07-phase-04-sidebar-priority-readonly-panel), [work log chuyển mục Khác](/work-logs/2026-11-18-08-phase-04-move-secondary-links-right).

Nhóm Công việc CLB cố định ở đáy sidebar trái; Tổng quan CLB ở đầu và vùng giữa cuộn chung kênh văn bản/gọi nhanh. [Work log sidebar cố định](/work-logs/2026-11-18-09-phase-04-pinned-work-sidebar).
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

Chạy backend và frontend như trước (`npm run dev:backend`, `npm run dev:frontend` ở hai terminal). Đăng nhập, hoàn thiện hồ sơ → Trang chủ → Không gian sinh hoạt → kênh thảo luận. URL `/workspace/:clubId/channels/general` có thể refresh trực tiếp; môi trường deploy cần SPA rewrite. Phải là membership active trong CLB published. Tài khoản chưa thuộc CLB sẽ thấy trạng thái trống; không tự tạo membership demo.

Mỗi CLB có không gian riêng, dải CLB đổi ngữ cảnh và vai trò lấy lại từ backend. Một người có thể là chủ nhiệm ở CLB này và thành viên ở CLB khác. Đăng nhập admin không tự được quyền thao tác workspace của CLB không tham gia. Shell công khai, cá nhân và CLB tách nhau; admin vẫn dùng module cũ, dành cho Phase 5.

| Trang | Thành viên | Chủ nhiệm |
| ---

2026-11-19: The merged club workspace retains the `final` layout. Administration remains at its separate `/admin` route. Frontend build and 86 tests passed; browser review remains pending. [Work log](/work-logs/2026-11-19-01-phase-04-final-ui-admin-merge).

 | --- | --- |
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
- Chưa có lời mời thành viên, tự tham gia CLB, tuyển dụng hay chat ban trong module workspace. Schema đã có bảng channel, nhưng workspace API chưa triển khai kênh; xem metadata ban không có nghĩa được đọc tin nhắn ban.
- Chưa sửa tên/nội dung giới thiệu CLB published: chờ thiết kế revision/admin approval. Phải giữ bản công khai hiện tại khi bổ sung luồng đó.
- Schema `meetings` đã có `club_id`, nhưng API tạo cuộc họp hiện chưa ghi trường này. Lối vào workspace chưa gắn cuộc họp với CLB hoặc áp membership CLB cho meeting. Quyền cuộc họp vẫn theo module meeting hiện tại.
- Cảnh báo chưa lưu hỗ trợ link, logout, reload/close và selector CLB; nút Back/Forward SPA chưa chặn đầy đủ.
- Selector lấy 24 CLB đầu, có link Tất cả CLB của tôi để dùng danh sách phân trang.

## Nhóm review tiếp

Mở bằng ít nhất hai membership khác role, xem desktop/mobile; thử bản nháp, trả sửa, duyệt và làm rõ policy sửa bài đã đăng. Sau review, Phase 5 xử lý shell admin và kiểm tra xuyên suốt sản phẩm. Không tự nâng trạng thái toàn dự án thành Done.
