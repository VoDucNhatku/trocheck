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
2. Nếu bài ghi phường/xã: tra thư viện đơn vị hành chính (ví dụ `vietnamadminunits`, proposal tài liệu [21]) để ra phường hệ mới; tên cũ giữ ở `old_ward_name`, `old_district_name`; `resolution = exact`.
3. Nếu chỉ có tên đường hoặc mốc: tra **từ điển địa bàn** của nhóm (`apps/api/app/pipeline/lexicon/places.yaml`): mỗi mục ghi mốc/đường → phường, người thêm, ngày kiểm. Có thì `resolution = from_street` / `from_landmark`.
4. Không tra được: `ward_code` để trống, `resolution = unresolved`. **Không đoán** phường từ mốc mơ hồ ("gần trường").

Từ điển địa bàn chỉ phủ 3–5 phường đã chốt ở tuần 1.

## 6. Luật ngữ cảnh (được phép suy ra, có ghi lại)

Những luật này cho phép điền giá trị không ghi trực tiếp. Mỗi lần áp dụng phải ghi `rule_id` vào evidence để người duyệt thấy.

| rule_id | Điều kiện | Suy ra |
|---|---|---|
| `CTX_PERIOD_MONTH` | Giá thuê ≥ 500.000 không có chu kỳ, bài là `rental_offer` | `period = month` |
| `CTX_BASIS_UNIT_SINGLE` | Bài có đúng một listing, `property_type` ∈ {ccmn, can_ho_dich_vu, nha_nguyen_can}, không có chữ "người", "ở ghép", "slot" | `basis = per_unit` |

Không có luật ngữ cảnh cho `phong_tro` ở bản đầu, vì phòng trọ cho ở ghép hay tính theo người phổ biến hơn. Mọi luật ngữ cảnh mới phải có ca đúng và ca phản ví dụ trong bảng này trước khi dùng.
