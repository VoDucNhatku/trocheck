# API contract

## Bổ sung đăng ký (ủy quyền trực tiếp, 27/10/2026)

`POST /api/v1/auth/register`: JSON `username` (ASCII chữ/số/gạch dưới,3–30), `password` (8–200,
có chữ hoa và chữ số), `confirm_password` khớp, `accept_terms` boolean true. Extra fields bị từ chối422.
201 trả SessionUser và session cookie HttpOnly/SameSite=Lax, Secure theo cấu hình; role cố định renter.
409 `username_taken` + field_errors.username, không sửa tài khoản đã có. 422 không echo password.
429 có Retry-After. `REGISTER_RATE_LIMIT=10`, `REGISTER_WINDOW_SECONDS=600`: đủ cho nhóm sinh viên thử/sửa lỗi
trong demo local, hạn chế tạo hàng loạt và hash mật khẩu; tính cả request sai schema. Sliding window theo IP transport,
không tin X-Forwarded-For do client gửi; bộ đếm trong RAM từng process, bounded10000 IP. BFF local chung một IP nên
cùng chia hạn mức; khi triển khai nhiều process/proxy thật cần rate limiter shared và trust-proxy cấu hình ở hạ tầng.
Không có email/OTP/reset/OAuth. Điều khoản được đọc ngay tại form; không thêm cột PII hoặc migration.

Prefix: `/api/v1`. JSON, `snake_case`, thời gian UTC ISO-8601, tiền là số nguyên đồng. FastAPI tự sinh OpenAPI tại `/docs`; web và extension dùng client sinh từ đó. File này là bản thỏa thuận trước khi code; khi code xong, OpenAPI là nguồn chính xác và file này cập nhật theo.

## 1. Quy ước chung

**Xác thực**

| Ai | Cách | Ghi chú |
|---|---|---|
| Web | Cookie phiên sau `POST /auth/login` | Tài khoản demo theo vai trò |
| Extension | Header `Authorization: Bearer <token>` | Token lấy từ trang Cài đặt trên web (dán vào extension), có hạn dùng, thu hồi được |

**Vai trò:** `renter` · `collector` · `reviewer` · `researcher` · `admin`. Một tài khoản có thể có nhiều vai trò. Mọi kiểm quyền làm ở API.

**Lỗi chuẩn**

```json
{ "error": { "code": "validation_error", "message": "…", "field_errors": {"text": "required"}, "request_id": "01J…" } }
```

| HTTP | `code` | Khi nào |
|---|---|---|
| 401 | `unauthenticated` | Thiếu/hết hạn token hoặc phiên |
| 403 | `forbidden` | Đúng người nhưng sai vai trò |
| 404 | `not_found` | Không có, hoặc không có quyền xem |
| 409 | `conflict` | Cùng idempotency key nhưng nội dung khác; duyệt trên phiên bản cũ |
| 422 | `validation_error` | Dữ liệu sai schema |
| 429 | `rate_limited` | Gửi quá nhanh |
| 503 | `unavailable` | DB/LLM tạm không dùng được |

Không trả traceback hay khóa API trong lỗi.

## 2. Extension → API

### `POST /ingest/batch` — chế độ Thu thập

Vai trò: `collector`. Tối đa 20 bài/lô. Schema từng bài: [ingest-post.schema.json](../../spec/schemas/ingest-post.schema.json).

```json
{
  "client": {"extension_version": "0.1.0", "session_id": "s-2026-10-20-01"},
  "posts": [{
    "idempotency_key": "fb:1234567890:9876543210",
    "source_type": "facebook_group",
    "source_group_id": "1234567890",
    "source_group_name": "Phòng trọ gần ĐH FPT",
    "permalink": "https://www.facebook.com/groups/1234567890/posts/9876543210/",
    "external_post_id": "9876543210",
    "posted_at": "2026-10-19T08:30:00Z",
    "posted_at_raw": "19 tháng 10 lúc 15:30",
    "text": "Cho thuê CCMN 1PN 30m2 … LH [SĐT]",
    "text_complete": true,
    "phone_masked": true
  }]
}
```

Phản hồi `200`:

```json
{ "results": [ {"idempotency_key": "fb:1234567890:9876543210", "status": "created", "post_id": "01J…"} ],
  "summary": {"created": 1, "duplicate": 0, "rejected": 0} }
```

`status` từng bài: `created` · `duplicate` (đã có, không tạo mới) · `rejected` (kèm `reason`: `schema`, `not_masked`, `too_long`, `empty`).

### `POST /analyses` — chế độ Nhận định

Vai trò: bất kỳ tài khoản đã đăng nhập. Một bài/lần.

```json
{ "idempotency_key": "assess:9876543210:1729411200", "source_type": "facebook_group",
  "permalink": "https://…", "text": "…", "text_complete": true, "phone_masked": true }
```

Phản hồi `202`: `{"analysis_id": "01J…", "status": "queued"}`. Cùng key + cùng nội dung → trả lại analysis cũ; cùng key + nội dung khác → 409.

### `GET /analyses/{id}`

```json
{ "analysis_id": "01J…", "status": "queued | running | succeeded | failed",
  "post_type": "rental_offer", "partial": false,
  "listings": [ { "listing_id": "01J…", "listing_index": 0, "rent": {…}, "area": {…}, "room": {…}, "location": {…}, "fees": [ … ] } ],
  "error": null }
```

Cấu trúc listing theo [listing-extraction.schema.json](../../spec/schemas/listing-extraction.schema.json). `partial = true` khi LLM lỗi và chỉ có kết quả Regex.

### `POST /analyses/{id}/contribute`

Đặt `contributed = true` cho bài, đưa listing vào luồng thống kê. Trả `200 {"contributed": true}`.

## 3. Người đi thuê

| Method · Path | Tham số chính | Trả về |
|---|---|---|
| `GET /listings` | `ward`/`type` key lặp, `price_min`, `price_max`, `area_min`, `area_max`, `has_price`, `sort` (`price_asc`/`price_desc`/`newest`), `page`, `page_size` | `items[]` (thẻ tin), `total`, `hidden_no_price`, `data_as_of` (nullable), `page`, `page_size`, `is_demo` |
| `GET /listings/{id}` | — | Listing đầy đủ + evidence + `post.text` đã che + link bài + lịch sử giá của cluster |
| `GET /listings/{id}/comparison` | — | Xem bên dưới |
| `GET /market/summary` | `ward`/`type` key lặp, `basis` | Bảng phường × loại: `n`, `median`, `p25`, `p75`, `median_per_m2`, `n_per_m2`, `excluded_counts` |
| `GET /stats/overview` | — | Tổng tin, tin đủ điều kiện, ngày cập nhật |

**`GET /listings/{id}/comparison`**

```json
{ "status": "ok | insufficient_data | not_comparable",
  "reason_codes": ["price_not_exact"],
  "criteria": {"ward_code": "…", "property_type": "ccmn", "basis": "per_unit", "area_band": "[30,40)", "window_days": 30, "broad_group": false},
  "n": 14, "median": 5000000, "p25": 4500000, "p75": 5800000,
  "n_per_m2": 12, "median_per_m2": 160000,
  "delta_percent": 10.0, "verdict": "higher | near | lower | null",
  "data_from": "2026-10-05", "data_to": "2026-10-25",
  "similar": [ {"listing_id": "…", "rent_vnd": 5200000, "area_m2": 32} ] }
```

Khi `status ≠ ok` thì `median`, `p25`, `p75`, `delta_percent`, `verdict` là `null`; giao diện dùng `reason_codes` để giải thích (`too_few_samples`, `price_not_exact`, `basis_unknown`, `ward_unresolved`, `area_missing_broad_group`).

## 4. Nhóm

| Method · Path | Vai trò | Mục đích |
|---|---|---|
| `GET /team/posts` | collector, reviewer | Kho dữ liệu, lọc theo trạng thái/nhóm/người thu/ngày |
| `POST /team/posts/{id}/reprocess` | reviewer | Chạy lại pipeline (tạo run mới) |
| `GET /team/export` | researcher | Xuất CSV/JSON các listing đã chuẩn hóa |
| `GET /team/reviews` | reviewer | Hàng duyệt, lọc theo lý do |
| `GET /team/reviews/{listing_id}` | reviewer | Bài + giá trị Regex/LLM + nghi trùng |
| `POST /team/reviews/{listing_id}/decision` | reviewer | `{"action": "approve|reject|split|merge", "expected_version": 3, "fields": {…}, "reason": "…", "merge_into_cluster": null}` → 409 nếu `expected_version` đã cũ |
| `POST /lab/run` | researcher | `{"text": "…"}` hoặc `{"post_id": "…"}` → kết quả Regex, LLM, token BIO của từng phương pháp |
| `GET /lab/gold/{post_id}` | researcher | Nhãn chuẩn của bài (chỉ tập dev; tập test bị khóa trước khi đóng băng) |
| `GET /eval/runs`, `GET /eval/runs/{id}` | researcher | Danh sách lần chạy, chỉ số, lỗi |
| `POST /team/extension-tokens`, `DELETE /team/extension-tokens/{id}` | mọi vai trò | Cấp/thu hồi token cho extension |

## 5. Giới hạn mặc định (cấu hình được)

| Mục | Giá trị khởi đầu |
|---|---|
| Độ dài `text` | ≤ 20.000 ký tự |
| Lô thu thập | ≤ 20 bài/request |
| Tốc độ gửi của một token | ≤ 60 bài/phút |
| Phân tích đang chạy cùng lúc của một người | 1 |
| Lần gọi LLM tối đa cho một bài | 3 (gồm thử lại) |

## 6. Trạng thái triển khai

Đã có code trong `apps/api` (OpenAPI tại `/docs`). Những điểm khác hoặc thêm so với bản thỏa thuận trên được liệt kê trong [apps/api/README.md](../../apps/api/README.md#ghi-chú-triển-khai-so-với-api-contract).

### Response DTO B1

Listings/detail/comparison/stats đã có response model tại `apps/api/app/schemas/public.py` và schema OpenAPI đầy đủ. Trường extraction tùy chọn giữ nguyên, explicit null không bị bỏ. `posted_at`, `data_as_of`, `updated_at`, `data_from`/`data_to` có thể null. Detail giữ `cluster_id`, `price_history`, `sibling_count`, `is_demo`; card giữ `review_status`, `is_demo`, `text_complete`. Comparison còn trả `message`, `disclaimer` (nullable), `is_demo`; web hiển thị kết luận từ API.

Query thực tế: `?ward=A&ward=B&type=ccmn&type=phong_tro&page=2&page_size=20`. Không dùng key có dấu ngoặc hoặc ghép dấu phẩy. Các endpoint đọc công khai không đòi login; demo flag áp dụng nhất quán: máy chủ tắt demo chỉ trả kho thật, bật demo mặc định chọn demo và `?demo=false` chọn thật. Envelope listings có thêm `is_demo` để kho rỗng vẫn hiển thị đúng chế độ.
