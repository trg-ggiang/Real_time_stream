# Phase 2 — Trải nghiệm khám phá công khai

Cập nhật polish 16/11: đã chỉnh căn nét chữ hero, trình tự xuất hiện title/copy/search, reveal theo viewport, photo drift desktop, hover/focus và reduced motion; đã kiểm tra cả 320px. Xem [work log tinh chỉnh](../work-logs/2026-11-16-02-phase-04-discovery-polish.mdx). Chờ nhóm duyệt thị giác, chưa tự coi là final.

Ngày 16/11/2026. Mã nguồn triển khai trên nhánh final cục bộ; chưa commit/push. Đây là Phase 2 của kế hoạch redesign, không phải Phase 02 PoC trong roadmap cũ.

## Kết quả

- Public UI mới: home, danh sách CLB/hoạt động/bài viết, trang chi tiết có URL riêng; giữ navy/xanh và Be Vietnam Pro.
- Dữ liệu đọc thật từ view public Supabase qua NestJS. Không có fallback sang mock khi API lỗi.
- Home là bản biên tập gọn: tối đa 3 CLB trong trang dữ liệu đầu (ưu tiên có ảnh); danh sách đầy đủ không ẩn bản ghi thiếu ảnh. Không gắn nhãn nổi bật do admin chọn hoặc khẳng định đây là xếp hạng.
- Hoạt động sắp tới dùng starts_at và lifecycle scheduled, sắp xếp ngày bắt đầu tăng dần. Nếu không có thì giới thiệu hoạt động đã đăng, ghi rõ chưa có lịch tới. Không đổi ngày quá khứ thành tương lai.
- Search chạy phía server theo tên CLB hoặc tiêu đề, trước phân trang. Bộ lọc thời gian all/upcoming/past lưu trên URL. Không giả lập đã có category/organization filter.
- Public GET timeout 8 giây/lần, tối đa 3 lần khi lỗi mạng/500/502/503/504, backoff 600/1600ms; hủy khi rời trang. 400/401/403/404/429 không tự thử lại. Chỉ áp dụng GET, không lặp mutation.
- Loading, lỗi, empty, không tìm thấy, ảnh lỗi/thiếu đều có UI; URL ngoài chỉ cho HTTP(S), nội dung text không render HTML.
- Menu tài khoản chứa lối vào CLB của tôi, meeting và admin; navigation public chỉ có khám phá nội dung. Shell cá nhân/admin/CLB hoàn chỉnh thuộc Phase 3–5.

## Chạy và xem

Chạy npm install nếu mới lấy dependency; dev:backend và dev:frontend như README. Truy cập http://localhost:5173. Các route mới: /clubs, /activities, /posts và /:collection/:uuid. Login/register vẫn dùng ?mode ở đúng pathname để trở về nội dung sau auth/onboarding.

Vite dev/preview hỗ trợ SPA fallback. Khi deploy host tĩnh phải cấu hình rewrite các route frontend về index.html; /api và /socket.io vẫn về backend. Chưa deploy trong phase này.

## Ranh giới module

```text
features/guest/GuestLanding          adapter hiện tại của App/AuthApp
  ├─ discovery/DiscoveryApp          router public, layout, menu
  │   ├─ pages/                     home, list, detail
  │   ├─ components/PublicContent    ảnh, card, state, text link
  │   ├─ hooks/use-public-query      cancel và request identity
  │   ├─ services/discovery-api      contract và DTO validation
  │   ├─ types.ts                    kiểu dữ liệu công khai
  │   └─ discovery.css               CSS chỉ scope .dc-app
  └─ LegacyGuestArea                 adapter tạm cho hash my-clubs/admin
shared/api/public-http               public GET retry/timeout
shared/lib/content-format            URL và định dạng ngày tái sử dụng
```

BrowserRouter chỉ bọc public experience. Không lồng router trong legacy/auth. Bridge hash giữ workflow cũ; admin hash khởi tạo đúng khi mở trực tiếp. Phase sau di chuyển bridge sang route thật, không tiếp tục thêm nghiệp vụ vào LegacyGuestArea.

Đã thêm react-router-dom trong frontend và lockfile. Không thêm thư viện UI/state manager. Types/format tách khỏi guest legacy; các module cũ re-export để tương thích.

## Backend bổ sung

- GET /api/public/clubs/:id, /activities/:id, /posts/:id. ID validate UUID; nguồn duy nhất là view public, không fallback bảng gốc; thiếu/ẩn trả 404.
- GET list nhận q tối đa 100 ký tự và period all/upcoming/past. Period chỉ có tác dụng với activities. q tìm theo tên/tiêu đề, chưa full-text/accent-insensitive search.
- Giữ allowlist response ở cả list và detail, không trả author_id/review metadata/join_url.
- Không thay schema/RLS, không chạy SQL hoặc ghi dữ liệu live. Existing create/review endpoints không đổi nghiệp vụ.

## Dữ liệu và ảnh

Đọc public live khi kiểm tra: 6 CLB, 5 hoạt động, 3 bài viết; số lượng có thể đổi khi nhóm test. Có bản ghi nhập thử thiếu ảnh/nội dung ngắn. Home ưu tiên ảnh trong preview, trang list vẫn hiển thị đầy đủ và có fallback trung thực.

Đã chạy scripts/seed-hust-public.mjs ở dry-run: 3 CLB/3 hoạt động/3 bài, kiểm tra manifest và asset thành công; không dùng --apply, không chỉnh/xóa bản ghi của nhóm. Bộ seed cũ vốn có ID ổn định và không ghi đè dữ liệu đã chỉnh. Chưa bổ sung bộ ảnh hay bản ghi mới vì bộ hiện có đủ để triển khai và kiểm tra public frame; data/media sẽ tiếp tục được bổ sung có provenance.

Nguồn nội dung và logo/ảnh SINNO/HUROS/HBAC nằm ở data/hust-public.json, ảnh có sẵn trong frontend/public/images/hust. Không tải mới và không khẳng định có quyền tái phân phối chính thức. Ảnh hero campus-bright-1000.jpg là ảnh minh họa AI tạo trong phiên cũ, theo work log 2026-11-15-02-phase-04-bright-guest-concepts; không phải ảnh xác thực sinh viên/trường. Alt và ngữ cảnh hiện tại chỉ mô tả minh họa; kiểm tra quyền ảnh CLB trước phát hành ngoài demo.

## Kiểm tra

- Typecheck và production build backend/frontend đạt. Chunk meeting lớn là cảnh báo hiện hữu; chưa tối ưu SDK video trong phase public.
- 40 test backend và 60 test frontend đạt: giữ auth/meeting/admission/share-screen, thêm public detail/search và GET retry/cancel, cập nhật test navigation theo thiết kế mới.
- HTTP thực với Supabase: list/detail ba collection trả 200. Không thực hiện đăng ký/duyệt live để test UI.
- 34 kiểm tra trình duyệt trên 1440/768/390: home/list/detail, no results, upcoming empty, 404, search URL, mobile menu/Escape; không overflow, ảnh hỏng, JS exception hoặc loading mắc kẹt.
- Đã mở ảnh tổng hợp desktop/tablet/mobile của home/list/detail/error và kiểm tra fold/full-page home. Bộ đo giao diện cuối: 0 FAIL, 2 WARN (nhiều cỡ chữ; không video). Đây không phải chứng nhận accessibility đầy đủ.
- Screenshot/JSON/test output ở output/phase-02-discovery và output/phase-02-*.txt/json, không phải asset production.
- docs.json parse được và các trang mới có đích hợp lệ. Kiểm tra toàn navigation vẫn thấy 11 work-log cũ bị thiếu từ trước; không tạo lại hoặc xóa lịch sử ngoài phạm vi redesign.

## Critique ba vòng

ROUND 1
Seen in one second: cổng cộng đồng navy sáng, có tìm kiếm nhưng bản ghi test thiếu ảnh chiếm home.
Idea: bảng tin đời sống Bách khoa được biên tập thành cổng khám phá.
Live thing: tìm kiếm dẫn tới list dữ liệu thật, không tạo số liệu ảo.
Layout: hero=split photo / hoạt động=agenda cards / CLB=community grid / bài=featured + list / close=statement.
Scores (tự đánh giá): design 6.5 · usability 7 · creativity 6.5 · content 6 → overall 6.6, capped 6 vì inspector còn FAIL.
Top problems: ảnh home thiếu (first/desktop-page-01); copy 14px nhỏ; mobile khoảng cách khiến link section trước giống kicker. Fix: preview ưu tiên ảnh, running text 16px, giãn rõ ranh giới section.

ROUND 2
Seen in one second: hero rõ, hình CLB thật trong preview, nội dung dễ đọc hơn.
Live thing: search/filter URL và detail hoạt động.
Scores (tự đánh giá): design 7 · usability 7.5 · creativity 6.5 · content 7 → overall 7.0, capped 6 do FAIL tự động chưa được xử lý.
Top problems: ngày 01 bị nhận nhầm index trang trí; logo HUROS bị crop; khoảng cách cuối bài/CTA mobile. Fix: ngày không zero-pad, logo contain, tăng section/closing spacing. Không giấu nội dung khỏi bộ đo.

ROUND 3
Seen in one second: nền tảng CLB sinh viên; một ảnh minh họa làm trọng tâm, nội dung thật ở dưới.
Idea/live thing/layout giữ như trên; palette/type giữ theo quyết định nhóm. Hướng tham khảo page-is-the-object seed 768564933, diễn giải bảng tin; không dùng ornament invitation vì đây là khám phá cộng đồng, không thiệp sự kiện đơn lẻ.
Scores (tự đánh giá): design 7.5 · usability 8 · creativity 6.5 · content 7 → overall 7.4.
Caps/limits: originality còn gần mô hình cổng khám phá phổ biến; dữ liệu live có tên thử, một số ảnh hoạt động chỉ là logo; chưa có quyền media mới. Không tự nâng điểm để gọi award-level.
Top remaining problems: typography còn nhiều size (WARN); list đầy đủ có dữ liệu test kém chất lượng; detail tiêu đề dài mobile cần nhiều dòng để giữ nội dung. Cần biên tập dataset và feedback nhóm, không xóa/ẩn dữ liệu chỉ để ảnh chụp đẹp.

## Phạm vi còn lại

- Follow/đăng ký hoạt động chưa có API trong base: guest được đưa tới login; signed-in được báo rõ tính năng chưa ghi nhận thao tác, không success giả.
- Bộ lọc taxonomy, upload ảnh, website/fanpage riêng, đề nghị CLB revision, private channels, notification realtime chưa triển khai.
- Chưa thay shell quản lý/admin/meeting; giữ các tính năng cũ qua adapter và regression tests. Chưa gọi LiveKit thật hai thiết bị trong phase này.
- Onboarding bắt buộc vẫn giữ từ AuthApp. Guard profile backend và phân quyền hiện tại cần xử lý tiếp theo Phase 3, không coi navigation là cơ chế bảo mật.
- Phase 2 public foundation đã triển khai và kiểm tra, chờ nhóm review diện mạo. Không coi toàn dự án hoặc các phase nghiệp vụ đã hoàn tất.
