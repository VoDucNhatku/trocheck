# Đưa TrọCheck lên mạng: Vercel (web) và Render (API)

## Vì sao chọn cách này

| Phần | Nơi chạy | Lý do |
|---|---|---|
| Web Next.js (`apps/web`) | **Vercel** | Nền tảng của chính Next.js. Đẩy code lên GitHub là tự deploy |
| API, worker và SQLite (`apps/api`) | **Render**, một container Docker có **ổ đĩa lưu trữ** | API cần chạy liên tục, và cần một tiến trình worker xử lý phân tích. SQLite cần ổ đĩa không bị xóa. Giữ SQLite thì không phải chuyển sang Postgres hay sửa code |

Trình duyệt **không gọi API trực tiếp**:
- Trang Next.js gọi API từ phía server (`API_BASE_URL`).
- Thao tác trên trình duyệt đi qua proxy `/api/workspace/*` cùng tên miền với web.
- Cookie đăng nhập là cookie của tên miền Vercel, nên không có vấn đề cookie khác tên miền.

**Đang dùng gói Free (người dùng chọn ngày 30/10/2026).** Gói này:
- không cần thẻ;
- không có ổ đĩa, nên **mỗi lần khởi động lại hay deploy lại, database được tạo lại từ đầu với dữ liệu demo**. Tài khoản tự đăng ký và bài phân tích sẽ mất;
- ngủ sau khoảng 15 phút không ai dùng.

Muốn giữ dữ liệu thì sửa `render.yaml`: đổi sang `plan: starter` và thêm `disk` (có sẵn ghi chú trong file).

**Chi phí nếu nâng cấp.** Mức giá dưới đây chưa kiểm lại trên trang giá của Render:
- Ổ đĩa trên Render chỉ gắn được vào gói trả phí (Starter, khoảng 7 USD/tháng, cộng khoảng 0,25 USD/GB ổ đĩa).
- Gói Free sẽ **mất database mỗi lần khởi động lại** và ngủ sau khoảng 15 phút.
- Vercel gói Hobby miễn phí cho dự án cá nhân.

## Các file đã có trong repo

- `apps/api/Dockerfile`: dựng image API, giữ nguyên cấu trúc repo dưới `/srv` (vì `config.py` tìm `spec/`, `eval/`, `data/` theo đường dẫn tương đối).
- `apps/api/deploy/start.sh`, chạy theo thứ tự:
  1. `init-db` (alembic upgrade).
  2. `seed` dữ liệu demo **một lần** cho mỗi ổ đĩa.
  3. Vòng lặp worker, tự chạy lại nếu chết.
  4. `uvicorn` trên `$PORT`. Tiến trình API **không** nhận `GEMINI_API_KEY`; key chỉ dành cho worker.
- `render.yaml`: Blueprint của Render, gồm dịch vụ `trocheck-api` ở vùng Singapore, ổ 1 GB gắn ở `/srv/data`, health check `/api/v1/health`.
- `.dockerignore`: không đưa `.env`, `data/*`, `node_modules`, `.next*` hay `apps/web` vào image.

## Bước 1. Render (API)

1. Đăng nhập <https://render.com> bằng tài khoản GitHub `VoDucNhatku`. Cho Render quyền đọc repo **trocheck**.
2. **New → Blueprint**, chọn repo `trocheck`, nhánh `main`. Render đọc `render.yaml`.
3. Điền các biến `sync: false`:

   | Biến | Giá trị |
   |---|---|
   | `SEED_PASSWORD` | Mật khẩu **dài và riêng**. Đây là mật khẩu của mọi tài khoản demo, kể cả `admin`. Không gửi vào chat |
   | `ALLOWED_ORIGINS` | Tạm để `https://trocheck.vercel.app`, sửa lại sau bước 2 |
   | `PASSWORD_RESET_BASE_URL` | Giống `ALLOWED_ORIGINS` |
   | `GEMINI_API_KEY`, `GEMINI_MODEL_ID` | Không bắt buộc. Để trống thì phân tích chỉ chạy Regex |

4. Chờ deploy xong. Mở `https://<tên-dịch-vụ>.onrender.com/api/v1/health`, phải thấy `{"status":"ok","demo_mode":true}`.

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
- Đăng nhập `admin` bằng `SEED_PASSWORD`. Mở Hàng duyệt, Kho, Kiểm tra.
- Phân tích một bài mới. Trạng thái phải chuyển sang "đã xong" (worker đang chạy).
- Mở trên điện thoại, ở cả chế độ sáng lẫn tối.

## Lưu ý

- Repo `trocheck` là **riêng tư**. Repo gốc `rener-vn` không bị động tới (remote `origin` vẫn trỏ về đó, còn remote mới là `trocheck`).
- Dữ liệu demo lấy từ `spec/fixtures` cộng bài sinh tự động, không có dữ liệu thật. **Không** đưa `data/gold` hay dữ liệu cào thật lên server công khai.
- Muốn dựng lại dữ liệu demo: xóa file `/srv/data/.seeded` và database trong Render Shell, rồi deploy lại.
- Cùng `Dockerfile` này chạy được trên nơi khác có ổ đĩa lưu trữ (Railway, Fly.io, máy ảo), nếu sau này đổi nhà cung cấp.
