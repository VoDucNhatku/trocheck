# Bật đăng nhập Google cho TrọCheck

Mã nguồn gồm nút Google trên trang đăng nhập/đăng ký, callback cùng tên miền Vercel và
xác minh tài khoản tại FastAPI. Cần tạo OAuth Client của riêng dự án trước khi dùng thật.

## 1. Tạo OAuth Client trong Google Cloud

1. Mở <https://console.cloud.google.com/auth/overview>, chọn hoặc tạo project TrọCheck.
2. Trong Google Auth Platform, chọn **Get started** nếu chưa cấu hình. Điền tên ứng dụng,
   email hỗ trợ và email liên hệ. Đối tượng **Audience** chọn **External**.
3. Khi ứng dụng đang **Testing**, thêm Gmail dùng thử tại **Audience → Test users**.
4. Vào **Clients → Create client**, chọn **Web application**, đặt tên `TroCheck Web`.
5. Thêm **Authorized redirect URIs** chính xác:

   ```text
   https://trocheck.vercel.app/api/auth/google/callback
   ```

   Nếu cần thử ở máy cá nhân, thêm riêng:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

6. Tạo client, giữ **Client ID** và **Client Secret** để nhập vào Render. Không đưa secret
   vào GitHub, biến `NEXT_PUBLIC_*`, ảnh chụp hoặc chat. Nếu Google cung cấp file JSON,
   không lưu file đó trong thư mục repo.

Luồng này dùng chuyển hướng phía máy chủ, không dùng Google JavaScript SDK nên không cần
thêm Authorized JavaScript origins. Chỉ xin quyền `openid email`; không cần quyền Gmail,
Drive hoặc Calendar. Khi cho người ngoài nhóm thử truy cập, kiểm tra lại Audience/test users
và trạng thái xuất bản trong Google Cloud.

## 2. Đặt biến trên Render

Mở dịch vụ API đang dùng cho TrọCheck → **Environment**, thêm:

| Biến | Giá trị |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID vừa tạo, thường kết thúc bằng `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client Secret vừa tạo |
| `GOOGLE_REDIRECT_URI` | `https://trocheck.vercel.app/api/auth/google/callback` |

Giữ `COOKIE_SECURE=true` và `SECRET_KEY` hiện có. Cả ba biến Google chỉ đặt ở **Render API**.
Vercel tiếp tục dùng `API_BASE_URL` đang trỏ đến API Render; không cần đặt Client Secret ở Vercel.

Triển khai code mới cho API và web. Script khởi động API chạy `alembic upgrade head` nên tự
áp dụng migration `0003`, không phải xóa bảng hay tạo lại tài khoản. Nếu dùng Render Free,
database vẫn có thể bị tạo lại khi khởi động theo cấu hình cũ của dự án; tài khoản Google
cũng chịu giới hạn lưu trữ này.

## 3. Kiểm tra sau triển khai

1. Mở <https://trocheck.vercel.app/dang-nhap>, chọn **Tiếp tục với Google**.
2. Chọn Gmail đã thêm vào Test users, chấp nhận yêu cầu. Lần đầu tạo tài khoản `renter`;
   những lần tiếp theo nhận lại cùng tài khoản theo Google subject.
3. Mở trang tài khoản, tải lại trang để kiểm tra phiên còn hiệu lực, sau đó đăng xuất.
4. Thử hủy ở trang Google: web quay lại trang đăng nhập với thông báo và cho thử lại.

Email đã có tài khoản mật khẩu sẽ nhận thông báo yêu cầu đăng nhập bằng tên tài khoản cũ.
Phiên bản này không có chức năng liên kết hai tài khoản, không tự gộp theo email.

Nếu gặp `redirect_uri_mismatch`, đối chiếu từng ký tự giữa Google Authorized redirect URIs
và `GOOGLE_REDIRECT_URI` trên Render. Địa chỉ preview Vercel cần một cấu hình callback riêng;
địa chỉ production ở trên chỉ dành cho `trocheck.vercel.app`.

## 4. Kiểm thử trong repo

Từ `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_auth_google.py tests/test_registration.py tests/test_auth_password.py tests/test_architecture.py -q
```

Từ `apps/web`:

```powershell
npm run generate:api
npm run typecheck
npm run test:integration
$env:RENER_DIST_DIR='.next-google-auth'
npm run build
npx playwright test --config playwright.google.config.ts
```

Kiểm thử trình duyệt dùng database tạm và danh tính Google giả lập tại loopback, không gọi
Google hay dùng tài khoản thật. Đăng nhập với Google thật vẫn phải kiểm sau khi nhập cấu hình.

Kết quả ngày 31/10/2026: 49 kiểm thử API/kiến trúc, 7 kiểm thử web và 5 kiểm thử trình duyệt
đều đạt; TypeScript và production build đạt. Lượt trình duyệt dùng server loopback khởi động
riêng (`GOOGLE_AUTH_EXTERNAL_SERVERS=1`) và bản Chromium đã cài trên máy.

Ảnh kiểm tra giao diện: [máy tính, sáng](google-login-preview/desktop-light.png),
[điện thoại, sáng](google-login-preview/mobile-light.png),
[điện thoại, tối](google-login-preview/mobile-dark.png).

Tài liệu Google: <https://developers.google.com/identity/protocols/oauth2/web-server>
và <https://accounts.google.com/.well-known/openid-configuration>.
