# uniCircle — Nền tảng CLB và phòng họp

## Bắt đầu phiên làm việc

1. Xem [luồng hệ thống](CODE_FLOW.md) và [trạng thái roadmap](docs/plans/master-plan.mdx).
2. Nếu làm phần Không gian sinh hoạt, đọc [bàn giao workspace](docs/design/phase-04-club-workspace.md) và [work log kiểm thử mới nhất](docs/work-logs/2026-11-19-07-phase-04-workspace-chat-enter.mdx).
3. Kiểm tra nhánh và thay đổi local bằng `git status -sb`. Khi working tree sạch, cập nhật `final` bằng `git pull --ff-only origin final`. Giữ lại công việc local cần dùng trước khi đồng bộ.

## Dự án đang có gì

- **Khám phá** tại `/`, `/clubs`, `/activities`, `/posts`. Guest xem dữ liệu công khai. Quan tâm và đăng ký hoạt động cần đăng nhập.
- **Tài khoản** yêu cầu hoàn thiện hồ sơ sau khi đăng ký hoặc khi đăng nhập bằng tài khoản còn thiếu hồ sơ. Sinh viên mặc định về `/`, admin về `/admin`, còn đích nội bộ hợp lệ được giữ. Trang `/me` chứa hồ sơ, theo dõi CLB, hoạt động đã đăng ký và lịch sử đề nghị thành lập CLB.
- **Không gian sinh hoạt** tại `/workspace` có kênh Chung và kênh ban, quản lý thành viên, nội dung và lịch họp gắn CLB. Chat kênh dùng Socket.IO, lưu trên Supabase và tải bù qua HTTP.
- **Quản trị** tại `/admin` có danh sách CLB và quy trình duyệt hoặc từ chối đề nghị thành lập.
- **Meeting** dùng LiveKit Cloud cho media, NestJS/Supabase cho phiên và quyền vào, Socket.IO cho chat theo phiên. Người đang họp có thể về Không gian CLB để nhắn tin và dùng Picture-in-Picture (PiP) trên trình duyệt hỗ trợ. Tuyển thành viên đã nối vào workspace. Phỏng vấn chưa triển khai.

## Cài đặt và cấu hình

Node.js 22.12+ và npm 10+. Từ thư mục gốc:

```powershell
npm install
```

`backend/.env` và `frontend/.env` đã được tạo cục bộ từ mẫu và bị Git ignore. Nếu checkout trên máy mới, copy từng `.env.example` sang `.env` khi file chưa tồn tại; không ghi đè cấu hình đang dùng.

Điền các giá trị trong `backend/.env` từ project development của nhóm:

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
JWT_SECRET=
```

Giữ `POC_ENABLED=true`, `LIVEKIT_ROOM_NAME=media-test-room`. `JWT_SECRET` cần chuỗi ngẫu nhiên ít nhất 32 ký tự, giữ ổn định giữa các lần khởi động. Secret chỉ ở backend. Backend yêu cầu cấu hình Supabase/JWT ngay khi khởi động; không dùng Supabase Auth ở FE. `VITE_API_URL` để trống để gọi `/api` cùng origin qua Vite proxy; `API_PROXY_TARGET=http://127.0.0.1:3000` là địa chỉ backend cục bộ.

## Chạy cục bộ

Hai terminal tại thư mục gốc:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Mở **http://localhost:5173** hoặc **http://127.0.0.1:5173**. Đăng ký/đăng nhập trước rồi tham gia phòng. Vite proxy `/api` về backend. API ở `http://localhost:3000/api`; `GET /api/health` kiểm tra liveness. Khi thiếu cấu hình LiveKit, API vẫn khởi động nếu Supabase/JWT hợp lệ và token endpoint trả 503 sau xác thực.

```powershell
npm run typecheck
npm test
npm run build
npm --workspace backend start
npm --workspace frontend run preview
```

Preview chạy cổng 4173 và dùng cùng API proxy khi `VITE_API_URL` để trống. Khi gọi API khác origin bằng URL tuyệt đối, đặt `FRONTEND_URL` đúng origin frontend. Preview chỉ phục vụ kiểm tra bản build. PoC token endpoint bị vô hiệu khi `POC_ENABLED` không bật và không cho bật trong `NODE_ENV=production`.

## Thử nhiều thiết bị qua HTTPS

Chạy `npm run tunnel` ở root để build và mở Cloudflare Quick Tunnel tới frontend preview; script khởi động backend nếu chưa chạy. Gửi URL HTTPS được in cho nhóm thử nghiệm. Dừng bằng Ctrl+C hoặc `npm run tunnel:stop`. Giữ `VITE_API_URL=` trống. Đăng nhập để mở cuộc họp bằng mã hoặc vào qua workspace. Phòng cố định chỉ áp dụng cho luồng PoC. Xem [hướng dẫn tunnel](docs/modules/https-tunnel.mdx) về luồng, log và giới hạn.

## Vừa họp vừa nhắn tin trong CLB

Trong cuộc gọi, bấm **Về Không gian CLB** rồi mở kênh để nhắn tin. Thanh **Đang trong cuộc họp** có nút **Mở lại phòng** và **Rời cuộc họp**. Muốn giữ video nổi khi nhắn tin hoặc chuyển tab, bấm **Picture-in-Picture** từ phòng họp trước khi điều hướng. Chủ phòng, điều hành và thành viên đều có thể chọn camera hoặc màn hình đang chia sẻ trên trình duyệt hỗ trợ. [Cách sử dụng và giới hạn](docs/modules/meeting-controls.mdx) · [Checklist hai thiết bị](docs/modules/https-tunnel.mdx).

## Tổ chức source

- [Chat trong phiên họp](docs/modules/meeting-chat.mdx): cần session ongoing và member admitted/chưa removed; chọn cùng phiên trước khi join. Chat dùng bảng meeting_messages đã được nhóm áp dụng. Backend kiểm tra participant thực tế qua LiveKit; không tự tạo session/duyệt thành viên/ghi attendance. Restart backend trước khi chạy tunnel nếu backend cũ đang chạy.

- [Chia sẻ màn hình](docs/modules/screen-sharing.mdx): với phiên họp động, host có quyền chia sẻ ban đầu và có thể duyệt yêu cầu của người tham gia. Xem luồng hiện hành trong [CODE_FLOW.md](CODE_FLOW.md).

- [Tài liệu giải thích code cho nhóm](docs/modules/module-01-team-guide.mdx): từng file, hàm, biến, tham số, cấu hình và các luồng Join/Leave/lỗi.

- `backend/src/config/`: kiểm tra môi trường; `configure-app.ts`: prefix/CORS/shutdown.
- `backend/src/livekit/`: controller HTTP, service ký token và module độc lập.
- `frontend/src/features/meeting/`: API service, session hook, UI và room components.
- Media state/track lifecycle do LiveKit SDK quản lý; token chỉ giữ trong memory.

Xem [hướng dẫn Module 1](docs/modules/module-01-media-poc.mdx) để biết hợp đồng API, vận hành và checklist kiểm thử hai thiết bị. Người dùng đã xác nhận audio/video giữa nhiều tab cùng máy; chưa nghiệm thu hai thiết bị và toàn bộ Module 1.

## Tài liệu và workflow

- [Project context](project_context.md): nội dung nguồn và hiện trạng cập nhật.
- [Master plan](docs/plans/master-plan.mdx): Phase 01–02 Done, Phase 03–06 In Progress, Phase 07 Todo.
- Codex đọc `AGENTS.md` và `.codex/AGENTS.md`; Claude đọc `CLAUDE.md`.
- Only create a work log after completing code changes; follow docs/ai-workflow.mdx.
- Docs MDX/Mintlify chưa có CLI validation; dự án đã có Git, không tự commit.

## Chia sẻ cấu hình trong nhóm

Chỉ commit `.env.example` với các ô key/secret trống. Mỗi thành viên tạo `.env` riêng từ mẫu và nhận credentials development qua trình quản lý mật khẩu có chia sẻ hoặc kênh mã hóa riêng, giới hạn cho người cần dùng. Không gửi credentials qua Git, issue, PR hoặc ảnh chụp màn hình. Tách credentials development với production.

`.gitignore` bỏ qua env và bản sao, secrets/khóa riêng, logs, build và lịch sử đăng nhập agent cục bộ; không che được key hardcode trong source hoặc trong file đã được Git theo dõi. Trước push kiểm tra `git status --short` và `git ls-files -- backend/.env frontend/.env` (lệnh thứ hai phải không có output). Nếu key đã lộ, thu hồi/thay key; thêm ignore không xóa lịch sử Git.

Tham khảo [quy tắc gitignore](https://git-scm.com/docs/gitignore) và [xử lý secret đã lộ](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Schema và nghiệm thu

Bản SQL mở rộng CLB, tuyển dụng, kênh và thông báo được theo dõi trong [gói migration 17/11](output/unicircle-platform-migration-20261117/README.md). Thư mục `supabase/migrations/` ở root hiện chứa migration điều khiển và chat cuộc họp. Khi dựng môi trường mới, kiểm tra schema nền và preflight của gói trước khi áp dụng. Các bảng trong migration có thể phục vụ nghiệp vụ tương lai ngay cả khi ứng dụng chưa gọi chúng.

Bản cập nhật dùng thanh trạng thái trong workspace và cửa sổ PiP đã được kiểm tra trên frontend. Ca media LiveKit Cloud trên hai thiết bị thật vẫn chờ nghiệm thu. [Kết quả kiểm thử](docs/work-logs/2026-11-25-01-phase-05-meeting-call-status.mdx) · [Bàn giao workspace](docs/design/phase-04-club-workspace.md) · [Tổng kết PoC](PHASE_05_SUMMARY.md).

## Loại câu lạc bộ — cập nhật 20/11/2026

Trang `/clubs` lọc theo loại CLB lưu trong `club_categories` và `club_category_links`.
Form `/me/club-requests/new` cho chọn một hoặc nhiều loại khi gửi đề nghị; admin và người gửi
thấy lại các loại trong chi tiết hồ sơ. API kiểm tra ID loại trước khi tạo CLB và lưu liên kết
cho đề nghị mới. Không cần migration mới.
Chạy `npm run seed:club-types` để xem trước sáu loại và mười liên kết CLB;
chỉ dùng `npm run seed:club-types -- --apply` trên Supabase development khi muốn thêm dữ liệu.
Script chỉ thêm bản ghi còn thiếu. Năm CLB thử nghiệm hoặc mô tả chưa rõ được xếp tạm vào `Khác`.

## Trưởng ban — cập nhật 20/11/2026

Chủ nhiệm vào Khác → Thành viên, dùng Chuyển trưởng ban/Gỡ trưởng ban để đổi
member/head trong ban hiện tại. Vai trò hiển thị tại tổng quan cá nhân; chuông
landing nhận thông báo bổ nhiệm và bỏ số khi xem. Cần chạy migration
`supabase/migrations/202611200001_department_head_notifications.sql`, restart
backend rồi test hai tài khoản. Xem [hướng dẫn](docs/modules/department-head.mdx).

## Tuyển thành viên - cập nhật 20/11/2026

Đã có tạo/đăng đợt, form 11 loại trường, ứng tuyển, duyệt theo ban và thông báo
trên landing. Chạy migration `supabase/migrations/202611200002_recruitment_workflow.sql`
rồi restart backend trước khi test. Xem [hướng dẫn tuyển thành viên](docs/modules/club-recruitment.mdx).
Build đạt; 60 test backend, 106 test frontend và regression SQL tạm đạt.
Chưa áp dụng migration hoặc nghiệm thu ghi trên DB development thật.


## Thông báo CLB đã quan tâm — 21/11/2026

Chạy migration `supabase/migrations/202611210001_followed_club_notifications.sql` sau các migration trưởng ban/tuyển thành viên, rồi restart backend. Người đã quan tâm nhận thông báo khi CLB đăng bài viết công khai, hoạt động hoặc đợt tuyển; bấm chuông để xem và mở chi tiết. Không gửi bù bài cũ. Migration chưa áp dụng lên Supabase thật; xem [work log](docs/work-logs/2026-11-21-02-phase-04-followed-club-notifications.mdx).


## Trợ giúp và báo cáo sự cố — 25/11/2026

Menu avatar công khai mở `/help` và `/report-issue`; người gửi theo dõi tại `/help/reports`, admin xử lý tại `/admin/support-reports`. Chạy toàn bộ migration `supabase/migrations/202611250001_support_reports.sql` một lần trong Supabase SQL Editor, restart backend rồi dùng bản frontend mới. Migration chỉ thêm một bảng hỗ trợ, chưa được áp dụng trên Supabase thật trong phiên này. Xem [hướng dẫn](docs/modules/help-support.mdx) và [work log](docs/work-logs/2026-11-25-01-phase-04-help-support-reports.mdx).

## Vào phòng họp trước giờ — 28/11/2026

Form lên lịch có tùy chọn trong Cài đặt nâng cao để vào phòng sớm tối đa 15 phút, mặc định tắt. Họp thường hoạt động với schema cũ. Để bật vào sớm trên môi trường development, áp dụng `supabase/migrations/202611280001_meeting_early_join.sql` để thêm cột `meetings.allow_early_join`, rồi restart backend. Migration chưa được áp dụng lên Supabase thật trong phiên này. [Work log](docs/work-logs/2026-11-28-01-phase-04-meeting-calendar-markers).
