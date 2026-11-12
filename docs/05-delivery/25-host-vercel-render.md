# Đưa TrọCheck lên mạng: Vercel (web) và Render (API)

## Vì sao chọn cách này

| Phần | Nơi chạy | Lý do |
|---|---|---|
| Web Next.js (`apps/web`) | **Vercel** | Nền tảng của chính Next.js. Đẩy code lên GitHub là tự deploy |
| API và worker (`apps/api`) | **Render**, một container Docker | Worker xử lý phân tích; database PostgreSQL đặt riêng trên Neon để giữ dữ liệu |

Trình duyệt **không gọi API trực tiếp**:
- Trang Next.js gọi API từ phía server (`API_BASE_URL`).
- Thao tác trên trình duyệt đi qua proxy `/api/workspace/*` cùng tên miền với web.
- Cookie đăng nhập là cookie của tên miền Vercel, nên không có vấn đề cookie khác tên miền.

**Tiếp tục dùng Render Free.** Gói này không có ổ đĩa lưu trữ bền vững và ngủ sau khoảng
15 phút không ai dùng. Khi `DATABASE_URL` trỏ tới PostgreSQL trên Neon, dữ liệu nằm ngoài
container và được giữ qua lần khởi động lại hoặc triển khai lại. Nếu vẫn dùng SQLite trong
container thì dữ liệu SQLite tiếp tục mất khi container bị tạo lại.

## Các file đã có trong repo

- `apps/api/Dockerfile`: dựng image API, giữ nguyên cấu trúc repo dưới `/srv` (vì `config.py` tìm `spec/`, `eval/`, `data/` theo đường dẫn tương đối).
- `apps/api/deploy/start.sh`, chạy theo thứ tự:
  1. `init-db` (alembic upgrade).
  2. `ensure-admin` tạo quản trị viên nếu chưa có tài khoản cùng tên.
  3. `seed` khi `DEMO_MODE=true` và có `SEED_PASSWORD`; chạy lại không tạo trùng và không đổi tài khoản đã có.
  4. Vòng lặp worker, tự chạy lại nếu chết.
  5. `uvicorn` trên `$PORT`. Tiến trình API **không** nhận `GEMINI_API_KEY`; key chỉ dành cho worker.
- `render.yaml`: Blueprint của Render, gồm dịch vụ `trocheck-api` ở vùng Singapore, gói Free và health check `/api/v1/health`.
- `.dockerignore`: không đưa `.env`, `data/*`, `node_modules`, `.next*` hay `apps/web` vào image.

## Bước 1. Render (API)

1. Đăng nhập <https://render.com> bằng tài khoản GitHub `VoDucNhatku`. Cho Render quyền đọc repo **trocheck**.
2. **New → Blueprint**, chọn repo `trocheck`, nhánh `main`. Render đọc `render.yaml`.
3. Điền các biến `sync: false`:

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | Chuỗi kết nối trực tiếp Neon, chỉ nhập sau khi mã hỗ trợ PostgreSQL đã triển khai; xem phần bên dưới |
   | `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Tài khoản quản trị đầu tiên; cần cả hai biến. Mật khẩu cần 8–200 ký tự và ít nhất một chữ hoa. Tên đã tồn tại thì giữ nguyên mật khẩu/vai trò. Mật khẩu bị từ chối: lệnh `ensure-admin` trực tiếp thoát khác 0; `start.sh` ghi một dòng không chứa mật khẩu và tiếp tục API/worker |
   | `SEED_PASSWORD` | Mật khẩu dài và riêng, chỉ dành cho tài khoản demo mới. Nếu `ADMIN_USERNAME=admin` đã tạo trước seed, `admin` giữ `ADMIN_PASSWORD`; các tài khoản đã có luôn giữ mật khẩu riêng. Không gửi mật khẩu vào chat |
   | `ALLOWED_ORIGINS` | Tạm để `https://trocheck.vercel.app`, sửa lại sau bước 2 |
   | `PASSWORD_RESET_BASE_URL` | Giống `ALLOWED_ORIGINS` |
   | `GEMINI_API_KEY`, `GEMINI_MODEL_ID` | Không bắt buộc. Để trống thì phân tích chỉ chạy Regex |

4. Chờ deploy xong. Mở `https://<tên-dịch-vụ>.onrender.com/api/v1/health`, phải thấy `{"status":"ok","demo_mode":true}`.

## Database trên Neon

1. Chờ mã hỗ trợ PostgreSQL trong thay đổi này được triển khai thành công lên Render.
2. Chủ dự án tạo dự án trên Neon, chọn vùng Singapore nếu được cung cấp.
3. Sao chép chuỗi kết nối trực tiếp (direct connection string) trong Neon; giữ nguyên tham số SSL.
4. Trong Render Dashboard, mở dịch vụ API → Environment, nhập chuỗi đó vào `DATABASE_URL`,
   rồi lưu và triển khai lại. Chỉ nhập tại dashboard; không gửi chuỗi vào chat hoặc ghi vào git.
5. Điền `ADMIN_USERNAME` và `ADMIN_PASSWORD` nếu cần tài khoản quản trị đầu tiên.
   Thiếu một biến thì `ensure-admin` không làm gì và thoát thành công. Nếu tên đã tồn tại,
   lệnh không đổi mật khẩu hoặc vai trò, kể cả khi tài khoản chưa có quyền quản trị.
6. Kiểm tra health, đăng nhập và số tin; triển khai lại để xác nhận tài khoản và bài vẫn còn.

Migration tạo schema trên PostgreSQL khi khởi động; bước này không chuyển dữ liệu từ SQLite cũ.
Không đổi `DEMO_MODE` trong Blueprint. Seed chỉ dùng mật khẩu cấu hình cho tài khoản demo mới,
không đổi mật khẩu/vai trò tài khoản đã có. ID ngoài ổn định và ràng buộc duy nhất theo loại nguồn/ID
ngăn tạo lại bài demo kể cả sau purge khóa idempotency; dữ liệu demo cũ được nhận lại theo hash văn bản
đã che số và loại nguồn để gán ID. Seed chỉ xử lý job trích xuất demo, giữ nguyên job thật đang chờ.

Theo thông tin Neon Free được điều phối viên đọc ngày 2026-11-12: mỗi dự án có 1 GB lưu trữ
và 100 CU-giờ mỗi tháng; compute về 0 sau 5 phút không hoạt động. Vượt giới hạn sẽ tạm dừng
compute đến kỳ tiếp theo và không xóa dữ liệu. Giới hạn vận hành hiện tại: worker thăm dò
database mỗi giây, health check chạy `SELECT 1`, nên Neon vẫn thức khi phiên Render đang thức.

## Bước 2. Vercel (web)

1. Đăng nhập <https://vercel.com> bằng GitHub. Chọn **Add New → Project**, import repo `trocheck`.
2. **Root Directory**: `apps/web`. Framework tự nhận là Next.js.
3. Environment Variables (đều chỉ dùng ở server, **không** đặt tiền tố `NEXT_PUBLIC_`):

   | Biến | Giá trị |
   |---|---|
   | `API_BASE_URL` | `https://<tên-dịch-vụ>.onrender.com/api/v1` |
   | `API_TIMEOUT_MS` | `8000` |

4. Settings → Functions → Function Region: chọn **Singapore (sin1)** cho gần API.
5. Deploy. Lấy URL thật (ví dụ `https://trocheck-xxx.vercel.app`), quay lại Render, sửa `ALLOWED_ORIGINS` và `PASSWORD_RESET_BASE_URL` theo URL đó. Render sẽ tự deploy lại.

## Bước 3. Kiểm sau khi lên mạng

Để bật Google login, làm thêm [thiết lập Google OAuth](26-google-login.md).

- Mở trang chủ, Tìm trọ, một tin, Thị trường khi **chưa đăng nhập**. Phải có dữ liệu demo.
- Đăng nhập `admin` bằng `ADMIN_PASSWORD` nếu `ADMIN_USERNAME=admin` đã tạo trước seed; nếu đây là tài khoản demo mới do seed tạo, dùng `SEED_PASSWORD`. Mở Hàng duyệt, Kho, Kiểm tra.
- Phân tích một bài mới. Trạng thái phải chuyển sang "đã xong" (worker đang chạy).
- Mở trên điện thoại, ở cả chế độ sáng lẫn tối.

## Lưu ý

- Repo `trocheck` là **riêng tư**. Repo gốc `rener-vn` không bị động tới (remote `origin` vẫn trỏ về đó, còn remote mới là `trocheck`).
- Dữ liệu demo lấy từ `spec/fixtures` cộng bài sinh tự động, không có dữ liệu thật. **Không** đưa `data/gold` hay dữ liệu cào thật lên server công khai.
- Không còn dùng `/srv/data/.seeded`. Khởi động lại sẽ kiểm tra dữ liệu trong database và giữ nguyên dữ liệu đã có.
