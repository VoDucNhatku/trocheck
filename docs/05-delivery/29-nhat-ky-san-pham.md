# Nhật ký sản phẩm TrọCheck

Ghi lại những gì đã đưa lên bản thật, những gì đã kiểm, và những việc còn thiếu. Mốc mới nhất ở trên.

## Bản thật hiện tại

- Web: `https://trocheck.vercel.app` (Vercel, dựng từ `main`).
- API: `https://trocheck-api.onrender.com` (Render Free, Docker, dựng từ `main`).
- Database: Neon PostgreSQL miễn phí, vùng Singapore, migration tới `0006`.
- Cờ trên Render: `DEMO_MODE=true`, `REVIEW_BOT_ENABLED` tắt.
- Extension TrọCheck Collector 0.3.1, tải ở trang `/extension`.

## 13/11/2026

### Đã đưa lên bản thật

| PR | Nội dung |
|---|---|
| #9 | API chạy trên PostgreSQL (Neon), dữ liệu bền qua khởi động lại; bot duyệt chạy song song (mặc định tắt); danh mục 168 phường, xã TP. Hồ Chí Minh theo Quyết định 19/2025/QĐ-TTg. |
| #10 | Nhận ra phường từ phường cũ và quận cũ trong bài theo Nghị quyết 1685/NQ-UBTVQH15 (440 đơn vị cũ). Ví dụ "phường 25, Bình Thạnh" ra Phường Thạnh Mỹ Tây. Phường cũ bị chia, phường số không kèm quận, bài chỉ ghi quận thì không gán và chuyển duyệt. |
| #11 | Trang Tài khoản hiện đúng tài khoản Google (email, trạng thái đã kết nối, ẩn đổi mật khẩu); giới hạn số lần đăng nhập; worker chờ lâu hơn khi rảnh; CI cho pull request; hướng dẫn sao lưu Neon. |

### Đã kiểm trên bản thật

- Render và Vercel triển khai thành công cho từng PR; `/api/v1/health` trả 200.
- Dữ liệu trên Neon giữ nguyên sau khi máy chủ ngủ rồi khởi động lại.
- Extension kết nối được với tài khoản Google bằng một nút trên trang Tài khoản; mã kết nối được dùng để gửi bài lên máy chủ thật.
- Trang Tài khoản hiện email Google và trạng thái "Đã kết nối".

### Kết quả kiểm thử khi gộp PR #11

- API trên SQLite: 628 đạt, 2 bỏ qua. API trên PostgreSQL: 630 đạt.
- import-linter: 3 hợp đồng giữ. Web: typecheck đạt, 46 test đạt.
- Nhận diện phường, bộ 60 tin thử có 30 tin bẫy: 30 mã đúng, 0 phường sai.

### Chưa kiểm

- Số bài thật đã vào database (tài khoản thường không có quyền xem kho).
- Gemini thật trên bài thật, độ chính xác của bot duyệt.
- Tên hiển thị Google cập nhật ở lần đăng nhập kế tiếp.

## Còn thiếu để người dùng mới dùng trọn luồng

Luồng mong muốn: cài extension, lướt nhóm Facebook, bài tự lưu và tự gửi lên web, người dùng xem lại bài của mình và kiểm tra giá.

1. **Trang "Bài của tôi".** Mọi tài khoản đã đăng nhập xem được bài mình đã gửi: giá, diện tích, phường đã tách, so với giá khu vực, trạng thái (đã nhận, chờ duyệt, đã công khai). Hiện tài khoản thường gửi được bài nhưng không xem lại được.
2. **Tắt chế độ demo** trên Render để bài thật đã duyệt hiện ở Tìm trọ, Thị trường và trang chủ (trang chủ đang có số liệu mẫu cố định).
3. **Bật bot duyệt** (`REVIEW_BOT_ENABLED=true`) và thêm màn hình xem kết quả bot, để một người quản lý đủ vận hành. Mỗi lượt bot là một lượt gọi Gemini.

## Việc vận hành và bảo vệ còn mở

- Tài khoản mẫu `admin` trên Neon vẫn dùng mật khẩu mẫu và có quyền quản trị: đổi mật khẩu hoặc bỏ quyền.
- Worker hỏi database tối đa mỗi 60 giây khi rảnh, chưa đủ để Neon Free tự ngủ sau 5 phút; cần cơ chế đánh thức giữa API và worker.
- Giới hạn đăng nhập lưu trong bộ nhớ một tiến trình, mất khi khởi động lại.
- Chưa có màn hình cấp vai trò cho tài khoản.
- Chưa cấu hình ESLint cho web.
- Gửi email đặt lại mật khẩu chưa có nhà cung cấp; danh mục phường Hà Nội chưa nạp; nhận diện bài chỉ ghi quận chưa có.
- Các số do nhóm tự chọn, cần chủ dự án xác nhận: 600 ảnh mỗi ngày, 2.000 lượt Gemini mỗi ngày, bot 500 lượt mỗi ngày, bot chờ tối đa 20 giây, tài khoản thường 200 bài mới mỗi ngày.
