# Rủi ro, dữ liệu và pháp lý

## 1. Bối cảnh cần biết

| Điều | Ảnh hưởng | Nguồn (proposal) |
|---|---|---|
| Meta đã gỡ quyền truy cập Groups qua Graph API từ 22/04/2024 | Không có API chính thức để đọc bài trong nhóm; vì vậy dùng extension đọc trong phiên duyệt của người dùng | Tài liệu [19] |
| Điều khoản của Meta hạn chế thu thập tự động khi chưa được cho phép | Thu thập phải ở quy mô nhỏ, do người dùng chủ động, dừng khi bị yêu cầu xác minh; dữ liệu chỉ dùng nội bộ | Proposal mục 4; Meta: [How We Combat Scraping](https://about.fb.com/news/2021/04/how-we-combat-scraping/) |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có hiệu lực từ 01/01/2026 | Che số điện thoại, không lưu tên người đăng, giới hạn mục đích và thời gian lưu | Tài liệu [20] |
| Từ 01/07/2025 cả nước còn 34 tỉnh, bỏ cấp huyện | Vị trí phải chuẩn hóa sang phường hệ mới, giữ tên cũ trong bài | Tài liệu [1], [21] |

Repo này không phải ý kiến pháp lý. Các biện pháp dưới đây là cam kết vận hành của nhóm trong phạm vi đồ án, đúng như proposal đã nêu.

## 2. Cam kết về dữ liệu

1. **Chỉ thu** bài trong các nhóm mà người thu là thành viên, nằm trong danh sách nhóm được phép.
2. **Quy mô nhỏ:** tối đa 50 bài/phiên, tổng 300–500 bài cho cả đồ án.
3. **Người dùng chủ động:** extension không tự chạy nền, không tự cuộn, không dùng nhiều tài khoản/proxy, không vượt CAPTCHA hay bước xác minh.
4. **Ẩn danh ngay trên máy:** che số điện thoại trước khi gửi; server che lại lần nữa. Không thu tên, ảnh đại diện, bình luận, ảnh bài.
5. **Chỉ dùng nội bộ:** không đăng lại bài lên Internet; web chạy local cho nhóm và người chấm.
6. **Không commit dữ liệu thật** lên GitHub. Repo chỉ chứa bài mẫu tự tạo (`spec/fixtures/`, nhãn DEMO).
7. **Gửi LLM tối thiểu:** chỉ gửi chữ bài đã che SĐT; không gửi link, tên nhóm hay thông tin người thu.
8. **Có thời hạn:** xóa dữ liệu thu thập khi kết thúc môn; bài nhận định không đóng góp xóa sau 7 ngày.

## 3. Bảng rủi ro

| # | Rủi ro | Khả năng | Ảnh hưởng | Cách xử lý | Người theo dõi |
|---|---|---|---|---|---|
| R1 | Facebook đổi giao diện làm extension đọc sai | Cao | Không thu được bài | Bộ chọn trong file cấu hình; trang kiểm tra HTML mẫu; đường dự phòng: nhận định + đóng góp, dán văn bản, nhập file | TV4 |
| R2 | Tài khoản thu bị Facebook yêu cầu xác minh / hạn chế | Trung bình | Chậm thu kho | Dừng ngay; giảm tốc độ; chia việc cho nhiều thành viên tự nguyện (mỗi người tài khoản của mình); dùng đường dự phòng | TV4 |
| R3 | Gemini hết hạn mức hoặc trả sai định dạng | Trung bình | Thiếu kết quả LLM | Chỉ gọi khi Regex không chắc (chế độ tiết kiệm); cache; thử lại có giãn cách; kiểm schema; giữ kết quả Regex | TV2 |
| R4 | Không đủ tin tương tự để so sánh | Cao | Nhận định toàn "chưa đủ dữ liệu" | Thu tập trung vào 3–5 phường và 1–2 loại hình phổ biến; báo "chưa đủ dữ liệu" thay vì con số | TV4, TV1 |
| R5 | Môi giới đăng lại một tin nhiều lần làm lệch thống kê | Cao | Trung vị lệch | Gộp trùng hai mức; chỉ gộp khi đủ căn cứ; thống kê theo cluster | TV1 |
| R6 | Nhầm thay đổi thành phần dữ liệu với thay đổi giá | Trung bình | Kết luận xu hướng sai | Luôn hiện N theo nhóm và theo tuần; so cùng tiêu chí nhóm | TV1 |
| R7 | Rò rỉ dữ liệu test | Trung bình | Kết quả không tin được | Khóa 10 bài test từ đầu, chia theo cụm phòng, chỉ chạy một lần sau đóng băng | TV1 |
| R8 | Gán nhãn chậm hơn dự kiến | Cao | Thiếu tập chuẩn | Pilot 20 bài để đo tốc độ thật ngay tuần đầu; chia đều 4 người; thu nhỏ tập nhưng giữ split | TV1 |
| R9 | Trễ tiến độ (repo bắt đầu tuần 2) | Cao | Không kịp demo | Ưu tiên P0; P1 chỉ làm khi M2 đạt; đường găng ở [lộ trình](01-lo-trinh-va-phan-cong.md) | Cả nhóm |
| R10 | Lộ khóa API hoặc dữ liệu thật trên GitHub | Thấp | Nghiêm trọng | `.env` trong `.gitignore`; review PR kiểm; repo private | Cả nhóm |
