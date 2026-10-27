# Bàn giao màn duyệt một tin và polish khu làm việc

Ngày kiểm: 27/10/2026. Phạm vi Codex số 2 theo `.tmp/codex-task-02-duyet-polish.md`.

## File tạo và sửa

| File | Thay đổi |
|---|---|
| `apps/web/src/app/(workspace)/team/duyet/[id]/page.tsx` | Tạo route; server gọi `requireUser(path, ['reviewer'])`, thiếu quyền render `Forbidden`. |
| `apps/web/src/features/workspace/ReviewDetail.tsx` | Tạo màn đối chiếu, sửa trường, quyết định, xác nhận, xử lý phiên bản và cảnh báo rời trang. |
| `apps/web/src/features/workspace/Team.tsx` | Giữ liên kết bằng listing ID thật; bổ sung nhãn lý do dự phòng và trình bày từng tin đầy đủ trên mobile. |
| `apps/web/src/features/workspace/Reading.tsx` | Tách đặt cọc cả trên màn hình và bản sao chép; câu so sánh trung tính, số Việt Nam; link tương tự có loại, diện tích, giá/đơn vị. |
| `apps/web/src/features/workspace/Login.tsx` | Gắn `htmlFor` / `id` cho tên tài khoản. |
| `apps/web/src/features/workspace/Market.tsx` | Không ngắt giữa số tiền; ngày Việt Nam; vùng bảng cuộn có tên và nhận focus. |
| `apps/web/src/features/workspace/Account.tsx` | Câu hướng dẫn kết nối rõ hơn, bỏ thông tin triển khai không cần thiết. |
| `apps/web/src/features/workspace/workspace.module.css` | Nền sidebar phủ trang dài; responsive, focus, evidence, bảng mobile, kích thước nút gửi ổn định; thêm class và chỉnh giá trị, giữ các class cũ. |
| `apps/web/tests/browser/interior.spec.ts` | Giữ 3 test cũ, thêm 9 test; đo contrast và chụp các trạng thái. |
| `docs/05-delivery/16-interior-delivery.md` | Biên bản này. |

Không sửa backend hoặc các file Lab / Đánh giá thuộc Codex số 1. Không thay đổi chữ ký hoặc export của các module dùng chung. Next tự thêm include riêng cho dist vào `tsconfig.json` khi chạy; các include do phiên Codex số 2 thêm đã được gỡ lại, giữ wildcard và các entry khác đang có.

## Hành vi màn duyệt

Lý do cần xem nằm trước bài gốc và các trường. Regex / LLM hiển thị **đoạn trích** từ `ReviewRun`; không giả lập hai bộ giá trị chuẩn hóa mà API không cung cấp. Chỉ hiển thị bằng chứng khớp đúng đoạn Unicode code point trong văn bản đã lưu. Giá trị chọn có form sửa rent, area, room, location, fees; giữ số thiếu là `null`.

Quyết định gọi đúng `GET team/reviews/{id}` và `POST team/reviews/{id}/decision`. Payload chỉ có các khóa trong `ReviewDecision`; luôn dùng `expected_version` đã tải. Chỉ gửi nhóm trường thay đổi khi approve, không gửi lại metadata ngoài nhu cầu sửa. Lý do loại tin bắt buộc và giới hạn 500 ký tự; merge cần cụm đích. Split có nghĩa tách tin khỏi cụm trùng, không chia bài thành nhiều tin.

Các quyết định đều có `Modal` xác nhận. Hủy / Escape không gửi quyết định. Trong khi gửi, nút giữ kích thước và khóa gửi lặp; chỉ chuyển về hàng duyệt sau phản hồi thành công. Khi gặp 409, giữ bản nháp, tải bản mới, hiện khác biệt giá trị / trạng thái / cụm; mọi thao tác ghi bị khóa cho đến khi người duyệt chủ động chọn dùng bản mới và bỏ sửa đổi cũ. Lỗi lưu giữ màn hình tại chỗ và hiện thông báo.

Click link, Back và reload khi có sửa đổi chưa lưu đều có cảnh báo. Hộp xác nhận nhận focus ở nút Hủy / Ở lại, giữ bàn phím bên trong và trả focus về nút mở sau khi đóng. Không thay `Modal` dùng chung để đạt hành vi này.

## Polish và ảnh thật

Đặt cọc được lọc theo `fee.type === 'deposit'`, không cộng với thuê hoặc phí. Câu so sánh dùng `delta_percent` / `verdict` do API trả và định dạng `vi-VN`, ví dụ “Giá chào thuê cao hơn trung vị nhóm khoảng 77,8%”. Giữ N, P25/P75, ngày dữ liệu và nhãn demo; N < 10 không hiện trung vị hay kết luận giá. Không tính thống kê ở frontend.

Các link tương tự dùng loại phòng của nhóm API, diện tích khi có và giá theo tháng / cơ sở tính; mũi tên ở cùng hàng. Nhãn evidence trong khu làm việc được đưa vào dòng, tăng cỡ chữ và không làm mờ các đoạn còn lại khi chọn một đoạn. CSS chỉ tác động trong `evidencePane`; component EvidenceHighlighter và CSS public không bị sửa.

Ảnh trong `.tmp/interior-shots/` đã được mở xem trực tiếp và qua contact sheet:

- `login-*`, `reading-*`: 1440, 1024, 768, 390, 360; `drawer-360`.
- `market-*`, `store-*`, `queue-*`, `account-*`, `review-*`: 1440, 768, 390.
- `review-conflict-*`, `review-reject-required-*`, `review-not-found-*`: 1440 và 390; thêm ảnh unsaved, saving, save-error, focus, hover và keyboard-dialog.
- `store-empty-*`, `queue-empty-*`, `reading-insufficient-*`: 1440 và 390.
- `public-evidence-*`: 1440 và 390, kiểm hồi quy trang `/tin/[id]`.
- `codex2-mobile-contact.png`, `codex2-desktop-contact.png`, `codex2-tablet-contact.png`: ghép phần đầu / cuối để kiểm bố cục; `codex2-modal-contact.png` ghép các hộp xác nhận. Thư mục có 50 PNG tại lúc bàn giao.

Ảnh cho thấy không tràn ngang toàn trang, cọc có khu riêng, số tiền thị trường không bị cắt giữa chữ số, thao tác kho / hàng duyệt xuất hiện đầy đủ trong mỗi tin trên mobile. Bảng rộng trên tablet / thị trường cuộn bên trong vùng có nhãn. Sidebar vẫn có nền giấy ngà ở phần dưới viewport đầu tiên. Không đổi hệ token hoặc font của ReNER.

Contrast chữ nhỏ của nhãn evidence, đo từ computed style thực tế sau khi chọn giá: PN **9,96:1**, VT **10,40:1**, DT **10,90:1**, GIÁ **11,82:1**, PHÍ **10,10:1**. Opacity của mọi đoạn là 1, nên các nhãn chưa chọn cũng giữ contrast. Kiểm reduced motion cho transition và animation trả `0s` / `none`.

## Lệnh và kết quả

Từ `apps/web`, build dùng `RENER_DIST_DIR=.next-codex2-prod` và `API_BASE_URL=http://127.0.0.1:18003/api/v1`.

| Kiểm tra | Kết quả đã quan sát |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, exit 0. |
| `npm run build` | Exit 0; `Compiled successfully in 8.9s`; sinh static pages 4/4; có route động `/team/duyet/[id]`, 8,87 kB. |
| `PW_CHANNEL=chrome INTERIOR_WEB=http://127.0.0.1:3009 INTERIOR_API=http://127.0.0.1:18003 npx playwright test -c playwright.interior.config.ts` | **12 passed (50.6s)**, 1 worker, không skip. |

12 test bao gồm 3 test cũ; reviewer đi từ hàng duyệt tới ID thật; renter bị chặn và API GET / POST trả 403; approve lưu số đã sửa và version; reject thiếu lý do bị chặn ở UI / API 422; cancel không đổi version; stale version trả 409 và giữ nháp; merge thiếu cụm trả 422; split / merge đổi cụm thật; giữ kích thước nút và một request khi đang gửi; lỗi 503 mô phỏng ở trình duyệt không báo thành công; 404 thật; hồi quy public; Back / reload, focus, reduced motion, empty và N < 10. Ngoại trừ lỗi 503 và việc trì hoãn request để kiểm nút gửi, các quyết định và dữ liệu là từ API thử thật.

Không thấy lỗi typecheck / build trong file của Codex số 1 tại thời điểm kiểm. Cảnh báo `NO_COLOR` / `FORCE_COLOR` của Playwright không làm test thất bại.

## Giới hạn còn lại

- Theo đúng pattern `requireUser` + `Forbidden` được yêu cầu, trang HTML thiếu quyền hiện thông báo Forbidden nhưng HTTP của trang là **200**. API được bảo vệ trả **403** cho cả đọc và ghi. Chưa đổi cơ chế HTTP 403 của trang HTML vì cần thay guard / cấu hình ngoài ranh giới file đã giao; test không đánh đồng hai loại phản hồi này.
- Chỉ kiểm trên Chrome cài tại máy, không kiểm Firefox / Safari, không chạy bộ backend pytest / eval hoặc kiểm Gemini. API thử dùng dữ liệu tự tạo và worker Regex, không gọi Gemini.
- Không thay component evidence public; ảnh public dùng để kiểm hồi quy, không phải tuyên bố đã tăng cỡ nhãn public.
- Không commit, push, deploy hoặc gọi thêm agent. Không in mật khẩu / token. API :18003 được giữ chạy.

Bản production xem thử được để chạy ở `http://127.0.0.1:3009/team/duyet`; dev :3008 của Codex số 2 đã dừng sau kiểm tra. Các cổng và server khác không bị dừng.
