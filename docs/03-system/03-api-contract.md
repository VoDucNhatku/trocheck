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
Đăng ký bằng mật khẩu giữ nguyên; email/đặt lại mật khẩu đã được bổ sung sau mốc này.
Đăng nhập Google được bổ sung theo yêu cầu ngày 31/10/2026, mô tả bên dưới.

## Bổ sung đăng nhập Google (31/10/2026)

- `GET /api/v1/auth/google/start?next=/phan-tich`: trả `authorization_url` và cookie giao dịch
  `rener_google_oauth`, HttpOnly/SameSite=Lax, hạn 10 phút, đường dẫn `/api/auth/google`.
  Dữ liệu giao dịch được ký HMAC, có state ngẫu nhiên và bộ kiểm chứng PKCE S256.
- `POST /api/v1/auth/google/callback`: JSON `{code, state}`, kèm cookie giao dịch do Next.js chuyển tiếp.
  API đối chiếu state, hạn dùng và chữ ký trước khi gọi Google; đổi code bằng Client Secret + PKCE,
  đọc danh tính từ endpoint userinfo chính thức bằng access token. Chỉ nhận email được Google xác minh.
  Thành công trả `{next}` và cookie phiên giống đăng nhập bằng mật khẩu. Không trả token Google cho web.
- Web dùng hai đường cùng tên miền `/api/auth/google/start` và `/api/auth/google/callback`.
  Callback kiểm tra đường quay lại bằng `safeReturnPath`, xóa cookie giao dịch và chuyển về trang đã yêu cầu.
- Danh tính được đối chiếu bằng `users.google_subject` duy nhất. Tài khoản mới chỉ có role `renter`,
  tên tài khoản được sinh ngẫu nhiên, `password_hash` rỗng và không đăng nhập được bằng mật khẩu
  trước khi người dùng đặt mật khẩu. Không tự gộp vào tài khoản cũ có email trùng.
- Lỗi: 400 `google_state_invalid`; 401 `google_denied`; 409 `google_account_conflict`;
  503 `google_not_configured` / `google_unavailable`; 429 theo hạn mức đăng ký hiện có.
  Thông báo không chứa code, Client Secret hay access token. Google tự chặn việc dùng lại authorization code.
- Cấu hình API: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`;
  hướng dẫn tại [thiết lập Google](../05-delivery/26-google-login.md).

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
| 429 | `daily_limit` | Tài khoản đã gửi đủ số bài mới hoặc số ảnh trong ngày; `Retry-After` là số giây tới 0 giờ (giờ Việt Nam) |
| 503 | `unavailable` | DB/LLM tạm không dùng được |

Không trả traceback hay khóa API trong lỗi.

## 2. Extension → API

### Bài của tôi — đọc riêng theo phiên đăng nhập (13/11/2026)

`GET /api/v1/me/posts?group=all&page=1&limit=20`: mọi vai trò đã đăng nhập, gồm `renter`;
ẩn danh trả 401. `group`: `all`, `published`, `waiting`, `other`; `page >= 1`, `1 <= limit <= 50`,
tham số sai trả 422. Sắp xếp `post_submissions.first_sent_at DESC, post_id DESC` để ổn định khi trùng giờ.
Chỉ đọc lượt gửi có `user_id` là tài khoản hiện tại, luôn loại `posts.is_demo=true`, không nhận ID người khác.
Bài phân tích riêng (`mode=assess`, chưa đóng góp) không nằm trong danh sách bài gửi về kho;
nếu sau đó được gửi qua ingest hoặc được đóng góp thì xuất hiện, kể cả khi mode gốc vẫn là assess.
Không thay đổi quyền của `/team/posts` hoặc quyền xem tin chưa công khai ở các endpoint khác.

Trả `{items, total, page, limit, comparison_baseline: "real_accepted"}`. Mỗi item có `post_id`,
`received_at` (lần gửi đầu của tài khoản), `source_group_name`, `permalink`, `excerpt` (tối đa 200 ký tự
của phiên bản hiện tại), `status`, `reason_codes`, `photo_count` và `listings` (có thể nhiều tin trong bài).
Không trả danh tính người thu ban đầu, người cùng gửi, người duyệt hoặc nội dung nhật ký duyệt.
Mỗi listing trả `listing_id`, `review_status`, các `reason_codes` đã lưu, `public_url` khi thực sự công khai;
`price_vnd`, `price_min_vnd`, `price_form`, `price_basis`, `price_period`, `area_m2`, `room_type`,
`ward_code`, `ward_name`, `resolution`, `comparison` theo schema so sánh hiện hữu.
Không suy giá của khoảng thành một giá chính xác. Số ảnh là tổng ảnh đã tải của bài, không phải URL ngoài bài.

Ánh xạ trạng thái theo thứ tự ưu tiên dưới đây, dùng công việc extract/reprocess mới nhất của **phiên bản hiện tại**.
Các listing phải `is_current=true` và thuộc extraction run của cùng phiên bản, tránh đưa kết quả cũ vào bài vừa sửa.

| Điều kiện dữ liệu thật | `status` trả về | Nhóm lọc |
|---|---|---|
| Job mới nhất `queued` / `running` | `received` | `waiting` |
| Job mới nhất `failed`, hoặc `posts.status=failed` | `failed` | `other` |
| `posts.status=rejected_type` (phân loại không phải `rental_offer`) | `not_rental` | `other` |
| Có listing `auto_accepted` / `approved` và bài `contributed=true` | `published` | `published` |
| Có listing `needs_review` | `needs_review` | `waiting` |
| Có listing `rejected` / `duplicate`, không có tin công khai hoặc chờ duyệt ở trên | `rejected` | `other` |
| Còn lại, gồm bài vừa nhận/chưa có kết quả | `received` | `waiting` |

`finalize_status` tạo `auto_accepted`/`needs_review`; quyết định duyệt cập nhật `listings.review_status`
thành `approved`/`rejected`/`duplicate`. Không tạo một trạng thái lưu trữ mới.
Bài nhiều tin ưu tiên công khai nếu có ít nhất một tin đủ điều kiện; liên kết công khai chỉ có trên tin đủ điều kiện.
Lý do chờ lấy nguyên `review_reasons` (ví dụ `basis_unknown`, `former_ward_split`, `outside_hcm_province`);
web dịch sang câu tiếng Việt, hoặc giải thích thiếu phường/cách tính giá từ các trường đã trích xuất.

So sánh gọi lại `services.market.comparison` → `pipeline.market.compare`: chỉ lấy **tin thật được chấp nhận**,
được đóng góp và đủ điều kiện về giá, cách tính, phường, loại phòng, cửa sổ thời gian; loại cả cụm của tin đang xét.
Không dùng demo ngay cả khi `DEMO_MODE=true`; `comparison.is_demo=false`.
Tỷ lệ hiện hữu so với **trung bình**, không phải trung vị. `insufficient_data` / `not_comparable` giữ lý do thật,
không sinh giá hoặc phần trăm giả. Web ghi rõ nguồn so sánh và tính chất giá chào thuê.

`GET /api/v1/me/posts/summary`: cùng xác thực và phạm vi sở hữu, trả
`{counts: {all, published, waiting, other}, quota: {used, limit, remaining, timezone}}`.
`timezone="Asia/Ho_Chi_Minh"`; `used` dùng đúng bộ đếm ingest hiện hữu: số bài **mới**
`collector_id=user.id`, `mode=collect`, `first_seen_at >= vn_day_start()`.
Bài trùng của người khác không dùng thêm lượt, dù có trong danh sách cá nhân. Không đổi chính sách ingest.
`limit`/`remaining` là null khi `INGEST_DAILY_LIMIT=0` hoặc có quyền collector (gồm admin theo quy tắc hiện hữu).

#### Lọc bài của tôi (14/11/2026)

`GET /api/v1/me/posts` nhận thêm các tham số tùy chọn, kết hợp bằng AND (giá trị lặp của `area`, `ward`, `type` là OR trong
chính bộ lọc đó). Các bộ lọc tin áp lên **từng tin** (listing hiện hành); bài khớp khi có ít nhất một tin khớp **toàn bộ**
điều kiện, và `listings` chỉ trả các tin khớp, kèm `listing_total` là tổng số tin của bài.

| Tham số | Ý nghĩa |
|---|---|
| `area` (lặp) | Khóa quận/huyện **cũ**: `quan-1`, `quan-3`, `quan-7`, `binh-thanh`, `thu-duc`... Tin khớp nếu phường mới của nó nằm trong quận cũ đó **hoặc** pipeline đã đọc thấy tên quận cũ trong bài (bảng `listing_districts`, xem dưới). Khóa lạ trả 422. |
| `ward` (lặp) | Mã phường/xã **mới** đúng 5 chữ số. |
| `price_min`, `price_max` | VND/tháng, `>= 0`, `price_min <= price_max`. So trên giá tháng của tin: giá chính xác, nếu là khoảng hoặc "từ" thì lấy đầu thấp (`rent_amount_vnd`, rồi `rent_min_vnd`). Tin giá theo ngày (`rent_period=day`) không khớp bộ lọc giá; kỳ hạn chưa rõ vẫn được giữ vì đa số bài không ghi "/tháng". Tin không công khai giá ("giá inbox") không có giá nên không bao giờ khớp bộ lọc giá, nhưng vẫn hiện khi không đặt bộ lọc giá. |
| `area_min`, `area_max` | m², `area_min <= area_max`. |
| `type` (lặp) | `phong_tro`, `ccmn`, `can_ho_dich_vu`, `nha_nguyen_can`, `unknown` (giá trị đã lưu). |
| `rental_only` | Mặc định `true`: ẩn bài `not_rental` và `failed`. `false` hiện tất cả. Không đổi `summary`. |
| `sort` | `newest` (mặc định, như cũ), `price_asc`, `price_desc`, `area_desc`. Bài xếp theo tin khớp thấp nhất (`price_asc`) hoặc cao nhất (`price_desc`, `area_desc`); bài không có giá/diện tích xếp cuối; hòa thì theo lượt gửi mới nhất rồi `post_id`. Tin trong từng bài cũng xếp theo khóa đó. |

Ánh xạ `area` -> phường mới được dựng một lần từ `former_wards.yaml` (không viết tay): với mỗi phường cũ, mọi
`new_ward_code` trong `relations` (nhận trọn hoặc một phần) thuộc quận/huyện cũ đó. Một phường mới có thể nhận phần của hai
quận cũ (ví dụ `27364` thuộc cả `quan-6` và `quan-8`), khi đó khớp **cả hai** khóa; vì vậy lọc theo quận cũ là gần đúng ở ranh giới,
không khẳng định toàn bộ phường mới nằm trong quận cũ. Phần lớn bài thật chỉ ghi quận cũ (Q10, quận 9 cũ, Gò Vấp...) mà không có phường, nên `area` còn khớp theo **tên quận cũ
đã đọc được trong bài**: bảng `listing_districts(listing_id, district_key)` (migration `0008`) lưu các khóa mà bộ khớp quận
hiện hữu `Places.unconfirmed_districts` tìm thấy trong văn bản (gồm viết tắt Q1, Q.1, quận 1, không dấu; thêm Quận 2 và
Quận 9 vốn không có phường cũ trong từ điển). Ghi một lần lúc trích xuất (`services/processing.store_run`) và migration
`0008` tự điền cho dữ liệu cũ khi chạy `init-db` (không gọi LLM, bỏ qua bài demo). Tin gắn cờ `outside_hcm_province`
không có dòng nào nên không khớp quận nào. `ward` vẫn chỉ khớp theo mã phường: tin chưa rõ phường không khớp `ward`.
Bài chưa có phường và chưa nêu quận không khớp `area`/`ward`, nhưng vẫn hiện khi không đặt bộ lọc tin nào.
Mỗi tin trả thêm `old_districts: [{key, name}]` (quận cũ đã đọc được) để web ghi nguồn vị trí.

Phân trang và `total` tính **sau** lọc, lọc và sắp xếp thực hiện trong SQL; `limit <= 50`. Thêm vào phản hồi:
`matched_listings` (số tin khớp trên toàn bộ kết quả, không chỉ trang hiện tại) và `total_sent` (mọi bài đã gửi, không phụ thuộc lọc).

`GET /api/v1/me/posts/filters`: cùng xác thực và phạm vi sở hữu (chỉ dữ liệu của chính tài khoản, bỏ bài demo,
`not_rental`, `failed`), trả `{areas: [{key, name, listing_count, post_count}], wards: [{code, name, listing_count,
post_count}], types: [{type, listing_count}], price_min_vnd, price_max_vnd, area_min_m2, area_max_m2, total_listings}`.
`areas` suy từ phường của từng tin theo ánh xạ trên và từ quận cũ đã đọc được trong bài, mỗi tin tính một lần cho mỗi quận (một phường chung hai quận cũ được đếm ở cả hai); sắp xếp theo
số bài giảm dần. Giá/diện tích là biên trên các tin đó, null khi không có số liệu.

Migration `0007` thêm khóa chính `(post_id,user_id)` trong `post_submissions`, với `first_sent_at`,
khóa ngoại cascade và chỉ mục `(user_id,first_sent_at)`; INSERT SELECT dùng kiểu SQLAlchemy tương thích
SQLite/PostgreSQL, không dựng lại posts. Backfill từ `collector_id`/`first_seen_at`, giữ nguyên collector.
Ingest dùng UPSERT theo dialect, không đổi thời điểm đầu khi gửi lại. Trước thay đổi, gửi trùng chỉ cập nhật
post/version và idempotency key của người thứ hai; không có quan hệ sở hữu bền vững của người thứ hai.
Không tự quét để khôi phục toàn bộ lượt gửi cũ của người thứ hai từ các idempotency key có thời hạn lưu.
Khi người dùng gửi lại với key cũ còn hiệu lực, ghi nhận lượt gửi bằng thời điểm của key; key mới ghi thời điểm gửi lại.

### `POST /ingest/batch` — chế độ Thu thập

Vai trò: mọi tài khoản đã đăng nhập (từ 2026-11-12; trước đó chỉ `collector`). Tối đa 20 bài/lô. Schema từng bài: [ingest-post.schema.json](../../spec/schemas/ingest-post.schema.json).

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

Giới hạn ngày: tài khoản không có vai trò `collector` chỉ được thêm một số bài mới mỗi ngày (bảng §5; bài `duplicate` không tính). Chạm giới hạn giữa một lô thì các bài còn lại không có dòng trong `results` và `summary` có thêm `deferred`; bên gửi giữ các bài đó để gửi lại hôm sau. Đã hết hạn mức từ đầu lô thì trả `429` với mã `daily_limit`.

### `PUT /ingest/images?idempotency_key=…` — ảnh phòng của một bài đã gửi

Vai trò: mọi tài khoản đã đăng nhập; chỉ gắn được ảnh vào bài do chính tài khoản đó gửi. Thân request là file ảnh (JPEG, PNG, WebP). Phản hồi `200`: `{"status": "created" | "duplicate", "url": "…"}`. Lỗi: `404` chưa có bài, `409` bài đã đủ ảnh, `413` ảnh quá lớn, `415` không phải ảnh, `429` `daily_limit`, `503` máy chủ chưa bật lưu ảnh.

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

### API kết quả bot duyệt thử

Endpoint tổng hợp dành cho `reviewer` hoặc `admin`; danh sách từng listing chỉ dành cho `admin`.
Chưa đăng nhập: 401; vai trò không được phép: 403 (kể cả reviewer gọi danh sách từng listing).
Bot chạy song song, không tự duyệt. Endpoint chi tiết `GET /team/reviews/{listing_id}` không trả kết quả bot.

| Endpoint (tiền tố `/api/v1`) | Dữ liệu trả về |
|---|---|
| `GET /team/bot-reviews/summary` | `enabled`, `by_status` (`ok`, `error`), `by_verdict` (`approve`, `reject`, `unsure`), `compared`, `agreed`, `agreement_rate`, `bot_approve_human_reject`, `bot_reject_human_approve`, `unsure_share` |
| `GET /team/bot-reviews?page=1&page_size=50` | `items`, `total`, `page`, `page_size`; mỗi hàng có `id`, `listing_id`, `listing_version`, `model_id`, `prompt_version`, `status`, `verdict`, `confidence`, `reason`, `error_code`, `created_at`, `human_decision` |

`page >= 1`, `1 <= page_size <= 200`. Sắp xếp mới nhất trước; một hàng cho mỗi lần thử đã lưu,
kể cả lỗi (`verdict`, `confidence` có thể null). `human_decision` là approve/reject của đúng phiên bản
listing mà bot đã đọc, null nếu chưa có, nếu chỉ có merge/split hoặc nếu lần bot đó bị lỗi.
Lịch sử mới ghi số phiên bản vào `review_events.before_json.version`; lịch sử cũ suy ra từ thứ tự sự kiện.

Thống kê loại toàn bộ listing demo, kể cả kết quả demo đã lưu trước đây. `by_status` đếm mọi lần thử
của dữ liệu thật; `by_verdict` chỉ đếm kết quả `ok`. So sánh lấy kết quả `ok` mới nhất của mỗi
listing và quyết định người trên đúng phiên bản, được ghi từ lúc bot chạy trở đi. `compared` bao gồm
`unsure` nếu đã có quyết định người; `agreed` chỉ tăng khi hai bên cùng approve hoặc cùng reject.
`agreement_rate = agreed / compared`, null khi chưa có cặp; `unsure_share = số unsure / số ok`,
null khi chưa có kết quả thành công. Các chỉ số này chưa phải độ chính xác so với nhãn chuẩn.
Chưa đo độ chính xác thực tế; Gemini chưa từng được gọi bằng khóa thật trong phần triển khai này.

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `REVIEW_BOT_ENABLED` | `false` | Bật job duyệt thử; thiếu khóa Gemini thì không tạo job hoặc gọi bot |
| `REVIEW_BOT_MODEL_ID` | rỗng | Rỗng thì dùng `GEMINI_MODEL_ID` |
| `REVIEW_BOT_DAILY_CALL_LIMIT` | `500` | Hạn mức riêng theo ngày Việt Nam, 0 là không có hạn mức riêng; vẫn tính vào hạn mức chung |
| `REVIEW_BOT_TIMEOUT_SECONDS` | `20` | Số giây timeout chờ mạng cho mỗi pha HTTP của bot, phải hữu hạn và lớn hơn 0; độc lập với timeout trích xuất |

Hết hạn mức chung hoặc riêng thì bot chờ tới 00:00 Việt Nam hôm sau. Job phân tích/trích xuất được ưu tiên
trước bot ở lần claim tiếp theo. Mỗi claim bot xử lý tối đa một listing và đưa job lại hàng đợi nếu còn;
job mới đến có thể chờ một lượt gọi bot đang chạy, cộng xử lý cục bộ và giao dịch DB. Timeout HTTP là
theo pha, không phải giới hạn tuyệt đối 20 giây cho toàn lượt. Bot mặc định tắt trên môi trường triển khai.

### Các giới hạn chung

| Mục | Giá trị khởi đầu |
|---|---|
| Độ dài `text` | ≤ 20.000 ký tự |
| Lô thu thập | ≤ 20 bài/request |
| Tốc độ gửi của một token | ≤ 60 bài/phút |
| Bài mới mỗi ngày của một tài khoản không có vai trò `collector` | ≤ 200 (`INGEST_DAILY_LIMIT`, 0 = bỏ giới hạn) |
| Ảnh mỗi ngày của một tài khoản không có vai trò `collector` | ≤ 600 (`INGEST_IMAGE_DAILY_LIMIT`, 0 = bỏ giới hạn) |
| Lần gọi LLM mỗi ngày của cả hệ thống | ≤ 2.000 (`LLM_DAILY_CALL_LIMIT`, 0 = bỏ giới hạn). Hết hạn mức: bài thu thập cần LLM chờ tới hôm sau, bài phân tích chạy Regex |
| Phân tích đang chạy cùng lúc của một người | 1 |
| Lần gọi LLM tối đa cho một bài | 3 (gồm thử lại) |

## 6. Trạng thái triển khai

Đã có code trong `apps/api` (OpenAPI tại `/docs`). Những điểm khác hoặc thêm so với bản thỏa thuận trên được liệt kê trong [apps/api/README.md](../../apps/api/README.md#ghi-chú-triển-khai-so-với-api-contract).

### Response DTO B1

Listings/detail/comparison/stats đã có response model tại `apps/api/app/schemas/public.py` và schema OpenAPI đầy đủ. Trường extraction tùy chọn giữ nguyên, explicit null không bị bỏ. `posted_at`, `data_as_of`, `updated_at`, `data_from`/`data_to` có thể null. Detail giữ `cluster_id`, `price_history`, `sibling_count`, `is_demo`; card giữ `review_status`, `is_demo`, `text_complete`. Comparison còn trả `message`, `disclaimer` (nullable), `is_demo`; web hiển thị kết luận từ API.

Query thực tế: `?ward=A&ward=B&type=ccmn&type=phong_tro&page=2&page_size=20`. Không dùng key có dấu ngoặc hoặc ghép dấu phẩy. Các endpoint đọc công khai không đòi login; demo flag áp dụng nhất quán: máy chủ tắt demo chỉ trả kho thật, bật demo mặc định chọn demo và `?demo=false` chọn thật. Envelope listings có thêm `is_demo` để kho rỗng vẫn hiển thị đúng chế độ.
