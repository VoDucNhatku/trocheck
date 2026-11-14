# Chuyển sang dữ liệu thật

Ngày đối chiếu mã nguồn và tài liệu: 13/11/2026. Web: https://trocheck.vercel.app. API: https://trocheck-api.onrender.com. Tài liệu này là hướng dẫn vận hành; chưa thay đổi cấu hình hay dữ liệu triển khai.

## Cấu hình trên Render

Trong Environment của dịch vụ `trocheck-api`, thực hiện theo hai giai đoạn dưới đây rồi lưu và triển khai lại dịch vụ. Worker được `apps/api/deploy/start.sh` chạy cùng dịch vụ nên nhận cùng cấu hình; tiến trình HTTP được bỏ `GEMINI_API_KEY` trước khi chạy.

| Biến | Giá trị khi mở kho thật | Khi bật bot duyệt |
| --- | --- | --- |
| `DEMO_MODE` | `false` | Giữ `false` |
| `GEMINI_API_KEY` | Nhập khóa riêng của dự án trong Dashboard, không đưa vào kho mã hay log; có thể để trống nếu chỉ chạy bộ trích xuất biểu thức chính quy | Phải có khóa hợp lệ và hạn mức khả dụng |
| `GEMINI_MODEL_ID` | Mã mô hình đã thử thành công với dự án; nếu chưa có, ứng viên kiểm thử là `gemini-3.8-flash` | Giữ mã đã kiểm thử |
| `REVIEW_BOT_ENABLED` | `false` trong bước mở kho thật ban đầu | `true` sau khi kiểm tra trích xuất và hàng đợi |
| `REVIEW_BOT_MODEL_ID` | Để trống khi bot tắt | Để trống để dùng `GEMINI_MODEL_ID`, hoặc đặt cùng mã mô hình đã kiểm thử |
| `REVIEW_BOT_DAILY_CALL_LIMIT` | `50` cho giai đoạn quan sát đầu tiên | `50`; chỉ tăng sau khi xem lượng gọi, lỗi và kết quả duyệt |
| `LLM_DAILY_CALL_LIMIT` | Giữ hạn mức chung hiện có; mặc định mã nguồn là `2000` | Bot và trích xuất cùng tiêu hạn mức chung này |
| Cờ tự quyết định, nếu có | Giữ tắt khi mở kho thật | Chỉ bật sau khi đọc tài liệu của thay đổi bổ sung và kiểm tra quyền xuất bản |

`gemini-3.8-flash` là mã ổn định có hỗ trợ đầu ra cấu trúc trong [tài liệu mô hình Google](https://aistudio.google.com/docs/models/gemini-3.8-flash). Đây là ứng viên cấu hình, chưa được xác nhận bằng khóa của dự án trong đợt bàn giao này. Nếu mô hình hiện có đã chạy tốt thì giữ nó; kiểm tra vòng đời và quyền truy cập trước khi thay. Không coi việc đặt tên mô hình là bằng chứng đã gọi thành công.

Không đặt `REVIEW_BOT_DAILY_CALL_LIMIT=0` với ý nghĩa tắt bot: `0` bỏ hạn mức riêng, vẫn chịu hạn mức chung. Hạn mức được tính theo ngày Việt Nam. Tắt bot bằng `REVIEW_BOT_ENABLED=false`. Trong phiên bản hiện tại, bot chỉ lưu ý kiến duyệt, không tự đổi `review_status` hoặc thay quyết định của người duyệt. Tắt bot không ngăn các tin đủ điều kiện được bộ trích xuất tự chấp nhận.

Sau khi bật bot, bài mới cần duyệt được đưa vào hàng đợi. Muốn xử lý phần tồn đọng, quản trị viên có thể chạy `python -m app.cli bot-review-backlog --limit 50` trong môi trường dịch vụ đã cấu hình đúng. Lệnh này ghi hàng đợi; chỉ chạy khi chủ dự án quyết định xử lý tồn đọng. Không chạy trong đợt kiểm tra này.

Giữ nguyên cấu hình cơ sở dữ liệu Neon và các bí mật đang dùng. Không cần đổi biến phía Vercel nếu địa chỉ API vẫn giữ nguyên. Không thêm khóa Gemini vào biến công khai của web hoặc extension. Các khóa cho bước lọc và trích xuất của extension được người dùng cấu hình riêng trên máy, khác với Gemini của worker.

## Blueprint và dữ liệu demo đang có

`render.yaml` chuyển `DEMO_MODE` sang `sync: false`. Theo [tham chiếu Blueprint của Render](https://render.com/docs/blueprint-spec#prompting-for-secret-values), khi cập nhật Blueprint hiện có, Render bỏ qua các biến khai báo theo cách này. Vì vậy thay đổi YAML không tự chuyển giá trị `true` hiện tại sang `false`; chủ dự án phải đổi giá trị trong Dashboard. Khi tạo Blueprint mới, Render hỏi giá trị; các môi trường xem trước không tự nhận biến `sync: false`.

94 bài demo hiện có trên Neon, theo thông tin bàn giao, mang cờ `is_demo=true`. Đổi `DEMO_MODE=false` không xóa hay đổi cờ những bản ghi này. Danh sách công khai, chi tiết tin, so sánh, `/stats/overview` và `/market/summary` chỉ đọc bộ dữ liệu thật; `?demo=true` cũng không vượt qua chế độ của máy chủ. Tin demo không được đếm vào số liệu thật. Những bài này vẫn có thể nằm trong kho quản trị hoặc bản xuất có chọn dữ liệu demo; không dùng tổng số hàng trong cơ sở dữ liệu làm số tin công khai.

Seed tạo bài demo có thể chạy lặp mà giữ dữ liệu cũ. `start.sh` chỉ gọi seed khi `DEMO_MODE=true` và có `SEED_PASSWORD`; khi `false` không tạo thêm bài demo. Lệnh khởi động vẫn chạy migration và bảo đảm quản trị viên. Không xóa 94 bài demo để chuyển chế độ, không chạy seed chỉ nhằm làm đầy kho thật.

Số “tin đã xử lý” trên trang chủ lấy từ `/stats/overview`: gồm cả tin đang chờ duyệt; “tin đủ điều kiện thống kê” là tập nhỏ hơn và không bằng số tin công khai. Một bài có thể sinh nhiều tin. Tìm trọ chỉ hiện tin đã đóng góp và có trạng thái `auto_accepted` hoặc `approved`. Các nhóm so giá vẫn cần tối thiểu 10 tin đủ điều kiện, cùng phường, loại và cách tính, trong cửa sổ cấu hình. Nhóm nhỏ ghi chưa đủ tin, không tự điền trung bình.

Trang chủ đọc số liệu ở máy chủ và dùng `revalidate: 60`. Sau khi đổi chế độ, chờ ít nhất một phút rồi tải lại để kiểm tra; đây là thời gian tái kiểm tra bộ nhớ đệm, không phải cam kết dữ liệu thay đổi chính xác tại giây thứ 60. Nếu cần chuyển tức thì, triển khai lại web để loại bỏ bộ nhớ đệm cũ và kiểm tra lại các liên kết. Số liệu đã lưu gần nhất có thể được Next giữ khi lần tái kiểm tra lỗi; vẫn hiển thị ngày xử lý từ API. Khi lần đọc không có dữ liệu dùng được, trang hiện thông báo trung tính.

## Trình tự mở và khôi phục

1. Sao lưu và thử khôi phục riêng theo [hướng dẫn sao lưu Neon](27-sao-luu-neon.md). Ghi lại phiên bản triển khai và cấu hình hiện hành trong nơi quản trị riêng, không sao chép bí mật vào biên bản.
2. Triển khai mã web và API đã kiểm tra, đổi riêng `DEMO_MODE=false`, giữ bot tắt. Kiểm tra kho rỗng trước khi gửi dữ liệu thật. Bài đang chờ duyệt không được xuất hiện trong Tìm trọ.
3. Gửi một bài tự tạo qua tài khoản người thuê, đợi worker, đối chiếu bằng chứng, tin công khai và trạng thái chờ duyệt. Không dùng nội dung cá nhân thật để thử. Gỡ bài thử bằng quy trình quản trị sau khi kiểm tra.
4. Xác nhận mô hình và khóa bằng một lượng thử nhỏ, sau đó bật bot với hạn mức `50`. Đối chiếu vài ý kiến bot với văn bản nguồn trước khi tăng lượng gọi. Cờ tự quyết định, nếu có, vẫn giữ tắt ở bước này.
5. Nếu cần dừng bot, đặt `REVIEW_BOT_ENABLED=false`, triển khai lại, kiểm tra worker và hạn mức. Ý kiến bot đã lưu không tự bị xóa. Nếu cần trở lại bản trình diễn, đặt `DEMO_MODE=true`, giữ bot tắt và kiểm tra các trang sau khi bộ nhớ đệm tái kiểm tra. Chế độ này mặc định chọn demo; dữ liệu thật vẫn còn và có thể được truy cập bằng `?demo=false`, nên đây không phải cơ chế khóa toàn bộ dữ liệu thật.
6. Nếu lỗi do mã mới, quay về phiên bản web/API đã biết hoạt động sau khi kiểm tra tương thích migration. Không khôi phục bản sao cơ sở dữ liệu hoặc xóa tin thật chỉ để đổi chế độ; thao tác đó có thể mất dữ liệu phát sinh.

## Theo dõi trong giờ đầu

- Phút 0–10: `/api/v1/health` trả `demo_mode=false`; mở `/`, `/tim-tro`, `/thi-truong`, `/extension` ở sáng/tối và điện thoại. Số liệu không hiện lại mốc 40/31 hay ngày cố định; kho rỗng có lời giải thích. Kiểm tra lại sau thời gian bộ nhớ đệm.
- Phút 10–20: đăng nhập người thuê, kết nối extension, gửi thử, xem giới hạn theo ngày. Kiểm tra worker còn chạy, công việc chuyển từ queued sang succeeded; khi nhàn có thể phải chờ đến 60 giây. Kiểm tra lỗi cấu hình, không ghi khóa hoặc toàn văn bài vào log.
- Phút 20–30: đối chiếu danh sách công khai với trạng thái duyệt. Tin needs_review không hiện; tin được chấp nhận mở được chi tiết và liên kết quay lại. Kiểm tra giá ghi `/tháng`, phí tách riêng, ảnh giữ chỗ có nhãn đúng.
- Phút 30–45: thử bộ lọc có/không kết quả, phường chưa có lựa chọn, nhóm một tin, giá không cụ thể và liên kết tin không tồn tại. Các nhóm dưới ngưỡng không có trung bình hoặc phần trăm chênh lệch.
- Phút 45–60: nếu đã bật bot, xem số lần gọi, 429, lỗi mô hình, thời gian chờ, ý kiến đã lưu và công việc bị hoãn sang ngày sau. Xác nhận hạn mức riêng và chung. Xem lỗi HTTP, chi phí và tải Neon; mức polling hiện có không bảo đảm Neon ngủ.

Ghi lại thời điểm chuyển chế độ, số bài thật đã nhận, số tin công khai/chờ duyệt, lỗi và quyết định tiếp tục hay khôi phục. Chủ dự án quyết định mô hình được phép dùng, mức hạn gọi lâu dài và thời điểm bật tự quyết định nếu chức năng đó được bổ sung.

## Kho chung và đọc lại bài cũ (14/11/2026)

Sau khi đặt `DEMO_MODE=false`, kho thật có 259 tin nhưng chỉ 8 tin đủ điều kiện thống kê theo phường (đa số thiếu cách tính giá, phường hoặc loại phòng, và 244 tin chưa duyệt). Bản cập nhật này:

- Mỗi lần khởi động, `start.sh` chạy `python -m app.cli reprocess-real --limit 1000` sau migration: đọc lại bằng luật hiện hành các bài thật trích bằng luật cũ, chỉ biểu thức chính quy, giữ nguyên mọi tin đã được người hoặc bot quyết định. Lần đầu sau khi triển khai sẽ đọc lại phần lớn bài; các lần sau không làm gì. Log chỉ in số đếm (`reprocess-real: {...}`).
- Thị trường mặc định xem theo quận cũ trên kho chung (tin đã duyệt và tin chưa duyệt đã qua kiểm tra tự động, có nhãn); Tìm trọ trên web dùng `pool=all`. Quy tắc ở ADR-0010 và hợp đồng API §3 "Kho chung".
- Nên tạo một nhánh Neon (bản chụp) trước khi triển khai lần đầu, vì bước đọc lại ghi đè kết quả trích của các tin chưa quyết định. Cách làm ở [sao lưu Neon](27-sao-luu-neon.md).

Kiểm tra sau triển khai: log Render có dòng `reprocess-real:` với `errors: 0`; `/api/v1/stats/overview` có `store_listings` lớn hơn trước; `/thi-truong` hiện bảng theo quận cũ. Kịch bản trình bày: [31-kich-ban-thuyet-trinh.md](31-kich-ban-thuyet-trinh.md).
