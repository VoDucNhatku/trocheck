# ADR-0008: Bot duyệt chạy song song

Trạng thái: Đã triển khai chế độ quan sát (2026-11-13); tự động quyết định chưa được phê duyệt.

## Bối cảnh

Các listing chưa đủ điều kiện công bố đang chờ người duyệt. Cần đánh giá bot trước khi chủ hệ thống
quyết định có giao quyền duyệt hay không. Hiện chưa có số đo độ chính xác từ dữ liệu thật.
Gemini chưa từng được gọi bằng khóa thật trong phần triển khai và kiểm chứng này; mọi test dùng mô hình giả.

## Các lựa chọn

Cho bot quyết định ngay; đưa gợi ý bot vào màn hình duyệt; hoặc chạy song song và lưu kết quả riêng.
Hai lựa chọn đầu có thể thay đổi dữ liệu công khai hoặc làm người duyệt bị ảnh hưởng bởi gợi ý.

## Quyết định

Chạy song song (shadow mode), mặc định tắt. Bot chỉ đọc chữ đã che số điện thoại, giá trị listing và
lý do cần duyệt; đưa verdict approve/reject/unsure cùng độ tự tin, lý do tiếng Việt và bốn kiểm tra.
Trích dẫn phải có nguyên văn trong bài; trích dẫn không tìm thấy làm kết quả thành unsure.
Nếu bộ chuẩn hóa giá `parse_rent` đọc được số tiền trong trích dẫn, các giá trị đọc được
(`amount_vnd`, `min_vnd`, `max_vnd`) phải bằng giá đang lưu, nếu khác hoặc giá lưu thiếu thì thành unsure.
Nếu bộ đọc không hiểu trích dẫn (ví dụ chỉ có “3”), giữ kiểm tra nguyên văn hiện tại; chưa xác nhận được
ý nghĩa giá trong trường hợp đó. Vị trí vẫn chỉ được kiểm tra nguyên văn, chưa kiểm tra ngữ nghĩa.
Approve cần đủ bằng chứng giá, vị trí và cả bốn kiểm tra đạt. Không sửa listing, không ghi sự kiện người,
không tác động trang công khai; endpoint chi tiết duyệt không chứa kết quả bot.

Lưu `bot_reviews` theo listing, phiên bản listing, mô hình, prompt, trạng thái, kiểm tra, chi phí và thời gian.
Một kết quả thành công cho mỗi listing/prompt. Đọc ảnh chụp rồi kết thúc giao dịch trước khi gọi mô hình;
sau đó mở giao dịch ngắn, kiểm tra chủ sở hữu/lượt claim, khóa phiên bản bài, đọc lại trạng thái/phiên bản
listing và ghi. Chỉ mục duy nhất ngăn hai kết quả `ok`; hai job trùng có thể cùng gọi mô hình, kết quả
đến sau được ghi `error`/`review_superseded` để giữ chi phí khi listing vẫn tồn tại. Job mất quyền claim
không được sửa trạng thái hay lưu verdict. Bot bỏ qua demo và summary loại cả kết quả demo cũ.
Một lần gọi mỗi lượt xử lý listing; lỗi tạm thời được lưu rồi retry bằng backoff của job, không mất chi phí.
Lỗi JSON/lược đồ hoặc lỗi vĩnh viễn được lưu `error`, kết thúc listing đó cho job hiện tại; có thể tạo lại
qua lệnh backlog. Với lỗi, `checks` lưu `retryable` và `job_id` để không lặp vô hạn listing lỗi khi nhường job.
Hạn mức riêng chỉ giới hạn bot, hạn mức chung tính cả bot. Hết ngân sách thì job bot hoãn đến ngày Việt Nam
kế tiếp, giữ kết quả đã lưu. Hàng đợi ưu tiên trích xuất/phân tích ở mỗi lần claim. Mỗi claim bot xử lý
tối đa một listing/một lần gọi mô hình rồi nhường job lại hàng đợi nếu còn listing. Worker tuần tự không
ngắt lời gọi đang chạy: job mới có thể chờ một lượt bot, thay vì N lượt của cả bài. Cấu hình
`REVIEW_BOT_TIMEOUT_SECONDS` mặc định 20 giây đặt timeout chờ mạng theo từng pha HTTP; thời gian
chờ còn cộng xử lý cục bộ/giao dịch DB, nên không phải cam kết 20 giây tuyệt đối hoặc “không bao giờ chờ”.
Không thể dự báo các job đến trong tương lai; bot vẫn tiêu dùng ngân sách chung,
nên luồng trích xuất tiếp tục áp dụng chính sách hạn mức chung hiện có.

## Đo lường

API summary cho reviewer/admin cho biết số kết quả theo verdict và trạng thái, tỷ lệ unsure,
số listing có cả kết quả bot và quyết định người trên đúng phiên bản, số đồng thuận và tỷ lệ đồng thuận,
cùng hai chiều bất đồng approve/reject. Merge/split không so sánh. Mỗi listing lấy kết quả bot thành công
mới nhất khi so với người; lỗi vẫn được đếm theo trạng thái. Danh sách từng listing chỉ cho admin,
reviewer nhận 403 để không xem trước verdict bot qua API này; tài khoản có quyền admin vẫn xem được.
Mẫu số đồng thuận gồm cả unsure có quyết định
người; mẫu số unsure là tất cả kết quả thành công. Mẫu số rỗng trả null.

Thêm `version` vào ảnh chụp trước quyết định người; lịch sử cũ suy ra phiên bản từ thứ tự sự kiện.
Không ghép kết quả bot với quyết định của phiên bản khác hoặc quyết định có trước thời điểm bot chạy.
Các số này là độ đồng thuận quan sát, chưa phải độ chính xác so với nhãn chuẩn. Không công bố số liệu
độ chính xác khi chưa đo.

## Hệ quả

Tăng chi phí LLM và lưu trữ, đổi lại có lịch sử độc lập để kiểm toán. Bot tắt hoặc thiếu khóa thì không chạy.
Chủ hệ thống chỉ bật qua cấu hình sau khi sẵn sàng; tài liệu API mô tả cờ bật, mô hình, hạn mức và timeout.
Không có giao diện mới trong giai đoạn này.

## Xem lại khi

Sau khi đã thu đủ kết quả thật và phân tích các loại bất đồng, chủ hệ thống quyết định riêng có cho bot
tự duyệt hay không, với tiêu chí và cơ chế giám sát phù hợp. Task này không trao quyền tự động quyết định.
