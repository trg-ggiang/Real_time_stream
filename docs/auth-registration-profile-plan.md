# Kế hoạch nghiệp vụ: Đăng ký, đăng nhập và hồ sơ cá nhân

## 1. Mục tiêu

Xây dựng luồng tài khoản cho người dùng gồm:

1. Đăng ký bằng email và mật khẩu.
2. Đăng nhập, đăng xuất và duy trì phiên làm việc.
3. Xác minh email nếu hệ thống bật xác minh.
4. Xem và cập nhật hồ sơ cá nhân.
5. Hướng dẫn kiểm thử luồng thành công, lỗi và bảo mật.

Tài liệu này là kế hoạch triển khai, không thay đổi schema hay mã nguồn. Phạm vi chỉ dựa trên schema được cung cấp cho `users`, `student_profiles`, `organizations`.

## 2. Phạm vi dữ liệu

### `users`

| Cột | Vai trò dự kiến |
|---|---|
| `user_id` (UUID) | Định danh tài khoản; nên liên kết với ID người dùng của hệ thống xác thực. |
| `email` (text, NOT NULL) | Email đăng nhập; cần chuẩn hóa và duy nhất. |
| `display_name` (text, NOT NULL) | Tên hiển thị tối thiểu khi tạo tài khoản. |
| `avatar_url` (text, nullable) | Ảnh đại diện tùy chọn. |
| `created_at` (timestamptz) | Thời điểm tạo bản ghi. |
| `password_hash` (text, nullable) | Chỉ dùng nếu ứng dụng tự quản lý mật khẩu; không lưu mật khẩu thô. |
| `email_verified_at` (timestamptz, nullable) | Thời điểm xác minh email; null nghĩa là chưa xác minh. |

### `student_profiles`

| Cột | Vai trò dự kiến |
|---|---|
| `user_id` (UUID, NOT NULL) | Khóa liên kết hồ sơ với tài khoản. |
| `full_name` | Họ tên đầy đủ. |
| `student_code` | Mã sinh viên. |
| `school_or_faculty` | Trường hoặc khoa. |
| `major` | Ngành học. |
| `cohort` | Khóa/lớp niên khóa. |
| `phone` | Số điện thoại. |
| `bio` | Giới thiệu bản thân. |
| `created_at`, `updated_at` | Thời điểm tạo và cập nhật hồ sơ. |

Mọi trường hồ sơ ngoài `user_id` đang nullable theo schema được gửi. Trước khi bắt buộc trường nào, cần thống nhất yêu cầu nghiệp vụ và cập nhật validation tương ứng.

### `organizations`

Có `organization_id`, `name`, `organization_type`. Bảng này có vẻ mô tả tổ chức/trường nhưng schema được cung cấp chưa thể hiện khóa ngoại từ `student_profiles`. Giai đoạn đầu không cần ghi vào bảng này để đăng ký hoặc sửa hồ sơ; xác nhận quan hệ trước khi thêm lựa chọn tổ chức vào giao diện.

## 3. Quyết định cần xác nhận trước triển khai

1. **Nguồn xác thực:** ưu tiên Supabase Auth làm nơi quản lý mật khẩu và phiên. Nếu chọn cách này, không dùng `users.password_hash` để đăng nhập; cân nhắc loại bỏ hoặc để null cột này. Không tự duy trì hai hệ mật khẩu.
2. **Liên kết ID:** xác nhận `users.user_id` có cùng giá trị với `auth.users.id`, và `student_profiles.user_id` là khóa ngoại tới `users.user_id`.
3. **Ràng buộc:** xác nhận `users.email` unique (không phân biệt chữ hoa/thường) và `student_profiles.user_id` unique để mỗi tài khoản có tối đa một hồ sơ.
4. **Xác minh email:** xác nhận có yêu cầu xác minh trước khi đăng nhập/truy cập tính năng hay không. `email_verified_at` là dấu thời gian đồng bộ trạng thái, không thay thế cơ chế xác minh của nhà cung cấp xác thực.
5. **Trường hồ sơ bắt buộc:** chốt các trường tối thiểu. Đề xuất bước đăng ký chỉ yêu cầu email, mật khẩu, tên hiển thị; hồ sơ sinh viên có thể hoàn thiện sau.
6. **RLS:** bật và kiểm tra Row Level Security để người dùng chỉ đọc/cập nhật bản ghi của mình. Quyền service role chỉ dùng phía server, không đưa vào frontend.

## 4. Luồng đăng ký

### Giao diện

- Trường: email, mật khẩu, xác nhận mật khẩu, tên hiển thị.
- Hiển thị lỗi cạnh trường và trạng thái gửi/đang xử lý.
- Yêu cầu mật khẩu đáp ứng chính sách đã thống nhất; không ghi mật khẩu hoặc token vào log.
- Sau đăng ký, hiển thị thông báo rõ: vào ứng dụng nếu đã xác minh, hoặc kiểm tra email để xác minh.

### Xử lý dự kiến

1. Chuẩn hóa email (trim, lowercase) ở lớp ứng dụng.
2. Validate định dạng email, mật khẩu và display name ở frontend và backend.
3. Tạo danh tính bằng Supabase Auth (hoặc nhà cung cấp đã chọn).
4. Tạo/đồng bộ bản ghi `users` với cùng ID Auth; lưu `email`, `display_name`, `created_at`. Không nhận `user_id` tùy ý từ client.
5. Tạo bản ghi `student_profiles` rỗng/tối thiểu gắn `user_id`, hoặc tạo lần đầu khi người dùng lưu hồ sơ — chọn một phương án nhất quán.
6. Nếu có xác minh email, cập nhật `email_verified_at` chỉ sau khi xác minh thành công; không tin cậy giá trị do client gửi.
7. Xử lý lỗi trùng email, lỗi xác minh, lỗi tạo hồ sơ và khả năng thử lại mà không tạo dữ liệu trùng.

### Kết quả mong đợi

- Tài khoản không bị tạo trùng khi gửi lặp.
- Bản ghi hồ sơ gắn đúng tài khoản.
- Người dùng nhận được hướng dẫn bước tiếp theo.

## 5. Luồng đăng nhập và đăng xuất

### Đăng nhập

1. Nhận email và mật khẩu, chuẩn hóa email.
2. Gửi thông tin đến cơ chế Auth; không truy vấn `password_hash` trực tiếp nếu dùng Supabase Auth.
3. Trả lỗi chung khi thông tin không hợp lệ để tránh tiết lộ email nào đã đăng ký.
4. Với đăng nhập thành công, tạo/khôi phục phiên an toàn và tải thông tin hồ sơ theo ID trong phiên.
5. Nếu email verification được yêu cầu, chặn quyền truy cập theo chính sách và cung cấp chức năng gửi lại email xác minh.
6. Điều hướng người dùng đến trang chính hoặc trang hoàn thiện hồ sơ nếu thiếu trường tối thiểu.

### Đăng xuất

- Thu hồi/xóa phiên ở Auth và xóa trạng thái phiên phía client.
- Sau đăng xuất, trang cần bảo vệ không còn truy cập được bằng trạng thái giao diện cũ.

### Phiên và bảo mật

- Ưu tiên cơ chế session/token chính thức của SDK/Auth; cookie phải có thuộc tính an toàn nếu phiên đi qua cookie.
- Không lưu mật khẩu thô, access token hoặc refresh token trong log.
- Bảo vệ API hồ sơ bằng xác thực server-side và kiểm tra quyền sở hữu.

## 6. Luồng xem và hoàn thiện hồ sơ

1. Người dùng mở trang hồ sơ; server xác định `user_id` từ phiên, không lấy quyền sở hữu từ request body.
2. Tải dữ liệu `users` (tên hiển thị, avatar) và `student_profiles` (thông tin sinh viên).
3. Nếu chưa có `student_profiles`, tạo bản ghi theo `user_id` một cách an toàn hoặc tạo khi lưu lần đầu.
4. Cho chỉnh sửa: `display_name`, `avatar_url`, `full_name`, `student_code`, `school_or_faculty`, `major`, `cohort`, `phone`, `bio`.
5. Validate độ dài, định dạng, URL ảnh và dữ liệu nhập; không áp đặt định dạng mã sinh viên/số điện thoại khi chưa có quy tắc chính thức.
6. Lưu thay đổi vào đúng bảng: thông tin tài khoản trong `users`; thông tin sinh viên trong `student_profiles`.
7. Cập nhật `updated_at` phía database hoặc bằng trigger đáng tin cậy.
8. Hiển thị trạng thái lưu thành công/lỗi và dữ liệu mới nhất.

## 7. API/điểm tích hợp dự kiến

Tên endpoint chỉ là gợi ý, cần khớp kiến trúc dự án khi triển khai:

| Hành động | Điểm tích hợp gợi ý | Quyền |
|---|---|---|
| Đăng ký | Auth sign-up | Công khai, có giới hạn tần suất |
| Đăng nhập | Auth sign-in | Công khai, có giới hạn tần suất |
| Đăng xuất | Auth sign-out | Phiên hiện tại |
| Lấy hồ sơ | `GET /users/me` hoặc truy vấn Supabase có RLS | Người dùng đã đăng nhập |
| Cập nhật hồ sơ | `PATCH /users/me` | Chỉ chủ hồ sơ |
| Gửi lại xác minh | Auth resend verification | Có giới hạn tần suất |

Không nhận `user_id` để quyết định tài khoản nào được cập nhật; server lấy ID từ danh tính đã xác thực.

## 8. Kế hoạch triển khai theo giai đoạn

### Giai đoạn A — Chốt dữ liệu và chính sách

- Xác nhận Supabase Auth, quan hệ khóa, unique constraints và RLS.
- Chốt các trường hồ sơ bắt buộc, chính sách xác minh email và phục hồi mật khẩu.
- Kiểm tra schema thực tế có constraint/trigger nào chưa xuất hiện trong bản trích xuất.

### Giai đoạn B — Backend/Auth

- Tích hợp đăng ký, đăng nhập, đăng xuất và xác minh email.
- Đồng bộ `users` và tạo hồ sơ một cách nhất quán.
- Xây dựng lấy/cập nhật hồ sơ hiện tại; validate DTO và quyền sở hữu.
- Chuẩn hóa phản hồi lỗi và giới hạn tần suất các thao tác Auth.

### Giai đoạn C — Frontend

- Tạo màn hình đăng ký và đăng nhập, trạng thái tải/lỗi/thành công.
- Thêm trang hoàn thiện/chỉnh sửa hồ sơ.
- Khôi phục phiên khi tải lại trang, điều hướng theo trạng thái xác minh và mức độ đầy đủ hồ sơ.

### Giai đoạn D — Kiểm thử và bàn giao

- Chạy kiểm thử đơn vị, tích hợp và giao diện theo checklist dưới đây.
- Kiểm tra RLS bằng ít nhất hai tài khoản khác nhau.
- Kiểm tra trên môi trường phát triển với email thử nghiệm; không dùng secret production trong frontend.

## 9. Hướng dẫn kiểm thử

### Chuẩn bị

- Dùng Supabase project/môi trường development riêng và tài khoản email thử nghiệm.
- Cấu hình URL redirect xác minh đúng origin phát triển.
- Kiểm tra biến môi trường: URL/anon key chỉ ở nơi phù hợp; service role và secret chỉ phía server.
- Dùng hai tài khoản A và B để kiểm thử phân quyền.

### Checklist chức năng

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| REG-01 | Đăng ký với dữ liệu hợp lệ | Tạo Auth user; `users` và hồ sơ liên kết đúng ID theo chính sách đã chọn. |
| REG-02 | Email sai định dạng | Hiện lỗi validation; không tạo tài khoản. |
| REG-03 | Mật khẩu không đạt chính sách/xác nhận không khớp | Báo lỗi rõ; không tạo tài khoản. |
| REG-04 | Email đã đăng ký | Không tạo bản ghi trùng; thông báo an toàn và hướng dẫn đăng nhập/khôi phục. |
| REG-05 | Gửi đăng ký liên tiếp | Không sinh hồ sơ/tài khoản trùng; thao tác có thể thử lại an toàn. |
| REG-06 | Xác minh email (nếu bật) | Chỉ sau xác minh mới được coi là verified; cập nhật `email_verified_at` chính xác. |
| LOG-01 | Đăng nhập đúng thông tin | Tạo phiên hợp lệ và tải đúng hồ sơ. |
| LOG-02 | Mật khẩu sai hoặc email không tồn tại | Thông báo chung; không rò rỉ trạng thái tài khoản. |
| LOG-03 | Tải lại trang sau đăng nhập | Phiên được khôi phục theo chính sách Auth; dữ liệu người dùng chính xác. |
| LOG-04 | Đăng xuất | Phiên bị thu hồi/xóa; trang bảo vệ yêu cầu đăng nhập lại. |
| PROF-01 | Tải hồ sơ chưa hoàn thiện | Các trường nullable hiển thị rỗng; không lỗi giao diện. |
| PROF-02 | Cập nhật đầy đủ các trường | Lưu đúng bảng và dữ liệu hiển thị lại chính xác. |
| PROF-03 | Nhập giá trị không hợp lệ/quá dài | Backend từ chối; dữ liệu cũ không bị ghi đè một phần ngoài dự kiến. |
| PROF-04 | Tài khoản A gọi cập nhật hồ sơ B | Bị từ chối; dữ liệu B không thay đổi. |
| PROF-05 | Avatar URL không hợp lệ | Bị validation từ chối hoặc báo lỗi phù hợp. |
| SEC-01 | Gửi `user_id` khác trong request | Server bỏ qua hoặc từ chối; chỉ ID trong phiên được dùng. |
| SEC-02 | Truy vấn trực tiếp qua Supabase với user A đọc/sửa B | RLS từ chối. |
| SEC-03 | Kiểm tra log và response lỗi | Không có mật khẩu, token, secret hoặc stack trace nhạy cảm. |

### Kiểm thử tự động đề xuất

- **Unit:** chuẩn hóa/validate email và hồ sơ; mapping lỗi Auth; chính sách profile completeness.
- **Backend integration:** đăng ký, đăng nhập, lấy/sửa hồ sơ với database test; xác nhận rollback hoặc retry khi đồng bộ thất bại.
- **RLS integration:** xác thực bằng user A/B để chứng minh không đọc/sửa chéo dữ liệu.
- **Frontend component:** validation biểu mẫu, trạng thái loading/error/success, hiển thị thiếu trường.
- **End-to-end:** đăng ký → xác minh (nếu bật) → đăng nhập → hoàn thiện hồ sơ → đăng xuất → đăng nhập lại.

Không ghi mật khẩu thật, token hay service role vào fixture, snapshot, log hoặc báo cáo kiểm thử.

## 10. Tiêu chí hoàn thành

- Người dùng có thể đăng ký và đăng nhập theo chính sách Auth đã chốt.
- Bản ghi `users` và `student_profiles` được liên kết đúng, không trùng.
- Người dùng xem/sửa được hồ sơ của mình và không thể truy cập hồ sơ người khác.
- Trạng thái xác minh email và phiên làm việc nhất quán.
- Checklist kiểm thử chức năng, xác thực đầu vào và RLS đạt trên môi trường phát triển.
- Có ghi nhận rõ các trường hợp chưa hỗ trợ và cách chạy kiểm thử trong hướng dẫn dự án.

## 11. Giả định và giới hạn

- Schema được cung cấp chỉ liệt kê cột; chưa xác nhận khóa chính, khóa ngoại, unique constraints, index, trigger, RLS policies hoặc cấu hình Supabase Auth.
- `organizations` chưa có liên kết rõ tới người dùng/hồ sơ, nên chưa nằm trong luồng đăng ký ban đầu.
- Cột `password_hash` có mặt nhưng chưa rõ hệ thống có dự định dùng hay không. Cần chốt một nguồn xác thực duy nhất trước khi viết code.
- Tài liệu này không thực hiện migration, thay đổi backend/frontend hay cấu hình Supabase.
