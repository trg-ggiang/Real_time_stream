# Sơ đồ hệ thống uniCircle

Đối chiếu mã nguồn hiện tại ngày 16/11/2026, sau Phase 5 và sửa điều hướng mặc định của admin. Các file .mmd chứa Mermaid thuần, không có hàng rào Markdown, có thể copy toàn bộ vào draw.io.

## Các sơ đồ

1. 01-screen-navigation.mmd: chuyển màn hình công khai, xác thực, hồ sơ, cá nhân và admin; lối vào workspace/meeting.
2. 02-workspace-meeting-navigation.mmd: màn hình sinh hoạt, quản lý CLB và phòng họp. Các đường dẫn /posts, /members, /review... trong phần workspace đều có tiền tố /workspace/:clubId; :kind là posts hoặc activities.
3. 03-system-business-flow.mmd: luồng nghiệp vụ từ guest đến tài khoản; quan tâm, đăng ký hoạt động, đề nghị/duyệt CLB, xuất bản nội dung và meeting.
4. 04-system-architecture.mmd: React, NestJS, Supabase, Socket.IO, LiveKit Cloud và vai trò của HTTPS tunnel.

File all-diagrams.md chứa cùng bốn sơ đồ dưới dạng code block để xem/tài liệu hóa. Khi import draw.io, dùng từng .mmd riêng và đặt mỗi sơ đồ ở một page; không dán cả bốn block vào cùng một hộp Mermaid.

## Cách đưa vào draw.io

- Mở file .mmd, copy toàn bộ nội dung bắt đầu từ flowchart.
- Trong draw.io: Arrange → Insert → Mermaid; hoặc nút + trên thanh công cụ → Mermaid.
- Dán nội dung, chọn Diagram nếu muốn các khối/đường nối chỉnh sửa được, rồi Insert.
- Không kèm các dòng ```mermaid và ``` nếu copy từ Markdown.
- Nếu bản draw.io đang dùng có vị trí menu khác, tìm chức năng Mermaid trong nhóm Insert.

Hướng dẫn chính thức: https://www.drawio.com/docs/manual/mermaid/

## Quy ước

- Hình chữ nhật: màn hình hoặc bước xử lý.
- Hình thoi: điều kiện hoặc quyết định.
- Hình trụ: database.
- Mũi tên liền: điều hướng hoặc dòng xử lý chính; không có nghĩa các tác vụ phải tự chạy nếu người dùng chưa xác nhận.
- Mũi tên nét đứt: ghi chú hoặc nhánh lỗi giải thích.
- Sơ đồ 01/02 là navigation; 03 là nghiệp vụ; 04 là kiến trúc. Không coi mọi khối nghiệp vụ là một trang UI riêng.

## Những điểm cần hiểu đúng

- Guest chỉ đọc nội dung public. Quan tâm, đăng ký hoạt động, đề nghị CLB và meeting cần account/profile phù hợp.
- Đăng ký tạo account, rồi bắt buộc hoàn thiện student profile. Không có bước xác thực email thật trong flow đang mô tả.
- Mặc định sau auth/profile từ trang gốc: admin vào /admin, sinh viên vào /me. Có deep link thì giữ trang đích cụ thể, không ép admin rời mọi trang public/cá nhân. Khối Resume minh họa bằng hai trang public; nguyên tắc áp dụng cho các deep link hợp lệ khác nữa.
- Role admin là quyền nền tảng; chairperson/member là quyền theo từng CLB; host/moderator là quyền trong meeting. Ba phạm vi không thay thế nhau.
- Chủ nhiệm tạo hoạt động được đăng ngay bằng chuỗi submit rồi approve; hai bước này không phải một transaction duy nhất. Bài viết vẫn qua bước duyệt rõ ràng.
- Các bước approve/submit/edit có expected_updated_at; bản cũ hoặc trạng thái đã đổi phải tải lại, không ghi đè.
- CLB pending được DB trigger khởi tạo cấu trúc nhưng chỉ mở workspace khi published và membership active. Approval không tạo/xóa bù membership.
- Hoạt động hiện public; bài viết có public/internal. Member CLB không tự động là người đã đăng ký hoạt động.
- Khi sửa nội dung đã đăng, bản hiện tại về draft và ẩn khỏi public tới khi duyệt lại; chưa có revision giữ hai phiên bản song song.
- is_private của ban mới chuẩn bị cho channel; chưa có chat ban hoặc tuyển dụng trong phạm vi hiện tại.
- Meeting mở từ workspace hiện chưa có club_id trong DB, không phải danh sách phòng thuộc CLB. Khi rời phòng quay lại công cụ họp; thoát công cụ mới quay về nơi mở trước đó.
- Media camera/mic/screen được truyền qua LiveKit Cloud. Giơ tay sử dụng cơ chế đồng bộ của module LiveKit; chat meeting đi qua Socket.IO/NestJS và meeting_messages trong Supabase.
- Kết thúc meeting làm mất quyền chat theo phiên; các sơ đồ không khẳng định bản ghi meeting_messages được xóa vật lý khỏi DB.
- HTTPS tunnel phục vụ đường vào app/API/Socket.IO đang chạy local. Máy chạy app, backend và tunnel vẫn phải hoạt động; media không chạy vòng qua tunnel.
- Kiểm tra cú pháp bằng Mermaid 11.4.1: 4/4 passed. Chưa thực hiện thao tác import trên ứng dụng draw.io của người dùng. Không thay source ứng dụng hoặc DB trong yêu cầu này.
