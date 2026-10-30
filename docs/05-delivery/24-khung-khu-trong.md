# Bàn giao bản thử khung khu trong — Codex số 4

Ngày kiểm: 28/10/2026. Phạm vi: mục 2 của `.tmp/codex-task-04-khung-khu-trong.md`.

## Kết quả

Khung có sidebar tối 240px, logo ReNER gạch dạ quang, ba nhóm điều hướng, mục hiện tại có vạch vàng 3px và `aria-current="page"`, link Về trang chủ, topbar nền giấy và menu tài khoản. 768–1023px dùng sidebar icon 64px có tooltip khi hover/focus; dưới 768px dùng dialog từ trái có lớp phủ tối.

Menu dùng `hasRole`: renter chỉ thấy Đọc tin + Cá nhân; collector thêm Kho; reviewer thêm Kho + Hàng duyệt; researcher thêm Kiểm tra trích xuất + Đánh giá; admin thấy toàn bộ mục hiện có. Quyền phía server và API vẫn được giữ.

Menu tài khoản có tên, vai trò, Tài khoản, Về trang chủ, đường kẻ và Đăng xuất thật. Enter/Space mở; Esc đóng và trả focus; bấm ngoài đóng. Mobile giữ Tab/Shift+Tab trong dialog, khóa cuộn nền, đóng bằng Esc, nút đóng, lớp phủ, chuyển route hoặc tăng màn hình lên tablet. Chuyển động khung chỉ dùng transform/opacity, 200ms; giảm chuyển động tắt animation/transition.

Route mới `/team/kiem-tra` giữ đúng `requireUser('/team/kiem-tra', ['researcher'])`. `/team/lab` trả **HTTP 308**, giữ query tiếng Việt và query nhiều giá trị. Đổi chữ hiển thị trong sidebar, breadcrumb, metadata, trang kiểm tra và link từ Đánh giá. Tên component/file `Lab.tsx`, kiểu dữ liệu và API `lab/run`, `lab/gold` giữ nguyên.

## File tạo/sửa trong lượt này

Đường dẫn dưới đây tính từ gốc workspace. Workspace đã có nhiều thay đổi trước khi nhận việc; bảng chỉ liệt kê phần Codex số 4 thực hiện.

| File | Thay đổi |
|---|---|
| `apps/web/src/features/workspace/Shell.tsx` | Menu tập trung theo vai trò, sidebar, breadcrumb, tài khoản, dialog mobile và xử lý focus |
| `apps/web/src/features/workspace/workspace.module.css` | Style khung, breakpoint 1024/768, tooltip, focus và chuyển động; không xóa/đổi tên class cũ |
| `apps/web/src/styles/tokens.css` | Token nền khung và `[data-workspace-chrome]` theo landing; token nội dung trang hiện có được giữ |
| `apps/web/src/app/(workspace)/team/kiem-tra/page.tsx` **mới** | Route, metadata và guard researcher |
| `apps/web/src/app/(workspace)/team/lab/page.tsx` | Redirect dự phòng, nối lại query |
| `apps/web/next.config.ts` | Redirect vĩnh viễn trước khi layout bắt đầu streaming |
| `apps/web/src/features/workspace/Lab.tsx` | Chỉ đổi tên hiển thị và tên vùng trợ năng |
| `apps/web/src/features/workspace/Evaluation.tsx` | Đổi chữ và đích link kiểm tra |
| `apps/web/tests/browser/shell.spec.ts` **mới** | 9 test khung, ảnh và đo tương phản |
| `apps/web/tests/browser/research.spec.ts` | Route/tiêu đề mới và test 308 giữ query |
| `apps/web/tests/browser/interior.spec.ts` | Kỳ vọng nền khung mới `rgb(244, 241, 234)` |
| `apps/web/tests/browser/redesign.spec.ts` | Chọn đúng link Tài khoản khi popover có hai link |
| `apps/web/playwright.interior.config.ts` | Thêm `shell.spec.ts` vào bộ interior |
| `docs/05-delivery/24-khung-khu-trong.md` **mới** | Báo cáo này |

Style logo mới được giới hạn trong sidebar/dialog vì trang đăng nhập cũng dùng class `brand`. Không sửa nội dung các trang khác ngoài phần đổi tên được giao. Không sửa backend, API sinh tự động, landing, SiteHeader, SiteFooter hay bản gốc ổ D. Các thay đổi tự sinh thêm đường dẫn codex4 vào `tsconfig.json` đã được gỡ, giữ danh sách include ban đầu.

## Lệnh chạy và kết quả thật

### API thử — chạy từ `apps/api`

```powershell
.venv\Scripts\python.exe -c "import runpy,uvicorn; m=runpy.run_path('../web/tests/serve-interior.py'); uvicorn.run(m['app'], host='127.0.0.1', port=18006)"
```

Kết quả: `Application startup complete`, lắng nghe `127.0.0.1:18006`. Dùng SQLite tạm, dữ liệu seed tự tạo, worker Regex; script xóa cấu hình Gemini trong môi trường thử. Cách chạy được giao hoạt động, không cần cách thay thế. Mật khẩu test nằm trong `.tmp/interior-test-credentials.json`, không in ra log/báo cáo.

### Web — chạy từ `apps/web`

```powershell
$env:RENER_DIST_DIR='.next-codex4-prod'
$env:API_BASE_URL='http://127.0.0.1:18006/api/v1'
npm run typecheck
npm run build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3017
```

- `npm run typecheck`: **exit 0**, `tsc --noEmit`, không lỗi.
- `npm run build`: **exit 0**, bản cuối `Compiled successfully in 9.4s`, kiểm kiểu và sinh trang thành công; bảng route có cả `/team/kiem-tra` và `/team/lab`.
- Production: `Ready in 1234ms`, chạy với output riêng `.next-codex4-prod`.

### Playwright — chạy từ `apps/web`, Chrome cài trên máy

```powershell
$env:PW_CHANNEL='chrome'
$env:INTERIOR_WEB='http://127.0.0.1:3017'
$env:INTERIOR_API='http://127.0.0.1:18006'
npx playwright test --config playwright.interior.config.ts
```

Kết quả cuối: **26 passed (1.2m), 0 failed**, exit 0. Bao gồm 12 interior, 5 redesign và 9 shell. Test khung kiểm cả collector ngoài bốn vai trò bắt buộc, chiều rộng sidebar, tooltip, `aria-current`, menu bàn phím/chuột, focus trong dialog, Esc trả focus, lớp phủ, chuyển trang, resize, không tràn ngang và luồng đăng nhập từ trang chủ rồi quay lại.

```powershell
$env:PW_CHANNEL='chrome'
$env:RESEARCH_WEB='http://127.0.0.1:3017'
$env:RESEARCH_API='http://127.0.0.1:18006/api/v1'
npx playwright test --config playwright.research.config.ts
```

Kết quả cuối: **15 passed (22.6s), 0 failed**, exit 0. Có kiểm quyền anonymous/renter/admin, chức năng kiểm tra hiện có, đánh giá và test redirect 308 giữ `tag=a&tag=b` cùng query tiếng Việt.

Trước khi sửa, lần chạy đầy đủ đầu tiên có **interior 25 pass / 1 fail** và **research 13 pass / 2 fail**. Hai kỳ vọng còn giữ route/màu cũ đã được cập nhật. Lỗi còn lại là `permanentRedirect` trong page bị streaming thành HTTP 200; cấu hình `redirects()` của Next xử lý trước render đã sửa thành 308, được test HTTP trực tiếp xác nhận. Sau sửa đã chạy lại toàn bộ hai bộ trên production, không bỏ qua test.

Lần chạy riêng khung ban đầu: **9 passed (15.6s)**. Có cảnh báo môi trường `NO_COLOR` bị `FORCE_COLOR` ghi đè; không có test bị skip. `git diff --check` trên các file đã sửa: exit 0, không lỗi whitespace (Git có cảnh báo chuẩn hóa LF/CRLF). Kiểm tập tên class trước/sau: `Removed CSS classes: []`.

## Ảnh đã mở xem

Thư mục: `.tmp/codex4-shots/`. Đã mở từng PNG của bản cuối, không chỉ tạo ảnh. Các ảnh vai trò chụp tại trang Phân tích với dữ liệu chưa nhập; phần nội dung giữ bản hiện có.

| Vai trò/trạng thái | File đã xem |
|---|---|
| Renter | `renter-1440.png`, `renter-1024.png`, `renter-768.png`, `renter-390.png` |
| Reviewer | `reviewer-1440.png`, `reviewer-1024.png`, `reviewer-768.png`, `reviewer-390.png` |
| Admin | `admin-1440.png`, `admin-1024.png`, `admin-768.png`, `admin-390.png` |
| Menu tài khoản mở | `account-open-1440.png` |
| Ngăn kéo mobile mở | `drawer-open-390.png` (viewport 390 × 844) |

Nhận xét: sidebar tối, gạch NER vàng, topbar giấy, tên tiếng Việt và menu vai trò hiện đúng; không thấy chữ va nhau/cắt dấu hay tràn ngang. 1024 vẫn đủ sidebar 240px; 768 là cột 64px; 390 dùng nút menu và dialog. Menu tài khoản đã chụp ở trạng thái animation kết thúc để nhìn đúng nền đặc; ảnh dialog chụp viewport để lớp phủ tương ứng màn hình.

Đo màu thật từ computed styles của khung, ghi trong `shell-contrast.json`:

| Cặp chữ/nền | Tương phản |
|---|---:|
| `#F4F1EA` / `#111214` | 16,62:1 |
| `#BDB9AE` / `#111214` | 9,56:1 |
| `#F4F1EA` / `#1A1B1E` | 15,27:1 |
| `#15161A` / `#F4F1EA` | 16,03:1 |
| `#6B675E` / `#FFFDF8` | 5,54:1 |
| `#15161A` / `#FFE14D` | 13,89:1 |

## Chỗ thêm một dòng cho các mục sau

Trong `apps/web/src/features/workspace/Shell.tsx`, mảng **`NAVIGATION`** ở đầu file là nơi thêm một dòng cấu hình cho mỗi đích khi backend/route tương ứng đã có. Nhóm, nhãn, icon, href và roles nằm cùng một dòng; renderer và lọc `hasRole` dùng chung cho sidebar desktop/mobile.

- **Nguồn cào**: thêm một dòng nhóm `Khu nhóm` khi đã có route/API và quyền được chốt. Bản thử không tự quyết quyền nghiệp vụ cho tính năng chưa làm.
- **Người dùng**: thêm một dòng nhóm `Khu nhóm`, `roles: ['admin']` khi backend/route sẵn sàng.
- **Thông báo**: thêm một dòng nhóm `Cá nhân` khi backend/route sẵn sàng.
- **Chuông**: trong topbar có comment `Future notification bell` ngay trước nút tài khoản; đây là chỗ cắm một dòng JSX của component chuông đã nối API. Không tạo chuông giả hoặc component rỗng trong bản thử.

## Chưa làm/chưa kiểm

- Không thêm chuông, Nguồn cào, Người dùng, Thông báo theo đúng phạm vi. Không thêm email vào menu vì SessionUser hiện chưa có trường này.
- Chưa thay style/nội dung bên trong các trang; vẫn còn màu xanh và kiểu tiêu đề của bản trước ở nội dung Phân tích/Kho/Duyệt… Đây là bản thử riêng phần khung.
- Tìm trọ vẫn mở trang công khai đang có. Thị trường vẫn giữ bố trí route hiện có; không chuyển nhóm route trong lượt này.
- Đã kiểm Chrome trên Windows; chưa kiểm Firefox, Safari, thiết bị cảm ứng thật hoặc trình đọc màn hình thật.
- Không chạy pytest vì không sửa backend; không chạy các bộ public/stitch ngoài phạm vi. Không gọi Gemini, không commit, push hoặc deploy; không gọi agent phụ.

## Server giữ chạy để xem

- **Web production:** http://127.0.0.1:3017 — output `.next-codex4-prod`.
- **API thử:** http://127.0.0.1:18006.
- Có thể đăng nhập bằng user seed `renter`, `reviewer`, `admin` (hoặc collector/researcher); đọc mật khẩu thử trực tiếp từ file `.tmp/interior-test-credentials.json` trên máy. Không dùng dữ liệu thật.
- Cổng dev 3016 không cần bật; toàn bộ bằng chứng kiểm thử dùng production 3017. Hai server trên được giữ chạy khi bàn giao.
