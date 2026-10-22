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
