# Phase 4 — Không gian sinh hoạt và quản lý CLB

**Bàn giao 19/11/2026** · Phase 04 kỹ thuật vẫn **In Progress**. Tài liệu này mô tả workspace sau tích hợp kênh, chat và họp gắn CLB. Xem [log tích hợp](../work-logs/2026-11-19-04-phase-04-workspace-handoff.mdx) và [log rà soát](../work-logs/2026-11-19-07-phase-04-workspace-chat-enter.mdx).

## Cách mở và luồng chính

Chạy backend và frontend như trước (`npm run dev:backend`, `npm run dev:frontend` ở hai terminal). Đăng nhập, hoàn thiện hồ sơ → Trang chủ → Không gian sinh hoạt → kênh thảo luận. URL `/workspace/:clubId/channels/general` có thể refresh trực tiếp; môi trường deploy cần SPA rewrite. Phải là membership active trong CLB published. Tài khoản chưa thuộc CLB sẽ thấy trạng thái trống; không tự tạo membership demo.

Mỗi CLB có không gian riêng, dải CLB đổi ngữ cảnh và vai trò lấy lại từ backend. Một người có thể là chủ nhiệm ở CLB này và thành viên ở CLB khác. Đăng nhập admin không tự được quyền thao tác workspace của CLB không tham gia. Shell công khai, cá nhân, CLB và admin tách nhau.

| Trang | Thành viên | Chủ nhiệm |
| --- | --- | --- |
| Tổng quan | Bài đã đăng, hoạt động và lối vào họp | Thêm lối vào hàng đợi duyệt |
| Bài viết | Đọc nội dung được phép, soạn và gửi duyệt bài của mình | Xét duyệt, yêu cầu sửa kèm lý do |
| Hoạt động | Đọc, soạn và gửi duyệt đề xuất | Tạo và đăng ngay, duyệt đề xuất |
| Thành viên | Xem danh sách thành viên active và ban | Thêm tài khoản theo email, chuyển ban/gỡ thành viên thường, chuyển chủ nhiệm |
| Cơ cấu CLB | Xem tên, mô tả, trạng thái và thuộc tính ban | Tạo ban và chỉnh metadata. Luồng đổi private còn lệch với quyền DB |
| Thông tin CLB | Đọc thông tin | Chỉnh liên hệ/URL ảnh |
| Phòng họp | Tạo họp ngay/lên lịch trong CLB | Cùng luồng tạo họp. Quyền host theo từng cuộc họp |

DB có role `head` theo ban. Code hiển thị role ở một số màn hình. Chưa có thao tác thêm/gỡ người ngoài ban ở kênh private cho head.

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

## Luồng chat và họp

- **Chat CLB.** NestJS lấy `club_channels` và lọc qua `clubspace_can_read_channel`. Kênh Chung và kênh ban mở dùng chung cho membership active. Kênh private dành cho thành viên trong ban hoặc người được cấp quyền riêng. Quyền chủ nhiệm không tự mở kênh private. Tin lưu theo kênh trong `channel_messages`, tải 50 tin mỗi lượt, polling khoảng 3 giây khi tab hiển thị. Backend dùng UUID do client gửi để chống ghi trùng khi thử lại.
- **Giao diện.** Navy sáng mặc định, nút Sáng/Tối ở cột thông tin và lưu lựa chọn trên trình duyệt. Có bong bóng tin gửi/nhận, nhóm theo người gửi, Enter gửi và Shift+Enter xuống dòng.
- **Họp CLB.** Workspace liệt kê cuộc họp theo `clubId`, gửi `clubId` khi tạo và truyền mã/ID buổi sang module meeting. Meeting xử lý phòng chờ, admission và LiveKit. Chat phiên họp đi qua Socket.IO riêng.

## Tổ chức code

```text
backend/src/workspace/
  workspace.controller          route, guards, DTO, no-store
  workspace-access.service      kiểm tra phạm vi và quyền theo CLB
  workspace-people.service      ban, membership, chuyển chủ nhiệm, liên hệ
  workspace-channels.*          quyền kênh, lịch sử và gửi tin
  workspace-content.service     draft, submit, review, phiên bản
  workspace.dto / module        validation và dependency injection
frontend/src/features/club-workspace/
  WorkspaceApp                  shell, routing, selector, menu mobile
  workspace-context             context riêng từng token + CLB
  pages/WorkspaceHome           thông tin và review hub
  pages/WorkspaceOverview       tổng quan và thống kê
  pages/WorkspaceChat           lịch sử, polling và composer
  pages/WorkspaceMeetings       tạo, lên lịch và mở buổi họp
  pages/WorkspaceContent        list, detail, editor posts/activities
  pages/WorkspacePeople         members, departments
  services/workspace-api        private contract
  use-workspace-mutation        khóa gửi lặp, hủy khi unmount, hiển thị lỗi
  workspace*.css                bố cục, màu sắc và theme trong scope cw-app
```

Tái sử dụng account-http, usePersonalQuery, ProfileGuard, ContentImage, định dạng ngày/link và unsaved-changes. Không tạo bộ auth hay Supabase client ở trình duyệt. Private GET no-store; phân trang tối đa 24. 401 quay lại auth; thiếu hồ sơ quay lại onboarding. Không nhận role, actor hoặc club_id tùy chọn trong body để cấp quyền.

### API mới

Tất cả dưới `/api/workspace/:clubId`, yêu cầu JWT và profile hoàn chỉnh.

| Method / suffix | Mục đích |
| --- | --- |
| GET / | Club context và role của người gọi |
| GET /channels | Danh sách kênh người gọi được phép đọc |
| GET/POST /channels/:channelId/messages | Lịch sử và gửi tin |
| GET /meetings | Danh sách phòng và buổi họp gắn CLB |
| GET /departments; POST /departments; PATCH /departments/:id | Đọc/tạo/sửa ban |
| GET /members; POST /members | Danh sách, thêm tài khoản đã có |
| PATCH /members/:id/department; POST /members/:id/remove | Chuyển ban, soft remove |
| POST /transfer-chair; PATCH /contact | Chuyển chủ nhiệm nguyên tử, sửa liên hệ/ảnh |
| GET /content/:kind; GET /content/:kind/:id | Published/mine/review và detail, kind posts hoặc activities |
| POST /posts hoặc /activities; PATCH /posts/:id hoặc /activities/:id | Lưu bản soạn mới/sửa |
| POST /content/:kind/:id/submit | Gửi bản hiện tại |
| PATCH /content/:kind/:id/review | Duyệt hoặc yêu cầu sửa |

Các route `my-clubs` cũ vẫn giữ tương thích; shell mới không sử dụng UI quản lý cũ. Club hash cũ được chuyển sang route mới. Admin chạy tại `/admin` và dùng API riêng.

## Kiểm chứng

- Source `36ff795`: `npm test` đạt **44 test backend và 94 test frontend**.
- Browser 1440 px và 390 px với API mô phỏng: menu mobile, đóng cột phải, lưu theme, gửi/nhận tin, chặn mở kênh private, mở đúng buổi họp và thử lại khi bước lưu lịch lỗi.
- Kiểm tra chỉ đọc trên Supabase cho AE 18: chủ nhiệm, thành viên và head có thể dùng kênh Chung và kênh ban mở. Chỉ chủ nhiệm trong ba tài khoản đã kiểm tra có quyền mở Ban quản trị. Chưa nghiệm thu gửi tin, tạo lịch, đổi quyền ban trên DB thật hoặc audio/video giữa hai thiết bị. [Chi tiết ca thử](../work-logs/2026-11-19-07-phase-04-workspace-chat-enter.mdx)

## Tiếp tục ở phiên sau

| Ưu tiên | Việc còn mở | Điểm bắt đầu |
| --- | --- | --- |
| 1 | Đối chiếu quyền sửa metadata và đổi riêng tư với DB. Bổ sung quản lý người ngoài ban bởi head khi được giao | `workspace-people.service.ts`, `WorkspacePeople.tsx`, migration mở rộng |
| 2 | Tải bù chat theo mốc tin cuối. Ca mô phỏng 55 tin mới chỉ hiện 50 tin | `WorkspaceChat.tsx`, `workspace-channels.service.ts` |
| 3 | Khôi phục tạo lịch sau khi rời trang, xử lý buổi đã hủy và chốt quyền vào họp qua mã | `WorkspaceMeetings.tsx`, `meetings.service.ts` |
| 4 | Sửa câu giới thiệu chat ở trang Ban, thống nhất nhãn Trưởng ban, rà theme tối của form họp và vị trí nút theme mobile | `WorkspacePeople.tsx`, `WorkspaceApp.tsx`, `workspace-theme.css` |

Khi nghiệm thu, dùng các tài khoản test có vai trò khác nhau ở cùng CLB. Ghi lại ca thử thật và ca mô phỏng. Dùng [preflight chỉ đọc](../../supabase/verification/phase-04-workspace-preflight.sql) và [gói SQL mở rộng](../../output/unicircle-platform-migration-20261117/README.md) để đối chiếu schema. Thực hiện migration, seed hoặc nghiệm thu ghi dữ liệu trong môi trường đã được nhóm chọn. Tuyển dụng/phỏng vấn, thông báo và duyệt sửa tên/mô tả CLB vẫn là các luồng chưa nối vào workspace.
