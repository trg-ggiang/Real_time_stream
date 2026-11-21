# uniCircle — Migration bổ sung tổng thể

1. Đọc docs/database/20261117-platform-migration.md, đặc biệt tác động tới API thêm member và sửa privacy.
2. Chạy supabase/verification/20261117_platform_preflight.sql (chỉ đọc).
3. Chạy TOÀN BỘ supabase/migrations/20261117000100_club_platform_extension.sql một lần trong Supabase SQL Editor bằng owner/postgres. Không chạy trên DB rỗng hoặc chạy lại schema core.
4. Chạy supabase/verification/20261117_platform_postflight.sql (chỉ đọc).

16 bảng mới, 14 RPC, 2 public projections backend-only. 84 SQL checks passed trên DB tạm. Chưa chạy live hoặc implement API/FE/worker mới. Không có seed/accounts/secrets trong gói này.
