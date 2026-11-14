# Gộp trùng, thống kê thị trường và nhận định giá

Module M8 và M9. Mục tiêu: một phòng được đăng 5 lần không được đếm thành 5 mẫu; một con số so sánh luôn đi kèm "so với cái gì, bao nhiêu mẫu, từ bao giờ".

## 1. Gộp trùng hai mức

### Mức 1 — cùng bài (M0, chắc chắn)

Cùng `external_post_id`, hoặc cùng `text_hash` trong cùng nhóm Facebook → cùng một post. Không tạo post mới, chỉ cập nhật `last_seen_at`. Bài bị sửa nội dung (hash khác, cùng `external_post_id`) → lưu **phiên bản mới** của post, giữ phiên bản cũ.

### Mức 2 — cùng phòng (M8, có thể sai)

Hai listing được đề xuất là **nghi cùng phòng** khi thỏa **tất cả**:

1. Cùng `property_type`, cùng phường (hoặc cùng `landmark` chuẩn hóa nếu chưa có phường).
2. Diện tích lệch ≤ 2 m² (hoặc cả hai đều thiếu diện tích).
3. Giá lệch ≤ 10% (giá có thể đổi giữa các lần đăng).
4. Độ giống nội dung: cosine TF-IDF ≥ ngưỡng (khởi đầu 0,8; chỉnh trên dữ liệu pilot).

| Độ chắc | Xử lý |
|---|---|
| Thỏa cả 4 và cosine ≥ 0,9 | Tự gộp vào cùng `cluster_id`, ghi lý do |
| Thỏa cả 4, cosine 0,8–0,9 | Đưa vào Hàng duyệt mục "nghi trùng" |
| Không thỏa | Hai cluster riêng |

Các ngưỡng là **giá trị khởi đầu cần kiểm** trên bài pilot (đếm cặp gộp đúng/sai), không phải chuẩn. Môi giới dùng chung một mẫu bài cho nhiều phòng khác nhau → cosine cao nhưng diện tích/giá khác → điều kiện 2–3 chặn lại. Tách cluster nhầm thì người duyệt bấm "khác phòng".

Mỗi cluster giữ **lịch sử giá** (các listing theo thời gian). Thống kê dùng **listing mới nhất** đủ điều kiện của mỗi cluster.

## 2. Điều kiện được tính vào thống kê

Một listing chỉ được dùng để tính thống kê khi thỏa **tất cả**:

| Điều kiện | Lý do |
|---|---|
| `post.contributed = true`, `is_demo = false` | Chỉ dữ liệu được phép, không lẫn dữ liệu demo |
| `review_status ∈ {auto_accepted, approved}` | Bỏ tin chưa xử lý xong hoặc bị loại |
| `rent.amount_form = exact` | "Từ 3tr", khoảng giá, giấu giá không phải một mức giá |
| `rent.period = month` | Không trộn giá ngày với giá tháng |
| `rent.basis` đúng với nhóm đang so | Giá/người và giá/phòng là hai nhóm khác nhau; `unknown` không vào nhóm nào |
| Có `ward_code` | Không xác định khu vực thì không biết so với ai |
| `property_type ≠ unknown` | |
| Thời gian (`posted_at`, thiếu thì `collected_at`) trong cửa sổ 30 ngày tính tới thời điểm tính | Tin quá cũ không phản ánh giá hiện tại; cửa sổ là cấu hình |
| Là listing mới nhất của cluster | Không đếm một phòng nhiều lần |

Ghi lại **số tin bị loại theo từng lý do**. Trang Thị trường và trang Đánh giá hiển thị các con số này, để thấy mẫu bị thu hẹp ở đâu (ví dụ nhiều tin thiếu phường).

## 3. Nhóm tin tương tự

Nhóm mặc định để so một tin đích:

- cùng `ward_code`
- cùng `property_type`
- cùng `basis` (`per_unit` hoặc `per_person`)
- cùng khoảng diện tích: `< 20` · `[20, 30)` · `[30, 40)` · `[40, 60)` · `≥ 60` m²
- trong cửa sổ 30 ngày
- **loại toàn bộ cluster của tin đích** (không tự so với chính nó hay bản đăng lại của nó)

Tin đích thiếu diện tích → so ở **nhóm rộng** (bỏ điều kiện diện tích) và ghi rõ "nhóm rộng, không xét diện tích". Không tự nới thêm điều kiện nào khác để đủ mẫu. Nội thất chưa dùng để chia nhóm ở bản demo vì nhiều bài không ghi; giao diện ghi rõ giới hạn này.

### 3b. Tầng 2: quận cũ ([ADR-0010](../decisions/ADR-0010-so-gia-theo-quan-cu.md), đề xuất)

Nhóm ở §3 là **tầng 1** và luôn được thử trước. **Tầng 2** chỉ chạy khi tầng 1 là `insufficient_data` (N < 10), hoặc `not_comparable` mà lý do duy nhất là thiếu phường. Tin đích không so được vì lý do khác (giá không chính xác, giá không theo tháng, chưa rõ cách tính giá, chưa rõ loại phòng) thì tầng 2 không cứu. Dữ liệu demo không có tầng 2.

| Điều kiện nhóm tầng 2 | Quy tắc |
|---|---|
| Quận cũ | Cùng **một** quận cũ. Một tin thuộc quận cũ khi: phường của tin thuộc đúng một quận cũ (khớp phường; phường thuộc hai quận thì bài phải nêu một trong hai), hoặc tin không có phường và bài nêu đúng một quận như nơi của tin (khớp nhắc tên một quận, từ `listing_districts`) |
| Không dùng | Quận chỉ được nhắc như vùng lân cận ("gần", "giáp"...: đã loại ở `district_scan`); bài nhiều khu vực (`listings.multi_area`); tin nêu hai quận mà không có phường |
| Giữ nguyên | Cùng loại phòng, cùng cách tính giá, khoảng diện tích khi tin đích có diện tích (không thì nhóm rộng), cửa sổ 30 ngày (`MARKET_WINDOW_DAYS`), loại cả cluster của tin đích, đếm theo cluster, N ≥ 10 |

Hai nguồn so sánh (`pool`), dùng theo thứ tự và luôn được ghi trong phản hồi:

1. `accepted`: tin `auto_accepted`/`approved` thỏa điều kiện §2 (trừ điều kiện có `ward_code`). Nếu N ≥ 10 thì dùng.
2. `auto_checked` ("tin thật đã qua kiểm tra tự động"): tin thật, đóng góp, hiện hành, `review_status` không phải `rejected`/`duplicate`, bài không phải `rejected_type`/`failed`, có giá chính xác theo tháng, cách tính giá và loại phòng đã biết, trong cửa sổ, và **không** mang mã chặn `conflict`, `multi_listing`, `outside_hcm_province`, `possible_duplicate`, `llm_error`, `rent_llm_only`. Mã vị trí chưa phân giải (`former_ward_*`, `former_district_unverified`) được phép. Nguồn này chứa cả tin `accepted`.

Nếu cả hai nguồn N < 10: khi tầng 1 có phường thì giữ nguyên kết quả tầng 1; khi tầng 1 thiếu phường thì trả `insufficient_data` với `scope = old_district` và N của nguồn lớn hơn. Phản hồi có `scope`, `scope_label` ("Bình Thạnh (cũ)"), `pool`, và `criteria.old_district_key`. Danh sách "tin giống nhất" chỉ gồm tin đã duyệt, kể cả khi số liệu lấy từ nguồn `auto_checked`.

## 4. Các chỉ số

Tính trên tập listing đủ điều kiện của nhóm, sau gộp trùng:

| Chỉ số | Cách tính | Điều kiện hiển thị |
|---|---|---|
| N | Số cluster trong nhóm | Luôn hiển thị |
| Trung vị giá | Median của `amount_vnd` | N ≥ 10 |
| P25, P75 | Phân vị 25 và 75, nội suy tuyến tính | N ≥ 10 |
| Giá/m² | Median của từng `amount_vnd / value_m2`, chỉ với tin có diện tích dương và `from_dimensions = false` | N riêng của chỉ số này ≥ 10 |
| Chênh lệch | `(giá tin − trung vị) / trung vị × 100%` | N ≥ 10 và trung vị > 0 |
| Độ mới | Ngày cũ nhất và mới nhất của dữ liệu trong nhóm | Luôn hiển thị |
| Tin giống nhất | 3 tin trong nhóm có cosine cao nhất với tin đích | Khi nhóm có tin |

Giá/m² là trung vị của các tỉ số, **không** lấy trung vị giá chia trung vị diện tích. P25–P75 mô tả độ phân tán của mẫu, **không phải** khoảng tin cậy.

## 5. Nhận định và câu chữ

| Điều kiện | Câu hiển thị |
|---|---|
| N < 10 | "Chưa đủ dữ liệu để nhận định: mới có {N} tin tương tự (cần ít nhất 10)." |
| Giá không phải `exact` | "Bài ghi giá dạng {từ…/khoảng…/không công khai}, chưa so sánh được." |
| Chênh lệch < −10% | "Thấp hơn {x}% so với trung vị của {N} tin {loại} {khoảng DT} cùng phường." |
| −10% đến +10% | "Gần trung vị ({x}%) của {N} tin {loại} {khoảng DT} cùng phường." |
| > +10% | "Cao hơn {x}% so với trung vị của {N} tin {loại} {khoảng DT} cùng phường." |

Tầng 2 (§3b) dùng cùng ngưỡng nhưng câu luôn ghi quận cũ, "không cùng phường" và nguồn tin, ví dụ:

| Điều kiện | Câu hiển thị |
|---|---|
| N < 10 ở tầng 2 (tin thiếu phường) | "Chưa đủ dữ liệu để nhận định: mới có {N} tin tương tự ở {quận} (cũ) (không cùng phường, {nguồn}; cần ít nhất 10)." |
| Đủ N | "{Thấp hơn/Gần/Cao hơn} mức trung bình ({x}%) của {N} tin {loại} {khoảng DT} ở {quận} (cũ) (không cùng phường, {nguồn})." |

`{nguồn}` là "chỉ gồm tin đã duyệt" (`pool = accepted`) hoặc "gồm tin chưa duyệt, đã qua kiểm tra tự động" (`pool = auto_checked`). Lưu ý: cài đặt hiện tại tính chênh lệch so với **trung bình** của nhóm (hợp đồng API, xem `03-api-contract.md`), nên câu thật ghi "mức trung bình"; các câu "trung vị" ở bảng trên là thiết kế gốc chưa được áp dụng cho phần chênh lệch.

Luôn kèm dòng: "Dữ liệu từ {ngày} đến {ngày}. Đây là giá chào thuê trong bài đăng đã thu, không phải giá giao dịch."

Ngưỡng ±10% và N ≥ 10 là **cấu hình**, không cứng trong code. N ≥ 10 là ngưỡng an toàn tối thiểu của proposal, không bảo đảm mẫu đại diện cho thị trường.

## 6. Ví dụ để viết test

Nhóm có 12 cluster đủ điều kiện, giá (triệu): 2,8 · 3,0 · 3,0 · 3,1 · 3,2 · 3,3 · 3,5 · 3,5 · 3,6 · 3,8 · 4,0 · 4,2. Tin đích 3,9 triệu.

- Trung vị = (3,3 + 3,5) / 2 = **3,4 triệu**.
- Chênh lệch = (3,9 − 3,4) / 3,4 ≈ **+14,7%** → "Cao hơn 14,7% so với trung vị…".
- Nếu chỉ còn 9 cluster → câu "Chưa đủ dữ liệu", không hiện trung vị.
- Nếu một trong 12 tin là bản đăng lại của tin đích (cùng cluster) → bị loại, còn 11.

Số liệu là ví dụ tự tạo để kiểm logic, không phải dữ liệu thị trường.

## 7. Xu hướng theo tuần (P1)

Chỉ vẽ khi mỗi tuần có N ≥ 10 trong cùng tiêu chí nhóm. Mỗi điểm kèm N của tuần đó, để người xem phân biệt "giá thay đổi" với "thu được tin khác loại".
