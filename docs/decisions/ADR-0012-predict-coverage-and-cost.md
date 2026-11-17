# ADR-0012: Độ phủ và chi phí so sánh giá

Trạng thái: Đã triển khai trong worktree predict, chờ điều phối tích hợp. Ngày: 18/11/2026.

## Bối cảnh đã tái hiện

Với văn bản hoàn toàn giả lập tại Linh Trung và Hiệp Bình Chánh, bài phân tích không có
`listing_districts` nhận `not_comparable`, dù có đủ mười tin cùng quận cũ. Câu chứa
`2,5tr` còn bị nhận thêm thành Quận 2; tên huyện Bình Chánh bị nhận bên trong tên
phường Hiệp Bình Chánh. Các lỗi này đã được tái hiện bằng test trước khi sửa.
Không truy cập dữ liệu sản xuất trong công việc này, nên chưa xác minh các số đếm
359/20 hay mức tăng độ phủ thực tế được nêu trong brief.

## Quyết định

- Khi tin đích thiếu dòng quận cũ và không suy được một quận duy nhất từ phường,
  dùng `district_scan` trên phiên bản hiện tại của chính tin đích. Không ghi ngược
  DB khi đọc; vẫn chặn nhiều khu vực, vùng lân cận và `outside_hcm_province`.
  Không suy phường mới từ một quận cũ. Cả API bài phân tích và My Posts dùng hàm chung.
- Giữ nguyên thứ tự và các điều kiện thống kê của ADR-0010. Ghi lại mỗi nhóm thực sự
  đã thử, nguồn `accepted`/`auto_checked`, số mẫu sau loại cụm trùng, kể cả nhóm mọi
  diện tích chưa đủ mẫu. Khi thiếu mẫu, trả số đếm này trong `message` hiện hữu.
- `comparisons(session, listings, settings)` trả ánh xạ `listing_id -> Comparison`.
  `comparison(...)` tiếp tục hoạt động thông qua hàm lô. Tải một hợp ứng viên từ
  các phường/quận cũ đích, tách dữ liệu thật/demo; điều phối viên sẽ đổi caller
  trong `my_posts.py` khi tích hợp. Worktree này không sửa caller đó.
- Ngoài ứng viên địa lý, cần tải các thành viên hiện hành cùng cụm với ứng viên:
  thành viên mới hơn ở địa điểm khác có thể loại thành viên cũ. Bỏ phần này sẽ làm
  thay đổi quy tắc chọn bản mới nhất **trước** khi chia nhóm. Truy vấn mở rộng theo
  cụm là điều kiện đảm bảo dữ liệu đúng, không phải tải toàn kho mặc định.
- Không đọc nội dung tin đối chiếu. Chọn tối đa `market_similar_count` tin công khai
  theo chênh lệch diện tích, rồi chênh lệch giá, rồi mã tin để thứ tự ổn định.
  Đây là thay đổi hành vi so với xếp hạng TF-IDF trên toàn bộ nội dung nhóm; các
  thống kê và điều kiện vào nhóm không đổi. Chỉ nội dung tin đích thiếu địa điểm
  mới cần đọc cho bước khôi phục quận cũ.
- `eligibility-report` chỉ đọc tin thật hiện hành, dùng đúng điều kiện loại của
  nhóm phường trong thống kê tổng quan; đếm cả bản cũ trong cụm. In số đếm từng lý
  do, mười tổ hợp phổ biến, tối đa ba mươi địa danh chuẩn xuất hiện trong các tin
  chưa phân giải phường. Mỗi địa danh tính một lần mỗi listing; đây là cụm được
  tìm thấy trong tin chưa phân giải, không khẳng định nó là nguyên nhân thất bại.
  Không in nội dung, liên hệ, đường dẫn hay tên người. Cụm ngoài từ điển được gom
  vào `[unrecognized location withheld]`, không xuất cụm văn bản tự do.
- Bổ sung `2tr590k`, `3tr590k`, hậu tố `dd` và giữ toàn bộ hậu tố tháng trong chứng
  cứ trích xuất. Regex tăng `1.3.0 -> 1.4.0`, normalizer tăng `1.2.0 -> 1.3.0`,
  phù hợp fingerprint mà `reprocess-real` dùng. Không tự chạy lại tin sản xuất.

## Ràng buộc cần điều phối viên biết

Brief không cho sửa schema hay OpenAPI. Vì vậy số đếm tầng nằm trong `message`,
không thêm trường JSON `tiers`. Nếu cần cấu trúc `tiers` cho giao diện, điều phối
viên cần mở phạm vi schema và cập nhật đặc tả khi hợp nhất.

Yêu cầu tìm cụm vị trí chưa biết và yêu cầu không in tên người có thể xung đột:
không có cách đảm bảo một cụm văn bản tùy ý là địa điểm. Chọn từ vựng địa lý chuẩn
để giữ riêng tư; việc khám phá tên địa điểm hoàn toàn mới cần một quy trình duyệt
riêng. Không coi nhãn đã ẩn là một địa danh đã xác minh.

## Phép đo PostgreSQL 17

Đã chạy 5.000 listing hoàn toàn giả lập, 39 nhóm địa điểm, mỗi bài gồm
16 lần lặp câu mô tả giả lập. Trang gồm 20 tin cùng nhóm; nhóm so sánh có 128 tin sau loại chính
tin đích. Mỗi trường hợp chạy ba lần, phiên ORM mới, bộ nhớ đệm DB đã ấm; lấy trung
vị từ `perf_counter`. Có các kiểm tra khác chạy đồng thời trên máy, nên đây là
phép đo cục bộ, không phải cam kết độ trễ sản xuất. Baseline là bản sao byte của
`services/market.py` tại HEAD trước thay đổi; cùng dữ liệu và cùng quy tắc tính
thống kê. Test kiểm tra các kết quả số trước/sau bằng nhau.

| Trường hợp | Trước (ms) | Sau (ms) | Truy vấn trước/sau |
|---|---:|---:|---:|
| Một so sánh | 1130.391 | 30.480 | 5 / 4 |
| Trang 20, vẫn gọi hàm đơn | 22023.917 | 525.536 | 100 / 80 |
| Trang 20, dùng hàm lô | 22023.917 | 36.364 | 100 / 4 |

Số truy vấn đọc nội dung: trước là 2 cho một tin, 40 cho trang; sau là 0 trong bộ
dữ liệu này. Chưa đo trường hợp toàn bộ kho thuộc cùng nhóm hoặc trang trải đều
nhiều quận. Chi phí phụ thuộc kích thước hợp ứng viên và cụm liên quan; trường
hợp một nhóm chứa cả kho vẫn phải tính trên cả nhóm để số liệu đúng.

Lệnh tái đo từ `apps/api`, sau khi lưu baseline vào `_handoff/market-before.py`:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://api_test@127.0.0.1:54329/trocheck_predict'
$env:PREDICT_BENCHMARK='1'
python -B -m pytest tests/test_predict_benchmark.py -s
```

Test này xóa schema của **DB kiểm tra được chỉ định** theo fixture chung; không
chạy vào DB sản xuất. Log thô, kết quả đo và bằng chứng gây lỗi/khôi phục nằm trong
`_handoff/` của worktree. Không có migration hay thay đổi cấu trúc phản hồi API.
