# Hành trình người dùng

Năm hành trình dưới đây là "xương sống" của sản phẩm. Mỗi màn hình, API và bảng dữ liệu phải phục vụ ít nhất một hành trình. Ký hiệu J1–J5 dùng xuyên suốt repo.

## J1 — Người đi thuê nhận định một bài ngay trên Facebook

**Bối cảnh:** Lan đang lướt nhóm "Phòng trọ gần ĐH FPT", thấy một bài, muốn biết giá thật và có hợp lý không.

| Bước | Lan làm | Hệ thống làm | Lan thấy |
|---|---|---|---|
| 1 | Bấm nút ReNER cạnh bài (hoặc bôi đen nội dung rồi bấm icon extension) | Extension lấy chữ của bài, che số điện thoại | Popup xem trước nội dung sẽ gửi |
| 2 | Bấm **Phân tích** | Gửi lên API, nhận mã yêu cầu; pipeline trích xuất | Trạng thái "Đang đọc bài…" (không hiện phần trăm giả) |
| 3 | Chờ vài giây | Chuẩn hóa, tìm nhóm tin tương tự trong kho | Panel: giá thuê, diện tích, loại phòng, vị trí, các khoản phí |
| 4 | Đọc nhận định | Tính trung vị nếu nhóm có ≥10 tin | "Cao hơn 10% so với trung vị của 14 tin CCMN 25–35 m² cùng phường, dữ liệu 05/10–25/10" **hoặc** "Chưa đủ dữ liệu: mới có 6 tin tương tự" |
| 5 | Bấm **Xem trên web** | Mở trang chi tiết | Bôi màu từng nhãn trong bài, 3 tin giống nhất |

**Trường hợp khó phải xử lý:** bài "ib giá" → hiện "Bài không công khai giá", vẫn cho xem giá tham khảo của nhóm. Bài có 2 phòng giá khác nhau → hiện 2 thẻ, không trộn. Bài không phải cho thuê (cần tìm phòng, ở ghép) → báo loại bài, không trích giá.

## J2 — Người đi thuê tìm phòng theo ngân sách trên web

**Bối cảnh:** Minh cần phòng dưới 4 triệu ở phường X, ít nhất 20 m².

| Bước | Minh làm | Minh thấy |
|---|---|---|
| 1 | Mở **Tìm trọ**, chọn phường, loại phòng, khoảng giá, diện tích | Danh sách thẻ tin, tổng số kết quả, thời điểm dữ liệu mới nhất |
| 2 | Sắp xếp theo giá hoặc tin mới | Thẻ tin: giá (hoặc "Chưa có giá"), diện tích, phí đã biết/thiếu, ngày đăng |
| 3 | Mở một tin | Trang chi tiết: thông tin chính → giá và phí → đoạn chữ nguồn → nhóm so sánh |
| 4 | Mở **Thị trường** | Trung vị, khoảng P25–P75, giá/m² theo phường và loại phòng, kèm số tin N |

**Luật:** tin thiếu giá bị loại khi bật lọc giá, và trang ghi rõ "12 tin không có giá bị ẩn". Bộ lọc nằm trên URL để gửi link cho bạn.

## J3 — Nhóm thu dữ liệu bằng extension

**Bối cảnh:** TV4 cần 300–500 bài cho kho thị trường trong 2–3 tuần.

| Bước | Người thu làm | Hệ thống làm |
|---|---|---|
| 1 | Đăng nhập web bằng tài khoản thu thập, kết nối extension | Cấp token cho extension |
| 2 | Mở một nhóm Facebook mình là thành viên, bật **Thu thập** | Extension đọc các bài hiện trên màn hình khi người dùng cuộn, mở "Xem thêm" để lấy đủ chữ |
| 3 | Cuộn như bình thường | Mỗi bài: lấy chữ, link bài, thời gian đăng; che số điện thoại; gửi theo lô |
| 4 | Xem bộ đếm trên extension | "Phiên này: 37 bài gửi, 5 bài trùng bỏ qua, 2 bài lỗi" |
| 5 | Facebook hiện yêu cầu xác minh | Extension **dừng ngay**, báo người dùng; không tự vượt |
| 6 | Mở web **Kho dữ liệu** | Thấy bài theo trạng thái: chờ xử lý / đã trích / cần duyệt / loại |

Chi tiết kỹ thuật cho bên làm extension: [đặc tả extension](../03-system/05-extension.md).

## J4 — Nhóm duyệt dữ liệu

**Bối cảnh:** sau khi trích xuất tự động, một phần tin bị gắn cờ "cần xem".

| Bước | Người duyệt làm | Hệ thống làm |
|---|---|---|
| 1 | Mở **Hàng duyệt**, lọc theo lý do (Regex và LLM lệch nhau, nhiều phòng, thiếu giá, nghi trùng) | Hiện danh sách theo mức ưu tiên |
| 2 | Mở một tin | Bên trái: bài gốc đã che SĐT, bôi màu nhãn. Bên phải: các trường, nguồn (Regex/LLM), mức đồng thuận |
| 3 | Sửa giá trị sai, chọn lý do | Lưu bản sửa, ghi ai sửa, lúc nào |
| 4 | Bấm **Duyệt** / **Loại** / **Tách phòng** / **Gộp với tin…** | Tin được duyệt mới vào kho thống kê |

Chỉ tin đã duyệt hoặc có độ đồng thuận cao (Regex và LLM khớp) mới được dùng để tính thống kê. Quy tắc chính xác: [gộp trùng và thống kê](../02-data/05-gop-trung-va-thong-ke.md).

## J5 — Nhóm đánh giá và trình bày với giảng viên

| Bước | Người làm | Kết quả |
|---|---|---|
| 1 | Gán nhãn BIO ~100 bài theo [hướng dẫn](../02-data/02-huong-dan-gan-nhan.md); hai người gán chéo 20 bài | Tập chuẩn + hệ số đồng thuận |
| 2 | Khóa 10 bài kiểm thử phức tạp, chia theo cụm phòng | File split có hash |
| 3 | Chạy Regex, LLM, Hybrid trên tập phát triển; đọc lỗi; chỉnh luật/prompt | Kết quả dev, bảng lỗi |
| 4 | Đóng băng hệ thống (ghi version), chạy một lần trên 10 bài test | Bảng kết quả RQ1–RQ4 |
| 5 | Mở **Lab** trên web để trình bày | Bôi màu nhãn; so Regex/LLM/nhãn chuẩn cạnh nhau; bảng P/R/F1 |

## Ma trận hành trình → thành phần

| | Extension | Tìm trọ | Chi tiết tin | Thị trường | Kho dữ liệu | Hàng duyệt | Lab | Đánh giá |
|---|---|---|---|---|---|---|---|---|
| J1 | ● | | ● | ○ | | | | |
| J2 | | ● | ● | ● | | | | |
| J3 | ● | | | | ● | | | |
| J4 | | | | | ○ | ● | | |
| J5 | | | | | | | ● | ● |

● dùng chính · ○ dùng phụ
