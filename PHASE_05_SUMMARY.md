# Tổng kết Phase 05 — Module 1: Media Connection PoC

Cập nhật: 2026-10-19 (Asia/Saigon). Trạng thái Phase 04/05: **In Progress**. Tài liệu này tổng hợp các phiên triển khai, sửa kết nối và chuẩn bị chia sẻ repository; không thay thế bằng chứng nghiệm thu hai thiết bị.

## 1. Mục tiêu và phạm vi

Kiểm chứng React kết nối LiveKit Cloud bằng token do NestJS ký, cho phép người tham gia cùng phòng nhìn và nghe nhau. Module 1 dùng một phòng cố định và không phụ thuộc nghiệp vụ câu lạc bộ/phỏng vấn. Phase 04 tạo nền tảng API/frontend; Phase 05 tích hợp media. Số phase và số module sản phẩm không ánh xạ một-một.

## 2. Những việc đã triển khai

| Nhóm | Kết quả |
| --- | --- |
| Môi trường | Kiểm tra Node.js 22.23.2/npm 10.9.8; npm workspaces; tạo backend/.env và frontend/.env cục bộ từ mẫu |
| Backend | NestJS bootstrap, kiểm tra env, CORS, shutdown, health endpoint và LiveKit module tách controller/service |
| Cấp token | POST /api/livekit/token; UUID riêng mỗi lần Join; backend quyết định room; TTL mặc định 300 giây; chỉ publish camera/microphone và subscribe |
| Bảo vệ PoC | Cache-Control no-store; 10 requests/phút/IP; mặc định loopback; thiếu cấu hình trả 503; không cho bật PoC không auth trong production |
| Frontend | React/Vite/TypeScript; tách meeting page, components, API service, session hook và types |
| Media UI | Join/Leave, local/remote video tiles, phát remote audio, camera/microphone controls, trạng thái kết nối và thông báo lỗi |
| Lifecycle | Chống Join trùng, hủy request khi Leave/unmount, bỏ qua response muộn; SDK quản lý room/track cleanup; token giữ trong memory |
| Tải trang | Lazy load SDK meeting sau khi nhận token, giữ trang lobby nhẹ hơn |
| Công cụ | Scripts dev, typecheck, test, build; backend Node test runner; frontend Vitest/jsdom/Testing Library |
| Tài liệu | Project context, API contract, hướng dẫn vận hành, checklist nghiệm thu, phase pages và work logs |

Luồng chính: **Browser → NestJS token API → Browser → LiveKit Cloud → publish/subscribe audio/video**. Media không đi qua NestJS hoặc WebSocket chat.

## 3. Các lỗi đã xử lý và bài học

### Frontend báo không kết nối được backend

Backend vẫn cấp token HTTP 200 nhưng cấu hình gọi localhost:3000 khác origin với trang 127.0.0.1:5173. Đã chuyển mặc định sang `/api` cùng origin thông qua Vite dev/preview proxy. API_PROXY_TARGET cấu hình địa chỉ backend; VITE_API_URL tuyệt đối vẫn dùng được khi cần backend riêng. Đã kiểm tra cả hai địa chỉ frontend nhận token HTTP 200.

### LiveKit trả 401 / invalid token

Ảnh Console người dùng cung cấp cho thấy LiveKit từ chối token; không thể kết luận máy mất Internet từ thông báo ngắt kết nối chung. Đã hướng dẫn đối chiếu URL/API Key/API Secret cùng project, restart backend và Join lại để lấy token mới. Người dùng sau đó báo đã được; chưa có biên bản xác nhận đầy đủ audio/video hai chiều trên hai thiết bị.

## 4. Bảo vệ credentials và chia sẻ Git

- .gitignore bỏ qua env và bản sao, private keys/secrets, logs, generated files và agent local credentials/history.
- Chỉ commit .env.example với trường key/secret trống; mỗi thành viên tự tạo .env và nhận credentials qua kênh bảo mật riêng.
- Các file hướng dẫn agent **được phép commit/push**: AGENTS.md, CLAUDE.md, .codex/AGENTS.md và các SKILL.md đang có. Không ignore toàn bộ .codex hoặc .claude.
- Không đưa API secret vào frontend/VITE_*, source, issue hoặc ảnh chụp. Ignore không bảo vệ secret hardcode hoặc xóa lịch sử Git.
- Phiên kiểm tra trước ghi nhận hai env không tracked và không thấy hai giá trị key LiveKit hiện tại trong 144 candidate files, staging hoặc 2 commit. Phạm vi này không phải kiểm toán mọi secret/key cũ.
- Agent chưa thực hiện commit/push repository.

## 5. Kiểm tra đã ghi nhận

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| TypeScript và build BE/FE | Đạt trong các phiên triển khai; frontend build sau sửa proxy đạt |
| Backend tests | 2 tests đạt: cấu hình và HTTP/JWT bao gồm room/identity/grants/expiry/rate limiting |
| Frontend tests | 10 tests đạt ở lần chạy sau sửa proxy: session concurrency/cancel/rejoin/errors và API URL routing |
| HTTP smoke | Health 200; thiếu credentials trả 503; sau cấu hình token API trả 200 trực tiếp và qua proxy |
| Gitignore và mẫu env | Đã kiểm tra sensitive/generated paths bị ignore, source/templates/lockfile vẫn được giữ, trường credentials trong mẫu trống |
| Docs | JSON, navigation, liên kết nội bộ và git diff --check đã kiểm tra theo từng phiên |
| Browser/media thật | Người dùng báo xử lý được lỗi; agent chưa trực tiếp kiểm tra camera, audio, autoplay, reconnect hoặc hai thiết bị |

Các kết quả trên lấy từ work logs, không phải tất cả được chạy lại trong phiên tổng kết này. Build còn cảnh báo chunk SDK meeting lớn hơn 500 kB; đã lazy load nhưng chưa tối ưu sâu.

## 6. Chưa nằm trong phạm vi

Chưa triển khai Supabase schema/database, đăng ký/đăng nhập, phân quyền ứng dụng, phòng động, chat, waiting room, screen sharing, recording hoặc nghiệp vụ quản lý CLB. Chưa benchmark mục tiêu nhiều phòng/20 participant và chưa deployment production.

## 7. Việc tiếp theo để nghiệm thu

1. Thử hai thiết bị độc lập: nhìn thấy remote video và nghe audio hai chiều.
2. Xác nhận bật/tắt camera/microphone phản ánh đúng ở phía người còn lại.
3. Thử Join/Leave/rejoin, participant count và camera/microphone được giải phóng khi rời phòng.
4. Thử từ chối quyền, autoplay bị chặn, mất mạng/reconnect và hiển thị lỗi.
5. Kiểm tra cùng Wi-Fi và hai mạng khác nhau qua môi trường HTTPS thử nghiệm phù hợp.
6. Ghi kết quả và bằng chứng vào work log trước khi đánh dấu Phase 04/05 Done.

## 8. Tài liệu liên quan

- [Hướng dẫn Module 1](docs/modules/module-01-media-poc.mdx)
- [Phase 05](docs/plans/phase-05-livekit-poc.mdx)
- [Master plan](docs/plans/master-plan.mdx)
- [Triển khai PoC](docs/work-logs/2026-10-19-02-phase-05-media-poc.mdx)
- [Sửa API proxy](docs/work-logs/2026-10-19-03-phase-05-local-api-proxy.mdx)
- [Gitignore và credentials](docs/work-logs/2026-10-19-04-phase-05-gitignore-secrets.mdx)
