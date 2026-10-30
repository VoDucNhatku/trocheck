# Đặc tả extension Chrome

Tài liệu bàn giao cho người hoặc nhóm làm extension. Mô tả **extension phải làm gì và gửi gì cho backend**, không quy định cách code. Ưu tiên số 1: **chạy được và thu được dữ liệu** vào kho để nhóm có 300–500 bài.

## 1. Extension làm hai việc

| Chế độ | Ai dùng | Kích hoạt | Kết quả |
|---|---|---|---|
| **Thu thập** | Người thu dữ liệu của nhóm | Bật công tắc trong popup khi đang ở một nhóm Facebook được phép | Các bài lướt qua được gửi về kho (`POST /ingest/batch`) |
| **Nhận định** | Người đi thuê | Bấm nút ReNER cạnh một bài, hoặc bôi đen nội dung rồi bấm icon | Panel giá/phí/nhận định cho bài đó (`POST /analyses`) |

Extension **không** trích xuất, không tính toán, không gọi LLM. Nó chỉ lấy chữ, che số điện thoại, gửi đi và hiển thị kết quả backend trả về.

## 2. Thành phần

| Thành phần | Việc |
|---|---|
| Manifest V3 | Khai báo quyền tối thiểu: `storage`; quyền truy cập trang chỉ cho `https://www.facebook.com/*` và địa chỉ API của nhóm. Không xin `<all_urls>` |
| Content script (chạy trên trang Facebook) | Tìm các bài trong feed, đọc chữ, link, thời gian; gắn nút ReNER cạnh mỗi bài; hiện panel kết quả |
| Service worker (nền) | Giữ token, gom lô, gửi API, thử lại khi lỗi mạng. Lưu ý: Chrome có thể tắt service worker bất cứ lúc nào, nên trạng thái cần giữ (hàng đợi chưa gửi, mã phân tích đang chờ) phải lưu vào `chrome.storage`, không để trong biến |
| Popup | Kết nối tài khoản, công tắc Thu thập, bộ đếm phiên, nút mở web |
| File cấu hình bộ chọn | Cách nhận diện bài, nút "Xem thêm", link, thời gian. Facebook đổi giao diện thì **chỉ sửa file này**, không sửa logic |

Framework tùy bên làm chọn (ví dụ WXT hoặc Plasmo cho React/TypeScript, hoặc viết tay). Yêu cầu là build ra bản load được bằng "Load unpacked".

## 3. Chế độ Thu thập — mô tả luồng

1. Người thu đăng nhập web, vào **Cài đặt → Kết nối extension**, lấy token, dán vào popup. Popup hiện "Đã kết nối: <tên tài khoản>".
2. Mở một nhóm Facebook mà **chính người đó là thành viên** và nằm trong **danh sách nhóm được phép** (cấu hình trên web, extension tải về khi kết nối). Nhóm không có trong danh sách → công tắc bị khóa, ghi lý do.
3. Bật **Thu thập**. Người dùng cuộn feed như bình thường; extension **không tự cuộn**.
4. Với mỗi bài xuất hiện trên màn hình:
   - nếu bài bị rút gọn, bấm "Xem thêm" **một lần** để lấy đủ chữ; không lấy được thì gửi với `text_complete = false`;
   - lấy **chữ bài**, **link bài**, **mã bài** (từ link), **thời gian đăng** (cả chuỗi hiển thị gốc và bản quy đổi nếu đọc được), **mã + tên nhóm**;
   - **che số điện thoại** ngay trên máy (thay bằng `[SĐT]`), đặt `phone_masked = true`;
   - bỏ qua bài đã gửi trong phiên (theo mã bài).
5. Gom tối đa 20 bài rồi gửi một lô. Hiển thị bộ đếm: đã gửi / trùng / bị từ chối / lỗi.
6. **Dừng thu thập** khi: người dùng tắt; đạt **50 bài/phiên**; Facebook hiện màn hình xác minh, CAPTCHA hoặc cảnh báo hành vi; API trả 401/403. Khi dừng vì Facebook, popup ghi rõ lý do và **không tự động thử lại**.

**Không thu:** tên người đăng, ảnh đại diện, ảnh bài, bình luận, lượt thích, số điện thoại chưa che, HTML thô của trang.

## 4. Chế độ Nhận định — mô tả luồng

1. Người dùng bấm nút ReNER cạnh bài (hoặc bôi đen chữ rồi bấm icon extension).
2. Popup **xem trước** chữ sẽ gửi (đã che SĐT) và link bài. Người dùng có thể hủy.
3. Bấm **Phân tích** → `POST /analyses` → nhận `analysis_id`. Lưu `analysis_id` vào `chrome.storage` để đóng/mở popup vẫn theo dõi được.
4. Hỏi trạng thái `GET /analyses/{id}`, giãn dần (1 giây, 2 giây, 3 giây…), dừng khi `succeeded`/`failed` hoặc sau 60 giây.
5. Với mỗi listing, gọi `GET /listings/{id}/comparison`, hiện panel theo [mô tả màn hình](../01-product/03-tinh-nang-va-man-hinh.md#4-màn-hình-extension).
6. Nút **Đóng góp vào kho** (mặc định không) → `POST /analyses/{id}/contribute`. Nút **Xem trên web** → mở `/phan-tich/{id}`.

## 5. Dữ liệu gửi lên

Đúng schema [ingest-post.schema.json](../../spec/schemas/ingest-post.schema.json). Các trường quan trọng:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `idempotency_key` | ✓ | Thu thập: `fb:<group_id>:<post_id>`. Nhận định: `assess:<post_id>:<epoch giây>` |
| `source_type` | ✓ | `facebook_group` |
| `text` | ✓ | Đã che SĐT; giữ nguyên xuống dòng và emoji (dấu hiệu tách phòng) |
| `text_complete` | ✓ | `false` nếu không mở được "Xem thêm" |
| `phone_masked` | ✓ | Phải là `true`; server từ chối nếu `false` |
| `permalink`, `external_post_id` | nên có | Cần cho gộp trùng |
| `posted_at`, `posted_at_raw` | nên có | `posted_at_raw` là chuỗi hiển thị gốc, server tự quy đổi lại nếu cần |
| `source_group_id`, `source_group_name` | nên có (thu thập) | |

Tham khảo API đầy đủ: [API contract §2](03-api-contract.md#2-extension--api).

## 6. Khi Facebook đổi giao diện

Facebook có thể đổi cấu trúc trang bất cứ lúc nào. Thiết kế để extension **hỏng nhẹ, không hỏng lặng lẽ**:

- Bộ chọn nằm trong file cấu hình, có version; ưu tiên dấu hiệu ổn định (vai trò ARIA, cấu trúc link bài) hơn tên class sinh tự động.
- Nếu một trang nhóm không nhận diện được bài nào sau khi cuộn → popup báo "Không nhận diện được bài, có thể Facebook đã đổi giao diện", không gửi dữ liệu rác.
- Có **trang kiểm tra**: vài trang HTML mẫu do nhóm tự tạo theo cấu trúc Facebook (không chứa thông tin cá nhân thật) để chạy thử bộ chọn mà không cần vào Facebook.

**Đường dự phòng** khi thu thập tự động không dùng được (theo thứ tự):

1. Chế độ Nhận định + **Đóng góp vào kho** từng bài.
2. Dán chữ bài trên web (F12).
3. Nhập file CSV/JSON theo lô (F13) theo cùng schema.

## 7. Tiêu chí nghiệm thu extension

| # | Tình huống | Kết quả phải thấy |
|---|---|---|
| E1 | Kết nối bằng token hợp lệ / sai / hết hạn | Hiện tên tài khoản / báo lỗi rõ / yêu cầu kết nối lại |
| E2 | Bật Thu thập trong nhóm được phép, cuộn qua 30 bài | ≥ 25 bài vào kho với chữ, link, thời gian; bộ đếm khớp số trên web |
| E3 | Cuộn lại qua các bài đã gửi | Không tạo bài trùng trong kho |
| E4 | Bài có "Xem thêm" | Chữ trong kho là bản đầy đủ, `text_complete = true` |
| E5 | Bài có số điện thoại nhiều dạng (ví dụ giả: `0123 456 789`, `0123.456.789`, `+84 123456789`, `09xx xxx xxx`) | Kho chỉ có `[SĐT]` |
| E6 | Nhóm không nằm trong danh sách cho phép | Không gửi gì |
| E7 | Đạt 50 bài trong phiên | Tự dừng, báo lý do |
| E8 | Facebook hiện màn hình xác minh | Dừng ngay, báo lý do, không thử lại |
| E9 | Mất mạng giữa phiên | Bài chưa gửi được giữ lại và gửi khi có mạng, không mất, không trùng |
| E10 | Nhận định một bài, đóng popup rồi mở lại | Vẫn thấy kết quả cùng bài, không tạo phân tích mới |
| E11 | Nhận định bài "ib giá", bài 2 phòng, bài cần thuê | Panel hiện đúng: không công khai giá / 2 thẻ / "không phải bài cho thuê" |
| E12 | Trang kiểm tra HTML mẫu | Nhận diện đúng số bài trong trang mẫu |

## 8. Giới hạn bắt buộc (không thương lượng)

- Chỉ chạy khi người dùng bật; không chạy nền khi người dùng không mở nhóm.
- Chỉ nhóm mà tài khoản Facebook đó là thành viên và nằm trong danh sách cho phép.
- Không tự cuộn, không mở nhiều tab, không dùng nhiều tài khoản, không dùng proxy, không giả lập trình duyệt khác, không vượt CAPTCHA hay bước xác minh.
- Không gửi khóa API LLM hay bí mật nào trong extension.
- Quy mô: 50 bài/phiên, tổng mục tiêu 300–500 bài cho cả đồ án.
