# ADR-0007: PostgreSQL trên Neon, giữ SQLite cục bộ

Trạng thái: Đã chốt (2026-11-12, chủ dự án chọn Neon; triển khai và kiểm chứng ngày 2026-11-13).

## Bối cảnh

Render Free không có ổ đĩa lưu trữ bền vững. SQLite trong container bị tạo lại khi khởi động,
làm mất tài khoản và bài người dùng gửi. Cần giữ dữ liệu độc lập với vòng đời container.

## Các lựa chọn

- Giữ SQLite trong container: phù hợp cục bộ, không đáp ứng lưu dữ liệu trên Render Free.
- Dùng PostgreSQL trên Neon cho môi trường triển khai, giữ SQLite cho phát triển và test mặc định.

## Quyết định

Chủ dự án chọn phương án Neon. Đặt `DATABASE_URL` trong Render Dashboard sau khi mã hỗ trợ được
triển khai; không đưa thông tin kết nối vào chat hoặc git. URL PostgreSQL được chuẩn hóa sang
psycopg 3, kiểm tra kết nối trước khi dùng, tái tạo kết nối sau 300 giây và tắt prepared statements.
Migration giữ nguyên các revision `0001`–`0004`; `0005` bổ sung lịch sử bot duyệt trên cả hai hệ.
SQLite tiếp tục dùng WAL và các PRAGMA hiện có.

Khởi động chạy migration, `ensure-admin`, rồi seed nếu bật demo và có mật khẩu seed.
Cả hai lệnh tạo tài khoản đều giữ nguyên mật khẩu và vai trò tài khoản đã tồn tại.
Seed dùng `external_post_id` ổn định và ràng buộc duy nhất theo loại nguồn/ID, nên chạy lại sau purge
khóa idempotency không tạo thêm bài demo. Demo cũ chưa có ID được nhận lại theo loại nguồn và hash
văn bản đã che số để gán ID; không thay ngày, nội dung hoặc listing. Seed chỉ xử lý job trích xuất demo,
giữ nguyên job thật đang chờ; không phụ thuộc tệp đánh dấu trên đĩa container.
`SEED_PASSWORD` chỉ áp dụng tài khoản demo mới. `ADMIN_USERNAME=admin` được tạo trước seed sẽ giữ
`ADMIN_PASSWORD`. Nếu `ensure-admin` từ chối mật khẩu, lệnh trực tiếp vẫn thoát khác 0; `start.sh`
ghi một dòng không chứa mật khẩu và tiếp tục khởi động API/worker.

## Hệ quả

Dữ liệu PostgreSQL tồn tại qua lần khởi động lại của container. Render vẫn dùng gói Free và ngủ
sau khoảng 15 phút không hoạt động. Bộ test chạy trên cả hai hệ; test PostgreSQL chỉ được trỏ
vào database thử nghiệm vì sẽ xóa schema `public` trước mỗi test dùng database.

Theo thông tin Neon Free đã được điều phối viên đọc ngày 2026-11-12: mỗi dự án có 1 GB lưu trữ,
100 CU-giờ mỗi tháng; compute về 0 sau 5 phút không hoạt động. Vượt giới hạn sẽ tạm dừng compute
đến kỳ tiếp theo, không xóa dữ liệu. Worker thăm dò database mỗi giây và health check chạy
`SELECT 1`, nên Neon vẫn thức khi phiên Render đang thức.

## Xem lại khi

Giới hạn lưu trữ hoặc compute không còn đủ, hoặc cần thay đổi lịch chạy worker và health check.
Các bước cấu hình của chủ dự án nằm trong [hướng dẫn triển khai](../05-delivery/25-host-vercel-render.md#database-trên-neon).
