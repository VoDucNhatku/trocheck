# Quy tắc chuẩn hóa

Bảng này là đặc tả cho module M4 và là nguồn của bộ test chuẩn hóa. Mỗi dòng là một ca kiểm: đầu vào → kết quả mong đợi. Thêm luật mới thì thêm dòng ví dụ trước, rồi mới viết code.

Ký hiệu: `—` là để trống. Tiền tính bằng đồng (số nguyên).

## 1. Giá thuê (`rent`)

| Đầu vào (span) | amount_form | amount_vnd / min–max | basis | period | Ghi chú |
|---|---|---|---|---|---|
| `5tr5/th` | exact | 5.500.000 | unknown | month | `tr5` = 5 trăm nghìn |
| `5tr5/th/phòng` | exact | 5.500.000 | per_unit | month | |
| `5.5tr`, `5,5tr`, `5,5 triệu` | exact | 5.500.000 | unknown | unknown | Thiếu chu kỳ → unknown; luật ngữ cảnh có thể đặt month (mục 6) |
| `5 triệu 5` | exact | 5.500.000 | unknown | unknown | |
| `5tr` | exact | 5.000.000 | unknown | unknown | |
| `3tr2` | exact | 3.200.000 | unknown | unknown | `tr2` = 2 trăm nghìn |
| `3tr25` | exact | 3.250.000 | unknown | unknown | Hai chữ số sau `tr` = chục nghìn |
| `2.800.000đ/tháng` | exact | 2.800.000 | unknown | month | |
| `2800k` | exact | 2.800.000 | unknown | unknown | |
| `1tr5/người` | exact | 1.500.000 | per_person | unknown | **Không** nhân với số người |
| `3 - 3,5tr` | range | 3.000.000–3.500.000 | unknown | unknown | |
| `từ 3tr` | starting_from | 3.000.000–— | unknown | unknown | Không dùng cho trung vị |
| `3tr bao điện nước` | exact | 3.000.000 | unknown | unknown | `includes = [electricity, water]` |
| `200k/ngày` | exact | 200.000 | unknown | day | Không quy ra tháng |
| `ib giá`, `inbox` | none | — | — | — | `visibility = hidden_explicit` |
| `giá thỏa thuận` | none | — | — | — | `visibility = hidden_explicit` |
| `5 củ` | exact | 5.000.000 | unknown | unknown | Tiếng lóng "củ" = triệu |

**Từ lóng chưa chắc nghĩa** (ví dụ "lít", "chai"): không quy đổi ở bản đầu, để `decision = needs_review`. Chỉ thêm vào từ điển sau khi kiểm trên bài pilot.

## 2. Phí (`fees`)

| Đầu vào | type | amount_vnd | unit | Ghi chú |
|---|---|---|---|---|
| `điện 3k5/số` | electricity | 3.500 | per_kwh | "số" = kWh |
| `điện 4k` | electricity | 4.000 | unknown | Không tự thêm /kWh khi bài không ghi |
| `điện giá nhà nước` | electricity | — | unknown | `state_rate = true` |
| `nước 100k/người` | water | 100.000 | per_person_month | Chu kỳ tháng là mặc định của phí theo người; nếu bài ghi khác thì theo bài |
| `nước 100k/tháng` | water | 100.000 | per_unit_month | Bài ghi /tháng: theo tháng; có /người thì ưu tiên per_person_month |
| `nước 20k/khối` | water | 20.000 | per_m3 | |
| `cọc 1 tháng` | deposit | — | months_of_rent | `months = 1` |
| `cọc 3tr` | deposit | 3.000.000 | one_time | |
| `dịch vụ 150k/phòng` | service | 150.000 | per_unit_month | |
| `free wifi`, `miễn phí internet` | internet | 0 | — | `free = true` |
| `gửi xe 100k` | parking | 100.000 | unknown | |

**Không cộng** tiền thuê với phí thành "tổng chi phí": thiếu lượng điện dùng và số người thì con số tổng là đoán.

## 3. Diện tích (`area`)

| Đầu vào | amount_form | value_m2 / min–max | from_dimensions |
|---|---|---|---|
| `30m2`, `30m²`, `30 mét vuông`, `30m` (khi đứng sau "DT"/"diện tích") | exact | 30 | false |
| `25-30m2` | range | 25–30 | false |
| `4x8m`, `4 x 8` | exact | 32 | true |
| `DT rộng` | none | — | — |

Với `nha_nguyen_can`, kích thước "4x16" có thể là diện tích đất, không phải diện tích ở. Ghi `from_dimensions = true` để thống kê giá/m² có thể loại.

## 4. Phòng (`room`)

| Đầu vào | Kết quả |
|---|---|
| `CCMN`, `chung cư mini` | property_type = ccmn |
| `phòng trọ`, `phòng khép kín` | property_type = phong_tro; "khép kín" → private_bathroom = true |
| `căn hộ dịch vụ`, `CHDV` | property_type = can_ho_dich_vu |
| `nhà nguyên căn`, `nhà riêng` | property_type = nha_nguyen_can |
| `1PN`, `1 phòng ngủ` | bedrooms = 1 |
| `2PN1WC` | bedrooms = 2, bathrooms = 1 |
| `studio` | bedrooms = 0 |
| `gác lửng`, `có gác` | mezzanine = true |
| `full nội thất`, `đầy đủ nội thất` | furnishing = full |

## 5. Vị trí (`location`)

1. Giữ **mốc nguyên văn** vào `landmark`.
2. Nếu bài ghi phường/xã: tra `apps/api/app/pipeline/lexicon/wards.yaml` để ra đơn vị hệ mới; `resolution = exact`. Danh mục TP.HCM có 168 đơn vị (113 phường, 54 xã, 1 đặc khu), mã chính thức dạng chuỗi 5 chữ số theo Quyết định 19/2025/QĐ-TTg, Phụ lục II, mục 79, Công báo 921 + 922 ngày 18/07/2025; đối chiếu dịch vụ danh mục Cục Thống kê ngày 13/11/2026. Mã demo có tiền tố `DEMO-` và chỉ dùng với bài demo.
3. Nếu chỉ có tên đường hoặc mốc: tra **từ điển địa bàn** của nhóm (`apps/api/app/pipeline/lexicon/places.yaml`): mỗi mục ghi mốc/đường → phường, người thêm, ngày kiểm. Có thì `resolution = from_street` / `from_landmark`.
4. Không tra được: `ward_code` để trống, `resolution = unresolved`. **Không đoán** phường từ mốc mơ hồ ("gần trường").

Tra tên đầy đủ, tên trần và alias bằng hai chỉ mục: giữ dấu (Unicode NFC, không phân biệt hoa/thường, gộp khoảng trắng) và bỏ dấu. Tên có dấu chỉ được khớp đúng tên/alias giữ dấu; chỉ đầu vào hoàn toàn không dấu mới được tra khóa bỏ dấu duy nhất. `phường Thanh Xuân` và `phường Phú Lãm` không nhận mã của Thạnh Xuân/Phú Lâm; `phuong ben thanh` vẫn tra được. Khi bỏ tiền tố để tra lại vẫn giữ điều kiện dấu của đầu vào gốc. Khóa thuộc nhiều mã bị loại khỏi chỉ mục tương ứng, không ghi đè theo thứ tự nạp. `Places.ambiguous_keys` công khai tập khóa bỏ dấu mơ hồ. Khi khóa bỏ dấu mơ hồ, chỉ cách viết có dấu khớp duy nhất mới phân xử: `xã Thanh An` → `25807`, `xã Thạnh An` → `27676`; `xa thanh an` và `thanh an` → rỗng. Alias trùng nguyên dạng cũng không có đích. `old_names` là quan hệ tạo thành, có thể chỉ góp một phần địa bàn; không tự biến thành alias.

Sau hợp nhất Regex/LLM, nếu có mã phường và bài nhắc đơn vị cấp huyện cũ bằng tiền tố quận/Q/Q., huyện, thị xã/TX., thành phố/TP hoặc tên trần trong danh mục, phải có quan hệ xác nhận mã đó trong `lexicon/districts.yaml`. Nhận có/không dấu, Q7/Q 7/Q.7/q7/quan 7/Quận 7 và các quận số 1–12 kể cả quận chưa có quan hệ. Tên số đứng trần chỉ kiểm khi là một đoạn địa chỉ riêng sau dấu phẩy. Không nhận các từ ngay sau tiền tố phường/xã/đặc khu làm tên quận: `phường Tân Bình`, `phường Bình Thạnh` giữ kết quả cũ. Thiếu quan hệ hoặc sai ngữ cảnh: bỏ mã/tên phường, đặt `resolution = unresolved`, `decision = needs_review`, thêm lý do `former_district_unverified`, nên không tự công bố. Ví dụ `phường An Phú, Thủ Đức` không nhận `25975`; `phường An Phú, Thuận An` được giữ `25975` theo Điều 1 khoản 82 Nghị quyết 1685/NQ-UBTVQH15. TP Hồ Chí Minh/HCM/Sài Gòn là thành phố hiện tại, không phải ngữ cảnh cấp huyện cũ.

`lexicon/provinces.yaml` lưu nguyên tên/mã 34 đơn vị cấp tỉnh từ [dịch vụ danh mục NSO](https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx), phương thức `DanhMucTinh`, ngày dữ liệu và ngày lấy 13/11/2026. Bài nhắc đơn vị cấp tỉnh ngoài mã `79` (có/không dấu, có/không tiền tố) bị bỏ phường và chuyển `needs_review` với lý do `outside_hcm_province`, kể cả khi chưa nhận được mã phường. Không coi từ ngay trong tên phường/xã là tỉnh. Bình Dương và Bà Rịa - Vũng Tàu cũ tính là TP.HCM; tên tỉnh cũ đầy đủ cũng không bị hiểu thành tên thành phố cũ nằm bên trong. Đây là guard bảo thủ theo toàn bài, chưa phân biệt phủ định hoặc địa danh dùng làm mốc. Demo không áp dụng hai guard này.

`districts.yaml` chỉ sao chép 155 quan hệ có nguồn của 30 đơn vị từ bộ bàn giao D1 `districts-hcm.yaml`; nguồn là [toàn văn Nghị quyết 1685/NQ-UBTVQH15](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-1685-nq-ubtvqh15-sap-xep-cac-dvhc-cap-xa-cua-thanh-pho-ho-chi-minh-nam-2025-119250616211341304.htm). Quan hệ chứng minh có địa bàn đóng góp, không chứng minh toàn bộ phường mới nằm trong một huyện cũ. Không sao chép phần chưa có nguồn. Kiểm ngữ cảnh toàn bài, áp dụng cho mọi listing, là lựa chọn bảo thủ: bài nhiều địa chỉ có thể phải duyệt thêm. Bộ demo không áp dụng kiểm tra mới này. Từ điển đường/mốc thật `places.yaml` hiện rỗng; danh mục hành chính không tự bổ sung khả năng trích xuất tên không tiền tố, phường số, tên không dấu hoặc tên viết tắt.

## 6. Luật ngữ cảnh (được phép suy ra, có ghi lại)

Những luật này cho phép điền giá trị không ghi trực tiếp. Mỗi lần áp dụng phải ghi `rule_id` vào evidence để người duyệt thấy.

| rule_id | Điều kiện | Suy ra |
|---|---|---|
| `CTX_PERIOD_MONTH` | Giá thuê ≥ 500.000 không có chu kỳ, bài là `rental_offer` | `period = month` |
| `CTX_BASIS_UNIT_SINGLE` | Bài có đúng một listing, `property_type` ∈ {ccmn, can_ho_dich_vu, nha_nguyen_can}, không có chữ "người", "ở ghép", "slot" | `basis = per_unit` |

Không có luật ngữ cảnh cho `phong_tro` ở bản đầu, vì phòng trọ cho ở ghép hay tính theo người phổ biến hơn. Mọi luật ngữ cảnh mới phải có ca đúng và ca phản ví dụ trong bảng này trước khi dùng.
