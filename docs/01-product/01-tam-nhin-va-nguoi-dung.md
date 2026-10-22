# Tầm nhìn, người dùng và phạm vi

## 1. Vấn đề

Bài cho thuê phòng trên các nhóm Facebook quanh trường đại học được viết tự do: viết tắt (`5tr5`, `1PN`, `CCMN`, `3k5/số`), nhiều con số cùng lúc (giá, cọc, điện, nước, dịch vụ), có bài giấu giá ("ib giá"), có bài gom nhiều phòng. Người đi thuê, chủ yếu là sinh viên, gặp ba khó khăn:

1. **Đọc nhầm giá.** Tiền cọc, giá theo người hoặc giá điện dễ bị hiểu là giá thuê.
2. **Không so được.** Không biết 3,5 triệu cho phòng 25 m² ở phường đó là cao hay thấp.
3. **Mất thời gian.** Phải đọc từng bài, tự ghi chép.

## 2. Câu trả lời của sản phẩm

> Với một bài đăng, ReNER-VN cho biết **giá thuê thật là bao nhiêu, phí gồm những gì**, chỉ rõ chữ nào trong bài nói điều đó, và **so với các tin tương tự đã thu** nếu có đủ dữ liệu.

Sản phẩm **không** định giá nhà, không đưa lời khuyên tài chính, không khẳng định phòng còn trống. Mọi con số so sánh là **giá chào thuê trong các bài nhóm đã thu được**, không phải giá giao dịch.

## 3. Người dùng

| Người dùng | Là ai | Họ cần | Họ dùng phần nào |
|---|---|---|---|
| **Người đi thuê** (chính) | Sinh viên tìm phòng quanh trường | Hiểu nhanh một tin; tìm tin theo ngân sách; biết giá có hợp lý không | Extension chế độ Nhận định; web: Tìm trọ, Chi tiết tin, Thị trường |
| **Người thu dữ liệu** | Thành viên nhóm (TV4 điều phối) | Đưa bài từ các nhóm Facebook vào kho nhanh, không trùng | Extension chế độ Thu thập; web: Kho dữ liệu |
| **Người duyệt dữ liệu** | Thành viên nhóm | Sửa kết quả trích xuất sai, gộp tin trùng, loại bài rác | Web: Hàng duyệt |
| **Người làm đánh giá** | TV1, TV4 | Gán nhãn tập chuẩn, chạy Regex/LLM/Hybrid, đọc lỗi, trả lời RQ1–RQ4 | Web: Lab trích xuất, Đánh giá; thư mục `eval/` |
| **Người chấm đồ án** | Giảng viên | Thấy được bài toán gán nhãn chuỗi, cách đo và kết quả | Web: Lab; báo cáo đánh giá; demo |

Giai đoạn đồ án: tất cả chạy trên máy nhóm, một tài khoản demo cho mỗi vai trò. Chưa có đăng ký công khai.

## 4. Giá trị và chi phí của từng bên

| Bên | Nhận được | Bỏ ra |
|---|---|---|
| Người đi thuê | Đọc đúng giá/phí, so sánh có căn cứ | Mở extension hoặc web |
| Nhóm thu và duyệt | Kho dữ liệu sạch để thống kê | Thời gian lướt nhóm, sửa nhãn, gộp trùng |
| Nhóm đánh giá | Câu trả lời cho RQ1–RQ4 | Gán nhãn khoảng 100 bài, gán chéo 20 bài |
| Chủ trọ / người đăng | Không có tính năng riêng | Bài đăng bị đọc; vì vậy che số điện thoại, không lưu tên |

## 5. Phạm vi

| Khía cạnh | Trong phạm vi | Ngoài phạm vi |
|---|---|---|
| Loại tin | Cho thuê để ở: phòng trọ, chung cư mini (CCMN), căn hộ dịch vụ, nhà nguyên căn | Mua bán nhà đất, tìm người ở ghép, cần thuê |
| Khu vực | 3–5 phường quanh cơ sở trường của nhóm (chốt ở tuần 1) | Toàn thành phố, toàn quốc |
| Thông tin | Giá thuê, Diện tích, Vị trí, Số phòng (kèm loại hình), các khoản phí: cọc, điện, nước, dịch vụ, internet, gửi xe | Pháp lý, tiện ích chi tiết, nội dung ảnh |
| Dữ liệu | Tập chuẩn ~100 bài gán tay; kho thị trường 300–500 bài tự trích xuất | Thu thập quy mô lớn |
| Phương pháp | Regex, LLM (Gemini) có neo nguồn, phương pháp lai | Huấn luyện mô hình mới (hướng phát triển) |
| Nhận định | So giá và giá/m² với nhóm tin tương tự; xu hướng theo tuần nếu đủ dữ liệu | Định giá, giá giao dịch, lời khuyên tài chính |

## 6. Thế nào là thành công?

**Về sản phẩm (demo):** với một bài thật chưa từng thấy, người xem thấy đúng giá/phí kèm đoạn chữ nguồn trong vài giây; tìm được tin theo ngân sách; thấy nhận định giá hoặc lý do chưa nhận định được.

**Về đồ án:** trả lời RQ1–RQ4 trên tập chuẩn, có 10 bài kiểm thử giữ riêng và chỉ chạy một lần sau khi đóng băng hệ thống. Xem [kế hoạch đánh giá](../04-evaluation/01-ke-hoach-danh-gia.md).

Đề bài yêu cầu tối thiểu: trích xuất thành công 4 trường từ **10 bài thực tế phức tạp**. Repo này đặt mức đó làm điểm sàn của demo.
