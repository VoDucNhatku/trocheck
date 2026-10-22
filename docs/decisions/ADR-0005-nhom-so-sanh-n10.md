# ADR-0005: Nhóm so sánh và ngưỡng N ≥ 10

Trạng thái: Đề xuất

## Bối cảnh

Proposal: so giá với trung vị nhóm tương tự (khu vực, loại hình, khoảng diện tích, nội thất, độ mới); N < 10 thì không kết luận.

## Quyết định

- Nhóm: cùng phường, loại hình, basis, khoảng diện tích (`<20`, `[20,30)`, `[30,40)`, `[40,60)`, `≥60` m²), cửa sổ 30 ngày, **loại cả cluster của tin đích**.
- **Chưa dùng nội thất** để chia nhóm ở bản demo vì nhiều bài không ghi; giao diện ghi rõ giới hạn.
- Đếm N theo cluster sau gộp trùng. N < 10 → `insufficient_data`.
- Không tự nới điều kiện để đủ mẫu; riêng tin thiếu diện tích được so ở "nhóm rộng" có ghi chú.
- Ngưỡng N, cửa sổ ngày, khoảng diện tích và ngưỡng ±10% là cấu hình.

## Hệ quả

- Nhiều tin sẽ "chưa đủ dữ liệu" khi kho nhỏ; đây là hành vi đúng.
- N ≥ 10 là ngưỡng an toàn tối thiểu, không bảo đảm mẫu đại diện.

## Xem lại khi

Kho đủ lớn để dùng thêm tiêu chí (nội thất), hoặc dữ liệu pilot cho thấy khoảng diện tích quá hẹp/rộng.
