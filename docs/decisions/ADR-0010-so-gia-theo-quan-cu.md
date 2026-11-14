# ADR-0010: So giá theo quận cũ khi phường chưa đủ mẫu

Trạng thái: Đề xuất. Ngày: 14/11/2026. Bổ sung và sửa đổi [ADR-0005](ADR-0005-nhom-so-sanh-n10.md) và [ADR-0006](ADR-0006-dieu-kien-vao-thong-ke.md).

## Bối cảnh

Thiết kế (README, ADR-0005, ADR-0006) so giá một tin với nhóm tin tương tự cùng **phường mới**, loại phòng, cách tính giá và khoảng diện tích, trong 30 ngày, loại cả cluster của tin đích, N ≥ 10, và chỉ lấy tin `auto_accepted` hoặc `approved`.

Trên kho thật 224 tin (số do chủ hệ thống đọc từ môi trường chạy, chưa tái đo ở đây), không tin nào so sánh được: mã phường chỉ có 34 tin, cách tính giá biết 104 tin (120 tin `basis_unknown`), diện tích 65 tin, tin được chấp nhận 15 tin. Nhưng 167 tin có quận cũ trong `listing_districts` (Bình Thạnh 25, Gò Vấp 22, Tân Phú 22, Quận 12 22...). Chủ hệ thống quyết định cải thiện đầu vào **và** thêm một tầng so theo quận cũ có nhãn rõ.

## Quyết định

**Đầu vào.** Luật ngữ cảnh mới `CTX_BASIS_UNIT_WHOLE` (xem [quy tắc chuẩn hóa §6](../02-data/04-quy-tac-chuan-hoa.md#6-luật-ngữ-cảnh-được-phép-suy-ra-có-ghi-lại)): giá của cả phòng/căn không có dấu hiệu tính theo người thì `basis = per_unit`, ghi `rule_id` vào evidence (suy ra, không phải đọc trực tiếp). Ở ghép, ký túc xá, giường, slot, cặp giá "1 người ... 2 người" không bị suy. Dòng phí (điện, nước, xe, rác, wifi, dịch vụ, cọc) không được coi là dấu hiệu.

**Tầng 1 (không đổi).** Nhóm cùng phường như ADR-0005, chỉ tin đã duyệt như ADR-0006.

**Tầng 2.** Chỉ chạy khi tầng 1 là `insufficient_data` (N < 10) hoặc `not_comparable` **chỉ vì** thiếu phường. Không cứu tin không so được vì lý do khác (giá không chính xác, không rõ cách tính giá, không rõ loại phòng, giá không theo tháng).
- Nhóm: cùng **một quận cũ**, cùng loại phòng, cùng cách tính giá, ưu tiên cùng khoảng diện tích nếu tin đích có diện tích (không thì nhóm rộng như tầng 1), cửa sổ 30 ngày (cùng cấu hình `MARKET_WINDOW_DAYS`), loại cả cluster của tin đích, N ≥ 10 tính theo cluster. Trong từng nguồn, nếu nhóm cùng khoảng diện tích thiếu mẫu thì thử mọi diện tích; chỉ dùng nhóm rộng khi đạt N tối thiểu, ghi `reason_codes = [..., area_band_relaxed]`, `criteria.area_band_relaxed = true`, `criteria.broad_group = true` và nhãn "mọi diện tích". Thứ tự: `accepted` cùng diện tích → `accepted` mọi diện tích → `auto_checked` cùng diện tích → `auto_checked` mọi diện tích. Không nới giá, cách tính, loại phòng, kỳ giá, cửa sổ hay điều kiện bài nhiều khu vực; nếu vẫn thiếu mẫu thì giữ kết quả thiếu mẫu như trước khi nới.
- Quận cũ của một tin: phường của tin thuộc đúng một quận cũ (khớp phường); phường thuộc hai quận cũ thì bài phải nêu một trong hai quận; hoặc tin không có phường và bài nêu **đúng một** quận như nơi của tin (khớp nhắc tên một quận). Không dùng vùng lân cận (đã loại ở `district_scan`), không dùng bài nhiều khu vực (`multi_area`), không dùng tin nêu hai quận mà không có phường. Dữ liệu demo không dùng tầng 2.
- Hai nguồn so sánh (`pool`), dùng theo thứ tự: (1) `accepted`: tin `auto_accepted`/`approved`; nếu N ≥ 10 thì dừng. (2) `auto_checked`, "tin thật đã qua kiểm tra tự động": tin thật, đóng góp, hiện hành, không bị `rejected`/`duplicate`, bài không phải `rejected_type`/`failed`, có giá chính xác theo tháng, cách tính giá và loại phòng đã biết, và không mang mã chặn `conflict`, `multi_listing`, `outside_hcm_province`, `possible_duplicate`, `llm_error`, `rent_llm_only`. Mã chưa phân giải vị trí (`former_ward_*`, `former_district_unverified`) được phép. Nguồn này chứa cả tin `accepted`, nên N không bao giờ nhỏ hơn nguồn trước. Nếu cả hai N < 10: `insufficient_data` mang `scope = old_district`, `pool = auto_checked` và N của nguồn lớn hơn khi tầng 1 không có phường; còn khi tầng 1 có phường thì giữ nguyên kết quả tầng 1.
- Phản hồi `Comparison` thêm `scope` (`ward` | `old_district`), `scope_label` (tên phường, hoặc "Bình Thạnh (cũ)") và `pool` (`accepted` | `auto_checked`), cùng `criteria.old_district_key`. Câu nhận định và giao diện luôn ghi: quận cũ, "không cùng phường" và nguồn ("chỉ gồm tin đã duyệt" hoặc "gồm tin chưa duyệt, đã qua kiểm tra tự động").
- Trang công khai chỉ trả số tổng hợp. Danh sách "tin tương tự" chỉ gồm tin đã duyệt (công khai); tin thuộc nguồn `auto_checked` chưa duyệt không bao giờ được nêu tên.

## Hệ quả

- Nhiều tin trước đây "chưa so sánh được" vì thiếu phường sẽ có nhận định, với nhóm rộng hơn (quận cũ gồm nhiều phường mới, giá lệch giữa phường không bị loại). Không thay ngưỡng N, ±10% hay cách tính chênh lệch (so với trung bình theo hợp đồng API hiện hữu).
- Nguồn `auto_checked` gồm tin chưa qua người duyệt: có thể lẫn tin sai. Vì vậy nhãn bắt buộc hiển thị và tầng này không được dùng cho trang Thị trường, số tổng hợp hay đánh giá RQ4.
- `CTX_BASIS_UNIT_WHOLE` có thể sai với bài bán phòng cho thuê theo đầu người nhưng không nêu dấu hiệu; số lượng bài bị ảnh hưởng chưa đo trên dữ liệu thật.
- Không đo được trên môi trường thật trong ADR này; số bài sẽ so sánh được trên kho thật là **chưa biết**.

## Xem lại khi

Kiểm tay một mẫu cho thấy tin `auto_checked` sai nhiều, hoặc nhóm quận cũ lệch giá giữa các phường đủ lớn để cần tách (ví dụ nới theo cụm phường mới thay vì cả quận).
