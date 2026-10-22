# Demo và nghiệm thu

## 1. Kịch bản demo (8–10 phút)

Chạy trên máy trình bày, local. Chuẩn bị trước: DB có kho thật đã thu + một bộ bài mẫu có nhãn DEMO; extension đã kết nối; tab Facebook nhóm đã mở; có video quay sẵn phòng khi mạng hoặc Facebook lỗi.

| # | Thời gian | Màn | Nói gì / làm gì | Chứng minh điều gì |
|---|---|---|---|---|
| 1 | 0:00 | Slide | Bài toán: bài đăng tự do, nhiều số tiền, không biết đắt hay rẻ | Vấn đề có thật |
| 2 | 1:00 | Facebook + extension | Bấm ReNER trên một bài thật → panel: giá, phí tách riêng, nhận định với N | J1 chạy trọn |
| 3 | 2:30 | Web `/phan-tich/{id}` | Bôi màu nhãn có chữ; bấm trường giá → đoạn chữ sáng lên | Neo nguồn, sequence labeling |
| 4 | 3:30 | Extension Thu thập | Bật thu thập, cuộn 10 bài, bộ đếm tăng; mở Kho dữ liệu thấy bài mới | J3, kho thật |
| 5 | 4:30 | Web Tìm trọ → Chi tiết | Lọc dưới 4 triệu, có tin "Chưa có giá" bị ẩn có thông báo; mở chi tiết, xem nhóm so sánh | J2, luật thiếu ≠ 0 |
| 6 | 5:30 | Lab | Một bài khó: Regex sai (lấy cọc làm giá), LLM đúng, Hybrid gắn cờ; bảng BIO | RQ1, RQ3 bằng ví dụ |
| 7 | 6:30 | Đánh giá | Bảng P/R/F1 theo trường × phương pháp trên test (đã đóng băng); tỉ lệ trả rỗng đúng; nhầm PRICE↔FEE | Kết quả có thật, có protocol |
| 8 | 7:30 | Thị trường | Bảng phường × loại, ô N < 10 ghi "chưa đủ dữ liệu" | Nhận định có điều kiện |
| 9 | 8:30 | Slide | Giới hạn: giá chào thuê, mẫu nhỏ, quyền dữ liệu; hướng phát triển | Trung thực về phạm vi |

**Dự phòng:** Facebook chặn → dùng bài đã thu sẵn và chế độ dán văn bản. Gemini hết hạn mức → kết quả cache của lần chạy trước (ghi rõ trên màn là kết quả đã lưu, không giả là vừa chạy) + kết quả Regex chạy trực tiếp.

## 2. Tình huống nghiệm thu sản phẩm

Mỗi dòng là một ca phải chạy được trước demo. Cột "Kiểm bằng" cho biết bằng chứng cần có.

| Mã | Tình huống | Kết quả phải thấy | Kiểm bằng | Tính năng |
|---|---|---|---|---|
| AT01 | `5tr5/th, điện 3k5/số, cọc 1 tháng` | Giá 5.500.000/tháng; điện, cọc là phí | Test pipeline + màn Chi tiết | F03, F05 |
| AT02 | Bài "ib giá" | "Bài không công khai giá"; không có số; không vào trung vị | Test pipeline + panel | F02, F06 |
| AT03 | `từ 3tr`, `3–3,5tr` | Hiện đúng dạng; không dùng cho trung vị | Test pipeline | F03, F06 |
| AT04 | `1tr5/người` | Hiện "/người"; không so với nhóm giá phòng | Test pipeline + comparison | F03, F06 |
| AT05 | Bài 2 phòng giá khác nhau | 2 listing; giá–diện tích đúng cặp | Test pipeline + màn Chi tiết | F03, F05 |
| AT06 | Bài có emoji và tiếng Việt có dấu | Bôi màu đúng vị trí chữ | Màn Chi tiết + test vị trí | F05 |
| AT07 | Bài cần thuê / ở ghép | Báo loại bài, không trích giá | Test pipeline + panel | F02, F03 |
| AT08 | Nhóm có 9 tin đủ điều kiện | "Chưa đủ dữ liệu", không hiện trung vị | Test M9 | F06 |
| AT09 | Nhóm có 12 tin, tin đích có bản đăng lại trong nhóm | Loại cả cluster của tin đích; N = 11 | Test M9 | F06 |
| AT10 | Cùng bài gửi hai lần từ extension | Một post trong kho | Test API + Kho dữ liệu | F01 |
| AT11 | Số điện thoại nhiều dạng | Kho chỉ có `[SĐT]` | Test M0 | F01 |
| AT12 | LLM lỗi / hết hạn mức | Kết quả Regex hiện với nhãn "một phần"; tin vào Hàng duyệt | Test M3b giả lập lỗi | F03, F07 |
| AT13 | LLM trả quote không có trong bài | Giá trị đó bị loại | Test M3b | F03 |
| AT14 | Người duyệt sửa giá, người khác sửa cùng lúc | Người sau nhận thông báo xung đột, không ghi đè âm thầm | Test API | F07 |
| AT15 | Tài khoản renter gọi API duyệt | 403 | Test API | F10 |
| AT16 | Lọc giá trên Tìm trọ | Tin không có giá bị loại, có thông báo số tin bị ẩn; URL giữ bộ lọc | Màn Tìm trọ | F04 |
| AT17 | Dữ liệu demo | Không vào thống kê thật, không vào đánh giá; có nhãn DEMO | Test M9 + màn | F04, F06 |
| AT18 | Chạy đánh giá trên test | Chỉ chạy được khi có tag đóng băng; manifest được ghi | Thư mục `eval/runs/` | F09 |

Các ca của extension: E1–E12 trong [đặc tả extension](../03-system/05-extension.md#7-tiêu-chí-nghiệm-thu-extension).

## 3. Định nghĩa "xong" cho một việc

- Chạy được trên máy người khác bằng lệnh trong README của phần đó.
- Có test cho phần logic (pipeline, API); có ảnh chụp các trạng thái cho phần giao diện.
- Ca nghiệm thu liên quan ở bảng trên đã chạy và có bằng chứng (lệnh + kết quả, hoặc ảnh).
- Không có khóa API, dữ liệu thật hay số điện thoại trong commit.
- Tài liệu liên quan trong `docs/` đã cập nhật nếu hành vi khác đặc tả.
