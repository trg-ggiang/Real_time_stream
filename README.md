# Real-time stream — khung công nghệ

Chỉ có cấu trúc thư mục, dependencies và biến môi trường mẫu. Chưa có code ứng dụng, schema database hoặc kết nối dịch vụ.

| Thư mục | Công nghệ |
| --- | --- |
| `backend/` | Node.js, NestJS, LiveKit server SDK, Supabase SDK, Socket.IO |
| `frontend/` | React, Vite, LiveKit React/client, Supabase SDK, Socket.IO client |
| `supabase/migrations/` | Thư mục trống dành cho migration sau này |

Yêu cầu Node.js 22.12+ và npm 10+. Cài toàn bộ dependencies từ thư mục gốc:

```sh
npm install
```

Copy `.env.example` thành `.env` trong từng thư mục khi cần cấu hình. Lấy thông tin từ project Supabase và LiveKit Cloud của bạn. Secret key Supabase và API secret LiveKit chỉ đặt ở backend.

Chat sử dụng Socket.IO qua WebSocket. Chưa có script chạy/build vì chưa có mã nguồn hoặc entry point.

## Agent workflow và tiến trình

- Codex: đọc `AGENTS.md` và `.codex/AGENTS.md`.
- Claude: đọc `CLAUDE.md`, dùng `.claude/settings.json` và skills trong `.claude/skills/`.
- Theo dõi phase tại `docs/plans/master-plan.mdx`.
- Mỗi phiên bắt buộc đóng bằng work log trong `docs/work-logs/`, cập nhật phase, session log và changelog; hướng dẫn tại `docs/ai-workflow.mdx`.
- Docs dùng MDX và navigation Mintlify; chưa cài CLI docs. Chưa khởi tạo Git.
