# ADR-0006: Điều kiện để một tin được tính vào thống kê

Trạng thái: Đề xuất

## Bối cảnh

Proposal: "chỉ các tin người dùng đồng ý đóng góp, có độ tin cậy cao và đủ giá thuê, vị trí" mới vào kho. Với 300–500 bài, duyệt tay toàn bộ quá tốn công.

## Quyết định

Tin vào thống kê khi `review_status ∈ {auto_accepted, approved}` và thỏa các điều kiện dữ liệu ở [gộp trùng và thống kê §2](../02-data/05-gop-trung-va-thong-ke.md#2-điều-kiện-được-tính-vào-thống-kê). `auto_accepted` chỉ khi giá và vị trí là `both_agree` hoặc `regex_only` không cờ, và bài không có nhiều phòng. Còn lại vào Hàng duyệt.

## Hệ quả

- "Đồng thuận" là trạng thái quy trình, không phải xác suất đúng: hai phương pháp có thể cùng sai. Kiểm tay một mẫu kho (RQ4) để ước lượng.
- Bài khó (nhiều phòng, xung đột) dễ bị loại hơn bài dễ, có thể làm mẫu lệch. Ghi số tin bị loại theo lý do để thấy mức ảnh hưởng.

## Xem lại khi

Kiểm tay cho thấy tỉ lệ sai trong `auto_accepted` cao → siết điều kiện hoặc duyệt tay nhiều hơn.
