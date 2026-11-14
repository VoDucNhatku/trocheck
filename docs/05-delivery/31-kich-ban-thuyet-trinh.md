# Kịch bản thuyết trình 5 phút

Dùng cho buổi trình bày luồng thật trên https://trocheck.vercel.app (`DEMO_MODE=false`). Chuẩn bị hai tài khoản: tài khoản đã lướt nhiều bài (có sẵn dữ liệu) và một tài khoản mới để cho thấy người dùng thử chạy được ngay.

## Chuẩn bị (trước buổi trình bày)

1. Mở `https://trocheck-api.onrender.com/api/v1/health`: phải thấy `"demo_mode": false`. Dịch vụ miễn phí có thể ngủ; mở trước 2–3 phút cho nó thức.
2. Trình duyệt A (tài khoản có dữ liệu): đã cài extension, đã kết nối, mở sẵn tab `Bài của tôi`.
3. Trình duyệt B (hồ sơ Chrome khác, chưa đăng nhập): dùng cho tài khoản mới.
4. Một nhóm hoặc một lượt tìm kiếm Facebook có bài cho thuê (ví dụ tìm "phòng trọ Thủ Đức", tab Bài viết).

## Phút 0–1: vấn đề

"Người thuê lướt hàng trăm bài trên Facebook nhưng không biết giá đó đắt hay rẻ so với khu vực. TrọCheck đọc giúp bài, tách giá, diện tích, khu vực, rồi so với kho bài mọi người đã thu."

## Phút 1–2: tài khoản mới chạy được ngay (trình duyệt B)

1. Đăng ký tài khoản mới, vào `Bài của tôi`: khung "Bắt đầu trong 4 bước" hiện trạng thái thật (chưa xong).
2. Bấm "Xem hướng dẫn cài extension" → tải file, giải nén, `chrome://extensions` → Developer mode → Load unpacked.
3. Vào `Tài khoản` → "Kết nối extension trên trình duyệt này". Quay lại `Bài của tôi`: bước 1–2 chuyển "Đã xong".
4. Mở Facebook, tìm "phòng trọ Thủ Đức", cuộn 10–20 bài. Nhãn góc dưới: "TrọCheck đang lưu · N bài mới".
5. Quay lại `Bài của tôi`, tải lại sau khoảng 30–60 giây: bài hiện kèm giá, diện tích, khu vực.

Nói: "Người dùng không phải làm gì trong extension, chỉ lướt như bình thường."

## Phút 2–3: lọc theo nhu cầu (trình duyệt A)

1. `Bài của tôi` → Khu vực "Thủ Đức (cũ)", giá đến 3 triệu, sắp xếp giá tăng dần → Áp dụng.
2. Dòng kết quả "N phòng khớp trong M bài đã gửi". Mỗi thẻ có nhãn "Ở đúng phường" / "Bài nhắc tên quận" / "Bài nhiều khu vực".
3. Chỉ một thẻ: dòng so giá, ví dụ "Thấp hơn 8% so với mức trung bình của 23 tin phòng trọ ở Thủ Đức (cũ) · không cùng phường · gồm tin chưa duyệt".

Nói: "Từ 07/2025 TP.HCM không còn quận, nhưng người thuê vẫn nghĩ theo quận. Hệ thống đổi phường mới về quận cũ theo bảng sáp nhập, và đọc cả tên quận trong bài. Bài chỉ nói 'gần Q1' không bị tính là Quận 1."

## Phút 3–4: kho chung (Thị trường, Tìm trọ)

1. `Thị trường` mở mặc định "Theo quận cũ": mỗi ô là trung bình giá của một quận × loại phòng, có số tin N. Ô dưới 10 tin ghi "Chưa đủ dữ liệu" và "n/10 tin".
2. Bấm ô "Thủ Đức (cũ) · Phòng trọ" → sang `Tìm trọ` đã lọc sẵn. Tin chưa duyệt có nhãn "Chưa duyệt · đã che liên hệ".
3. Bật "Chỉ tin đã duyệt" để cho thấy hai lớp dữ liệu.

Nói: "Người dùng sau hưởng dữ liệu của người dùng trước: tài khoản mới chưa gửi bài nào vẫn thấy mặt bằng giá Thủ Đức."

## Phút 4–5: độ tin cậy và giới hạn

- Ngưỡng N ≥ 10 tin; chưa đủ thì không đưa con số. Đây là giá chào thuê, không phải giá giao dịch.
- Tin chưa duyệt chỉ vào kho khi qua kiểm tra tự động (giá theo tháng rõ ràng, rõ loại phòng và cách tính giá, không có dấu hiệu xung đột, không phải bài nhiều khu vực); luôn có nhãn.
- Không ai thấy ai đã gửi bài nào; số điện thoại được che ngay trên máy trước khi gửi.
- Mỗi tài khoản gửi tối đa 200 bài và 600 ảnh mỗi ngày; hết hạn mức ảnh thì bài vẫn gửi (tiện ích 0.3.4).

## Nếu có sự cố khi trình bày

| Hiện tượng | Xử lý |
|---|---|
| Trang chờ lâu lần đầu | API miễn phí đang thức dậy; chờ 30–60 giây rồi tải lại |
| Bài mới chưa hiện trong `Bài của tôi` | Máy chủ xử lý theo hàng đợi, có thể mất đến 60 giây; tải lại |
| Extension báo "Chưa kết nối" | `Tài khoản` → kết nối lại; mã kết nối có hạn 30 ngày |
| Thị trường ô nào cũng "Chưa đủ dữ liệu" | Chuyển sang quận nhiều tin nhất (đứng đầu bảng) hoặc nói về ngưỡng N ≥ 10 |
