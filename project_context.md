# PROJECT CONTEXT — HỆ THỐNG PHÒNG HỌP TRỰC TUYẾN VÀ NỀN TẢNG QUẢN LÝ CÂU LẠC BỘ ĐẠI HỌC

> Ghi nhận ngày 2026-10-19 (Asia/Saigon) từ nội dung người dùng cung cấp.
>
> Cập nhật triển khai ngày 2026-10-19: Module 1 đã có token API, meeting UI, scripts build/test và `.env` cục bộ. Credentials LiveKit chưa được điền; chưa xác minh media thật trên hai thiết bị. Tài liệu nguồn bên dưới giữ nguyên để tham khảo yêu cầu, không phải bản mô tả tính năng đã nghiệm thu.
>
> Module sản phẩm và phase theo dõi không ánh xạ một-một. Phase 04/05 được triển khai trước Phase 03 vì PoC chưa cần database/auth. Xem `docs/modules/module-01-media-poc.mdx` và master plan để biết hiện trạng.
>
> Scaffold đã chọn Vite và Socket.IO qua WebSocket. ORM, cơ chế auth và hosting ứng dụng chưa chốt. Mục tiêu 20 participant chưa được kiểm chứng.

## 1. Vai trò của Agent

Bạn là một Senior Full-stack Software Engineer kiêm System Architect, có kinh nghiệm về phát triển ứng dụng web, hệ thống realtime, WebRTC, thiết kế backend, cơ sở dữ liệu, triển khai ứng dụng và tích hợp các dịch vụ cloud.

Bạn đang hỗ trợ một nhóm gồm 5 sinh viên phát triển bài tập lớn môn Công nghệ Web.

Nhiệm vụ quan trọng nhất của bạn ở giai đoạn hiện tại là **hiểu chính xác bối cảnh, mục tiêu, kiến trúc và phạm vi của dự án**, từ đó hỗ trợ nhóm đưa ra các quyết định kỹ thuật hợp lý và triển khai các module theo từng giai đoạn.

Dự án cần được phát triển theo hướng có thể mở rộng trong tương lai, nhưng không được đánh đổi sự đơn giản và tính khả thi của phiên bản hiện tại để xây dựng những thành phần chưa thực sự cần thiết.

Các nguyên tắc làm việc:

- Ưu tiên hiểu và phân tích kiến trúc trước khi viết code.
- Tôn trọng các quyết định công nghệ đã được thống nhất.
- Không tự ý bổ sung framework, service hoặc dependency khi chưa có nhu cầu rõ ràng.
- Phân biệt rõ yêu cầu hiện tại và định hướng mở rộng tương lai.
- Thiết kế code có tính module hóa, dễ đọc, dễ kiểm thử và dễ bảo trì.
- Không overengineering, không sử dụng microservices hoặc hệ thống phân tán phức tạp khi chưa cần thiết.
- Khi đề xuất giải pháp, cần giải thích lý do lựa chọn, các phương án thay thế và những trade-off quan trọng.
- Không tự ý triển khai các chức năng ngoài scope của module đang phát triển.
- Nếu repository đã tồn tại, phải đọc và phân tích cấu trúc, dependencies, conventions và code hiện tại trước khi chỉnh sửa.

Ngôn ngữ trao đổi và giải thích chính là tiếng Việt. Tên biến, tên hàm, tên lớp, API, thuật ngữ kỹ thuật và code sử dụng tiếng Anh theo chuẩn lập trình.

---

## 2. Bối cảnh tổng thể của dự án

### 2.1. Ý tưởng sản phẩm ban đầu

Ý tưởng dài hạn là xây dựng một nền tảng quản lý câu lạc bộ dành cho sinh viên đại học.

Nền tảng cho phép sinh viên tìm kiếm, khám phá và theo dõi thông tin của các câu lạc bộ trong trường. Mỗi câu lạc bộ có thể quản lý thông tin, hoạt động, thành viên và những đợt tuyển dụng của mình.

Một trong những quy trình nghiệp vụ quan trọng là tuyển thành viên mới.

Ví dụ, một câu lạc bộ mở đợt tuyển dụng. Sinh viên truy cập nền tảng, xem thông tin tuyển dụng, nộp CV hoặc hồ sơ ứng tuyển. Ban tuyển dụng tiếp nhận hồ sơ, đánh giá, lựa chọn ứng viên và tổ chức những vòng phỏng vấn trực tuyến.

Hệ thống cần cho phép các câu lạc bộ thực hiện phỏng vấn ngay trên website thay vì phải sử dụng những nền tảng bên ngoài như Google Meet hoặc Zoom.

Đặc biệt, nhiều câu lạc bộ có thể đồng thời tổ chức nhiều phòng phỏng vấn độc lập.

Ví dụ:

CLB AI tổ chức ba phòng phỏng vấn, mỗi phòng gồm hai interviewer và một candidate.

Trong khi đó, CLB Tiếng Nhật tổ chức hai phòng phỏng vấn khác, còn CLB Âm nhạc đang tổ chức một cuộc họp nội bộ.

Những phòng họp này phải hoạt động độc lập về participant, quyền truy cập và luồng media.

### 2.2. Tại sao phát triển Meeting Module trước?

Nhóm quyết định chưa xây dựng toàn bộ hệ thống quản lý câu lạc bộ ngay từ đầu.

Thay vào đó, nhóm ưu tiên phát triển hệ thống phòng họp trực tuyến vì đây là thành phần có độ phức tạp kỹ thuật tương đối cao, liên quan trực tiếp đến realtime communication, networking và tích hợp WebRTC.

Nếu Meeting Module có thể hoạt động ổn định, được triển khai thành công và đáp ứng những yêu cầu cơ bản về nhiều phòng họp đồng thời, nó có thể trở thành nền tảng để tích hợp những nghiệp vụ khác trong tương lai.

Do đó, kiến trúc cần giữ cho Meeting Module tương đối độc lập với các khái niệm như Club, Application hoặc Recruitment.

Một cuộc họp có thể được sử dụng cho phỏng vấn ứng viên, họp nội bộ, thảo luận nhóm hoặc những hoạt động trực tuyến khác.

Không nên hardcode logic khiến mọi Meeting bắt buộc phải thuộc một đợt tuyển dụng của câu lạc bộ.

---

## 3. Mục tiêu kỹ thuật của hệ thống

Dự án hướng đến việc xây dựng một ứng dụng web có khả năng tổ chức các cuộc họp trực tuyến nhiều người sử dụng.

Các yêu cầu cốt lõi của hệ thống hoàn chỉnh bao gồm:

- Người dùng có thể tạo phòng họp.
- Người tổ chức có thể chia sẻ đường dẫn tham gia phòng.
- Nhiều người có thể tham gia cùng một phòng thông qua trình duyệt.
- Người tham gia có thể bật/tắt camera và microphone.
- Những người trong phòng có thể nhìn và nghe nhau theo thời gian thực.
- Hệ thống có thể quản lý danh sách người tham gia.
- Các phòng họp khác nhau hoạt động độc lập.
- Nhiều phòng có thể hoạt động đồng thời.
- Người dùng có thể rời phòng và kết nối lại.
- Về sau có thể bổ sung cơ chế xác thực, phân quyền, waiting room và quản lý lịch phỏng vấn.
- Hệ thống có thể được triển khai để người dùng ở các mạng Internet khác nhau tham gia, không yêu cầu cùng mạng LAN.

Tuy nhiên, đây là định hướng của toàn bộ Meeting System, không phải toàn bộ yêu cầu của Module 1.

---

## 4. Điều kiện thực tế và giới hạn của dự án

Đây là bài tập lớn môn Công nghệ Web do nhóm 5 sinh viên thực hiện.

Nhóm hiện có 5 laptop cá nhân với RAM tối đa khoảng 16 GB mỗi máy.

Nguồn lực tài chính và phần cứng hạn chế. Vì vậy, nhóm không ưu tiên thuê VPS cấu hình cao, mua thêm phần cứng hoặc tự vận hành hệ thống media server phức tạp.

Kiến trúc cần phù hợp với việc phát triển trên laptop cá nhân và triển khai thông qua những nền tảng cloud phù hợp với ngân sách sinh viên.

Định hướng tải ban đầu của hệ thống meeting là khoảng 3–5 phòng hoạt động đồng thời, tối đa khoảng 4 participant mỗi phòng, tương đương mục tiêu thử nghiệm tối đa 20 participant đồng thời.

Đây là mục tiêu nghiệp vụ và kiểm thử của BTL, không phải kết quả benchmark đã được xác nhận.

Về mặt media, ưu tiên độ ổn định của âm thanh và hình ảnh hơn độ phân giải quá cao.

Có thể sử dụng mức video ban đầu khoảng 360p, 15 FPS cho các thử nghiệm, sau đó điều chỉnh dựa trên chất lượng thực tế.

Trong giai đoạn đầu, không cần tối ưu cho hàng trăm hoặc hàng nghìn participant.

---

## 5. Tech Stack đã thống nhất

Những công nghệ sau đã được lựa chọn làm nền tảng cho dự án.

### 5.1. Backend — Node.js / NestJS

Backend sử dụng Node.js với framework NestJS và ngôn ngữ TypeScript.

Backend chịu trách nhiệm xử lý nghiệp vụ của hệ thống, không trực tiếp truyền tải audio/video.

Trong những module tiếp theo, NestJS sẽ đảm nhiệm authentication, authorization, quản lý phòng, quản lý participant, cấp quyền tham gia phòng và kết nối với database.

Đặc biệt, backend chịu trách nhiệm tạo LiveKit access token thông qua LiveKit Server SDK.

Các thông tin nhạy cảm như LiveKit API Secret phải được lưu ở phía server và tuyệt đối không được đưa vào frontend.

Backend được tổ chức theo định hướng Modular Monolith: một ứng dụng NestJS duy nhất nhưng tách thành những module có trách nhiệm rõ ràng.

### 5.2. Frontend — React

Frontend sử dụng React kết hợp TypeScript.

Có thể sử dụng Vite làm công cụ phát triển và build.

Frontend chịu trách nhiệm hiển thị giao diện, xử lý tương tác người dùng và tích hợp LiveKit Client SDK.

Ứng dụng cần tách các phần liên quan đến meeting thành components, hooks và services phù hợp để tránh đặt toàn bộ logic trong một file React lớn.

Trong giai đoạn PoC, có thể ưu tiên các component có sẵn của LiveKit để kiểm chứng kết nối trước khi custom giao diện.

### 5.3. Realtime Media — LiveKit Cloud

**LiveKit Cloud là lựa chọn chính thức để xử lý audio/video realtime.**

Nhóm không tự triển khai WebRTC SFU và không tự vận hành TURN server trong phiên bản đầu tiên.

LiveKit Cloud chịu trách nhiệm cung cấp hạ tầng WebRTC, signaling, SFU và các cơ chế network traversal/fallback cần thiết do dịch vụ quản lý.

Frontend kết nối trực tiếp đến LiveKit Cloud thông qua LiveKit Client SDK.

Backend sử dụng LiveKit Server SDK để tạo access token và về sau có thể sử dụng các API quản lý phòng, participant hoặc tích hợp webhook.

Luồng media không đi qua NestJS backend.

Cần nắm rõ những khái niệm:

Room là không gian giao tiếp logic chứa các participant.

Participant là một thực thể tham gia room, có identity riêng.

Track đại diện cho một nguồn audio hoặc video.

Publish là đưa media track lên LiveKit.

Subscribe là nhận media track của participant khác.

SFU là thành phần tiếp nhận và phân phối các media track đến những người cần nhận.

LiveKit Cloud chỉ giải quyết phần hạ tầng truyền thông và không thay thế business logic của ứng dụng.

### 5.4. Database — Supabase

Supabase được lựa chọn làm nền tảng database.

Database chính là PostgreSQL do Supabase quản lý.

Ở những module tiếp theo, database sẽ lưu thông tin user, meeting, participant, quyền truy cập, lịch phỏng vấn và các metadata cần thiết.

Backend NestJS sẽ làm việc với database theo một data access layer nhất quán. Có thể lựa chọn Prisma hoặc phương án tích hợp PostgreSQL phù hợp sau khi xem xét yêu cầu thực tế; chưa coi ORM là quyết định bắt buộc.

Không sử dụng Supabase để truyền video/audio.

Module 1 chưa cần sử dụng database.

### 5.5. Chat — WebSocket

Hệ thống dự kiến có tính năng chat realtime.

Định hướng hiện tại là triển khai WebSocket, có thể thông qua Socket.IO hoặc WebSocket Gateway trong NestJS.

Cần phân biệt rõ WebSocket chat và WebRTC media.

WebSocket chat phục vụ trao đổi tin nhắn và một số sự kiện nghiệp vụ.

WebRTC và LiveKit Cloud phục vụ truyền audio/video.

Không gửi các frame video hoặc dữ liệu microphone thông qua WebSocket chat.

Tính năng chat chưa thuộc Module 1.

### 5.6. Deployment

Định hướng triển khai là sử dụng những nền tảng managed hosting phù hợp với ngân sách.

Frontend có thể triển khai qua Vercel.

NestJS backend có thể triển khai trên Render hoặc một nền tảng Node.js hosting tương đương, sau khi kiểm tra các giới hạn tài nguyên, thời gian chạy và khả năng hỗ trợ WebSocket.

Database sử dụng Supabase Cloud.

Media sử dụng LiveKit Cloud.

Nhóm không cần yêu cầu các client nằm trong cùng mạng LAN.

Chưa triển khai Kubernetes, self-hosted LiveKit cluster hoặc hạ tầng horizontal scaling phức tạp.

---

## 6. Kiến trúc tổng thể định hướng

Kiến trúc logic của hệ thống:

```text
                    WEB BROWSER
                         |
                  React Frontend
                         |
             +-----------+-----------+
             |                       |
         REST API                  WebRTC
             |                       |
             v                       v
       NestJS Backend          LiveKit Cloud
             |                       |
             |                  SFU / Media
             |
       Supabase PostgreSQL
```

Đối với các cuộc họp, backend chịu trách nhiệm xác minh quyền truy cập và cấp token.

Frontend dùng token để kết nối trực tiếp đến LiveKit.

LiveKit Cloud chịu trách nhiệm truyền media giữa các participant.

Trong tương lai, WebSocket có thể được sử dụng để đồng bộ waiting room, chat hoặc những sự kiện nghiệp vụ tùy yêu cầu.

Điểm quan trọng của kiến trúc là sự tách biệt giữa business logic, media communication và data persistence.

---

# 7. MODULE ĐẦU TIÊN — MEDIA CONNECTION PROOF OF CONCEPT

## 7.1. Mục tiêu của Module 1

Module đầu tiên có tên:

**Media Connection Proof of Concept (PoC)**

Mục đích không phải xây dựng ngay một ứng dụng meeting hoàn chỉnh.

Mục tiêu là kiểm chứng rằng React frontend có thể kết nối thành công đến LiveKit Cloud thông qua access token được cấp bởi NestJS backend.

Sau khi kết nối, hai người sử dụng các trình duyệt hoặc thiết bị khác nhau phải có thể nhìn và nghe nhau theo thời gian thực.

Module này là một thí nghiệm kỹ thuật nhằm xác nhận media pipeline hoạt động end-to-end.

Nếu Module 1 hoạt động thành công, nhóm mới tiếp tục xây dựng các tính năng quản lý phòng, chia sẻ link, phân quyền và các nghiệp vụ phỏng vấn.

## 7.2. Phạm vi chức năng chính xác

Module 1 chỉ cần một trang web đơn giản, không yêu cầu authentication của ứng dụng.

Trang web cho phép người dùng kết nối vào một phòng thử nghiệm cố định trên LiveKit Cloud.

Các chức năng cần có là nút tham gia phòng, nút rời phòng, bật/tắt camera, bật/tắt microphone, hiển thị local video và hiển thị remote video của những người khác trong cùng phòng.

Người dùng phải có thể nghe được âm thanh từ microphone của participant khác.

Ứng dụng nên hiển thị trạng thái kết nối cơ bản như connecting, connected, disconnected hoặc reconnecting.

Khi camera hoặc microphone bị tắt, giao diện phải phản ánh đúng trạng thái media.

Không được chỉ ẩn video bằng CSS mà vẫn tiếp tục publish camera.

Khi người dùng rời phòng, kết nối LiveKit phải được ngắt và tài nguyên media cần được dọn dẹp phù hợp.

## 7.3. Những gì chưa triển khai trong Module 1

Module 1 chưa cần đăng ký, đăng nhập, JWT authentication của ứng dụng, Supabase database, danh sách phòng, tạo phòng động, chia sẻ link tự động, waiting room, role-based access control, chat, screen sharing, ghi hình, lịch phỏng vấn hoặc load testing nhiều phòng.

Những chức năng này thuộc các module tiếp theo.

Không triển khai chúng chỉ vì chúng xuất hiện trong bối cảnh tổng thể của dự án.

## 7.4. Kiến trúc triển khai Module 1

```text
Browser A                       Browser B
    |                               |
    v                               v
React Frontend                 React Frontend
    |                               |
    | HTTP                          | HTTP
    v                               v
         NestJS Token Endpoint
                  |
                  | Signed LiveKit JWT
                  |
          +-------+-------+
          |               |
          v               v
       Browser A       Browser B
          |               |
          |    WebRTC     |
          v               v
             LiveKit Cloud
                  |
               SFU Room
```

Backend cung cấp một endpoint duy nhất phục vụ cấp token thử nghiệm.

Ví dụ:

```http
POST /api/livekit/token
```

Backend tạo LiveKit access token có identity riêng cho mỗi lần tham gia, với quyền join một room cố định, publish audio/video và subscribe vào media track của người khác.

Token nên có thời hạn ngắn và được ký tại server.

Frontend gọi endpoint để nhận LiveKit URL cùng access token.

Sau đó frontend sử dụng LiveKit React SDK để kết nối đến room.

Cả hai client phải tham gia cùng một room name để nhìn và nghe được nhau.

Trong PoC, có thể dùng tên phòng cố định:

```text
media-test-room
```

Không cần lưu thông tin phòng vào Supabase.

## 7.5. Những điểm kỹ thuật đặc biệt cần chú ý

**Thứ nhất: Bảo mật token.**

Không được hardcode LiveKit API Secret trong frontend.

Không đưa secret vào biến môi trường Vite có prefix `VITE_`.

NestJS phải chịu trách nhiệm tạo token.

Vì Module 1 không có authentication, endpoint cấp token là endpoint thử nghiệm công khai. Cần giới hạn phạm vi sử dụng, tránh triển khai công khai không kiểm soát. Có thể sử dụng fixed room, rate limiting hoặc một cơ chế bảo vệ môi trường development đơn giản.

**Thứ hai: Identity của participant.**

Mỗi participant phải có identity riêng.

Không sử dụng cùng một identity cho tất cả trình duyệt vì có thể gây ra xung đột khi tham gia room.

Backend có thể dùng UUID để tạo identity thử nghiệm.

**Thứ ba: Phân biệt local track và remote track.**

Local video là hình ảnh camera của người dùng hiện tại.

Remote video là hình ảnh từ participant khác được nhận thông qua LiveKit.

Chỉ hiển thị được local camera không được coi là đã hoàn thành Module 1.

Bắt buộc phải kiểm chứng được remote video và remote audio.

**Thứ tư: Audio playback.**

Trình duyệt có chính sách autoplay đối với audio.

Cần đảm bảo audio track từ remote participant được render và phát đúng cách.

Có thể sử dụng RoomAudioRenderer hoặc component tương đương của LiveKit.

Nếu trình duyệt chặn autoplay, giao diện cần cung cấp thao tác để người dùng kích hoạt audio.

**Thứ năm: Điều khiển camera/microphone.**

Nút bật/tắt phải thay đổi trạng thái publish media thực sự.

Nên sử dụng API điều khiển track do LiveKit SDK cung cấp.

Trạng thái UI cần được đồng bộ với trạng thái media thực tế.

**Thứ sáu: Connection lifecycle.**

Ứng dụng cần quản lý quá trình connecting, connected, disconnecting, disconnected và reconnecting.

Cần xử lý các lỗi kết nối và lỗi cấp quyền sử dụng thiết bị.

Không được để nhiều kết nối trùng lặp do component React render lại hoặc người dùng nhấn Join nhiều lần.

Khi component bị unmount hoặc người dùng Leave Room, phải cleanup thích hợp.

**Thứ bảy: Kiểm thử trên thiết bị thật.**

Ban đầu có thể thử hai tab trình duyệt để kiểm tra chức năng.

Tuy nhiên, điều kiện nghiệm thu phải bao gồm hai thiết bị hoặc hai môi trường trình duyệt độc lập.

Nên kiểm tra cả hai client trên cùng Wi-Fi và trên hai mạng khác nhau, ví dụ một laptop Wi-Fi và một điện thoại 4G.

Nên sử dụng tai nghe khi kiểm thử để tránh tiếng vọng âm thanh.

---

## 8. Kết quả đầu ra bắt buộc của Module 1

Module 1 được coi là hoàn thành khi có thể chứng minh được toàn bộ luồng:

```text
React
  |
  v
Request LiveKit Token
  |
  v
NestJS Backend
  |
  v
Generate Signed Access Token
  |
  v
React Receives Token
  |
  v
Connect to LiveKit Cloud
  |
  v
Publish Camera / Microphone
  |
  v
LiveKit SFU
  |
  v
Remote Participant Subscribes
  |
  v
Audio / Video Playback
```

Các điều kiện nghiệm thu cụ thể:

Hai trình duyệt nhận được token khác identity nhưng cùng room.

Cả hai kết nối thành công đến LiveKit Cloud.

Người A nhìn thấy camera của người B.

Người B nhìn thấy camera của người A.

Hai người nghe được âm thanh của nhau.

Người A tắt camera thì người B thấy trạng thái camera tắt.

Người A tắt microphone thì người B không còn nghe âm thanh từ A.

Khi bật lại camera/microphone, quá trình truyền media tiếp tục hoạt động.

Khi một participant rời phòng, participant còn lại nhìn thấy sự thay đổi.

Ứng dụng không crash khi người dùng từ chối quyền truy cập camera hoặc microphone.

Kết nối được kiểm tra thành công trên hai thiết bị khác nhau.

Không yêu cầu database, chat, authentication hoặc nhiều room động trong giai đoạn này.

---

## 9. Định hướng cấu trúc source code

Cần chuẩn bị source code đủ rõ ràng để có thể mở rộng trong các module sau.

Cấu trúc tham khảo:

```text
university-club-platform/
│
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   └── meeting/
│   │   │       ├── components/
│   │   │       ├── hooks/
│   │   │       ├── services/
│   │   │       └── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── livekit/
│   │   │   ├── livekit.module.ts
│   │   │   ├── livekit.controller.ts
│   │   │   └── livekit.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
│
├── README.md
└── .gitignore
```

Đây chỉ là cấu trúc định hướng.

Nếu repository đã có cấu trúc khác nhưng hợp lý, hãy ưu tiên giữ conventions hiện tại thay vì tự ý tái cấu trúc toàn bộ.

Không cần tạo trước nhiều file rỗng cho các chức năng chưa triển khai.

---

# 10. Định hướng các module tiếp theo

Agent cần hiểu rằng Module 1 chỉ là bước đầu tiên trong quá trình phát triển Meeting System.

Các module tương lai có thể được triển khai theo thứ tự sau.

### Module 2 — Dynamic Meeting Rooms

Bổ sung khả năng tạo phòng động, sinh room ID, tạo và chia sẻ link tham gia, quản lý room lifecycle và danh sách participant.

Ví dụ:

```text
/meetings/{meetingId}
```

Nhiều room có thể hoạt động độc lập trên LiveKit Cloud.

### Module 3 — Authentication & Authorization

Bổ sung đăng ký, đăng nhập, quản lý user và quyền tham gia phòng.

NestJS sử dụng Supabase PostgreSQL để lưu dữ liệu người dùng và phòng họp.

Backend phải kiểm tra quyền trước khi cấp LiveKit token.

Không được sử dụng link phòng làm phương thức xác thực duy nhất cho những cuộc họp riêng tư.

### Module 4 — Interview Workflow

Bổ sung nghiệp vụ phỏng vấn.

Có thể có những role như Host, Interviewer, Candidate và Observer.

Candidate có thể được đưa vào waiting room trước khi tham gia phòng chính.

Host có khả năng chấp nhận, từ chối hoặc loại participant khỏi phòng.

Các trạng thái phỏng vấn phải được quản lý độc lập với trạng thái kết nối WebRTC.

### Module 5 — Realtime Chat

Bổ sung chat bằng WebSocket.

Có thể sử dụng Socket.IO với NestJS WebSocket Gateway.

Chat cần có các quy tắc quản lý người gửi, phòng chat, nội dung và phân quyền phù hợp.

Khi cần, lịch sử tin nhắn được lưu trong Supabase PostgreSQL.

### Module 6 — Reliability & Performance

Nghiên cứu reconnect, thiết bị mất kết nối, thay đổi mạng, lỗi microphone/camera, token expiration và những edge case liên quan đến vòng đời participant.

Thực hiện kiểm thử nhiều phòng đồng thời.

Thu thập và đánh giá các chỉ số như connection success rate, join latency, RTT, jitter, packet loss và chất lượng media.

Vì sử dụng LiveKit Cloud, không được tuyên bố benchmark CPU/RAM của SFU nếu không có quyền truy cập các chỉ số đó.

### Module 7 — University Club Management Integration

Mở rộng hệ thống để phục vụ quản lý câu lạc bộ.

Có thể phát triển các thực thể như Club, ClubMember, RecruitmentCampaign, Application, Interview và Meeting.

Một Interview có thể liên kết đến Meeting.

Tuy nhiên, Meeting vẫn phải có khả năng sử dụng độc lập ngoài quy trình tuyển dụng.

Trong tương lai, nền tảng có thể bổ sung quản lý CV, lịch phỏng vấn, kết quả tuyển dụng, đánh giá ứng viên, thông báo và quản lý thành viên.

---

## 11. Những nguyên tắc kiến trúc phải duy trì lâu dài

**Separation of Concerns:** Frontend, backend nghiệp vụ, database, chat và media server cần có trách nhiệm riêng.

**Backend-controlled Authorization:** Frontend không được tự quyết định quyền tham gia phòng. Backend chịu trách nhiệm kiểm tra quyền và cấp LiveKit token phù hợp.

**Managed Media Infrastructure:** Không tự xây dựng SFU hoặc TURN khi đã chốt LiveKit Cloud, trừ khi yêu cầu dự án thay đổi.

**Modularity:** Code meeting cần có thể tái sử dụng cho các nghiệp vụ ngoài phỏng vấn.

**Incremental Development:** Chỉ phát triển những thành phần cần thiết cho module hiện tại.

**Maintainability:** Ưu tiên TypeScript typing rõ ràng, error handling, logging và cấu trúc source code dễ bảo trì.

**Security:** Không expose API secrets, database credentials hoặc các thông tin nhạy cảm lên trình duyệt hay repository.

**Pragmatism:** Các giải pháp phải phù hợp với giới hạn về thời gian, nhân lực, chi phí và mục tiêu học tập của nhóm.

---

# 12. Yêu cầu đối với Agent khi nhận được Project Context này

Trước tiên, hãy đọc và hiểu toàn bộ thông tin của dự án.

Nếu đã có repository, hãy kiểm tra source code hiện tại để xác định những thành phần đã tồn tại, chưa tồn tại hoặc chưa hoàn chỉnh.

Đừng mặc định mọi thành phần được mô tả trong tài liệu đều đã được triển khai.

Không tự ý bắt đầu xây dựng toàn bộ University Club Platform.

Không tự ý triển khai các module tương lai chỉ vì chúng đã được mô tả.

Trong giai đoạn hiện tại, hãy ưu tiên hỗ trợ Module 1 — Media Connection Proof of Concept.

Sau khi hiểu bối cảnh, hãy phản hồi theo cấu trúc sau:

**Phần 1 — Hiểu biết của bạn về dự án:** Trình bày lại mục tiêu tổng thể của University Club Platform và vai trò của Meeting Module.

**Phần 2 — Kiến trúc và tech stack:** Xác nhận trách nhiệm của React, NestJS, LiveKit Cloud, Supabase và WebSocket.

**Phần 3 — Scope của Module 1:** Mô tả chính xác những gì cần triển khai, những gì không cần triển khai và vì sao.

**Phần 4 — Luồng media end-to-end:** Mô tả luồng từ lúc người dùng nhấn Join đến khi hai participant nhìn và nghe thấy nhau.

**Phần 5 — Những vấn đề kỹ thuật cần chú ý:** Phân tích token, identity, local/remote tracks, autoplay audio, permission, connection lifecycle, cleanup và bảo mật.

**Phần 6 — Kế hoạch triển khai Module 1:** Đề xuất thứ tự xây dựng backend token service, frontend meeting page, LiveKit integration và kiểm thử.

**Phần 7 — Khả năng mở rộng:** Giải thích các quyết định trong Module 1 cần được thực hiện như thế nào để không cản trở những module tiếp theo.

Chỉ sau khi hoàn thành việc phân tích bối cảnh và kế hoạch triển khai, mới bắt đầu viết hoặc chỉnh sửa code theo yêu cầu cụ thể tiếp theo.

**Mục tiêu cuối cùng của prompt này là đảm bảo bạn hiểu đúng toàn bộ bối cảnh dự án, nhưng tập trung giải quyết chính xác Module 1 ở thời điểm hiện tại.**