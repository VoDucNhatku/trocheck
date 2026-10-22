# ADR-0004: Mô hình giá tách bốn chiều

Trạng thái: Đề xuất

## Bối cảnh

"Giá" trong bài có nhiều dạng: một số, khoảng, "từ", giấu giá, theo người, theo ngày, bao phí. Gộp tất cả vào một ô số làm trộn giá người với giá phòng và biến "ib giá" thành 0.

## Quyết định

Giá thuê (`rent`) gồm các chiều độc lập, định nghĩa ở [từ điển dữ liệu §4.1](../02-data/01-tu-dien-du-lieu.md#41-rent--giá-thuê):

- `visibility`: `disclosed` · `hidden_explicit` · `not_stated` · `ambiguous` — bài nói gì.
- `amount_form`: `exact` · `range` · `starting_from` · `none` — dạng số.
- `basis`: `per_unit` · `per_person` · `unknown`.
- `period`: `month` · `day` · `unknown`.
- `includes`: các khoản đã bao trong giá.

Trạng thái của **hệ thống** (đã trả lời, để trống, cần duyệt) nằm riêng ở `decision`, không trộn vào `visibility`. "Model không đọc được" không được ghi thành "bài mơ hồ".

## Hệ quả

- Chỉ `exact` + `month` + `basis` xác định mới vào trung vị.
- Giao diện hiển thị được "Chưa có giá", "Từ 3 triệu", "1,5 tr/người" thay vì một con số sai.

## Xem lại khi

Phân tích lỗi trên dev cho thấy một dạng giá phổ biến chưa có trong mô hình.
