# ADR-0011 — Đánh thức worker và tiến độ riêng của người gửi

Trạng thái: triển khai trong worktree, chưa triển khai lên máy chủ.

## Quyết định

- PostgreSQL phát `pg_notify` trong giao dịch đưa job vào hàng đợi. Worker mở một kết nối
  `LISTEN trocheck_jobs` riêng, ở chế độ autocommit, trước khi thăm dò. Payload rỗng, không
  chứa nội dung bài hay danh tính. SQLite giữ Event trong tiến trình và thăm dò lùi dần
  1, 2, 4, 8, 16, 32, 60 giây. Mất kết nối LISTEN cũng dùng chu kỳ này.
- Một bộ điều phối thăm dò khi rỗi, kể cả khi `worker_concurrency=2` (mặc định). Khi có việc,
  các luồng chạy đồng thời, mỗi lần xử lý mở session riêng. Mỗi luồng có client AI riêng.
- Trước mỗi lần gọi AI, kể cả thử lại, worker giữ một lượt trong giao dịch riêng. Một
  `UPDATE ... WHERE ... RETURNING` quyết định quyền gọi dựa trên lịch sử và lượt đang giữ.
  `INSERT ... ON CONFLICT DO UPDATE` trước đó khóa hàng đếm để câu UPDATE đọc ảnh chụp
  mới sau khi writer khác commit, ở mức READ COMMITTED. Lượt của bot cũng chịu hạn mức chung.
  Khi kết quả được lưu, lượt đang giữ được chuyển thành lịch sử trong cùng giao dịch.
  Rollback kết quả không hoàn lượt đã gọi; cache không gọi AI nên không giữ lượt.
  Session đọc được kết thúc trước khi giữ lượt và chờ AI, tránh giữ hết pool kết nối.
- Việc giữ lượt thuộc lớp service để pipeline tiếp tục thuần, không nhập ORM/cơ sở dữ liệu.
- Uvicorn phục vụ trước. Tiến trình đọc lại bài cũ chờ health trả lời rồi chạy nền. Các
  thông báo lỗi đọc lại và tạo admin được giữ nguyên.
- Migration 0010 thêm thời điểm bắt đầu/kết thúc, bước hiện tại và bảng lượt AI đang giữ;
  có downgrade cho SQLite và PostgreSQL. Job cũ thiếu thời điểm không dùng làm mẫu ETA.
- Tiến độ dùng quyền sở hữu qua `PostSubmission`, cùng điều kiện loại demo và bài riêng
  hiện có. API không cho chọn tài khoản khác. ID không tồn tại và ID người khác đều trả 404;
  chưa đăng nhập trả 401. Response thành công là `private, no-store`.
- Xếp vị trí trên toàn hàng đợi; ưu tiên job đến hạn, trích xuất trước bot, rồi thời điểm
  tạo và ID, cùng thứ tự claim. Chỉ trả vị trí, không trả ID/nội dung bài của người khác.
  ETA = vị trí × trung vị tối đa 50 job hoàn tất gần nhất, ít nhất 5 mẫu hợp lệ.
  Tổng quan dùng ETA lớn nhất trong các bài của chính người gửi, không phụ thuộc bộ lọc/trang.
- Bot đang chờ/chạy cũng giữ tiến độ và cập nhật giao diện. Khi chỉ còn chờ người duyệt,
  web và tiện ích dừng cập nhật. Khi có việc, cập nhật mỗi 5 giây, có hủy khi rời trang.
  Lý do từ chối lấy từ sự kiện duyệt đã lưu. Lỗi xử lý chỉ lộ mã ngắn, giao diện dùng
  lời tiếng Việt, tránh trả nguyên lỗi nhà cung cấp có thể chứa dữ liệu nhạy cảm.

## Cách hiểu cần lưu ý

- Bài hoãn vì hết hạn mức AI giữ vị trí nhưng không đưa ETA tính bằng giây trước giờ
  được chạy lại; giao diện giải thích chờ sang ngày mới. Đây là lựa chọn tránh hẹn sai
  so với áp dụng công thức ETA cho cả job chưa đến hạn.
- Nếu tiến trình chết giữa lúc giữ lượt và gọi AI, lượt đó vẫn được giữ trong ngày.
  Không tự hoàn khi chưa biết nhà cung cấp đã nhận yêu cầu hay chưa, để tránh vượt hạn mức.
- `_handoff/` là ngoại lệ dành cho bằng chứng theo yêu cầu riêng của brief; không là mã sản phẩm.

## Kiểm chứng

Các kiểm thử `test_speed_*.py` kiểm quyền riêng tư, commit/rollback của NOTIFY, đánh thức
khác tiến trình, migration hai chiều, trung vị 50 mẫu, từng lần thử AI, tranh chấp hạn mức
và session riêng khi chạy 10 luồng. Kiểm thử health chạy entrypoint thật với bước đọc lại
bị giữ chờ và máy chủ Uvicorn thật. Kiểm thử trình duyệt đi qua các bước rồi xác nhận dừng
cập nhật, có ảnh màn hình điện thoại và máy tính trong `_handoff/post-progress-ui/`.

`scripts/measure_speed.py` tạo schema tạm trong cơ sở dữ liệu PostgreSQL riêng, đưa 30 bài
vào hàng đợi, dùng bộ xử lý giả gọi AI đúng một lần/bài và ngủ 2 giây/lần. Mã worker và
queue gốc được đọc nguyên văn bằng `git show HEAD:...` trong tiến trình con. Đo trường hợp
worker đã rỗi ở mức chờ 60 giây; không phải phép đo toàn bộ pipeline hay nhà cung cấp thật.
`scripts/prove_speed_wakeup.py` bỏ NOTIFY, yêu cầu kiểm thử thất bại, khôi phục byte gốc,
so SHA-256 rồi yêu cầu kiểm thử đạt. Log thực thi và số đo nằm trong `_handoff/`.
