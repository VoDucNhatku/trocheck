# Tính năng và màn hình

Web có **hai khu**: khu **Người đi thuê** (dùng thật) và khu **Nhóm** (thu, duyệt, Lab, đánh giá). Khu Nhóm cũng là nơi trình bày phần NLP khi bảo vệ đồ án. Extension có màn hình riêng, mô tả ở cuối file.

## 1. Danh sách tính năng theo ưu tiên

**P0 — bắt buộc cho demo.** Bỏ một mục thì một hành trình J1–J5 bị đứt.

| Mã | Tính năng | Hành trình | Kết quả nhìn thấy |
|---|---|---|---|
| F01 | Extension chế độ Thu thập | J3 | Bài từ nhóm Facebook vào kho, có bộ đếm phiên |
| F02 | Extension chế độ Nhận định | J1 | Panel giá/phí/nhận định cho một bài |
| F03 | Pipeline trích xuất Regex + LLM + đối chiếu | J1–J5 | Mỗi trường có giá trị chuẩn, đoạn nguồn, nguồn phương pháp |
| F04 | Tìm và lọc tin | J2 | Danh sách theo phường, loại, giá, diện tích |
| F05 | Chi tiết tin có bằng chứng | J1, J2 | Bôi màu nhãn trong bài, phí tách riêng, nhóm so sánh |
| F06 | Nhận định giá theo nhóm tương tự | J1, J2 | Trung vị, P25–P75, N, chênh lệch %; N < 10 thì báo thiếu |
| F07 | Hàng duyệt | J4 | Sửa trường, duyệt/loại/tách/gộp, có lịch sử |
| F08 | Lab trích xuất | J5 | Regex / LLM / nhãn chuẩn cạnh nhau trên cùng một bài |
| F09 | Trang đánh giá | J5 | P/R/F1 theo trường, chuẩn hóa đúng, trả rỗng đúng, chi phí |
| F10 | Đăng nhập theo vai trò | tất cả | Tài khoản demo: renter, collector, reviewer, researcher |

**P1 — làm nếu còn thời gian.**

| Mã | Tính năng |
|---|---|
| F11 | Trang Thị trường đầy đủ: biểu đồ phân bố giá theo phường/loại, xu hướng theo tuần khi đủ dữ liệu |
| F12 | Dán văn bản một bài trên web (dự phòng khi extension lỗi) |
| F13 | Nhập CSV/JSON theo lô (dự phòng cho thu thập) |
| F14 | Lưu tin yêu thích |

**P2 — hướng phát triển, không làm trong đồ án:** bản đồ khoảng cách tới trường; thông báo tin mới; tinh chỉnh PhoBERT/CRF từ tập đã gán nhãn; mở rộng sang khu vực khác.

## 2. Sơ đồ trang

```text
Người đi thuê                         Nhóm (cần đăng nhập vai trò)
├── /                Trang chủ        ├── /team/kho          Kho dữ liệu
├── /tim-tro         Tìm trọ          ├── /team/duyet        Hàng duyệt
├── /tin/[id]        Chi tiết tin     ├── /team/duyet/[id]   Duyệt một tin
├── /thi-truong      Thị trường       ├── /team/lab          Lab trích xuất
├── /phan-tich/[id]  Kết quả phân tích├── /team/danh-gia     Đánh giá
└── /dang-nhap                        └── /team/cai-dat      Nguồn, nhóm FB, tài khoản
```

Thanh điều hướng người đi thuê: **Tìm trọ · Thị trường · Cài extension**. Khu Nhóm có sidebar: Kho dữ liệu · Hàng duyệt (badge số việc) · Lab · Đánh giá · Cài đặt.

## 3. Đặc tả từng màn hình

Mỗi màn hình ghi: mục đích, nội dung, hành động, các trạng thái phải vẽ, API dùng. Tên API xem [API contract](../03-system/03-api-contract.md).

### 3.1 Trang chủ `/`

- **Mục đích:** giải thích sản phẩm trong 10 giây và dẫn tới Tìm trọ hoặc cài extension.
- **Nội dung:** một câu giá trị; ví dụ bài đăng có bôi màu nhãn (bài tự tạo, ghi rõ "ví dụ"); hai nút: **Tìm phòng**, **Cài extension**; số tin đang có trong kho và ngày cập nhật.
- **Trạng thái:** kho rỗng → ẩn số liệu, giữ ví dụ.
- **API:** `GET /stats/overview`.

### 3.2 Tìm trọ `/tim-tro`

- **Mục đích:** J2 — tìm tin theo nhu cầu.
- **Bộ lọc:** phường (nhiều lựa chọn), loại phòng, khoảng giá (triệu/tháng), khoảng diện tích, "chỉ tin có giá". Sắp xếp: giá tăng/giảm, mới nhất. Bộ lọc lưu trên URL.
- **Thẻ tin:** loại phòng · phường · giá thuê (hoặc "Chưa có giá" / "Từ 3 triệu" / "1,5 tr/người") · diện tích (hoặc "Chưa rõ") · dòng phí ("Điện 3,5k/số · Nước 100k/người · Cọc 1 tháng" hoặc "Chưa rõ phí") · ngày đăng · nhãn nhận định nếu có ("Thấp hơn trung vị 8%").
- **Trạng thái:** đang tải (khung xám) · không có kết quả (nêu điều kiện nào làm rỗng, nút bỏ từng điều kiện) · lỗi API (nút thử lại) · kho rỗng.
- **API:** `GET /listings`.

### 3.3 Chi tiết tin `/tin/[id]`

Bốn vùng theo thứ tự đọc:

1. **Thông tin chính:** loại phòng, số phòng ngủ/khép kín, diện tích, vị trí (mốc như "gần ĐH FPT" + phường chuẩn theo đơn vị hành chính mới, tên cũ giữ lại), ngày đăng, link bài gốc.
2. **Giá và phí:** giá thuê lớn và rõ, kèm đơn vị (`/tháng/phòng` hoặc `/tháng/người`). Bảng phí: cọc, điện, nước, dịch vụ, internet, gửi xe; khoản nào bài không nói thì ghi "Không đề cập". Không cộng thành tổng nếu thiếu thông tin.
3. **Bằng chứng:** bài gốc (đã che SĐT) với từng nhãn bôi màu **và** có chữ nhãn (GIÁ, DT, VT, PN, PHÍ) để người không phân biệt màu vẫn đọc được. Bấm một trường bên trên thì đoạn chữ tương ứng sáng lên. Ghi nguồn: Regex / LLM / cả hai khớp / người duyệt sửa.
4. **So sánh:** trung vị nhóm, P25–P75, vị trí của tin trên thanh phân bố, N, tiêu chí nhóm, khoảng thời gian dữ liệu, 3 tin giống nhất. Thiếu dữ liệu thì vùng này vẫn hiện và giải thích thiếu gì.

- **Trạng thái:** tin bị loại/ẩn · bài nhiều phòng (tab cho từng phòng) · thiếu giá · không đủ mẫu.
- **API:** `GET /listings/{id}`, `GET /listings/{id}/comparison`.

### 3.4 Thị trường `/thi-truong`

- **Mục đích:** nhìn tổng quan giá chào thuê theo khu vực.
- **Nội dung:** bảng phường × loại phòng: trung vị, P25–P75, giá/m², N. Ô có N < 10 ghi "chưa đủ dữ liệu". P1: biểu đồ hộp theo phường; trung vị theo tuần kèm N mỗi tuần.
- **Câu bắt buộc trên trang:** "Số liệu là giá chào thuê trong các bài đăng nhóm đã thu từ [ngày] đến [ngày], không phải giá giao dịch."
- **API:** `GET /market/summary`.

### 3.5 Kết quả phân tích `/phan-tich/[id]`

- **Mục đích:** trang web mở từ nút "Xem trên web" của extension (J1); cũng là kết quả của F12 dán văn bản.
- **Nội dung:** giống Chi tiết tin, thêm trạng thái xử lý và nút **Đóng góp vào kho** (mặc định không đóng góp).
- **Trạng thái:** đang chờ · đang trích xuất · hoàn tất · lỗi LLM (vẫn hiện kết quả Regex, ghi "kết quả một phần") · không phải bài cho thuê.
- **API:** `GET /analyses/{id}`, `POST /analyses/{id}/contribute`.

### 3.6 Kho dữ liệu `/team/kho`

- **Mục đích:** J3 — theo dõi dữ liệu đã thu.
- **Nội dung:** bảng bài: nguồn (nhóm FB), ngày đăng, ngày thu, loại bài, trạng thái (chờ xử lý / đã trích / cần duyệt / đã duyệt / loại / trùng), người thu. Bộ lọc theo trạng thái, nhóm, người thu, ngày. Thẻ tổng: tổng bài, theo trạng thái, theo phường.
- **Hành động:** xử lý lại một bài; xuất CSV cho đánh giá (chỉ trường đã chuẩn hóa).
- **API:** `GET /team/posts`, `POST /team/posts/{id}/reprocess`, `GET /team/export`.

### 3.7 Hàng duyệt `/team/duyet` và `/team/duyet/[id]`

- **Danh sách:** tin cần xem, sắp theo lý do: Regex/LLM lệch nhau · nhiều phòng · có giá nhưng không xác định đơn vị · nghi trùng · LLM lỗi.
- **Màn duyệt một tin:** trái là bài gốc bôi màu; phải là bảng trường với giá trị Regex, giá trị LLM, giá trị chọn, ô sửa, lý do sửa. Dưới là danh sách tin nghi trùng (chọn: cùng phòng / khác phòng / chưa chắc).
- **Hành động:** Duyệt · Loại (bắt buộc lý do) · Tách thành nhiều phòng · Gộp.
- **API:** `GET /team/reviews`, `GET /team/reviews/{id}`, `POST /team/reviews/{id}/decision`.

### 3.8 Lab trích xuất `/team/lab`

- **Mục đích:** cho thấy bài toán gán nhãn chuỗi và sự khác nhau giữa các phương pháp. Màn chính khi bảo vệ.
- **Nội dung:** chọn một bài (từ tập dev/test hoặc dán chữ). Ba hàng bôi màu song song: **Regex** (kèm mã luật, ví dụ `PRICE_TR_SUFFIX`), **LLM** (kèm đoạn trích nguyên văn), **Nhãn chuẩn** (nếu bài thuộc tập chuẩn). Bên dưới: bảng BIO theo token; bảng giá trị chuẩn hóa của từng phương pháp; ô đỏ chỗ lệch nhau.
- **API:** `POST /lab/run`, `GET /lab/gold/{post_id}`.

### 3.9 Đánh giá `/team/danh-gia`

- **Nội dung:** chọn lần chạy (run). Bảng P/R/F1 theo trường × phương pháp; tỉ lệ chuẩn hóa đúng; tỉ lệ trả rỗng đúng; ma trận nhầm PRICE ↔ FEE; chi phí (số lần gọi LLM, thời gian); danh sách lỗi có link sang Lab. Lần chạy test có nhãn "đã đóng băng".
- **API:** `GET /eval/runs`, `GET /eval/runs/{id}`.

## 4. Màn hình extension

| Màn | Nội dung | Trạng thái |
|---|---|---|
| Popup chính | Tài khoản đã kết nối · công tắc **Thu thập** · bộ đếm phiên (gửi / trùng / lỗi) · nút mở web | Chưa kết nối · đang thu · tạm dừng · dừng vì Facebook yêu cầu xác minh |
| Xem trước (Nhận định) | Chữ của bài sẽ gửi (đã che SĐT), link bài, nút **Phân tích** / **Hủy** | Không lấy được chữ → hướng dẫn bôi đen hoặc dán |
| Panel kết quả | Giá thuê to, đơn vị; loại · DT · vị trí; dòng phí; ô nhận định màu viền + chữ ("Cao hơn 10% so với trung vị"); thanh phân bố P25–median–P75 có chấm "bài này"; "N = 14 tin CCMN 25–35 m² cùng phường"; 3 tin tương tự; nút **Xem trên web** | Đang xử lý · không phải bài cho thuê · không công khai giá · chưa đủ dữ liệu · lỗi |

Mẫu panel đã có trong proposal (Hình 2). Chi tiết kỹ thuật: [đặc tả extension](../03-system/05-extension.md).

## 5. Quy tắc giao diện chung

- **Không truyền thông tin chỉ bằng màu**: nhãn luôn có chữ; ô nhận định có viền + câu chữ. Tương phản đạt WCAG AA.
- **Không giả tiến độ**: không hiện phần trăm khi không biết tổng việc; không dùng chữ "Live" nếu không cập nhật thật.
- **Thiếu là thiếu**: giá thiếu hiện "Chưa có giá", không hiện 0; phí không đề cập hiện "Không đề cập".
- **Câu nhận định dùng từ trung tính**: "cao hơn trung vị của nhóm tin so sánh", không dùng "bị hét giá" hay "rẻ, nên thuê".
- **Dữ liệu ví dụ có nhãn**: mọi bài tự tạo dùng để minh họa đều ghi "ví dụ".
- **Mỗi màn có đủ trạng thái** đang tải / rỗng / lỗi / thành công; dùng được bằng bàn phím; hiển thị được ở bề rộng điện thoại.
