# Kế hoạch triển khai backend meeting và tích hợp frontend

Cập nhật: 2026-11-08 (Asia/Bangkok)  
Phạm vi: triển khai backend điều khiển meeting theo ERD đã cung cấp; rà soát frontend hiện tại và lập kế hoạch tích hợp giao diện. Database là nguồn chuẩn, không thay schema trong lượt này.

## 1. Nghiệp vụ đã chốt

- Phân biệt **meeting** với **session**. Meeting có thể được tạo nhanh hoặc tạo để dùng lại/lên lịch.
- Meeting nhanh tạo đúng một session `active`. Khi kết thúc, giữ meeting/session/attendance làm lịch sử; ghi chú gắn với session.
- Meeting theo lịch có `recurrence_rule` tùy chọn. Một meeting không lặp có một session; meeting lặp sinh các session từ giờ bắt đầu/kết thúc của buổi đầu và RRULE.
- Link/code nhận diện meeting. Nếu có nhiều session, client hiển thị danh sách để người dùng chọn.
- Người ngoài meeting được duyệt vào đúng session đang xin. Guest không trở thành member lâu dài; muốn tham dự các session sau thì owner/moderator mời họ vào meeting.
- Owner và moderator được duyệt/từ chối guest. Moderator chỉ mute/remove người cùng cấp hoặc thấp hơn; owner có quyền trên các vai trò thấp hơn. Không cho tự mute qua API quản trị.
- Member đã được mời/owner/moderator có thể lên lịch và kết thúc session.
- Yêu cầu bị từ chối tối đa ba lần trong 30 phút; sau lần từ chối thứ ba, chờ 30 phút mới được gửi lại.
- Mute áp dụng lên audio track đang publish ở kết nối hiện tại. Sau khi rời hẳn và kết nối lại, mute không còn hiệu lực.
- Khi tắt phòng chờ, yêu cầu đang chờ vẫn giữ trạng thái chờ; chỉ các lượt vào mới được xét theo cài đặt mới. Teams có hành vi tương tự: người đã ở lobby vẫn ở đó khi organizer đổi thiết lập trong cuộc họp ([Microsoft Teams](https://support.microsoft.com/en-gb/teams/meetings/using-the-lobby-in-microsoft-teams-meetings)).

## 2. Backend đã cập nhật

### Thay đổi chính

- Meeting endpoints dùng JWT ứng dụng qua `JwtAuthGuard` và `@CurrentUser`, khớp login hiện tại và `users.user_id`; không còn xác thực meeting bằng Supabase Auth access token.
- Tách tạo meeting dùng lại (`POST /api/meetings`) và meeting nhanh (`POST /api/meetings/quick`). Meeting nhanh tạo session duy nhất ở trạng thái `active`.
- Tất cả room name LiveKit được lấy từ `meeting_sessions.livekit_room_name`; attendance gắn `session_id`. Không còn đọc/ghi `meetings.livekit_room_name`, `meetings.status`, capacity hay self-unmute fields của code cũ.
- Thêm danh sách session, tạo session theo lịch, chọn session khi join và xác thực trạng thái `scheduled`/`active`/`ended` trước khi cấp token.
- Guest request gắn với session qua attendance row chưa có `joined_at`; chỉ sau khi được duyệt backend mới ghi attendance tham dự/cấp token. Kết thúc session đóng attendance, hết hạn guest tạm và giữ lại lịch sử.
- Thêm duyệt/từ chối theo session, xem trạng thái yêu cầu, mời thành viên lâu dài bằng email, đổi moderator, cài đặt phòng chờ, mute/remove theo thứ bậc role, leave theo `attendanceId`, và end session.
- Thêm giới hạn ba lần bị từ chối trong cửa sổ 30 phút. `429` trả `retryAt`; trạng thái join trả số lượt còn lại và thời điểm thử lại.
- Thêm DTO validation và kiểm tra UUID route params.

### Định dạng lịch lặp

Backend mở rộng RRULE khi member tạo session đầu tiên; dùng cùng thời lượng cho các lần lặp. Code hiện hỗ trợ `FREQ=DAILY|WEEKLY|MONTHLY|YEARLY`, `INTERVAL`, `COUNT` hoặc `UNTIL`, `BYDAY` không có ordinal, cùng `BYMONTHDAY`/`BYMONTH` trong các tổ hợp hỗ trợ. Tối đa 5.000 session; thời gian được tính theo UTC. RRULE fields/tổ hợp khác bị từ chối rõ ràng, không âm thầm tạo lịch sai. Đây là giới hạn còn lại nếu DB thực tế dùng các biến thể RRULE ngoài tập này.

### File backend

- `backend/src/meetings/meetings.controller.ts`
- `backend/src/meetings/meetings.service.ts`
- `backend/src/meetings/dto/`

## 3. Kết quả kiểm tra

- `npm.cmd --workspace backend run typecheck`: đạt.
- `npm.cmd --workspace frontend run typecheck`: đạt.
- `npm.cmd --workspace frontend run build`: đạt; Vite vẫn cảnh báo chunk LiveKit lớn hơn 500 kB.
- Chưa chạy test tự động theo lượt này. Chưa kết nối Supabase/LiveKit thật; cần xác nhận nullable/default/FK của các cột được dùng và thực nghiệm các luồng với database development.

## 4. Rà soát frontend hiện tại

Frontend hiện **chưa tích hợp** meeting backend mới:

- `AuthApp` giữ application JWT, phù hợp backend sau đổi.
- `MeetingPage`/`useMeetingSession` vẫn có một nút vào room thử nghiệm chung.
- `requestJoinCredentials()` gọi `/api/livekit/token`; endpoint này vẫn cấp room PoC cố định và không biết meeting/session.
- UI chưa có tạo meeting nhanh, tạo meeting theo lịch, nhập link/code, chọn session, waiting room, danh sách duyệt, mời member, phân role, mute/remove participant hoặc kết thúc session.
- Hook leave chưa gửi `attendanceId` để đóng đúng attendance; UI disconnect hiện chỉ dọn state tại client.

## 5. Kế hoạch frontend tiếp theo

1. **Dashboard sau đăng nhập:** thay lobby PoC bằng hai lựa chọn: “Tạo meeting nhanh” và “Tạo meeting dùng lại”; thêm nhập meeting code/link để mở meeting.
2. **Luồng meeting nhanh:** gọi `POST /meetings/quick`, nhận `meetingId`, `meetingCode`, `sessionId`; sau đó gọi `/meetings/:code/join` với `sessionId`. Nếu response `pending`, hiển thị màn hình chờ và poll `join-status`; chỉ dựng `LiveKitRoom` sau khi được duyệt và gọi join lấy token.
3. **Luồng meeting theo lịch:** tạo meeting với tiêu đề, waiting room và recurrence rule; lịch buổi đầu gửi `scheduledStartAt`/`scheduledEndAt` tới endpoint session. Với meeting lặp, hiển thị các session từ `GET /meetings/:code/sessions` để người dùng chọn đúng buổi.
4. **Guest/request:** sau khi vào code chọn session rồi yêu cầu join. Hiển thị trạng thái chờ/được duyệt/từ chối; khi bị từ chối hiển thị `remainingAttempts`/`retryAt` và không tự gửi lại request bằng polling.
5. **Bảng điều khiển owner/moderator:** danh sách request theo session với approve/deny; danh sách participant; mute/remove theo API; nút mời member theo email và đổi moderator theo quyền.
6. **Điều khiển session:** bất kỳ meeting member đã được mời nào cũng có nút lên lịch/kết thúc theo quyền backend. Khi end, ngắt `LiveKitRoom`, gọi end API và quay về meeting/history.
7. **Đồng bộ attendance:** lưu `attendanceId` trong session state; gửi ID đó khi Leave; xử lý disconnect bất thường bằng thông báo và cho phép reconnect. Không hiển thị reconnect như một lần join mới nếu backend chưa xác nhận attendance cũ.
8. **Cài đặt waiting room:** owner bật/tắt trong meeting settings; UI giữ các request cũ ở trạng thái pending sau khi tắt, không tự nhận tất cả.
9. **Kiểm chứng giao diện sau tích hợp:** chạy FE/backend typecheck/build; sau đó thử owner, moderator và guest ở ít nhất hai trình duyệt/thiết bị cho quick session, session lặp, approve/deny, retry cooldown, invite lâu dài, mute và kết thúc session.

## 6. Việc còn lại và giới hạn

- Cần kiểm tra schema Supabase development thực tế (đặc biệt cột nullable/default, foreign key `meeting_members` ↔ `users`, `attendances.joined_at/livekit_identity`, và giá trị `leave_reason`). Chưa áp dụng migration; code mới không cần migration cũ tự thêm `max_participants`/`allow_self_unmute`.
- Tạo meeting và membership owner chưa nằm trong một transaction DB; cleanup sau lỗi chỉ là best-effort.
- Session hết hạn theo `scheduled_end_at` chưa có worker tự kết thúc đúng giờ; hiện member phải gọi end API. LiveKit webhook/cleanup khi mất mạng cũng chưa có.
- Chưa có API ghi chú; meeting/session/attendance lịch sử được giữ để notes feature có thể dùng `session_id`.
- Working tree có sẵn thay đổi và merge-conflict markers trong `docs/docs.json`, `docs/dev/session-log.mdx`, `docs/plans/master-plan.mdx` cùng `.env.example`; không chỉnh các file đang conflict để tránh ghi đè công việc có sẵn.

