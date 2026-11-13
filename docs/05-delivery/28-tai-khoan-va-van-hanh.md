# Tài khoản và vận hành sau tác vụ H

## Tài khoản Google

Migration `0006` thêm `users.display_name`, không đổi tên đăng nhập nội bộ,
mật khẩu, email hoặc vai trò hiện có. Lần đăng nhập Google tiếp theo yêu cầu
scope `profile`, lưu tên từ UserInfo đã xác thực và cập nhật email nếu không
trùng tài khoản khác. Tài khoản Google cũ chưa đăng nhập lại sẽ hiển thị email
trước; không thể khôi phục tên Google từ dữ liệu cũ.

`auth/me`, đăng nhập và đăng ký trả các trường công khai `email`,
`display_name`, `google_connected`, `local_login_enabled`. Không trả Google
subject hoặc hàm băm mật khẩu. Tài khoản chỉ dùng Google không có mục đổi
mật khẩu và không được tạo token khôi phục mật khẩu qua luồng phát triển.
Không tự liên kết tài khoản theo email.

## Giới hạn đăng nhập và tài khoản mẫu

Trong một tiến trình API: tối đa 30 lần đăng nhập mỗi IP, mỗi phương thức,
trong 5 phút; tối đa 5 lần mỗi tên tài khoản hoặc Google subject trong cùng
cửa sổ. Tính mọi lần thử, kể cả thành công, để hạn chế cả brute force và lạm
dụng callback. Khi vượt giới hạn trả 429 và `Retry-After`, tự hết khóa khi
cửa sổ trượt qua. Tên tài khoản được chuẩn hóa khoảng trắng và chữ hoa/thường
cho khóa giới hạn; Google dùng subject do nhà cung cấp xác thực.
Không tin `X-Forwarded-For` tùy ý từ client; địa chỉ do lớp transport cung cấp
cần được proxy tin cậy xử lý đúng. Giới hạn có khóa luồng, giới hạn 10.000
khóa trong bộ nhớ và mất khi khởi động lại; cần kho dùng chung khi tăng số
tiến trình hoặc instance. Xác thực trạng thái OAuth vẫn bắt buộc trước khi
gọi Google; giới hạn subject chỉ áp dụng sau khi xác minh danh tính.

Khi `ADMIN_USERNAME` có giá trị, seed không tạo tài khoản trùng tên đó và
không cấp quyền quản trị cho tài khoản mẫu mới `admin`; tài khoản này chỉ có
quyền `renter`. Tài khoản có sẵn giữ nguyên mật khẩu và vai trò. Vì vậy,
**tài khoản mẫu `admin` từng có quyền quản trị trên Neon vẫn cần chủ dự án
kiểm tra, đổi mật khẩu riêng hoặc thu hồi quyền theo quy trình quản trị**.
Tác vụ này không xóa hoặc sửa tài khoản production. Không dùng tên tài khoản
mẫu cho `ADMIN_USERNAME`; dành một tên riêng để tránh xung đột với seed.

## Worker khi rảnh

Sau các lần không có việc, thời gian đợi tăng gấp đôi từ `worker_poll_seconds`
tới 60 giây. Sau khi nhận việc hoặc có enqueue đã commit trong cùng tiến
trình, worker trở lại nhịp ngắn ngay. Enqueue chưa commit hoặc rollback không
đánh thức worker. Các lần truy vấn dùng phiên ngắn, không giữ transaction
trong lúc đợi.

`deploy/start.sh` hiện chạy API và worker ở hai tiến trình riêng, nên enqueue
từ API được worker phát hiện ở lần poll tiếp theo, có thể chậm tối đa 60 giây
khi rảnh lâu. Thông báo trong bộ nhớ chỉ hoạt động trong cùng tiến trình.
Mức 60 giây làm giảm truy vấn nhưng **không bảo đảm Neon ngủ**: gói Free cần
5 phút không hoạt động. Muốn đạt mục tiêu đó cần lịch đợi trên 5 phút cùng
cơ chế đánh thức liên tiến trình, hoặc thay đổi cách chạy worker. Cần chọn
giữa độ trễ và tiết kiệm tài nguyên trước khi thay đổi triển khai; tác vụ H
không sửa thiết lập Render/Vercel. Nguồn: [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero).

CI mới chạy trên pull request: toàn bộ API bằng SQLite, ba hợp đồng import,
web typecheck và các kiểm thử web gồm cả kiểm thử trình duyệt với dữ liệu tự
tạo. PostgreSQL vẫn được kiểm tra cục bộ trước khi bàn giao; chưa xác minh
workflow trên GitHub cho đến khi điều phối viên mở PR.
