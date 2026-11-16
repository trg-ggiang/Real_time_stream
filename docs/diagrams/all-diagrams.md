# Sơ đồ uniCircle — Mermaid

Ngày 16/11/2026. Xem README.md trong cùng thư mục để biết cách import và giới hạn hiện tại.

## 1. Chuyển màn hình tổng thể

```mermaid
flowchart TB
    ENTRY["Mở website"] --> PUBLIC["Khám phá - Trang chủ / "]
    PUBLIC --> CLUBS["Danh sách CLB /clubs"]
    PUBLIC --> ACTIVITIES["Danh sách hoạt động /activities"]
    PUBLIC --> POSTS["Danh sách bài viết /posts"]
    CLUBS --> CLUB_DETAIL["Chi tiết CLB /clubs/:id"]
    ACTIVITIES --> ACTIVITY_DETAIL["Chi tiết hoạt động /activities/:id"]
    POSTS --> POST_DETAIL["Chi tiết bài viết /posts/:id"]
    PUBLIC --> AUTH["Đăng nhập hoặc đăng ký - query mode"]
    CLUB_DETAIL -->|"Quan tâm khi chưa đăng nhập"| AUTH
    ACTIVITY_DETAIL -->|"Đăng ký khi chưa đăng nhập"| AUTH
    AUTH --> PROFILE_CHECK{"Hồ sơ đầy đủ?"}
    PROFILE_CHECK -->|"Chưa"| ONBOARDING["Hoàn thiện hồ sơ sinh viên"]
    ONBOARDING -->|"Lưu thành công"| DESTINATION{"Có trang đích cụ thể?"}
    PROFILE_CHECK -->|"Có"| DESTINATION
    DESTINATION -->|"Có"| RESUME["Quay lại trang đã mở - xác nhận lại thao tác"]
    DESTINATION -->|"Không"| ROLE{"Role nền tảng?"}
    ROLE -->|"admin"| ADMIN_HOME
    ROLE -->|"Sinh viên hoặc role khác"| PERSONAL_HOME
    RESUME --> CLUB_DETAIL
    RESUME --> ACTIVITY_DETAIL

    subgraph PERSONAL["KHÔNG GIAN CÁ NHÂN"]
        PERSONAL_HOME["Tổng quan /me"]
        MY_CLUBS["CLB tham gia /me/clubs"]
        FOLLOWS["CLB quan tâm /me/follows"]
        REGISTRATIONS["Đăng ký hoạt động /me/registrations"]
        REQUESTS["Lịch sử đề nghị CLB /me/club-requests"]
        REQUEST_NEW["Tạo đề nghị /me/club-requests/new"]
        REQUEST_DETAIL["Theo dõi đề nghị /me/club-requests/:id"]
        PROFILE["Hồ sơ /me/profile"]
        PERSONAL_HOME --> MY_CLUBS
        PERSONAL_HOME --> FOLLOWS
        PERSONAL_HOME --> REGISTRATIONS
        PERSONAL_HOME --> REQUESTS
        PERSONAL_HOME --> PROFILE
        REQUESTS --> REQUEST_NEW
        REQUEST_NEW -->|"Gửi thành công"| REQUEST_DETAIL
        REQUESTS --> REQUEST_DETAIL
        REQUEST_DETAIL -->|"Bị từ chối - tạo hồ sơ mới"| REQUEST_NEW
    end

    subgraph ADMIN["QUẢN TRỊ HỆ THỐNG - CHỈ ADMIN"]
        ADMIN_HOME["Tổng quan /admin"]
        ADMIN_QUEUE["Danh sách đề nghị /admin/club-requests"]
        ADMIN_DETAIL["Xét duyệt /admin/club-requests/:id"]
        ADMIN_CLUBS["Danh sách CLB đã duyệt /admin/clubs"]
        ADMIN_CLUB_DETAIL["Chi tiết CLB /admin/clubs/:id"]
        ADMIN_HOME --> ADMIN_QUEUE
        ADMIN_HOME --> ADMIN_CLUBS
        ADMIN_QUEUE --> ADMIN_DETAIL
        ADMIN_CLUBS --> ADMIN_CLUB_DETAIL
        ADMIN_DETAIL -->|"Duyệt hoặc từ chối - tải lại"| ADMIN_DETAIL
    end

    PUBLIC -->|"Menu tài khoản"| PERSONAL_HOME
    PERSONAL_HOME -->|"Có role admin"| ADMIN_HOME
    ADMIN_HOME -->|"Không gian cá nhân"| PERSONAL_HOME
    FOLLOWS --> CLUB_DETAIL
    REGISTRATIONS --> ACTIVITY_DETAIL
    ADMIN_DETAIL -->|"Đã công khai"| CLUB_DETAIL
    ADMIN_CLUB_DETAIL -->|"Đang công khai"| CLUB_DETAIL
    MY_CLUBS -->|"Membership active - CLB published"| WORKSPACE["Không gian CLB /workspace/:clubId - xem sơ đồ 02"]
    PERSONAL_HOME --> MEETING["Công cụ phòng họp - query view=meeting"]
    WORKSPACE --> MEETING
    MEETING -->|"Thoát công cụ - về trang đã mở"| RETURN["Không gian cá nhân hoặc trang phòng họp của workspace"]
    PERSONAL_HOME -->|"Đăng xuất hoặc hết phiên"| AUTH
    ADMIN_HOME -->|"Đăng xuất hoặc hết phiên"| AUTH
```

## 2. Workspace và meeting

```mermaid
flowchart TB
    MY_CLUBS["CLB tham gia /me/clubs"] --> ACCESS{"Đăng nhập, đủ profile, membership active và CLB published?"}
    ACCESS -->|"Không"| DENIED["Yêu cầu đăng nhập, hoàn thiện hồ sơ hoặc báo không có quyền"]
    ACCESS -->|"Có"| HOME["Tổng quan /workspace/:clubId"]
    HOME --> SWITCH["Chọn CLB khác"]
    SWITCH -->|"Cảnh báo nếu chưa lưu - kiểm tra lại quyền"| ACCESS

    subgraph COMMON["SINH HOẠT CHUNG - THÀNH VIÊN VÀ CHỦ NHIỆM"]
        POST_LIST["Bài viết /posts - thuộc workspace"]
        ACTIVITY_LIST["Hoạt động /activities - thuộc workspace"]
        CONTENT_DETAIL["Chi tiết bài hoặc hoạt động /:kind/:id"]
        EDITOR["Soạn mới /:kind/new hoặc sửa /:kind/:id/edit"]
        MEMBERS["Thành viên /members"]
        DEPARTMENTS["Cơ cấu CLB /departments"]
        MEETING_ENTRY["Phòng họp /meetings - thuộc workspace"]
        POST_LIST --> CONTENT_DETAIL
        ACTIVITY_LIST --> CONTENT_DETAIL
        POST_LIST --> EDITOR
        ACTIVITY_LIST --> EDITOR
        CONTENT_DETAIL -->|"Chỉ tác giả được sửa"| EDITOR
        EDITOR -->|"Lưu nháp hoặc gửi duyệt thành công"| CONTENT_DETAIL
    end

    HOME --> POST_LIST
    HOME --> ACTIVITY_LIST
    HOME --> MEMBERS
    HOME --> DEPARTMENTS
    HOME --> MEETING_ENTRY
    HOME --> CHAIR{"Chủ nhiệm của CLB đang chọn?"}

    subgraph MANAGEMENT["QUẢN LÝ CLB - CHỈ CHỦ NHIỆM"]
        REVIEW["Nội dung chờ duyệt /review"]
        REVIEW_POSTS["Bài viết - list=review"]
        REVIEW_ACTIVITIES["Hoạt động - list=review"]
        INFORMATION["Thông tin và liên hệ /information"]
        MEMBERS_EDIT["Thêm thành viên bằng email, chuyển ban, gỡ thành viên, chuyển chủ nhiệm"]
        DEPARTMENT_EDIT["Tạo hoặc sửa ban - trạng thái và is_private"]
        REVIEW --> REVIEW_POSTS
        REVIEW --> REVIEW_ACTIVITIES
        REVIEW_POSTS --> CONTENT_DETAIL
        REVIEW_ACTIVITIES --> CONTENT_DETAIL
        INFORMATION -->|"Chỉ lưu liên hệ và URL ảnh"| INFORMATION
    end

    CHAIR -->|"Có"| REVIEW
    CHAIR -->|"Có"| INFORMATION
    MEMBERS -->|"Chủ nhiệm"| MEMBERS_EDIT
    DEPARTMENTS -->|"Chủ nhiệm"| DEPARTMENT_EDIT
    CONTENT_DETAIL -->|"Pending và người xem là chủ nhiệm"| DECISION["Duyệt đăng hoặc yêu cầu chỉnh sửa có lý do"]
    DECISION --> CONTENT_DETAIL

    MEETING_ENTRY --> HUB["Mở công cụ họp - query view=meeting"]
    HUB --> CREATE["Tạo cuộc họp hoặc lên lịch phiên"]
    HUB --> JOIN["Nhập mã hoặc mở link mời - chọn phiên"]
    CREATE --> JOIN
    JOIN --> PREJOIN["Kiểm tra quyền, phiên họp và thiết bị"]
    PREJOIN --> ADMISSION{"Được tham gia ngay?"}
    ADMISSION -->|"Chờ xét duyệt"| WAITING["Phòng chờ"]
    WAITING -->|"Được duyệt"| PREJOIN
    WAITING -->|"Bị từ chối"| HUB
    ADMISSION -->|"Có"| ROOM["Phòng họp: camera, mic, chia sẻ màn hình, giơ tay, chat"]
    ADMISSION -->|"Không đủ điều kiện"| HUB
    ROOM -->|"Rời phòng hoặc phiên kết thúc"| HUB
    HUB -->|"Thoát công cụ họp"| MEETING_ENTRY
    HOME -->|"Về không gian cá nhân"| MY_CLUBS
```

## 3. Luồng nghiệp vụ hệ thống

```mermaid
flowchart TB
    START["Người dùng truy cập website"] --> READ["Frontend gọi API public để xem CLB, bài viết, hoạt động"]
    READ --> ACTION{"Muốn thao tác cần tài khoản?"}
    ACTION -->|"Không"| READ
    ACTION -->|"Có"| ACCOUNT{"Có phiên đăng nhập hợp lệ?"}
    ACCOUNT -->|"Chưa"| AUTH["Đăng ký hoặc đăng nhập qua NestJS"]
    AUTH --> USERDB["Đọc hoặc tạo users - kiểm tra mật khẩu - cấp JWT ứng dụng"]
    USERDB --> PROFILE{"Hồ sơ sinh viên đã đủ?"}
    ACCOUNT -->|"Có"| PROFILE
    PROFILE -->|"Chưa"| COMPLETE["Bổ sung student_profiles và lưu thành công"]
    COMPLETE --> READY
    PROFILE -->|"Rồi"| READY["Tài khoản sẵn sàng - quay lại đích hoặc vào trang mặc định theo role"]

    READY --> FOLLOW["Quan tâm hoặc bỏ quan tâm CLB"]
    FOLLOW --> FOLLOWS_DB["API ghi club_follows theo user hiện tại và CLB published"]
    READY --> REGISTER["Đăng ký hoặc hủy đăng ký hoạt động"]
    REGISTER --> REGISTER_CHECK{"Hoạt động, thời hạn và sức chứa hợp lệ?"}
    REGISTER_CHECK -->|"Có"| REG_DB["Ghi hoặc cập nhật activity_registrations - giữ lịch sử hủy"]
    REGISTER_CHECK -->|"Không"| REG_ERROR["Báo lý do và tải lại trạng thái"]

    READY --> CLUB_REQUEST["Sinh viên gửi đề nghị thành lập CLB"]
    CLUB_REQUEST --> PENDING["Tạo clubs status=pending - trigger khởi tạo ban và chủ nhiệm"]
    PENDING --> ADMIN["Admin đọc hồ sơ - JWT, profile và role được kiểm tra ở backend"]
    ADMIN --> DECISION{"Quyết định xét duyệt"}
    DECISION -->|"Từ chối - cần lý do"| REJECT["Conditional UPDATE sang rejected - lưu người duyệt, thời gian và lý do"]
    REJECT --> OWNER["Người gửi xem kết quả - có thể tạo đề nghị mới"]
    OWNER --> CLUB_REQUEST
    DECISION -->|"Duyệt"| STRUCTURE{"Cấu trúc chủ nhiệm và Ban quản trị hợp lệ?"}
    STRUCTURE -->|"Không"| FIX["Báo xung đột - kiểm tra dữ liệu khởi tạo"]
    STRUCTURE -->|"Có"| PUBLISH["Conditional UPDATE pending và đúng updated_at sang published"]
    PUBLISH --> PUBLIC["Public views đưa CLB vào trang khám phá khi tải lại"]
    PUBLISH --> WORKSPACE["Membership active được mở workspace của CLB published"]

    READY --> MEMBER_CHECK{"Là thành viên active của CLB published?"}
    MEMBER_CHECK -->|"Có"| WORKSPACE
    MEMBER_CHECK -->|"Không"| NO_MEMBER["Không truy cập dữ liệu nội bộ CLB"]
    WORKSPACE --> CONTENT["Tác giả soạn bài hoặc hoạt động - lưu draft"]
    CONTENT --> SUBMIT["Gửi đúng phiên bản draft sang pending_review"]
    SUBMIT --> AUTO{"Hoạt động do chủ nhiệm tạo?"}
    AUTO -->|"Có"| APPROVE["Duyệt đăng với quyền chủ nhiệm"]
    AUTO -->|"Không"| CHAIR["Chủ nhiệm xem hàng đợi đúng CLB"]
    CHAIR --> REVIEW{"Kết quả xét duyệt"}
    REVIEW -->|"Yêu cầu sửa - cần lý do"| CHANGES["changes_requested hoặc rejected ở schema legacy"]
    CHANGES --> CONTENT
    REVIEW -->|"Duyệt"| APPROVE
    APPROVE --> VISIBILITY{"Nội dung được công khai?"}
    VISIBILITY -->|"Hoạt động hoặc bài viết public"| PUBLIC_CONTENT["Public view chỉ trả nội dung published của CLB published"]
    VISIBILITY -->|"Bài viết internal"| PRIVATE_CONTENT["Chỉ đọc trong workspace có membership hợp lệ"]
    CONTENT -->|"Sửa nội dung đã đăng"| HIDE["Đưa về draft và ẩn bản công khai cho tới khi duyệt lại"]
    HIDE --> SUBMIT
    WORKSPACE --> PEOPLE["Chủ nhiệm quản lý ban, thành viên và liên hệ - chuyển chủ nhiệm qua RPC"]

    READY --> MEETING["Mở công cụ meeting - quyền họp độc lập với role CLB"]
    WORKSPACE --> MEETING
    MEETING --> PERMISSION["Backend kiểm tra phiên họp, quyền thành viên và điều kiện tiếp nhận"]
    PERMISSION --> TOKEN["Cấp token LiveKit có quyền của cuộc họp"]
    TOKEN --> MEDIA["Trình duyệt kết nối LiveKit Cloud - camera, mic và màn hình"]
    MEDIA --> CHAT["Socket.IO xác thực JWT và quyền session - lưu meeting_messages rồi phát tin"]
    CHAT --> LEAVE["Rời phòng hoặc phiên kết thúc - cập nhật tham dự và thu hồi quyền truy cập"]
    LEAVE --> RETURN["Về công cụ họp hoặc trang trước đó"]

    PUBLISH -.-> CONFLICT["Nếu trạng thái hoặc updated_at đã đổi: trả 409, tải lại trước khi quyết định"]
    APPROVE -.-> CONFLICT
```

## 4. Kiến trúc kỹ thuật

```mermaid
flowchart LR
    USER["Người dùng - Guest, sinh viên, chủ nhiệm hoặc admin"] --> WEB["React và Vite - public, personal, workspace, admin, meeting"]
    WEB -->|"HTTP API qua HTTPS tunnel khi chia sẻ link"| API["NestJS Backend"]
    API --> PUBLIC["Public content - chỉ đọc các view published"]
    API --> AUTH["Auth và Users - mật khẩu, JWT, profile"]
    API --> PERSONAL["Personal - follows, registrations, club requests"]
    API --> WORKSPACE["Workspace - membership, ban, bài viết và hoạt động"]
    API --> ADMIN["Admin - role nền tảng và xét duyệt CLB"]
    API --> MEETING["Meetings - phòng, session, quyền, admission và attendance"]
    PUBLIC --> DB[("Supabase PostgreSQL")]
    AUTH --> DB
    PERSONAL --> DB
    WORKSPACE --> DB
    ADMIN --> DB
    MEETING --> DB
    WEB -->|"Socket.IO qua HTTPS tunnel"| CHAT["NestJS Chat Gateway - xác thực và kiểm tra quyền session"]
    CHAT -->|"Lưu và đọc meeting_messages"| DB
    CHAT -->|"Phát tin đến đúng người còn quyền"| WEB
    MEETING --> LK_SERVICE["LiveKit Service - tạo token và thao tác quyền phòng"]
    LK_SERVICE -->|"Token và địa chỉ LiveKit trả qua API"| WEB
    LK_SERVICE -->|"Server API quản lý phòng"| LK["LiveKit Cloud - truyền media"]
    WEB <-->|"WebRTC - audio, video, screen share"| LK
    NOTE["Supabase không truyền video. HTTPS tunnel mở đường vào ứng dụng local; media đi qua LiveKit Cloud."]
    DB -.-> NOTE
    LK -.-> NOTE
```
