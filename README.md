# Real-time Stream — Meeting Module

Ứng dụng thử nghiệm audio/video: React/Vite gọi NestJS để nhận token rồi kết nối trực tiếp LiveKit Cloud. Module 1 dùng một room cố định, chưa có đăng nhập, database hoặc chat.

## Cài đặt và cấu hình

Node.js 22.12+ và npm 10+. Từ thư mục gốc:

```powershell
npm install
```

`backend/.env` và `frontend/.env` đã được tạo cục bộ từ mẫu và bị Git ignore. Nếu checkout trên máy mới, copy từng `.env.example` sang `.env` khi file chưa tồn tại; không ghi đè cấu hình đang dùng.

Điền ba giá trị trong `backend/.env` từ project LiveKit Cloud:

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Giữ `POC_ENABLED=true`, `LIVEKIT_ROOM_NAME=media-test-room`. Secret chỉ ở backend. Các biến Supabase, Socket.IO và `VITE_LIVEKIT_URL` trong mẫu dành cho các module sau; Module 1 lấy LiveKit URL từ token endpoint. `VITE_API_URL` để trống để gọi `/api` cùng origin qua Vite proxy; `API_PROXY_TARGET=http://127.0.0.1:3000` là địa chỉ backend cục bộ.

## Chạy cục bộ

Hai terminal tại thư mục gốc:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Mở **http://localhost:5173** hoặc **http://127.0.0.1:5173**. Vite proxy `/api` về backend, tránh khác origin khi chạy cục bộ. API ở `http://localhost:3000/api`; `GET /api/health` kiểm tra liveness. Khi thiếu cấu hình LiveKit, API vẫn khởi động và token endpoint trả 503.

```powershell
npm run typecheck
npm test
npm run build
npm --workspace backend start
npm --workspace frontend run preview
```

Preview chạy cổng 4173 và dùng cùng API proxy khi `VITE_API_URL` để trống. Khi gọi API khác origin bằng URL tuyệt đối, đặt `FRONTEND_URL` đúng origin frontend. Preview chỉ phục vụ kiểm tra bản build. PoC token endpoint bị vô hiệu khi `POC_ENABLED` không bật và không cho bật trong `NODE_ENV=production`.

## Tổ chức source

- `backend/src/config/`: kiểm tra môi trường; `configure-app.ts`: prefix/CORS/shutdown.
- `backend/src/livekit/`: controller HTTP, service ký token và module độc lập.
- `frontend/src/features/meeting/`: API service, session hook, UI và room components.
- Media state/track lifecycle do LiveKit SDK quản lý; token chỉ giữ trong memory.

Xem [hướng dẫn Module 1](docs/modules/module-01-media-poc.mdx) để biết hợp đồng API, vận hành và checklist kiểm thử hai thiết bị. Chưa xác minh audio/video với LiveKit Cloud thật hoặc nghiệm thu Module 1.

## Tài liệu và workflow

- [Project context](project_context.md): nội dung nguồn và hiện trạng cập nhật.
- [Master plan](docs/plans/master-plan.mdx): Phase 02 Done; Phase 04/05 In Progress. PoC triển khai trước Phase 03 database/auth.
- Codex đọc `AGENTS.md` và `.codex/AGENTS.md`; Claude đọc `CLAUDE.md`.
- Mỗi phiên đóng bằng work log, phase, session log và changelog theo `docs/ai-workflow.mdx`.
- Docs MDX/Mintlify chưa có CLI validation; dự án đã có Git, không tự commit.

## Chia sẻ cấu hình trong nhóm

Chỉ commit `.env.example` với các ô key/secret trống. Mỗi thành viên tạo `.env` riêng từ mẫu và nhận credentials development qua trình quản lý mật khẩu có chia sẻ hoặc kênh mã hóa riêng, giới hạn cho người cần dùng. Không gửi credentials qua Git, issue, PR hoặc ảnh chụp màn hình. Tách credentials development với production.

`.gitignore` bỏ qua env và bản sao, secrets/khóa riêng, logs, build và lịch sử đăng nhập agent cục bộ; không che được key hardcode trong source hoặc trong file đã được Git theo dõi. Trước push kiểm tra `git status --short` và `git ls-files -- backend/.env frontend/.env` (lệnh thứ hai phải không có output). Nếu key đã lộ, thu hồi/thay key; thêm ignore không xóa lịch sử Git.

Tham khảo [quy tắc gitignore](https://git-scm.com/docs/gitignore) và [xử lý secret đã lộ](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Tổng kết triển khai

Xem [PHASE_05_SUMMARY.md](PHASE_05_SUMMARY.md) để nắm công việc đã làm, lỗi đã xử lý, kết quả kiểm tra và phần còn chờ nghiệm thu. Các file Markdown hướng dẫn agent vẫn được phép commit/push; credentials và session cục bộ tiếp tục bị ignore.
