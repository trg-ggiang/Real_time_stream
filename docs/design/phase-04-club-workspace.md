# Phase 4 — Không gian sinh hoạt và quản lý CLB

> Image and confirmation update: existing image URL inputs now use file selection/upload; confirmations use the shared asynchronous popup. [Implementation and verification](../work-logs/2026-11-20-12-phase-04-popups-image-upload.mdx).

> Realtime update 2026-11-20: club messages use Socket.IO `/workspace-chat`; history uses HTTP only on connection/reconnection/pagination. Meeting messages use `/chat`. Older polling/meeting-overview descriptions below are historical; see [current transport and room decisions](../work-logs/2026-11-20-11-phase-04-realtime-chat-room-cleanup.mdx). Meetings still open as a separate full-page view; only the duplicate overview was removed.

**Bàn giao 20/11/2026** · Phase 04 kỹ thuật vẫn **In Progress**. Tài liệu này mô tả workspace sau tích hợp kênh, chat và họp gắn CLB. Xem [log tích hợp](../work-logs/2026-11-19-04-phase-04-workspace-handoff.mdx) và [log rà soát](../work-logs/2026-11-19-07-phase-04-workspace-chat-enter.mdx).

Điều hướng cập nhật 20/11: hai lối họp chỉ nằm trong nhóm Gọi và gặp mặt; chuyển kênh dùng danh sách kênh đã tải trong CLB; dải CLB giữ thứ tự membership từ API. Xem [work log điều hướng](../work-logs/2026-11-20-07-phase-04-workspace-navigation-stability.mdx).

Các mục trong Công việc CLB và Khác có icon Phosphor đi cùng nhãn; quyền hiển thị và đường dẫn không đổi. Xem [work log icon menu](../work-logs/2026-11-20-08-phase-04-workspace-menu-icons.mdx).

Shell CLB không còn footer `uniCircle · tên CLB` ở đáy trang; xem [work log gỡ footer](../work-logs/2026-11-20-09-phase-04-remove-workspace-footer.mdx).

Trang Khác → Thông tin CLB cuộn trong cột nội dung trên desktop/tablet và cuộn theo trang trên mobile; xem [work log cuộn trang](../work-logs/2026-11-20-10-phase-04-club-information-scroll.mdx).

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

DB có role `head` theo ban. Giao diện hiện đọc role và có thao tác chuyển ban hoặc chuyển chủ nhiệm. Bổ nhiệm trưởng ban và thêm/gỡ người ngoài ban ở kênh private chưa có luồng API/UI.

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
- **Giao diện.** Navy sáng mặc định, nút Sáng/Tối ở cột thông tin và lưu lựa chọn trên trình duyệt. Có bong bóng tin gửi/nhận, nhóm theo người gửi, Enter gửi, Shift+Enter xuống dòng và nút mặt cười chèn emoji Unicode vào ô soạn. Link HTTP/HTTPS trong tin được gạch chân và bấm trực tiếp.
- **Họp CLB.** Workspace liệt kê cuộc họp theo `clubId`, gửi `clubId` khi tạo và truyền mã/ID buổi sang module meeting. Với họp gắn CLB, API danh sách buổi, join và trạng thái chờ đều kiểm tra membership active trước khi áp dụng quyền riêng của cuộc họp. Mỗi buổi có link mời và phòng LiveKit riêng. Chat phiên họp đi qua Socket.IO riêng.

- **Ảnh và tệp.** Nút kẹp giấy và dán ảnh trực tiếp vào ô soạn dùng chung giới hạn 3 tệp và 15 MiB tổng mỗi tin. Ảnh hiện trực tiếp trong chat và bấm để xem lớn hoặc tải. Tài liệu hiện thành thẻ tệp. Tệp nằm trong Storage private. API chỉ cấp URL xem/tải cho người có quyền đọc kênh và tin chưa bị gỡ. Dùng migration 20261120000100_club_chat_attachments.sql trước khi triển khai bản ứng dụng này.

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
  pages/WorkspaceChat           lịch sử, polling và ô soạn
  pages/ChannelAttachments      dán ảnh, bản nháp và xem/tải tệp
  pages/ChannelMessageText      hiển thị link HTTP/HTTPS
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
| GET/POST /channels/:channelId/messages | Đọc lịch sử và gửi tin văn bản/emoji |
| POST /channels/:channelId/messages/attachments | Gửi ảnh/tệp qua multipart, có thể kèm chú thích |
| GET /channels/:channelId/attachments/:attachmentId | Cấp URL xem ảnh hoặc tải tệp sau khi kiểm tra quyền |
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

- 20/11/2026: npm test đạt **49 backend và 100 frontend**. Build frontend đạt trong lượt sửa cuối. Browser dùng API mô phỏng để kiểm tra ảnh và tài liệu, bấm link ra đúng buổi họp, theme tối và phân trang ở desktop/mobile.
- Supabase chỉ đọc: đã kiểm tra quyền kênh ở AE 18 và xác nhận bảng metadata, quan hệ API và bucket private cho đính kèm. [Kiểm tra migration đính kèm](../../supabase/verification/20261120_club_chat_attachments_postflight.sql)
- Quick Tunnel đã chuyển HTTP/WSS với backend mô phỏng. Ca gửi/tải ảnh thật, tạo lịch và audio/video giữa hai thiết bị/hai mạng vẫn cần nghiệm thu. [Sổ phiên](../dev/session-log.mdx)

## Tiếp tục ở phiên sau

| Ưu tiên | Việc còn mở | Điểm bắt đầu |
| --- | --- | --- |
| 1 | Đối chiếu quyền sửa metadata và đổi riêng tư với DB. Bổ sung quản lý người ngoài ban bởi head khi được giao | `workspace-people.service.ts`, `WorkspacePeople.tsx`, migration mở rộng |
| 2 | Tải bù chat theo mốc tin cuối, nghiệm thu tải tệp thật và xử lý file upload bỏ dở | `WorkspaceChat.tsx`, `workspace-channels.service.ts` |
| 3 | Khôi phục tạo lịch sau khi rời trang, xử lý buổi đã hủy và nghiệm thu hai buổi qua HTTPS | `WorkspaceMeetings.tsx`, `meetings.service.ts` |
| 4 | Sửa câu giới thiệu chat ở trang Ban, thống nhất nhãn Trưởng ban, rà vị trí nút đổi theme trên mobile | `WorkspacePeople.tsx`, `WorkspaceApp.tsx`, `workspace-theme.css` |

Khi nghiệm thu, dùng các tài khoản test có vai trò khác nhau ở cùng CLB. Ghi lại ca thử thật và ca mô phỏng. Dùng [preflight chỉ đọc](../../supabase/verification/phase-04-workspace-preflight.sql) và [gói SQL mở rộng](../../output/unicircle-platform-migration-20261117/README.md) để đối chiếu schema. Thực hiện migration, seed hoặc nghiệm thu ghi dữ liệu trong môi trường đã được nhóm chọn. Tuyển thành viên và thông báo đã nối vào workspace ở cập nhật 20/11 bên dưới. Phỏng vấn và duyệt sửa tên/mô tả CLB còn chưa triển khai.

## Trưởng ban — cập nhật 20/11/2026

Chủ nhiệm vào Khác → Thành viên, dùng Chuyển trưởng ban/Gỡ trưởng ban để đổi
member/head trong ban hiện tại. Vai trò hiển thị tại tổng quan cá nhân; chuông
landing nhận thông báo bổ nhiệm và bỏ số khi xem. Cần chạy migration
`supabase/migrations/202611200001_department_head_notifications.sql`, restart
backend rồi test hai tài khoản. Xem [hướng dẫn](../modules/department-head.mdx).

## Tuyển thành viên - cập nhật 20/11/2026

Mục Công việc CLB → Tuyển thành viên chỉ cho chair/head. Chair tạo draft/đăng/đóng
và duyệt mọi ban; head chỉ xem/duyệt đơn đúng ban mình. Editor/queue/detail thay
vùng giữa, giữ workspace shell. Bài đã đăng vào activities feed và trang CLB;
applicant điền form, xem lại, xác nhận rồi theo dõi ở Không gian cá nhân.
Duyệt thêm member đúng ban trong cùng transaction với kết quả và thông báo.
Chuông landing giữ luồng bổ nhiệm trưởng ban và mở rộng đơn/kết quả tuyển.
Cần migration 202611200002 và restart backend; xem
[hướng dẫn](../modules/club-recruitment.mdx) và
[work log](../work-logs/2026-11-20-02-phase-04-recruitment-workflow.mdx).
Chưa nghiệm thu Supabase thật; Phase 04 vẫn In Progress.


## Chuyển CLB — 21/11/2026

Giữ khung workspace và theme khi đổi CLB; tải context/nội dung mới trong vùng chính và không hiển thị công cụ của CLB cũ khi chờ. Xem [work log](../work-logs/2026-11-21-03-phase-04-club-switch-flicker.mdx).

## Thông báo trong workspace — 22/11/2026

Biểu tượng từng CLB có số thông báo; kênh có tin mới được làm đậm. Tổng số gồm tin chưa đọc ở kênh có quyền truy cập, buổi họp đang diễn ra/sắp tới, bài và hoạt động chờ chủ nhiệm duyệt hoặc bị yêu cầu sửa của tác giả. Mở kênh cập nhật `channel_read_states`; dữ liệu khác giữ badge đến khi trạng thái nghiệp vụ đổi. Workspace tải lại tổng hợp mỗi 15 giây khi tab hiển thị. [Work log](../work-logs/2026-11-22-13-phase-04-workspace-attention.mdx).

Badge tổng được căn trong góc icon CLB. Danh sách kênh dùng tên đậm và dấu `#` đổi màu khi có tin mới, không hiện số ở từng hàng kênh. [Work log chỉnh giao diện](../work-logs/2026-11-22-14-phase-04-attention-visual-polish.mdx).

Badge CLB sau đó được đưa sát góc ngoài, với khoảng đệm khi rail cuộn. Mục Gọi và gặp mặt dùng icon camera/lịch và nhãn số họp xanh nhẹ. [Work log tinh chỉnh](../work-logs/2026-11-22-15-phase-04-attention-icon-meeting-polish.mdx).
