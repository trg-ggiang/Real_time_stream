# Hướng dẫn duyệt người tham gia phòng

Tài liệu này hướng dẫn cách tạo phòng có chế độ chờ duyệt và cho khách vào phòng.

## Hiểu nhanh: chủ phòng, đường dẫn, mic và duyệt khách

Các bước này hiện chạy theo thứ tự sau:

1. Người đăng nhập bấm **Tham gia phòng**, chọn quyền mic/camera; phòng chờ duyệt luôn bật và không thể tắt.
2. Khi bấm **Lưu cài đặt**, frontend gửi cài đặt lên backend. Backend gắn phòng với `userId` lấy từ phiên đăng nhập, rồi màn hình gọi hiện ngay trong Home. Vì vậy chủ phòng là tài khoản đã tạo phòng, không phải người có tên giống chủ phòng hay người biết URL.
3. URL mời có dạng `/meeting/{roomId}` để người khác mở đúng phòng. Chủ phòng vẫn ở Home; dùng **Sao chép link mời** trong màn hình gọi để gửi URL cho khách. URL tự nó không chứng minh họ là chủ phòng và không bỏ qua đăng nhập hoặc bước duyệt.
4. Khi vào phòng, backend nhận diện chủ phòng bằng cách so `userId` trong phiên hiện tại với `ownerUserId` đã lưu lúc tạo phòng. Backend trả `isHost` cho giao diện và tự kiểm tra lại quyền với các thao tác nhạy cảm như xem hàng chờ, duyệt người hoặc khóa mic.
5. Host có thể khóa mic một thành viên trong danh sách thành viên cạnh video. Backend yêu cầu LiveKit mute track mic đang phát và bỏ quyền publish microphone của người đó; khi host mở khóa, thành viên có thể tự bật mic lại.

### Phân biệt hai loại cài đặt mic

- **Quyền mic của cả phòng** là lựa chọn khi tạo phòng. Nếu tắt, người tham gia không được cấp quyền phát mic khi nhận token; nút mic cũng bị ẩn/khóa theo cài đặt.
- **Khóa mic một thành viên** là hành động của host trong lúc họp. Nó chỉ áp dụng cho thành viên được chọn. Khi khóa, backend mute track hiện tại nếu có và thu hồi quyền phát mic để họ không thể tự bật lại. Khi mở khóa, quyền mic được khôi phục theo cài đặt chung của phòng.
- Host không thể khóa mic của chính mình bằng nút trong hàng thành viên. Nếu mic cả phòng đã bị tắt, host không thể cấp quyền riêng cho một thành viên bằng nút này.

### URL được tạo và hoạt động thế nào?

Frontend tạo `roomId` trước khi gửi yêu cầu lưu cài đặt. Sau khi backend xác nhận tạo/lưu phòng thành công, frontend cập nhật đường dẫn trong tab hiện tại thành `/meeting/{roomId}`. Trang meeting đọc ID này để xin thông tin kết nối LiveKit cho đúng phòng. Người nhận URL phải đăng nhập; khách luôn phải được host chấp thuận trước khi backend cấp LiveKit token.

URL hiện không có thời hạn hay cơ chế thu hồi lời mời riêng. Vì vậy hãy chia sẻ với người dự định mời; việc biết URL không đồng nghĩa có quyền chủ phòng. Bản hiện tại cũng chưa lưu quyền thành viên bền vững trong database.

## Tạo phòng và duyệt thành viên

1. Đăng nhập, mở Home và chọn **Tham gia phòng**.
2. Chọn quyền mic/camera rồi lưu thiết lập. Phòng chờ duyệt luôn bật; thành viên không thể tự bỏ qua bước chủ phòng chấp nhận.
3. Chủ phòng ở trong phòng để thấy danh sách chờ. Gửi link mời bằng nút **Sao chép link mời**.

Khách đăng nhập bằng link sẽ ở màn hình chờ. Backend chưa cấp LiveKit token cho đến khi chủ phòng bấm **Cho vào**. Link phòng tự nó không cấp quyền chủ phòng.
## Khách tham gia

1. Mở liên kết phòng chủ phòng gửi. Nếu chưa đăng nhập, đăng nhập rồi mở lại liên kết.
2. Trang sẽ hiện thông báo đang chờ chủ phòng. Khách không cần tải lại trang.
3. Sau khi chủ phòng chấp thuận, trang tự vào phòng trong vài giây.

## Chủ phòng duyệt khách

1. Chủ phòng cần đang ở trong phòng.
2. Hộp **Chờ duyệt** ở góc trên bên phải hiển thị những người đang đợi.
3. Chọn **Cho vào** cạnh tên khách cần chấp thuận.
4. Khách được vào tự động sau lần kiểm tra trạng thái tiếp theo.

Chỉ tài khoản đã tạo phòng mới xem hàng chờ và duyệt người tham gia. Khách chưa được duyệt không nhận được LiveKit token để vào phòng.

### Host điều khiển mic thành viên

Danh sách thành viên nằm trong panel cạnh video. Host bấm biểu tượng mic ở dòng của thành viên khác:

- Khi mic đang bật, một lần bấm sẽ mute track đang phát và thu hồi quyền publish microphone của participant. Participant không thể tự bật mic lại trong khi host đang khóa.
- Khi mic đã tắt/đang khóa, biểu tượng cho phép host cấp lại quyền mic. Participant có thể bật mic của mình sau đó.
- Dòng host không thể bấm để tự điều khiển mic. Nếu cài đặt cả phòng đã tắt mic, host cũng không thể cấp quyền riêng cho một participant.

Nút gọi `RoomContent` handler trong `frontend/src/features/meeting/components/MeetingRoom.tsx`, rồi `handleMuteMicrophone()` gọi `muteParticipantMicrophone()` ở `frontend/src/features/meeting/services/room-api.ts`. Request `POST /api/livekit/rooms/{roomId}/participants/mute-microphone` gửi `participantIdentity` và trạng thái `muted` mong muốn.

`LivekitController.muteParticipantMicrophone()` trong `backend/src/livekit/livekit.controller.ts` xác thực phiên và DTO. `LivekitService.muteParticipantMicrophone()` tại `backend/src/livekit/livekit.service.ts` kiểm tra chủ phòng và participant trong LiveKit. Khi mute, service gọi `RoomServiceClient.mutePublishedTrack()` cho track microphone đang phát, rồi `RoomServiceClient.updateParticipant()` để bỏ nguồn `MICROPHONE` khỏi quyền publish. Khi host cấp lại, backend khôi phục các nguồn publish theo cài đặt phòng.

Lệnh mute không động tới camera hay participant khác. API key/secret chỉ được dùng ở backend. Nếu nhìn thấy `Device in Use`, đó là lỗi mở thiết bị camera/mic tại tab hiện tại, độc lập với server-side mute.
## Quyền media

Cài đặt mic và camera áp dụng cho token của mọi người vào phòng. Thành viên không được cấp quyền chia sẻ màn hình.

## Lưu ý khi thử nghiệm

- Backend phải tiếp tục chạy trong khi khách tham gia và chờ duyệt.
- Cài đặt phòng, chủ phòng và hàng chờ hiện được lưu trong bộ nhớ của một tiến trình backend. Khởi động lại backend hoặc chạy nhiều instance có thể làm mất trạng thái phòng.
- Nếu cần gửi lại URL, chủ phòng nhấn **Sao chép link mời** trong màn hình họp.
- Nút **Rời phòng** đưa người dùng về Home.

## Triển khai kỹ thuật theo thao tác

Các thao tác này gửi HTTP request tới NestJS qua `/api` (dev frontend đi qua Vite proxy). Không dùng Socket.IO để báo duyệt: host và khách tự tải lại trạng thái theo chu kỳ 8 giây. Mọi endpoint dưới đây cần phiên đăng nhập; NestJS chạy `JwtAuthGuard`, còn body cấu hình được kiểm tra bởi `ValidationPipe` và `RoomSettingsDto`.

| Thao tác trên giao diện | Hàm frontend được kích hoạt | Request / dữ liệu gửi đi | Hàm backend xử lý | Kết quả |
| --- | --- | --- | --- | --- |
| Bấm **Mở phòng họp mới** | `HomePage` gọi `setConfiguring(true)` | Chưa gửi request; chỉ mở `RoomPermissionForm` | — | Người tạo chọn mic, camera và chờ duyệt. |
| Bấm **Lưu cài đặt** | `RoomPermissionForm` gọi `onSave(permissions)` → `HomePage.createRoom()` → callback `AuthApp.createMeetingRoom()` | `POST /api/livekit/rooms/{roomId}/settings`, JSON gồm `allowMic`, `allowVideo`, `waitingRoom` | `LivekitController.createRoom()` → `LivekitService.createRoom()` | Service lưu `ownerUserId`, cài đặt, `pending` và `approved` trong state phòng. Sau HTTP 201, màn hình họp hiện trong Home; không đổi URL của chủ phòng. |
| Người tạo hoặc khách mở URL phòng | `MeetingPage` effect gọi `session.join()` → `useMeetingSession.join()` → `requestJoinCredentials()` trong `token-api.ts` | `POST /api/livekit/rooms/{roomId}/token`, gửi `{}`; cookie phiên gửi cùng request | `LivekitController.createRoomToken()` → `LivekitService.createJoinCredentials()` | Nếu được vào, trả LiveKit token, `isHost` và `settings`. Frontend truyền quyền vào `MeetingRoom` và kết nối LiveKit. |
| Khách chưa được duyệt xin vào phòng | Cùng luồng `useMeetingSession.join()` | Cùng `POST .../{roomId}/token` | `LivekitService.createJoinCredentials()` thêm user vào `pending` | Trả `{ "waiting": true }`, không cấp token. `useMeetingSession` bật state `waiting`; `MeetingPage` hiển thị thông báo và gọi `session.join()` lại mỗi 8 giây. |
| Host mở danh sách chờ | `MeetingPage` effect gọi `getWaitingParticipants()` trong `room-api.ts`, lặp mỗi 8 giây | `GET /api/livekit/rooms/{roomId}/waiting` | `LivekitController.getWaitingParticipants()` → `LivekitService.getWaitingParticipants()` | Backend so sánh `user.userId` với `ownerUserId`; chỉ host nhận danh sách `{ userId, displayName }`. |
| Host bấm **Cho vào** | `MeetingPage.approveParticipant()` → `approveWaitingParticipant()` trong `room-api.ts` | `POST /api/livekit/rooms/{roomId}/waiting/{participantUserId}/approve` | `LivekitController.approveParticipant()` → `LivekitService.approveParticipant()` | Backend xác minh host, chuyển user từ `pending` sang `approved`. |
| Khách được duyệt | Poll tiếp theo gọi lại `useMeetingSession.join()` | Lặp `POST /api/livekit/rooms/{roomId}/token` | `LivekitService.createJoinCredentials()` thấy user trong `approved`, xóa trạng thái duyệt một lần và ký token | Frontend nhận credentials, bỏ màn hình chờ và kết nối LiveKit. |

### Nơi áp dụng quyền media

`LivekitService.createJoinCredentials()` chuyển cài đặt phòng thành LiveKit `canPublishSources`: `allowVideo` điều khiển `CAMERA`, `allowMic` điều khiển `MICROPHONE`. Screen share không có trong form, token grant hoặc control bar. Backend grant là lớp thực thi quyền; ẩn nút chỉ đồng bộ giao diện.

### Tra cứu handler: thao tác → hàm → file

Các đường dẫn bên dưới tính từ thư mục gốc repository (`D:/Real_time_stream`). Một số handler là callback inline trong JSX, vì vậy không có tên hàm riêng.

1. **Bấm “Mở phòng họp mới”**
   - JSX `onClick` gọi `setConfiguring(true)`.
   - State setter nằm trong component `HomePage` tại `frontend/src/features/home/page.tsx`.
   - Chưa có HTTP request ở bước này; nó chỉ hiện form.

2. **Thay đổi checkbox trong form**
   - JSX `onChange` của checkbox gọi `setPermissions(...)` (callback inline).
   - Component và state `permissions` nằm trong `RoomPermissionForm` tại `frontend/components/RoomPermissionForm.tsx`.

3. **Bấm “Lưu cài đặt”**
   - Form `onSubmit` gọi prop `onSave(permissions)` trong `RoomPermissionForm`, file `frontend/components/RoomPermissionForm.tsx`.
   - Prop `onSave` là callback inline `(permissions) => void createRoom(permissions)` trong `HomePage`, file `frontend/src/features/home/page.tsx`.
   - Hàm `HomePage.createRoom()` gọi prop `onCreateRoom` tại cùng file.
   - Prop đó trỏ tới `AuthApp.createMeetingRoom()` trong `frontend/src/features/auth/AuthApp.tsx`. Hàm này gửi `POST /api/livekit/rooms/{roomId}/settings` với JSON cài đặt.
   - Backend nhận tại `LivekitController.createRoom()` trong `backend/src/livekit/livekit.controller.ts`, rồi gọi `LivekitService.createRoom()` trong `backend/src/livekit/livekit.service.ts` để ghi chủ phòng và cài đặt.
   - Khi request thành công, `AuthApp` lưu ID phòng đang hoạt động và `HomePage` hiển thị `MeetingPage` nhúng trong Home. Nút **Sao chép link mời** cung cấp `/meeting/{roomId}` cho khách; link đó vẫn mở phòng trực tiếp.

4. **Người tạo hoặc khách mở URL phòng**
   - `MeetingPage` có effect gọi `session.join()` trong `frontend/src/features/meeting/MeetingPage.tsx`.
   - `session.join()` là hàm trả về từ hook `useMeetingSession` trong `frontend/src/features/meeting/hooks/use-meeting-session.ts`.
   - Hook gọi `requestJoinCredentials()` ở `frontend/src/features/meeting/services/token-api.ts`, gửi `POST /api/livekit/rooms/{roomId}/token`.
   - Backend gọi `LivekitController.createRoomToken()` trong `backend/src/livekit/livekit.controller.ts`, rồi `LivekitService.createJoinCredentials()` trong `backend/src/livekit/livekit.service.ts`.
   - Nếu khách cần host duyệt, service thêm user vào `pending` và trả `{ waiting: true }`; chưa tạo token. Hook đặt state `waiting`, còn effect trong `MeetingPage` gọi lại `session.join()` mỗi 8 giây.

5. **Host nhận danh sách người chờ**
   - Effect trong `MeetingPage` gọi `getWaitingParticipants()` tại `frontend/src/features/meeting/services/room-api.ts`, định kỳ 8 giây.
   - Hàm gửi `GET /api/livekit/rooms/{roomId}/waiting`.
   - Backend `LivekitController.getWaitingParticipants()` trong `backend/src/livekit/livekit.controller.ts` gọi `LivekitService.getWaitingParticipants()` tại `backend/src/livekit/livekit.service.ts`. Service chỉ trả danh sách nếu user hiện tại là chủ phòng.

6. **Host bấm “Cho vào”**
   - JSX `onClick` gọi `MeetingPage.approveParticipant(participant)` tại `frontend/src/features/meeting/MeetingPage.tsx`.
   - Hàm này gọi `approveWaitingParticipant()` ở `frontend/src/features/meeting/services/room-api.ts`, gửi `POST /api/livekit/rooms/{roomId}/waiting/{participantUserId}/approve`.
   - Backend `LivekitController.approveParticipant()` ở `backend/src/livekit/livekit.controller.ts` gọi `LivekitService.approveParticipant()` tại `backend/src/livekit/livekit.service.ts`. Service xác minh host rồi chuyển user từ `pending` sang `approved`.
   - Khách được duyệt không nhận push event; lần poll token kế tiếp (tối đa khoảng 8 giây) gọi lại `useMeetingSession.join()`, rồi được cấp token.

7. **Áp dụng quyền media khi vào LiveKit**
   - `LivekitService.createJoinCredentials()` trong `backend/src/livekit/livekit.service.ts` tạo LiveKit grant `canPublishSources` theo cài đặt phòng.
   - `MeetingRoom` trong `frontend/src/features/meeting/components/MeetingRoom.tsx` nhận `credentials.settings`, truyền mic/camera vào `LiveKitRoom` và ẩn/hiện các nút trong `ControlBar`.
### Backend xác nhận chủ phòng

Chủ phòng được xác định bằng **tài khoản đã đăng nhập**, không dựa vào tên hiển thị, room ID tự nó, hay một cờ `isHost` do trình duyệt gửi lên:

1. Khi tạo phòng, `AuthApp.createMeetingRoom()` gửi request kèm cookie phiên đăng nhập tới `POST /api/livekit/rooms/{roomId}/settings`.
2. `LivekitController.createRoom()` có `JwtAuthGuard` và lấy user đã xác thực qua `@CurrentUser() user`. Vì vậy `LivekitService.createRoom(user, roomId, settings)` nhận user từ phiên đăng nhập phía server.
3. `LivekitService.createRoom()` lưu `user.userId` vào `RoomState.ownerUserId` cho UUID đó. Nếu UUID đã có và được chính user đó tạo trước đây, thao tác tạo lại là idempotent; nếu user khác cố nhận cùng phòng làm chủ, backend trả Conflict.
4. Khi xin token, `LivekitService.createJoinCredentials()` xác định host bằng phép so sánh `roomState.ownerUserId === user.userId`. Chỉ phép so sánh này mới tạo `isHost: true`; nếu bật waiting room thì host được vào, khách khác phải qua hàng chờ.
5. Khi host tải danh sách chờ hoặc duyệt khách, `getWaitingParticipants()` và `approveParticipant()` trong `LivekitService` kiểm tra lại `user.userId === ownerUserId`. Frontend ẩn/hiện hộp chờ theo `isHost`, nhưng backend vẫn tự kiểm tra quyền cho từng request.

`participantIdentity` của LiveKit được tạo riêng theo từng lần cấp token (`userId` cộng UUID ngẫu nhiên); identity này dùng nhận diện participant trong LiveKit, không dùng để quyết định chủ phòng. Hiện `ownerUserId` nằm trong `Map` bộ nhớ của `LivekitService`, nên khi backend restart thì quan hệ chủ phòng cũng mất cùng trạng thái phòng.
### Vì sao nhận diện được chủ phòng dù chưa dùng database?

Backend không “đoán” chủ phòng từ room ID. Khi tạo phòng, `JwtAuthGuard` xác thực cookie phiên đăng nhập và `@CurrentUser()` cung cấp user hiện tại. `LivekitService.createRoom()` lấy `user.userId` đó, lưu làm `ownerUserId` trong `RoomState`, rồi đặt `RoomState` vào `rooms: Map<roomId, RoomState>`.

`LivekitService` được đăng ký làm provider của NestJS trong `LivekitModule`. Provider mặc định là singleton, nên các request trong cùng tiến trình backend dùng chung instance và cùng một `Map`. Ở request sau, guard lại xác thực tài khoản gửi request; service lấy state theo `roomId` rồi so sánh `user.userId` với `ownerUserId`. Khớp thì đó là host; không khớp thì không được xem hoặc duyệt hàng chờ.

Nói cách khác, database chưa cần thiết cho bản PoC chạy **một backend process** vì state tạm được giữ trong RAM giữa các request. Đây không phải lưu trữ lâu dài: restart sẽ xóa `Map`, còn nhiều backend instance sẽ có các `Map` khác nhau. Nếu cần host/room tồn tại sau restart hoặc chạy nhiều instance, phải lưu owner cùng room settings trong database hoặc kho chia sẻ.
### Giới hạn triển khai hiện tại

Room settings và hàng chờ là `Map` trong `LivekitService`, không phải tín hiệu realtime và không được lưu vào database. Backend restart hoặc nhiều instance có thể làm mất/trộn trạng thái. Cần kho chia sẻ bền vững và cơ chế realtime phù hợp trước khi chạy production nhiều instance.
## Nếu host không điều khiển được mic

- Kiểm tra host đang dùng đúng tài khoản đã tạo phòng và mic của cả phòng không bị tắt trong cài đặt.
- Host có thể mute ngay cả khi participant chưa publish track mic: quyền publish microphone sẽ bị khóa để participant không bật lại.
- Khi host đã cấp lại quyền, participant phải tự bật mic trên thiết bị của họ.
- Nếu lỗi là `Device in Use`, đóng app/tab khác đang giữ camera hoặc mic rồi thử bật thiết bị lại. Lỗi thiết bị này không ngăn backend đổi quyền microphone của participant khác.





