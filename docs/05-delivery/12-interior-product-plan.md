# ReNER — bàn làm việc đọc tin

Ngày 26/10/2026. Phạm vi được ủy quyền trong `11-worker-interior-brief.md`. Giữ branch `codex/restore-paper-ui`, toàn bộ thay đổi landing trước đó, bản gốc và KusShoes chỉ đọc. Git cần `-c safe.directory=<workspace>` riêng từng lệnh do ownership của clone; không đổi cấu hình global.

## Quyết định sản phẩm

Đối tượng là sinh viên đọc tin trọ và nhóm làm dữ liệu. Việc chính là biến văn bản khó đọc thành bản thông tin có nguồn. Chọn một hướng: **Bản đọc tin**, nguyên văn đã che liên hệ ở trái; trường chuẩn hóa có thể chọn ở phải; so sánh và “Cần hỏi thêm” nằm tiếp theo. Không chọn dashboard KPI tổng quát vì nó không giúp người mới đọc một bài. Không chọn chat vì nguồn và đơn vị cần xem song song.

Nền giấy `#f6f4ee`, surface `#fffdf7`, ink `#172b25`, forest `#244b3c`, amber `#f2cd64`, muted `#59655b`; mở rộng token hiện có bằng scope khu trong để landing không đổi. Be Vietnam Pro 14–16px/1.6 cho đọc và form, Newsreader 32px/1.12 cho tiêu đề trang, JetBrains Mono cho ID ngắn. Sidebar 232px, header 60px. Điện thoại một cột, điều hướng trong drawer có Escape và focus native dialog. Không có ảnh phòng giả gắn vào listing thật.

Motion từ emil-design-eng/animation-performance: hover 120ms, nhấn 0–100ms, drawer 200ms, chuyển vùng 160ms opacity/transform tối đa 4px; reduced motion tắt chuyển động. Không transition all, không state mỗi frame. Bảng và thao tác lặp lại không có hiệu ứng vào trang kéo dài.

## Sitemap và luồng theo vai trò

`/dang-nhap` → đích nội bộ đã kiểm tra hoặc `/phan-tich` → `/phan-tich/[analysis_id]`. Đọc tin có thêm `/tim-tro`, `/tin/[id]` (giữ nguyên), `/thi-truong`, `/tai-khoan`. Nhóm có `/team/kho`, `/team/duyet`, `/team/duyet/[listing_id]`, `/team/lab`, `/team/danh-gia` theo bảng sau. `admin` kế thừa mọi role đúng `services/users.has_role`; researcher không tự có reviewer/collector.

| Màn / hành động | Endpoint thật dưới /api/v1 | Quyền | Trạng thái bắt buộc |
|---|---|---|---|
| Đăng nhập / phiên / thoát | POST auth/login, GET auth/me, POST auth/logout | mọi người / đã login | pending, sai thông tin, 401, mạng lỗi |
| Tạo / đọc phân tích | POST analyses, GET analyses/{id} | current_user; sở hữu hoặc reviewer/researcher/admin đọc | queued/running/succeeded/failed, partial, 429, 404 |
| Đóng góp | POST analyses/{id}/contribute | quyền xem analysis | mặc định chưa; xác nhận rõ, pending/error/success |
| So sánh | GET listings/{id}/comparison | public hoặc quyền analysis | insufficient_data/not_comparable, lỗi độc lập |
| Thị trường | GET market/summary?ward=&type=&basis=&demo= | public | có số, N dưới ngưỡng, rỗng, lỗi |
| Token extension | GET/POST team/extension-tokens; DELETE .../{id} | current_user; token sở hữu | hiện bí mật một lần, copy, thu hồi xác nhận |
| Kho | GET team/posts?status=&group=&collector=&date_from=&date_to=&post_type=&page=&page_size= | collector/reviewer/admin | loading/empty/error, URL state, thiếu ngày |
| Xử lý lại | POST team/posts/{id}/reprocess | reviewer/admin | queued thật, pending, lỗi |
| Xuất | GET team/export?format=&include_demo= | researcher/admin | download lỗi, không chứa text cá nhân |
| Hàng duyệt / chi tiết | GET team/reviews?reason=&page=&page_size=; GET .../{listing_id} | reviewer/admin | lý do, version, empty/error |
| Duyệt / loại / tách / gộp | POST team/reviews/{id}/decision | reviewer/admin | expected_version, reason, 409 tải lại, hủy không ghi |
| Lab | POST lab/run {text hoặc post_id}; GET lab/gold/{post_id} | researcher/admin | Regex/LLM chưa chạy khác rỗng; test gold khóa |
| Đánh giá | GET eval/runs, GET eval/runs/{run_id} | researcher/admin | không có run/metrics, frozen, số thật |

## Contract tương tác

| Control | Trigger → kết quả | Gọi API / local | Pending, lỗi, kiểm |
|---|---|---|---|
| Form login | submit → xác minh → chuyển đích | auth/login; server auth/me | khóa gửi lặp, lỗi inline; test login/logout/back/401 |
| Hiện mật khẩu | click → đổi type, giữ nội dung | local | aria-pressed, tên nút thay đổi, bàn phím |
| Dùng bài mẫu | click → điền văn bản tự tạo | local | không gửi tự động; nhãn minh họa |
| Xem trước / phân tích | che số → người dùng đọc → submit | analyses; idempotency một yêu cầu | giữ key khi retry; 429; không tạo 2 lần |
| Field/evidence | chọn → làm nổi đúng code-point span | local | pressed + chữ; emoji Unicode test |
| Poll analysis | tải → nhịp 1.5s tăng tới 10s | GET analysis | abort khi rời, dừng terminal; lỗi có retry |
| Bộ lọc + phân trang | submit/link → URL → đọc dữ liệu | GET theo query thật | reload/back giữ bộ lọc; không filter không có API |
| Đóng góp / thu hồi / quyết định | mở dialog → xác nhận → mutation | endpoint của role | trap focus, Escape, trả focus; lỗi inline, pending |
| Chỉnh review | sửa → đánh dấu dirty → lưu | decision schema fields | hủy khôi phục; 409 giữ bản sửa để so; beforeunload/link warning |
| Token mới / copy | tạo → hiện một lần → copy | token create / clipboard | không log/chụp bí mật; reload không hiện lại |
| Drawer mobile | mở → nav → đóng | local native dialog | focus, Escape, touch; reduced motion |

## Thứ tự vertical slice và nghiệm thu

1. Response DTO bổ sung OpenAPI (không đổi nghiệp vụ), BFF allowlist cùng origin, auth thật + shell + nền control.
2. Phân tích → ID → polling → bản đọc tin/evidence/phí → so sánh → đóng góp tùy chọn. Không gọi LLM để chụp màn; backend kiểm thử Regex-only trên DB tách.
3. Market summary và account/token. Bảng P25/median/P75/N/ngày và biểu đồ có trục; không tính thống kê lại trên browser.
4. Kho/hàng duyệt/chi tiết/version conflict, reprocess và export theo quyền.
5. Lab/đánh giá chỉ dữ liệu có thật. Gold test khóa. Error links không có endpoint → ghi gap, không vẽ link giả.
6. Typecheck, build output riêng, API suite, integration/E2E giá trị; render 1440/1024/768/390/360; xem ảnh, contrast, keyboard/reduced motion/overflow/pageerror; privacy scan.

## Gaps và backlog

- Các route private/market/Lab/eval đang trả dict không response_model: bổ sung DTO từ service rồi generate type, không tự định nghĩa schema đoán ở web.
- Không có GET chi tiết post riêng cho collector; kho dùng excerpt thật và liên kết analysis theo API quyền, không giả collector đọc được mọi analysis.
- Không có API đăng ký/reset/OAuth, lịch sử phân tích cá nhân, favorite, ảnh listing, user admin, trend/map, error-row export, nhãn gold write. Không vẽ control cho các capability này.
- Review `split` là tách cluster, không tách bài thành nhiều listing. Merge cần cluster thật, chỉ đề xuất từ suspected_duplicates.
- Auth cookie hiện signed stateless; logout xóa cookie, không thu hồi server mọi bản cookie cũ. Không đổi auth model trong UI slice.
- Cloud chỉ lập kế hoạch: driver/Postgres parity/worker durable/poll idle cần thẩm định; chưa deploy/migrate/push.
