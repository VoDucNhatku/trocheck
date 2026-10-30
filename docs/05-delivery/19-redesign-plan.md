# Kế hoạch thiết kế lại khu trong

## Câu hỏi và vật liệu

ReNER giúp sinh viên đọc một bài trọ có căn cứ; nhóm vận hành đối chiếu và duyệt dữ liệu. Bài đăng, đoạn trích Unicode,
giá có basis/kỳ, điện theo số, nước theo người/khối, cọc theo tháng, phường, loại phòng, cụm trùng, N và phiên bản duyệt
là vật liệu riêng của sản phẩm. API là nguồn số liệu. Không tổng hợp tiền nhà và phí thành tổng; không suy diện tích từ ảnh.

| Màn | Câu hỏi đầu tiên / yếu tố riêng | Endpoint tương đối / quyền | Trạng thái phải giữ |
|---|---|---|---|
| Đăng nhập, đăng ký | Làm sao vào đọc bài? / sân nhà và câu đọc có nguồn | auth/login, auth/register; guest | lỗi trường, pending,409,429, safe next |
| Phân tích | Dán bài nào? / độ đầy đủ của bài | POST analyses; renter | ngắn/dài, pending, lỗi, demo |
| Bản đọc tin | Tiền nhà bao nhiêu và còn thiếu gì? / phiếu phí + trích nguồn | analyses/:id, listings/:id/comparison; chủ bài/quyền API | polling, partial, failed, nhiều tin, null,N<10, đóng góp |
| Thị trường | Cùng nhóm đang chào bao nhiêu? / khoảng P25–P75 theo basis | market; public/read | lọc, empty, no-match, error, đủ/thiếu N |
| Tài khoản | Phiên và kết nối nào đang dùng? / mã extension hiện một lần | auth/me, extension tokens; user | tạo/thu hồi/copy, pending/error,401 |
| Kho | Bài nào cần xử lý? / nguồn và độ đầy đủ | posts; collector | lọc/page/retry/empty/error,403 |
| Hàng duyệt | Tin nào cần đọc lại? / lý do ở đầu dòng | reviews; reviewer | lọc/page/no-match/empty/error |
| Duyệt tin | Đoạn nào chứng minh giá trị chọn? / bàn đối chiếu | reviews/:id + mutation; reviewer | draft,409,confirm,unsaved,pending,error |
| Lab | Các phương pháp đọc cùng đoạn ra sao? / ba lớp bằng chứng | lab; researcher | cached LLM, gold lock, pending/error,null |
| Đánh giá | Lần chạy này sai ở đâu? / mẫu số cùng metric | evaluation; researcher | no runs, unavailable metrics, frozen, errors |

Admin kế thừa quyền; route guard và API giữ quyền thật. Sau auth dùng safe next; không có next thì bàn phân tích,
điều hướng nhóm chỉ hiện với role tương ứng. Public tìm trọ vẫn truy cập được không cần account.

## Audit bản trước (redesign-skill, dựa ảnh đã mở)

| Nhóm | Chẩn đoán | Ưu tiên |
|---|---|---|
| Phân cấp | Giá ngang vai với các trường; Review lặp panel dài; mọi màn chung một nhịp | Cao: bố cục trước màu |
| Chữ | Nhiều micro-label uppercase, cỡ nhỏ; heading dài; số thiếu vai trò nổi bật | Cao: 14/16/24/36, tabular |
| Bề mặt | Panel lồng và các khối đồng trọng lượng; sidebar gradient | Cao: nền chung, section phẳng |
| Auth | Không ảnh, khoảng trống lớn, chưa đăng ký | Cao: form gọn + minh họa sân nhà |
| Hành vi | Có đủ nền tảng 409/draft, API guards, evidence; cần bảo toàn | Test hồi quy; không viết lại nghiệp vụ |
| Mobile | Phí và source đến trước câu trả lời; form lọc đẩy dữ liệu quá sâu | Sắp lại thứ tự; drawer; 44px targets |

## Khám phá có chủ đích

Draw đã chạy: `draw.mjs --app --kind workspace --screens home,detail,inbox,analytics,settings --keep palette,type --out .taste-skill/app`.
Seed **706906306**, style **editorial-greeting**. Lấy open plane, nhịp cột chung, surface theo vật liệu;
không lấy greeting hay KPI bốn ô vì không trả lời nhiệm vụ. Tham khảo library/app.json và directions.json:
achromatic ledger cho các khoản tiền; framed sheet cho đối chiếu; place-carries-it cho ảnh auth.
Đề bài ưu tiên sáng tạo theo nghiệp vụ nên đây là biến tấu có ghi lý do, không dựng nguyên blueprint.

| Màn | Hướng thử / trục khác biệt | Giả thuyết chọn và chi phí |
|---|---|---|
| Auth | Sân nhà: form trái, một ảnh lớn phải | Ưu tiên: form ổn định, ảnh cùng landing; cần crop mobile |
| Auth | Bưu thiếp: ảnh trái nhỏ, form phải cùng caption | Ít chiều cao ảnh, nhưng chia sức chú ý giữa hai trục |
| Auth | Dải ảnh: panorama trên, form dưới | Dễ mobile, nhưng đẩy đăng ký xuống dưới fold desktop |
| Reading | Phiếu đọc: giá/phí trước, nguyên văn bên phải | Ưu tiên: trả lời tiền nhà trước; evidence một cú bấm |
| Reading | Hai bản in: nguồn trái, giá trị phải đồng hàng | Tốt cho người nghiên cứu; người thuê phải tìm câu trả lời |
| Reading | Từng bước: tiền nhà → phí → hỏi thêm theo tab | Gọn màn nhỏ; che dữ liệu cần so đồng thời |
| Review | Bảng đối chiếu + editor mở theo trường + quyết định sticky | Ưu tiên: scan cả nhóm, giữ tác vụ tại chỗ |
| Review | Duyệt từng trường qua tab | Ít chiều cao, nhưng tăng cú bấm và che ngữ cảnh |
| Review | Ba cột: nguồn / đối chiếu / quyết định | Hành động luôn thấy; hẹp quá ở laptop có sidebar |

Các hướng này phải được dựng trên route prototype có picker, kiểm live và ghi quyết định sau ảnh.
Không lấy số liệu mẫu ngoài API/fixture có nhãn; prototype mutations dùng state thử riêng.

## Tham chiếu đã xem

- Cosmos: đủ 3 ảnh. Lấy form ít chữ, ảnh lớn, account popover; không lấy masonry hay thương hiệu.
- Tin trọ: đủ 11 ảnh mở trong .tmp. Lấy nhịp giá/phí/lưu ý; không đưa ảnh hoặc liên hệ vào sản phẩm.
- Stitch: 7 PNG mở; 4 HTML đọc phần cấu trúc/nội dung. Lấy giá nổi, phí có đơn vị, đối chiếu; bỏ số bịa và nút giả.
- Landing: ReadingHero và ảnh sân nhà/mây. Giữ font và chất giấy; ảnh auth có nhãn minh họa.
- [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui): phân cấp chrome và thử prototype trong ngữ cảnh thật.
- [GOV.UK account](https://design-system.service.gov.uk/patterns/create-accounts/): tác vụ tạo account rõ; giữ public không bắt đăng ký.
- [GOV.UK password](https://design-system.service.gov.uk/components/password-input/): hiện/ẩn, autocomplete, không spellcheck.
- [Vietnamese Typography](https://vietnamesetypography.com/design-challenges/): kiểm khoảng cho dấu chồng; không ép leading display lên UI.

## Motion được chọn

| Vị trí | Mục đích / tần suất | Recipe |
|---|---|---|
| Account popover | Spatial consistency / thỉnh thoảng | origin top right, opacity + translateY(4px),160ms ease-out |
| Drawer | Spatial consistency / thỉnh thoảng | translateX,200ms var(--ease-out), cubic-bezier(.16,1,.3,1) |
| Button | Feedback / thường xuyên | màu nhấn tức thì; hover120ms khi pointer fine |

Loại chuyển cảnh evidence và tab (đọc thường xuyên), count-up giá/biểu đồ (cản đọc), entrance mỗi panel (không mục đích).
Reduced motion tắt motion; keyboard không phải chờ animation.

## Thứ tự thực hiện và chứng cứ

A: khảo sát → design system và tài liệu này. B: tests đăng ký RED → API GREEN → auth prototype/promote → shell →
Reading prototype/promote → Review prototype/promote → market/account/team/lab/evaluation.
C: ảnh trước/sau1440/768/390; bố cục thêm1024/360; hai vòng critique ba màn chính; contrast/inspector;
test interior/research/public, typecheck/integration/pytest. Bằng chứng cập nhật ở20 và21; không dùng checklist thay kết quả.


## Quyết định sau prototype thật

Route dev `/prototype-redesign` đã dựng và chụp 3 auth (cả login/register), 3 Reading, 3 Review.
Dữ liệu Reading/Review lấy từ analysis demo qua API thật; mutation prototype chỉ đổi state và có thông báo không lưu.
Ảnh tại `.tmp/redesign-shots/*-prototype-*-1440.png`; contact sheet `workbench-prototypes-contact.png` đã mở xem.

- Auth chọn Sân nhà: hai khối cân bằng, form giữ vị trí; bỏ Bưu thiếp vì góc nghiêng thêm trang trí không giúp việc;
  bỏ Dải ảnh vì đẩy form xuống. Mobile ẩn ảnh để form đi trước.
- Reading chọn Phiếu đọc: giá đọc trước nguồn. Hai bản in đảo ưu tiên sang nguồn; Từng bước che thông tin phí cùng lúc.
  Sau vòng1, chuyển Cần hỏi thêm sang dưới nguyên văn để lấp khoảng trống bằng thông tin có ích.
- Review chọn Bảng đối chiếu: đọc cả năm nhóm không đổi tab. Từng trường tăng bước; Ba cột làm đoạn trích hẹp.
  Editor native details trong hàng; toolbar sticky dưới viewport, chỉ chấp nhận là primary.

Picker dùng nền đặc thay glass theo lệnh cấm của đề bài. Bản thua, picker và toàn bộ route thử đã gỡ khỏi src;
bản lưu để truy nguyên chỉ nằm trong `.tmp/redesign-prototype-source` (ignored).
