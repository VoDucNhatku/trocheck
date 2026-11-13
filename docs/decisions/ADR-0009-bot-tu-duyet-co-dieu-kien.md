# ADR-0009: Bot tự duyệt có điều kiện, mặc định tắt

Trạng thái: Đã triển khai sau ADR-0008; chủ hệ thống quyết định bật. Ngày: 13/11/2026.

## Bối cảnh và phạm vi

Một người quản lý không thể xử lý mãi hàng chờ tăng dần. Cần cho phép công bố một tập tin rất hẹp,
giữ nguyên chế độ quan sát (shadow mode) khi chưa bật quyền. ADR này bổ sung quyền ở tầng dịch vụ;
`pipeline/review_bot.py` và prompt vẫn chỉ tạo đề xuất, không có quyền ghi cơ sở dữ liệu.
Không có số đo độ chính xác thực tế; các kiểm chứng dùng bài tự tạo và mô hình giả.

## Quyết định

Hai cờ `REVIEW_BOT_ENABLED=true` và `REVIEW_BOT_AUTO_APPROVE=true` phải cùng bật.
Cờ thứ hai mặc định `false`; `REVIEW_BOT_AUTO_APPROVE_DAILY_LIMIT` mặc định `200`, số nguyên không âm.
Giá trị `0` chặn toàn bộ tự duyệt, không có nghĩa vô hạn. Không thay giá trị triển khai.

Lược đồ verdict dùng số thực trong `[0, 1]`, không có các nhãn mức tự tin. Chỉ `status=ok`,
`verdict=approve`, `confidence=1.0` được xét. Không dùng ngưỡng gần đúng. Bốn kiểm tra đều phải đạt,
đều có trích dẫn không rỗng và nguyên văn trong bài. Ngoài kiểm tra giá hiện có của ADR-0008,
trích dẫn giá phải đọc được bằng `parse_rent`, cho đúng số VND, giá chính xác và kỳ tháng;
đơn vị trong trích dẫn nếu có phải khớp `per_unit`. Trích dẫn chỉ chứa số trần không đủ tự duyệt.

Tin phải còn hiện hành, đúng phiên bản bài và listing, `needs_review`, không demo, có đúng một listing
trong lần trích xuất. Loại phòng phải biết, giá công khai chính xác > 0 VND/tháng và đơn vị `per_unit`.
Mã phường phải thuộc danh mục TP.HCM hiện có, vị trí đã phân giải; văn bản không có tỉnh ngoài TP.HCM
theo bộ kiểm tra địa danh hiện hành. Trường khác không được có `needs_review` hoặc `conflict`.
Bot không sửa giá, địa chỉ hoặc bất kỳ giá trị trích xuất nào; không loại tin, không xóa tin.

## Danh sách lý do được phép (allow-list)

| Mã | Nguồn thực trong pipeline | Vì sao đủ điều kiện xét |
| --- | --- | --- |
| `rent_llm_only` | `reconcile.finalize_status`: giá có `agreement=llm_only`, tin vẫn cần duyệt | Giá đã được mô hình trích xuất từ nguyên văn nhưng thiếu xác nhận bằng Regex; một lượt duyệt độc lập phải xác nhận lại số tiền, kỳ, đơn vị, một phòng và vị trí. Không chấp nhận xung đột hoặc sự thiếu hụt khác. |

Đây là mã tường minh mới cho nguyên nhân đã tồn tại (`rent.agreement=llm_only`); trước đây tin đó
có thể có danh sách lý do rỗng và chỉ hiện nhãn dự phòng `field_needs_review`. Việc ghi mã không đổi
trạng thái ban đầu hoặc giá trị trường. Không đưa nhãn dự phòng này vào allow-list.
Chỉ xét khi có ít nhất một lý do và **toàn bộ** lý do thuộc bảng trên; còn kiểm lại nguồn giá `llm_only`.
Tin cũ thiếu mã không được suy đoán đủ điều kiện. Không mở rộng tự động theo mã tương lai.

`basis_unknown`, `conflict`, `multi_listing`, `possible_duplicate`, `llm_error`, `former_ward_split`,
`outside_hcm_province`, các mã thiếu/chưa xác minh phường và mọi mã khác đều chặn.
Không cho qua `post_type_uncertain`: hiện pipeline chỉ dùng mã này để kích hoạt trích xuất,
chưa có nguyên nhân hàng chờ độc lập đủ rõ để mở quyền tự duyệt.

## Người gửi và danh tính hệ thống

Kho hiện không có cột/trang quản lý khóa người dùng. Trong phạm vi này, người gửi bị thu hồi toàn bộ
vai trò hoặc có dấu `blocked` trong JSON `roles` không được tự duyệt. Chưa bổ sung chức năng khóa
tài khoản toàn hệ thống; khi bổ sung, cần nối trạng thái khóa chính thức vào chốt này.

Tạo lặp an toàn (idempotent) người dùng `review-bot`, ID dành riêng `0000000000000000000000000B`,
không vai trò, `password_hash=!` không thể xác thực mật khẩu. Không chiếm tài khoản trùng tên đã đăng ký;
xung đột danh tính khiến quyền tự duyệt dừng an toàn. Chủ hệ thống không cấp vai trò hoặc đặt mật khẩu
cho danh tính này. Không cần migration.

## Giao dịch, hạn mức và lịch sử

Sau lời gọi mô hình, giữ cơ chế kiểm tra quyền claim, phiên bản bài/listing và kết quả trùng của ADR-0008.
Khóa ghi dòng người dùng hệ thống tuần tự hóa các worker trước khi đếm hạn mức; khóa listing và đọc lại
phiên bản trước quyết định. Không giữ giao dịch cơ sở dữ liệu trong khi chờ mô hình.
Gọi cùng `reviews.decide` như người duyệt, action `approve`, không truyền fields, `commit=False`;
kết quả bot, trạng thái, tăng phiên bản, cập nhật cluster, sự kiện và trạng thái job cùng giao dịch ngoài.
Người duyệt vẫn dùng nhánh commit mặc định. Đếm sự kiện `approve` của danh tính bot trong ngày Việt Nam
UTC+7; hoàn tác không xóa sự kiện và không hoàn lại hạn mức.

Giới hạn này đếm lịch sử còn lưu trong `review_events`; thao tác quản trị xóa hẳn bài hiện có có thể
xóa dây chuyền lịch sử. Muốn hạn mức bền vững qua việc xóa dữ liệu cần bộ đếm/lịch sử độc lập ở tác vụ riêng.

## Hiển thị và hoàn tác

Admin đọc `GET /team/bot-reviews/summary` có thêm `auto_approve_enabled`, `auto_approved_today`,
`auto_approve_daily_limit`. Reviewer giữ phản hồi thống kê cũ để tương thích.
Các quyết định bot không được tính thành nhãn người khi đo đồng thuận.

`GET /team/reviews?status=bot_approved` liệt kê quyết định bot vẫn hiện hành. Mặc định vẫn chỉ lấy
`needs_review`. Màn Hàng duyệt có liên kết “Bot đã duyệt”; dòng tin mở “Xem / Hoàn tác”. Chi tiết
và lịch sử có nhãn “Bot đã duyệt”; `history.source` xác định `bot`/`human`.
Action `undo` qua endpoint quyết định hiện có chỉ áp dụng cho quyết định bot approve mới nhất còn hiệu lực,
với `expected_version`. Tin về `needs_review`, tăng phiên bản, cập nhật cluster và ghi sự kiện người;
tin biến mất khỏi `/listings`. Phiên bản cũ trả 409. Không khôi phục giá trị trường vì bot không sửa trường.
Kết quả bot thành công vẫn còn, nên hoàn tác không tạo vòng lặp tự duyệt lại cùng listing/prompt.

## Chi phí, vận hành và giới hạn

Một lần xét listing gọi Gemini **1 lần** trong lượt bot bình thường; chuyển trạng thái approve thêm **0 lần**.
Đây là chi phí ngoài trích xuất trước đó. Lỗi tạm thời hoặc job trùng có thể làm tổng lời gọi lớn hơn;
chi phí từng lượt vẫn được ghi như ADR-0008. Đạt trần tự duyệt vẫn cho bot quan sát và ghi verdict,
nên vẫn tốn lời gọi theo hạn mức LLM riêng/chung; không có duyệt bù tự động khi sang ngày.
Kết quả quan sát đã lưu trước khi bật cờ cũng không được dùng lại để công bố; chỉ lượt duyệt mới
đủ điều kiện mới có quyền quyết định. Không tự động chạy lại dữ liệu cũ khi thay cờ hoặc tăng trần.

Chủ hệ thống quyết định bật, chọn trần và theo dõi lỗi duyệt thực tế. Confidence của mô hình không phải
xác suất đã hiệu chuẩn. Kiểm tra vị trí vẫn dựa trên danh mục và đề xuất có trích dẫn của mô hình,
không chứng minh địa chỉ thực ngoài đời. Chưa gọi Gemini thật, chưa bật production và chưa kiểm PostgreSQL
trong tác vụ này; điều phối viên kiểm PostgreSQL trước khi phát hành.
