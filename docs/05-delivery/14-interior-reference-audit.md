# Audit hai bộ ảnh riêng biệt

26/10/2026. Đã mở xem 7 PNG Stitch hợp lệ và đủ 11 ảnh đời thực bằng view_image. Bản gốc chỉ nằm `.tmp`, bị Git ignore; không đưa ảnh/contact vào public hoặc fixture.

| Stitch | Kiểm | Giữ / chỉnh / thiếu trạng thái |
|---|---|---|
| 1 Trang chủ | PNG 389950 byte, đã xem | Giữ ý nguyên văn → chuẩn hóa; landing sân nhà hiện tại giữ nguyên. Bỏ claim tốc độ/độ chính xác/số tin dựng. |
| 2 Tìm trọ | 28 byte, hỏng | Không claim đã xem ảnh; đọc HTML tham khảo. Giữ hành vi thật trang hiện có; cần gửi lại nếu muốn đối chiếu hình. |
| 3 Chi tiết | PNG 688815 byte, đã xem | Giữ evidence tương tác, tách giá/phí. Không lấy ảnh “xác thực”, tiện ích/0đ/ước tính phí hay giá gần để lấp dữ liệu thiếu. Bổ sung insufficient/error. |
| 4 Thị trường | PNG 907217 byte, đã xem | Giữ matrix N/quartile. Bỏ trend, % NER, khuyên thuê, PDF/Excel không có endpoint. Đơn vị, exclusions, dates, empty/error là bắt buộc. |
| 5 Phân tích | PNG 802575 byte, đã xem | Giữ nhập → nguồn/giá/phí → đóng góp. Bỏ PhoBERT, 94.8%, 0.42s, config model không có. Thêm masked preview, queued/running/error/partial/429. |
| 6 Đăng nhập | PNG 264315 byte, đã xem | Giữ label/password visibility. Bỏ Google/reset/remember không có schema; không điền sẵn credential. Thêm inline error/session expired và return path. |
| 7 Kho | PNG 496379 byte, đã xem | Giữ bảng, role shell, filter. Bỏ crawl source sync/add, online badge, notification, % và KPI không API. Thêm date nullable/reprocess state/empty/403. |
| 8 Hàng duyệt | 28 byte, hỏng | Chỉ đọc HTML; cần ảnh gửi lại để đối chiếu. Thiết kế từ queue API thật, reason trước excerpt. |
| 9 Duyệt một tin | 28 byte, hỏng | Chỉ đọc HTML; cần gửi lại. Làm source/Regex/LLM/edited, version 409, dirty, confirm. |
| 10 Lab | PNG 653458 byte, đã xem | Giữ alignment và BIO disclosure. Bỏ mock PhoBERT/F1 và lời khen model. LLM unavailable, gold test lock, không ghi gold. |
| 11 Đánh giá | 28 byte, hỏng | Chỉ đọc HTML; cần gửi lại. Run thật/empty, metric null/frozen, không dựng số. |

## Ảnh đời thực (riêng tư)

| Ảnh | Quan sát áp dụng |
|---|---|
| 01–02 | Bài B08 + ảnh phòng có gác/bếp. 5,2 triệu/tháng; diện tích không ghi. Phí điện/nước/dịch vụ/tạm trú tách riêng. Ảnh không chứng minh m². |
| 03–04 | 4,7 triệu; khoản theo người và phòng khác nhau. Điện hành lang 50k thiếu đơn vị; không gộp. Ngày dự kiến trống không phải posted_at. |
| 05–06 | 6 triệu; điện/nước/dịch vụ/xe riêng. Mô tả thú cưng/xe điện là lời người đăng; không thành chứng nhận. |
| 07–08 | 6,5 triệu; gác cao 1,6m là chiều cao. Nước m³ và nước nóng/người khác khoản; cọc 1,5 tháng. Wi-Fi nằm trong dịch vụ không cộng lần nữa. |
| 09 | Bài ngắn, ảnh dọc, hashtag giá; screenshot có contact và bị cắt. Chỉ dùng hiểu tình huống, không chép nguyên. Không tự gắn period/basis. |
| 10 | Quảng cáo 20P và hashtag, có contact. Không suy 20 bedrooms/20 listings. Không gắn ảnh này vào API listing khác. |
| 11 | #1tr499k, Xem thêm; nội dung không đầy đủ. Nhãn text_complete cần do người gửi xác nhận, không giả nội dung toàn bài. |

Tỷ lệ ảnh đa dạng (dọc, ngang, collage), đời sống trọ có gác/bếp nhỏ/cửa kính và đồ dùng thực tế. Khu đọc tin ưu tiên chữ + evidence, không biến ảnh tham khảo thành album sản phẩm. Chưa xây OCR hoặc extraction từ ảnh. Demo tự tạo có nhãn rõ, không dùng nguyên bài thật.
