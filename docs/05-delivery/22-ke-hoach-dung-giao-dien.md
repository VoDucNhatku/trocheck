# Kế hoạch dựng giao diện TrọCheck (dự án ReNER-VN)

Cập nhật 28/10/2026, sau khi chốt trang chủ. Tên hiển thị của sản phẩm là **TrọCheck**; tên kho mã và tài liệu kỹ thuật vẫn là ReNER-VN. File đi kèm: [23-trang-thieu-va-prompt-stitch.md](23-trang-thieu-va-prompt-stitch.md) (các màn cần làm trên Stitch và prompt).

Tài liệu này trả lời: lấy mọi thứ ở đâu, backend đã đủ chưa, trang nào lấy từ nguồn nào, style ra sao, dựng theo thứ tự nào, và các tính năng mở rộng đã chốt.

---

## Đường dẫn: lấy mọi thứ ở đâu

Thư mục gốc của dự án (gọi tắt là **WS** trong các bảng dưới):

```text
C:\Users\Asus\.codex\visualizations\2026\10\26\01a175c3-2040-7cb2-aec8-69bc64b965c1\rener-github-review-20261026
```

### Nguồn thiết kế

| Thứ cần | Đường dẫn đầy đủ |
|---|---|
| **Trang chủ đã chốt (bản thử v3)** | `WS\.tmp\landing-v2\story-v3.html` (xem tại http://localhost:4610/story-v3.html, máy chủ `landing-v2-proto` trong `D:\DEMO kế hoạch kì 5\DEMO kế hoạch kì 5\TMG301\.claude\launch.json`) |
| Ảnh chụp trang chủ v3 (1440 và 390, sáng và tối, nhiều điểm cuộn) | `WS\.tmp\landing-v2\shots\v3\` |
| Logo TrọCheck (file gốc của bạn) | `C:\Users\Asus\Downloads\stitch_rener_rental_intelligence_platform.zip`; đã giải nén ở `WS\.tmp\stitch-trocheck\screen.png`; mảnh đã cắt (biểu tượng, chữ cho nền sáng, chữ cho nền tối) ở `WS\.tmp\brand\` |
| Ảnh sân trọ và ảnh mây (ảnh AI, lấy từ landing cũ, commit `7152eac`) | Gốc `WS\apps\web\public\images\rener-courtyard.png`, `rener-cloud-bank.png`; bản nén webp `WS\.tmp\landing-v2\img\` |
| Landing artifact cũ (nguồn cho các phần sau dải mẩu bài) | https://claude.ai/artifact/6y1t6u7odKT8VBj98SCEGb, mã nguồn `WS\.tmp\landing-artifact\Main.dc.html` |
| File ZIP Stitch gốc | `C:\Users\Asus\Downloads\stitch_rener_rental_intelligence_platform (10).zip` |
| Màn Stitch giữ lại (mỗi thư mục có `screen.png` + `code.html`) | `WS\.tmp\stitch-10\trang_3_chi_ti_t_ph_ng_rener\` (Chi tiết tin)<br>`WS\.tmp\stitch-10\trang_4_th_tr_ng_rener\` (Thị trường)<br>`WS\.tmp\stitch-10\trang_5_ph_n_t_ch_b_i_ng_rener\` (Phân tích)<br>`WS\.tmp\stitch-10\trang_6_ng_nh_p_rener\` (Đăng nhập)<br>`WS\.tmp\stitch-10\trang_7_kho_d_li_u_rener\` (Kho dữ liệu)<br>`WS\.tmp\stitch-10\trang_10_lab_rener\` (Kiểm tra trích xuất, tên cũ "Lab") |
| Màn Stitch không dùng | `WS\.tmp\stitch-10\trang_ch_rener\` (trang chủ, đã thay bằng landing) |
| Màn Stitch hỏng ảnh (đã loại, HTML vẫn đọc được) | `WS\.tmp\stitch-10\_da-loai-hong\trang_2_t_m_tr_rener\`, `trang_8_h_ng_duy_t_rener\`, `trang_9_duy_t_m_t_tin_rener\`, `trang_11_nh_gi_rener\` |
| Bộ màu Stitch cũ (không dùng nữa) | `WS\.tmp\stitch-10\warm_analytical_clarity\DESIGN.md` |
| **Nơi để bản Stitch mới** (bạn tạo) | `WS\.tmp\stitch-11\<số>-<tên-màn>\screen.png` + `code.html` |
| 11 ảnh bài đăng/phòng trọ thật (dữ liệu thử đọc ảnh) | `WS\.tmp\rental-reference-photos\` (01–11 `.png` + `manifest.json`) |
| Ảnh tham chiếu Cosmos (đăng nhập chia đôi, chip, menu) | `WS\.tmp\design-refs\cosmos\01-feed-menu.webp`, `02-onboarding-chips.webp`, `03-login-split.webp` |
| Ảnh chụp bản giao diện Codex số 3 (bản hiện tại, để so) | `WS\.tmp\redesign-shots\` |
| Chuẩn thiết kế KusShoes (tham khảo cách viết quy tắc) | `D:\DEMO kế hoạch kì 5\DEMO kế hoạch kì 5\TMG301\KusShoes\docs\DESIGN.md` |

### Tài liệu

| Tài liệu | Đường dẫn |
|---|---|
| Kế hoạch này + prompt Stitch | `WS\docs\05-delivery\22-ke-hoach-dung-giao-dien.md`, `23-trang-thieu-va-prompt-stitch.md` |
| Bản sao để mở trong app | `D:\DEMO kế hoạch kì 5\DEMO kế hoạch kì 5\TMG301\ReNER-thiet-ke\` |
| Hợp đồng API | `WS\docs\03-system\03-api-contract.md` |
| Cơ sở dữ liệu | `WS\docs\03-system\04-co-so-du-lieu.md` |
| Đặc tả extension | `WS\docs\03-system\05-extension.md`, `WS\apps\extension\README.md` |
| Tính năng và màn hình (gốc) | `WS\docs\01-product\03-tinh-nang-va-man-hinh.md` |
| Báo cáo Codex số 3 (bản hiện tại) | `WS\docs\05-delivery\20-redesign-delivery.md` |

### Mã nguồn

| Phần | Đường dẫn |
|---|---|
| Route web (Next.js) | `WS\apps\web\src\app\` — `(renter)\` trang công khai, `(workspace)\` khu trong, `dang-nhap\`, `dang-ky\` |
| Giao diện khu trong | `WS\apps\web\src\features\workspace\` (`Shell.tsx`, `Analyze.tsx`, `Reading.tsx`, `Team.tsx`, `ReviewDetail.tsx`, `Lab.tsx`, `Evaluation.tsx`, `Account.tsx`, `Login.tsx`, `Market.tsx`, `ui.tsx`) |
| Landing hiện tại (sẽ thay) | `WS\apps\web\src\features\landing\` |
| Token style | `WS\apps\web\src\styles\tokens.css` |
| Header/chân trang công khai | `WS\apps\web\src\components\SiteHeader\`, `SiteFooter\` |
| BFF + danh sách API được phép gọi | `WS\apps\web\src\app\api\workspace\[...path]\route.ts`, `WS\apps\web\src\lib\workspace\safe-path.ts` |
| Kiểu dữ liệu API sinh tự động | `WS\apps\web\src\lib\api\generated.ts` (chạy `npm run generate:api` sau khi đổi API) |
| API (FastAPI) | `WS\apps\api\app\api\routes.py`, `schemas\`, `services\`, `models\__init__.py` |
| Migration | `WS\apps\api\migrations\versions\` |
| Test API | `WS\apps\api\tests\` |
| Test trình duyệt | `WS\apps\web\tests\browser\` (`interior.spec.ts`, `research.spec.ts`, `public.spec.ts`, `redesign.spec.ts`) |
| Extension (chưa có code) | `WS\apps\extension\` |
| Kết quả đánh giá | `WS\eval\runs\` (chưa có thư mục này vì chưa chạy lần nào) |
| Bản gốc local (không sửa) | `D:\DEMO kế hoạch kì 5\DEMO kế hoạch kì 5\TMG301\rener-vn` (cổng 3000) |

---

## Những gì đã thống nhất với bạn

| # | Bạn yêu cầu | Kế hoạch xử lý |
|---|---|---|
| 1 | Phần đầu web lấy landing trong artifact | Trang chủ `/` = bản thử v3 đã chốt + các phần sau của landing artifact (mục 2.1) |
| 2 | Khu trong lấy các trang trong ZIP Stitch, mình chọn lại, trang hỏng thì xóa | Giữ 6 màn, loại 4 màn hỏng, không dùng trang chủ Stitch (mục 2.2–2.3) |
| 3 | Cho biết cần thêm trang nào để bạn prompt Stitch cho nó sáng tạo | 16 màn mới + 6 prompt vẽ lại, ở file 23 |
| 4 | Style theo artifact, vì chuyển cảnh rất mượt | Bộ token và chuyển động ở mục 3 |
| 5 | Kiểm backend đã có và chuẩn chưa | Mục 1 |
| 6 | Từ trang chủ phải bấm tới được mọi trang | Mục 2.1 sửa menu; checklist ở mục 4, bước 6 |
| 7 | Chỉ lên kế hoạch, không tự thêm gì khi bạn chưa đồng ý | Tính năng mới nằm ở mục 5. Chỉ mục bạn đã chốt mới được đưa vào kế hoạch và prompt Stitch |
| 8 | Ghi đường dẫn thư mục đầy đủ để biết lấy ở đâu | Mục "Đường dẫn" ở đầu file này và đầu file 23 |
| 9 | Chốt tính năng nhóm 5.1 (ảnh) | Đã chốt cả 3 mục: đọc ảnh chụp bài đăng, extension lưu ảnh đầu tiên, hiện ảnh tin (mục 5.1) |
| 10 | Chốt nhóm 5.3 (tài khoản) | Đã chốt: đổi mật khẩu, quên mật khẩu, đăng nhập Google, thông báo (mục 5.3) |
| 11 | Chốt nhóm 5.4 (khu nhóm) | Đã chốt: tìm từ khóa trong Kho, duyệt nhiều tin, ghi nhãn chuẩn, nguồn cào bằng bot (mục 5.4) |
| 12 | Đổi tên "Lab" | Đổi thành **Kiểm tra trích xuất**, route `/team/kiem-tra` (mục 2.5) |
| 13 | Duyệt 5.5 quản lý người dùng | Đã chốt: màn Người dùng cho admin (mục 5.5, file 23 §A16) |
| 14 | Tên sản phẩm và logo | Tên **TrọCheck**. Chỉ dùng logo trong file zip của bạn, không tự vẽ logo (mục 0, 3.1) |
| 15 | Có chế độ sáng và tối từ nay | Mọi màn có hai chế độ, nút chuyển trên thanh đầu trang (mục 3.1) |
| 16 | Câu mở đầu trang chủ | Giữ câu của landing cũ: "Đọc đúng giá thuê. / Tìm chốn an tâm." (mục 2.1) |
| 17 | Nền sau phần mở đầu và hiệu ứng | Ảnh sân trọ lùi rồi tan khi cuộn; hết phần 2 thì mây phủ kín rồi tan ra phần sau (mục 2.1, 3.5) |
| 18 | Phần 2: một bài đăng được đọc qua các bước | Bắt đầu từ ảnh chụp bài + ảnh phòng; nhãn ghi đủ chữ; phiếu giá; biểu đồ khối xanh; kết luận theo giá trung bình (mục 2.1) |
| 19 | Dải mẩu bài chạy | Tiêu đề "Đọc được cả bài viết tắt, cả bài giấu giá."; ảnh đại diện chữ cái trên nền màu; khung bo tròn (mục 2.1) |
| 20 | Các màn khác dùng giá trung bình | Thay trung vị bằng giá trung bình ở mọi màn; bỏ chữ P25–P75, dải khoảng giá, "trung vị" và "N" trên giao diện; ghi số phòng bằng chữ (mục 1.5, 3.3, 3.7) |

Còn chờ bạn quyết:
- Nhóm 5.2 (người đi thuê).
- Đề xuất "AI ước tính" khi bài thiếu thông tin. Chưa ghi vào mục 5 vì chưa duyệt.
- Bảng màu: giữ vàng dạ quang như trang chủ (đang theo), hay chuyển sang xanh lục lam theo `DESIGN.md` đi kèm file logo.
- Thanh đầu trang của các trang công khai khác: đề xuất dùng cùng kiểu trang chủ (logo, menu, nút sáng/tối) trên nền thường, không có ảnh.

---

## 0. Tóm tắt quyết định

| Hạng mục | Quyết định |
|---|---|
| Tên và logo | **TrọCheck**, logo lấy từ file của bạn (`WS\.tmp\brand\`). Giao diện không còn chữ "ReNER"; kho mã và tài liệu kỹ thuật giữ tên ReNER-VN. |
| Trang chủ `/` | Bản thử v3 đã chốt cho phần mở đầu, phần 2, mây và dải mẩu bài. Các phần sau vẫn lấy từ landing artifact (mục 2.1). |
| Chế độ màu | Mọi màn có chế độ sáng và tối (mục 3.1). |
| Style toàn site | Theo landing: giấy ngà + mực + bút dạ quang vàng, vùng tối `#111214`, tiêu đề Newsreader. Bộ màu xanh "Warm Analytical Clarity" của Stitch **bỏ**; màu xanh của logo chỉ nằm trong logo. |
| Trang trong từ Stitch | Giữ 6 màn còn ảnh tốt làm **bố cục**, vẽ lại theo style mới, bỏ số bịa. |
| Màn Stitch hỏng | 4 màn đã chuyển vào `_da-loai-hong`, làm lại bằng prompt mới. |
| Màn cần làm trên Stitch | 16 màn mới + 6 màn vẽ lại (file 23). |
| Backend | Đủ API cho các màn hiện có. Tính năng đã chốt ở 5.1, 5.3, 5.4, 5.5 cần thêm API, bảng và migration, liệt kê ở mục 5. |
| "Lab" | Đổi tên thành "Kiểm tra trích xuất". |

---

## 1. Backend

### 1.1 Hiện trạng: đủ cho mọi màn đang có

Kiểm ngày 27–28/10/2026:
- 27 endpoint dưới `/api/v1` (FastAPI), hợp đồng tự sinh trong `generated.ts`.
- `pytest`: 265 passed.
- Migration Alembic chạy trên DB trống tạo đủ 16 bảng, so với model: 0 khác biệt.
- Đăng ký thật (`POST /auth/register`) có kiểm tên, mật khẩu, trùng tên (409), giới hạn theo IP, tự đăng nhập.

Các điểm cần biết khi thiết kế:

| Hiện trạng | Ảnh hưởng |
|---|---|
| Dữ liệu chưa có ảnh | Sẽ có khi làm xong 5.1. Trước đó thẻ tin dùng bài gốc có tô nhãn làm hình ảnh. |
| Bảng `users` chỉ có tên tài khoản, mật khẩu, vai trò; **chưa có email** | Quên mật khẩu và đăng nhập Google (5.3) cần thêm cột email trước. |
| Chưa có lượt đánh giá nào (`eval\runs\` chưa tồn tại) | Màn Đánh giá phải có trạng thái trống. |
| Extension Chrome **chưa có dòng code nào** | 5.1 (lưu ảnh khi cuộn) phải dựng phần extension cơ bản trước. |

### 1.2 Bản đồ trang → API → quyền (các màn hiện có)

| Trang | Route | API | Ai vào được |
|---|---|---|---|
| Trang chủ | `/` | `GET /stats/overview`, `GET /market/summary` | Mọi người |
| Tìm trọ | `/tim-tro` | `GET /listings?ward&type&price_min&price_max&area_min&area_max&has_price&sort&page&page_size&demo` | Mọi người |
| Chi tiết tin | `/tin/[id]` | `GET /listings/{id}`, `GET /listings/{id}/comparison` | Mọi người |
| Thị trường | `/thi-truong` | `GET /market/summary?ward&type&basis&demo` | Mọi người (API công khai; web hiện đặt sau đăng nhập, nên chuyển ra ngoài) |
| Đăng nhập | `/dang-nhap` | `POST /auth/login` | Khách |
| Đăng ký | `/dang-ky` | `POST /auth/register` | Khách |
| Phân tích bài đăng | `/phan-tich` | `POST /analyses` (202 + `analysis_id`) | Đã đăng nhập |
| Bản đọc tin | `/phan-tich/[id]` | `GET /analyses/{id}`, `POST /analyses/{id}/contribute` | Chủ bài |
| Tài khoản | `/tai-khoan` | `GET /auth/me`, `POST/GET/DELETE /team/extension-tokens`, `POST /auth/logout` | Đã đăng nhập |
| Kho dữ liệu | `/team/kho` | `GET /team/posts?status&group&collector&date_from&date_to&post_type&page`, `POST /team/posts/{id}/reprocess`, `GET /team/export?format&include_demo` | collector, reviewer |
| Hàng duyệt | `/team/duyet` | `GET /team/reviews?reason&page` | reviewer |
| Duyệt một tin | `/team/duyet/[id]` | `GET /team/reviews/{id}`, `POST /team/reviews/{id}/decision` | reviewer |
| Kiểm tra trích xuất (tên cũ Lab) | `/team/kiem-tra` (hiện là `/team/lab`) | `POST /lab/run`, `GET /lab/gold/{post_id}` | researcher |
| Đánh giá | `/team/danh-gia` | `GET /eval/runs`, `GET /eval/runs/{run_id}` | researcher |

`admin` có mọi quyền. Trình duyệt gọi khu trong qua BFF `/api/workspace/[...path]`. Mỗi API mới phải được thêm vào allowlist ở `safe-path.ts`.

### 1.3 Dữ liệu từng trang có thể hiện

- **Thẻ tin (`ListingCard`)**: loại phòng, phường, địa danh, giá (`visibility`, `amount_form`, `amount_vnd`/`min`/`max`, `basis`, `period`), diện tích, phí, ngày đăng, nhận định + `delta_percent`, trạng thái duyệt, cờ demo, cờ đủ chữ. Kèm `total`, `hidden_no_price`, `data_as_of`. **Thêm sau 5.1:** `image_url`.
- **Chi tiết (`ListingDetail`)**: tin đầy đủ (giá, diện tích, phòng: số phòng ngủ, WC, gác, WC riêng, nội thất; vị trí: địa danh, đường, phường, phường cũ/quận cũ, độ chắc chắn), phí, bài gốc (đã che, `permalink`, tên nhóm, ngày đăng), số tin cùng bài, lịch sử giá. **Thêm sau 5.1:** `images[]`.
- **So sánh (`Comparison`)**: trạng thái (ok / chưa đủ dữ liệu / không so sánh được), tiêu chí nhóm, N, trung vị, P25, P75, trung vị/m², chênh lệch %, nhận định, khoảng ngày, vài tin tương tự, thông điệp, lưu ý.
- **Thị trường (`MarketCellDTO`)**: phường × loại × cách tính: N, trung vị, P25, P75, trung vị/m², khoảng ngày; số tin bị loại theo lý do; `min_n` = 10; số ngày cửa sổ.
- Trung vị, P25, P75 ở hai mục trên là dữ liệu API hiện có. Giao diện chỉ hiện giá trung bình và số phòng (mục 1.5, 3.7).
- **Bản đọc tin (`AnalysisResult`)**: trạng thái, loại bài, đọc một phần, trạng thái LLM, đã đóng góp, chữ bài, các tin đọc được, lỗi. **Thêm sau 5.1:** nguồn (dán chữ / ảnh chụp).
- **Kho (`TeamPost`)**: id, trạng thái, loại bài, chế độ, nguồn, nhóm, người thu, đã đóng góp, demo, lần thấy đầu/cuối, ngày đăng, đoạn trích, đủ chữ, job (trạng thái, lần thử, mã lỗi), số tin; `by_status`.
- **Hàng duyệt (`ReviewQueueItem`)**: id, lý do, đoạn trích, loại, phường, thời điểm, version, demo; `counts` theo lý do.
- **Duyệt một tin (`ReviewDetail`)**: tin, version, trạng thái, lý do, cụm trùng, bài gốc + permalink, lượt chạy (span Regex, span LLM, trạng thái LLM, model), tin nghi trùng (cosine, giá, diện tích), lịch sử.
- **Kiểm tra trích xuất (`LabResultDTO`)**: chữ, split, loại bài, evidence theo phương pháp, bảng token (Regex / LLM / nhãn chuẩn), giá trị chuẩn hóa theo trường, tin đọc được.
- **Đánh giá (`EvalResult`)**: manifest (split, đóng băng, phương pháp, phiên bản, thời gian, commit), metrics, số lỗi theo phương pháp × loại lỗi.

### 1.4 Những thứ Stitch vẽ mà hệ thống chưa có

**Loại 1: số liệu bịa hoặc mô tả sai hệ thống → luôn bỏ.**
- "PhoBERT", "Deep Learning", "v2.4", "checkpoint", "Độ chính xác 94,8%", F1 cứng. Hệ thống thật dùng **Regex + LLM (Gemini) + kết hợp**; số liệu chỉ lấy từ `eval\runs`.
- "+14,2% tuần này", "Live feed", tốc độ ms/bài, "1,420 / 1,428 tin", "Tìm kiếm nhiều nhất / lượt xem", "Biến động giá mạnh nhất", "Hệ thống online".
- "Ảnh thực tế AI xác thực".
- Thẻ "tài khoản demo click để điền" ở màn đăng nhập (lộ mật khẩu).

**Loại 2: tính năng chưa có backend.**
- **Đã chốt, sẽ làm** (5.1, 5.3, 5.4, 5.5): ảnh tin, đọc ảnh chụp bài đăng, extension lưu ảnh, đổi mật khẩu, quên mật khẩu, đăng nhập Google, thông báo, tìm từ khóa trong Kho, duyệt nhiều tin, ghi nhãn chuẩn, nguồn cào bằng bot, quản lý người dùng.
- **Còn chờ duyệt, chưa vẽ** (5.2): lưu phòng yêu thích, lịch sử phân tích của tôi, báo sai lệch, sao chép tóm tắt, lời khuyên thuê trọ, xuất PDF/Excel thị trường.

### 1.5 Backend cần thêm cho trang chủ đã chốt

| Việc | Chi tiết |
|---|---|
| Tính giá trung bình của nhóm so sánh | Mọi màn có so sánh dùng "mức trung bình" (bạn chốt 28/10/2026: trang chủ, thẻ tin, chi tiết tin, thị trường, bản đọc tin). API hiện chỉ trả trung vị, P25, P75. Thêm giá trung bình và giá trung bình/m² (ví dụ `mean_vnd`, `mean_per_m2`) vào `Comparison` (`GET /listings/{id}/comparison`) và `MarketCellDTO` (`GET /market/summary`); `delta_percent` và nhận định tính theo trung bình. Trung vị, P25, P75 vẫn giữ trong API cho nhóm nghiên cứu, không hiện trên giao diện. Cùng ngưỡng `min_n` = 10. Thêm test pytest, chạy `npm run generate:api`. |
| Số trong ví dụ trang chủ | Ví dụ 12 phòng có trung bình 4,108 tr; phòng 4,7 tr cao hơn khoảng 14%. Đây là số tự tạo, không lấy từ API. |

---

## 2. Chọn trang

### 2.1 Trang chủ

**Đã chốt 28/10/2026** theo bản thử `WS\.tmp\landing-v2\story-v3.html`. Thứ tự từ trên xuống:

1. **Thanh đầu trang** nằm trên ảnh: logo TrọCheck, menu, nút chuyển sáng/tối. Khi cuộn, thanh trôi đi cùng trang.
2. **Mở đầu** trên ảnh sân trọ (ảnh AI, có nhãn "Không gian minh họa bằng AI") với khung viền mảnh:
   - Dòng nhỏ "Một nơi ở. Một khởi đầu." (chấm vàng, chữ hoa giãn).
   - Tiêu đề hai dòng cùng cỡ: "Đọc đúng giá thuê." / "*Tìm chốn an tâm.*" (dòng dưới nghiêng, màu vàng).
   - Câu: "Giữa hàng trăm bài đăng, tìm một căn phòng vừa ý bắt đầu từ những thông tin rõ ràng."
   - Nút vàng "Tìm phòng của bạn" (tới `/tim-tro`) và link "Khám phá TrọCheck" (cuộn xuống phần 2).
   - "Cuộn để đọc rõ hơn" ở góc dưới.
   - Bên phải: ảnh chụp bài đăng và ảnh phòng, cũng là điểm bắt đầu của phần 2.
3. **Phần 2: một bài đăng được đọc qua 6 bước.** Khung ghim theo cuộn, thanh 7 bước ở dưới.

   | Bước | Nội dung |
   |---|---|
   | 1. Gác ảnh phòng | Ảnh sân lùi rồi tan; ảnh phòng bị đẩy ra. "Ảnh phòng để bạn xem. Giá nằm trong chữ." |
   | 2. Đọc ảnh chụp | Vạch quét chạy qua ảnh chụp, chữ trải ra từng dòng; tên trang và cách liên hệ bị che. |
   | 3. Gán nhãn | Mỗi đoạn được tô 5 màu, nhãn ghi đủ chữ: Giá, Diện tích, Vị trí, Loại phòng, Phí. Bài thiếu diện tích thì ô để trống, không đoán. |
   | 4. Phiếu giá | Nhãn bay vào phiếu. "Giá thuê" là ô vàng; giá "4.700.000 đ /tháng"; chữ "đã chuẩn hóa" màu đỏ. 5 khoản phí đứng riêng từng dòng, đầu dòng là ô màu nhỏ thay chữ nhãn. Thiếu thì ghi "Không đề cập" (chữ đen). Cuối phiếu: "Nên hỏi lại…". |
   | 5. So với nhóm | Biểu đồ khối 3D trong khung "Giá chào thuê cùng phường", mỗi khối xanh là một phòng; vạch nét đứt "Trung bình 4,1 tr"; cờ vàng "Phòng này 4,7 tr"; mũi đo "đắt hơn 14%". Không có chú thích, không có chữ P25/P75. |
   | 6. Kết luận | Hộp đóng dấu: "Cao hơn mức trung bình khoảng 14% của 12 phòng cùng phường." và "Đây là giá chào thuê trong bài đăng, không phải giá giao dịch." Tiêu đề: "Trước khi nhắn chủ trọ, xem giá này đáng hỏi tiếp không." |

4. **Mây phủ**: hết phần 2, mây tràn lên từ hai bên và từ dưới, phủ kín rồi tan ra phần sau. Chế độ tối mây tối màu, chế độ sáng mây trắng.
5. **Dải mẩu bài chạy**: tiêu đề "Đọc được cả bài viết tắt, cả bài giấu giá.", dòng phụ "Các mẩu dưới đây là ví dụ tự tạo, viết giống bài trong các nhóm cho thuê." Hàng trên là mẩu bài thô (ảnh đại diện chữ cái trên nền màu, khung bo tròn, nhãn đủ chữ), hàng dưới là bản đã đọc; hai hàng chạy ngược chiều; có nút tạm dừng.
6. **Các phần sau** chưa có trong bản thử v3 (trang còn ngắn). **Đang giao Codex số 5** làm tiếp trong bản thử `WS\.tmp\design-v4	rang-chu.html` (bước 4). Nội dung lấy từ landing artifact, làm lại cho ra trang sản phẩm hoàn chỉnh, đổi tên và thêm chế độ sáng tối: dải số liệu, 6 ca khó, extension (panel 4 trạng thái), thị trường (ô dưới 10 tin để trống), nguyên tắc, khối so sánh Regex/LLM/nhãn chuẩn, nút cuối, chân trang.

Màn hẹp dưới 1000px, trình duyệt chưa hỗ trợ `animation-timeline`, hoặc máy bật giảm chuyển động: mọi phần hiện tĩnh theo thứ tự trên, không có mây, ảnh sân chỉ nằm sau phần mở đầu.

Phải sửa khi đưa vào web:

| Chỗ | Sửa |
|---|---|
| Bài đăng và ảnh phòng ở phần 2 | Bản thử đang dùng ảnh chụp bài và ảnh phòng thật của bạn. **Thay bằng bài và ảnh tự tạo trước khi đưa vào mã nguồn**, nên đặt ở một phường Hà Nội cho khớp dữ liệu. Số trong phiếu giá, biểu đồ và kết luận đổi theo. |
| Menu | Bản thử có Tìm trọ, Thị trường, Cách hoạt động và nút sáng/tối. Khi dựng: Tìm trọ, Thị trường, Extension, **Đăng nhập**, nút **Tạo tài khoản**, nút sáng/tối. Đã đăng nhập thì thành **Vào bàn làm việc** + chuông thông báo (5.3). |
| Giá trung bình | Ví dụ trên trang chủ là số tự tạo. Chỗ nào hiện số thật thì lấy trung bình từ API (mục 1.5). |
| Dải số "412 / 298 / 25/10" | Lấy từ `GET /stats/overview`; giữ nhãn demo khi `is_demo`. |
| Bảng thị trường (6 dòng cứng) | Lấy từ `GET /market/summary`, 6 ô có N lớn nhất; ô `n < min_n` hiện "chưa đủ dữ liệu" + nền sọc. |
| "Dữ liệu từ 05/10/2026 đến 25/10/2026" | Lấy `data_from`/`data_to` từ API. |
| 6 ca khó, panel extension | Giữ nội dung ví dụ tự tạo, đã ghi nhãn; đổi ReNER thành TrọCheck; thêm chế độ sáng. |
| Khối "Lab" cuối trang | Đổi tiêu đề sang "Kiểm tra trích xuất". |
| Nút "Cài extension" | Dẫn tới `/extension` (file 23 §A10). |
| Chân trang | Logo TrọCheck; thêm cột Tài khoản (Đăng nhập, Tạo tài khoản) và link Điều khoản. |

### 2.2 Màn Stitch giữ lại (làm bố cục, vẽ lại style)

Cột cuối: **BỎ** = số bịa; **THÊM** = tính năng đã chốt; **CHỜ** = tính năng chờ duyệt, chưa vẽ.

| Màn Stitch | Route | Giữ | Bỏ / thêm / chờ |
|---|---|---|---|
| `trang_3` Chi tiết phòng | `/tin/[id]` | Tiêu đề loại + diện tích; khối giá bên phải; bài gốc tô 5 màu + chú giải; bảng phí có đơn vị; thước so với khu; tin tương tự | BỎ: "Ảnh thực tế AI xác thực", thang máy, số người ở. THÊM: khu ảnh tin (5.1). CHỜ: "Lưu phòng", "Sao chép", "Báo sai lệch" |
| `trang_4` Thị trường | `/thi-truong` | Ma trận phường × loại (giá trung bình, giá trung bình/m², số phòng); ô thiếu dữ liệu; cột so giá trung bình giữa phường; công tắc "Giá phòng / Giá theo người"; chọn phường | BỎ: "1,428 tin / 94,8%", "Biến động giá mạnh nhất", "Tìm kiếm nhiều nhất", "Kỳ khảo sát". CHỜ: Xuất Excel/PDF, Lời khuyên |
| `trang_5` Phân tích bài đăng | `/phan-tich` | Hai cột dán bài / kết quả; thanh 3 bước; giá lớn; chip 5 nhãn; thẻ phí; thước giá; "Đóng góp bài này"; cảnh báo ca đặc biệt | BỎ: "94,8% PhoBERT", "Cấu hình mô hình", "Kho tham chiếu 1,420", "0,42s". THÊM: tải ảnh chụp bài đăng (5.1) |
| `trang_6` Đăng nhập | `/dang-nhap` | Form gọn, hiện/ẩn mật khẩu, "Quay lại trang chủ" | BỎ: 4 thẻ tài khoản demo, "SSL 256-bit", "Engine v2.4". THÊM: "Quên mật khẩu?", "Đăng nhập với Google" (5.3), đăng nhập bằng tên tài khoản **hoặc email** |
| `trang_7` Kho dữ liệu | `/team/kho` | Sidebar; thẻ đếm theo trạng thái; bộ lọc; bảng; Xuất CSV; phân trang | BỎ: "+14,2%", "Live feed", tốc độ PhoBERT, "Meta Graph", "AI v2.4 Online". THÊM: ô tìm từ khóa, nút "Nguồn cào" dẫn tới màn quản lý bot (5.4) |
| `trang_10` Lab | `/team/kiem-tra` | Chọn bài/dán chữ + chạy; 3 tầng Regex / LLM / nhãn chuẩn; bảng token; bảng giá trị chuẩn hóa | BỎ: PhoBERT, F1 cứng, tốc độ ms, checkpoint. THÊM: "Ghi vào nhãn chuẩn" (5.4); đổi tên màn |

`trang_ch` (trang chủ Stitch) không dùng.

### 2.3 Màn bỏ (ảnh hỏng)

`trang_2` Tìm trọ, `trang_8` Hàng duyệt, `trang_9` Duyệt một tin, `trang_11` Đánh giá: đã chuyển vào `WS\.tmp\stitch-10\_da-loai-hong\`. Mỗi màn có prompt thay thế ở file 23.

### 2.4 Danh sách cuối: 23 màn

| # | Màn | Route | Nguồn thiết kế | Ưu tiên |
|---|---|---|---|---|
| 1 | Trang chủ | `/` | Bản thử v3 + landing artifact (mục 2.1) | P0 |
| 2 | Tìm trọ | `/tim-tro` | Stitch mới (file 23 §A1) | P0 |
| 3 | Chi tiết tin | `/tin/[id]` | `trang_3` vẽ lại (file 23 §B1) | P0 |
| 4 | Thị trường | `/thi-truong` | `trang_4` vẽ lại (§B2) | P0 |
| 5 | Đăng nhập | `/dang-nhap` | `trang_6` vẽ lại (§B4) | P0 |
| 6 | Đăng ký | `/dang-ky` | Stitch mới (§A5) | P0 |
| 7 | Phân tích bài đăng (dán chữ hoặc ảnh chụp) | `/phan-tich` | `trang_5` vẽ lại (§B3) | P0 |
| 8 | Bản đọc tin + trạng thái | `/phan-tich/[id]` | Stitch mới (§A7) | P0 |
| 9 | Khung khu trong (sidebar, topbar, menu tài khoản, chuông) | — | Stitch mới (§A8) | P0 |
| 10 | Hàng duyệt (có duyệt nhiều tin) | `/team/duyet` | Stitch mới (§A2) | P1 |
| 11 | Duyệt một tin | `/team/duyet/[id]` | Stitch mới (§A3) | P1 |
| 12 | Kho dữ liệu (có tìm từ khóa) | `/team/kho` | `trang_7` vẽ lại (§B5) | P1 |
| 13 | Nguồn cào (quản lý bot) | `/team/nguon-cao` | Stitch mới (§A14) | P1 |
| 14 | Tài khoản (email, đổi mật khẩu, Google, token) | `/tai-khoan` | Stitch mới (§A6) | P1 |
| 15 | Quên mật khẩu + đặt lại mật khẩu | `/quen-mat-khau`, `/dat-lai-mat-khau` | Stitch mới (§A12) | P1 |
| 16 | Thông báo | `/thong-bao` + bảng thả từ chuông | Stitch mới (§A13) | P1 |
| 17 | Kiểm tra trích xuất (tên cũ Lab) | `/team/kiem-tra` | `trang_10` vẽ lại (§B6) | P1 |
| 18 | Đánh giá | `/team/danh-gia` | Stitch mới (§A4) | P1 |
| 19 | Trang lỗi: 404 / 403 / 500 / hết phiên | — | Stitch mới (§A9) | P1 |
| 20 | Người dùng (quản trị tài khoản, chỉ admin) | `/team/nguoi-dung` | Stitch mới (§A16) | P1 |
| 21 | Extension (giới thiệu + kết nối) | `/extension` | Stitch mới (§A10) | P2 |
| 22 | Popup extension (lưu ảnh, bộ đếm) | trong extension | Stitch mới (§A15) | P2 |
| 23 | Điều khoản và dữ liệu | `/dieu-khoan` | Stitch mới (§A11) | P2 |

P0 = cần cho buổi demo. P1 = khu nhóm và tài khoản. P2 = extension và trang phụ.

### 2.5 "Lab" là gì, đổi tên thành gì

**Là gì:** màn dành cho người nghiên cứu (vai trò researcher, admin cũng vào được). Màn này lấy **một bài** rồi đặt ba cách đọc cạnh nhau: Regex đọc gì, LLM đọc gì, nhãn chuẩn do người gán là gì. Chỗ nào lệch thì đánh dấu. Có bảng so từng chữ (token) và bảng so giá trị đã chuẩn hóa (ví dụ "5tr5" → 5.500.000 đ). Màn Đánh giá trả lời "phương pháp nào tốt hơn trên cả tập"; màn này trả lời "**vì sao** nó sai ở bài này".

**Thuộc phần nào:** nằm trong **khu nhóm**, cùng chỗ với Kho dữ liệu, Hàng duyệt và Đánh giá. Đây là khu làm việc của nhóm làm dữ liệu, không phải trang quản trị người dùng. Trang quản trị người dùng (xem tài khoản, đổi vai trò, khóa tài khoản) là màn riêng **Người dùng**, đã chốt ở 5.5.

**Đã có chưa:** có. Route `/team/lab`, file `WS\apps\web\src\features\workspace\Lab.tsx`, có 14 test ở `research.spec.ts`. Sidebar đang ghi "Lab đối chiếu".

**Tên mới: "Kiểm tra trích xuất"**, route `/team/kiem-tra`. Khi dựng thì đổi nhãn sidebar, tiêu đề trang, route (để `/team/lab` chuyển hướng sang route mới), khối cuối landing và các test. Tên dự phòng nếu bạn không thích: "Soi lỗi đọc tin" hoặc "So nhãn".

---

## 3. Hệ style (lấy từ landing artifact và trang chủ v3)

### 3.1 Màu

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--paper` | `#F4F1EA` | Nền trang sáng |
| `--card` | `#FFFDF8` | Thẻ, form, phiếu giá |
| `--ink` | `#15161A` | Chữ chính, viền 1.5px, nút tối |
| `--ink-2` | `#55524A` | Chữ phụ trên nền sáng |
| `--ink-3` | `#6B675E` | Đơn vị, chú thích |
| `--line` | `#DDD8CC` | Đường kẻ bảng |
| `--line-soft` | `#ECE7DB` | Kẻ dòng phiếu giá |
| `--night` | `#111214` | Header, sidebar, đầu bảng, khối kể chuyện |
| `--night-2` | `#1A1B1E` | Thẻ trên nền tối |
| `--night-line` | `#2C2C29` / `#33332F` / `#4A4A48` | Viền trên nền tối |
| `--on-night` | `#F4F1EA` | Chữ chính trên nền tối |
| `--on-night-2` | `#BDB9AE` / `#D2CEC3` | Chữ phụ trên nền tối |
| `--hl` | `#FFE14D` | Nút chính, gạch dạ quang tiêu đề, vòng focus, chọn chữ |
| `--link` | `#2337C6` | Link khi hover, hành động phụ trong panel, chấm "tin này" |
| `--lower` | `#1E6B45` | Nhận định "thấp hơn mức trung bình", trạng thái thành công |
| `--higher` | `#B42318` | Nhận định "cao hơn mức trung bình", lỗi, thao tác nguy hiểm |
| Nhãn Giá / Diện tích / Vị trí / Loại phòng / Phí | `#FFE14D` / `#8FE8BF` / `#9FD3FF` / `#D4C2FF` / `#FFB89A` | PRICE / AREA / LOC / ROOM / FEE |

Chữ trên nhãn màu luôn là `--ink`. Mỗi nhãn ghi **đủ chữ** (Giá, Diện tích, Vị trí, Loại phòng, Phí), không viết tắt, nên màu không phải cách duy nhất để phân biệt. Chỗ quá chật (đầu dòng phiếu giá) dùng ô màu 10px, rê chuột hiện tên nhãn.

#### Chế độ sáng và tối

Mọi màn có hai chế độ. Mặc định theo cài đặt của máy; nút chuyển trên thanh đầu trang (mặt trời / mặt trăng), trình duyệt nhớ lựa chọn. Đặt chế độ bằng một script nhỏ trong `<head>` để trang không nháy màu khi tải.

- Trang trong: chế độ tối đổi nền trang `--paper` thành `#111214`, thẻ/form `--card` thành `#1A1B1E`, đường kẻ `--line` thành `#2C2C29`, chữ `--ink` thành `#F4F1EA`.
- Vật thể giấy (bài đăng gốc, phiếu giá, mẩu bài, hộp kết luận) giữ nền sáng ở cả hai chế độ, như một tờ giấy.
- Nền vàng `--hl` giữ nguyên; chữ trên nền vàng luôn `--ink`.

Token đã dùng ở trang chủ v3:

| Token | Tối | Sáng | Dùng cho |
|---|---|---|---|
| `--night` | `#111214` | `#EEECE6` | Nền vùng kể chuyện, dải mẩu bài |
| `--night-2` / `--night-3` | `#1A1B1E` / `#2C2C29` | `#E4E1D9` / `#D6D2C7` | Mặt nổi, viền |
| `--on-night` / `--on-night-2` | `#F4F1EA` / `#BDB9AE` | `#15161A` / `#4A473F` | Chữ chính / chữ phụ |
| `--body` | `#D2CEC3` | `#3A3833` | Đoạn văn |
| `--muted` | `#8C887E` | `#6F6A5F` | Chú thích, trục biểu đồ |
| `--edge` / `--edge-2` | `#3A3A36` / `#55524A` | `#CFC9BB` / `#A8A294` | Viền khung, vạch |
| `--panel` | `#1E1F22` → `#17181A` | `#FFFDF8` → `#F6F3EC` | Khung biểu đồ |
| `--hl-text` | `#FFE14D` | `#8A6400` | Chữ vàng trên nền (số bước, mũi đo) |
| `--amber` | `#F2CD64` | `#7A5800` | Dòng nghiêng của tiêu đề mở đầu |
| `--btn-shadow` | `#F4F1EA` | `#15161A` | Bóng cứng của nút chính |
| Lớp phủ ảnh sân | đen 90% → 20% từ trái sang | kem 95% → 18% | Giữ chữ đọc được trên ảnh; màn hẹp phủ đều ~80% |

Đã đo: chữ ở cả hai chế độ ≥ 4,5:1. Chữ đè trên ảnh đo theo từng điểm ảnh; thấp nhất 4,1:1 ở dòng nghiêng cỡ lớn, chế độ sáng (chữ lớn chỉ cần ≥ 3:1).

#### Logo

- Chỉ dùng logo trong file của bạn: biểu tượng (nhà + khiên có dấu tích) và chữ "TrọCheck". Không vẽ lại, không thay bằng logo chữ tự gõ.
- Thanh đầu trang: biểu tượng 34px + chữ cao 21px.
- Chế độ tối dùng bản chữ đổi màu ("Trọ" `#78F0C2`, màu tấm khiên trong logo; "Check" `#F4F1EA`), hình chữ giữ nguyên. Nếu bạn muốn giữ màu gốc ở mọi chế độ thì đặt logo trên nền trắng nhỏ.
- Ô "THẨM ĐỊNH GIÁ" và dòng "Kiểm định giá & Phòng trọ sinh viên minh bạch" chưa dùng trên thanh đầu trang vì quá nhỏ để đọc.

### 3.2 Chữ

| Vai trò | Font | Cỡ / độ đậm |
|---|---|---|
| Tiêu đề lớn | Newsreader | 56–84px, 500, letter-spacing −0.035em đến −0.04em, line-height ~1 |
| Tiêu đề trang trong | Newsreader | 36–42px, 500 |
| Từ nhấn | Newsreader nghiêng | Cùng cỡ với phần còn lại của tiêu đề. Trang chủ: 400, màu `--amber`, không gạch dưới. Trang trong: 300, gạch dạ quang phía dưới |
| Giá lớn | Newsreader | 34–36px, 600, số tabular |
| Nội dung | Be Vietnam Pro | 14–16.5px, 400–500, line-height 1.55–1.6 |
| Nút, nhãn | Be Vietnam Pro | 14–15px, 600–700; nhãn thực thể 9,5–12px, 700, ghi đủ chữ, không viết hoa toàn bộ |
| Số, ID, token | JetBrains Mono | 12–14px |

Tiêu đề dùng `text-wrap: balance`, đoạn văn dùng `text-wrap: pretty`. Hai dòng của cùng một tiêu đề phải cùng cỡ chữ. Không ngắt dòng giữa một cụm từ (ví dụ "giải | pháp").

### 3.3 Hình khối

- Viền chuẩn `1.5px solid --ink`. Bo góc: nút 8px, thẻ 12px, khung lớn 14px, chip 999px. Ảnh tin bo 10px, viền 1.5px.
- Bóng: chỉ có **bóng cứng lệch** cho nút chính (`4px 4px 0`). Khối nổi trên nền tối dùng `0 40px 70px -30px rgba(0,0,0,.7)`.
- Phiếu giá: nền `--card`, kẻ đứt dưới giá, dòng 40px, mép dưới răng cưa.
- Nhận định: viền 2px, viền trái 6px theo sắc thái; chưa đủ dữ liệu thì viền đứt.
- Ô thiếu dữ liệu: nền sọc chéo `repeating-linear-gradient(-45deg, transparent 0 8px, #F4F1EA 8px 9px)`.
- Thước giá: trục, vạch nét đứt "Trung bình", cờ vàng "Phòng này", mũi đo "% chênh" (như biểu đồ trang chủ). Không vẽ dải khoảng giá.
- Tin không có ảnh: ô thay thế là một dòng trích bài có tô nhãn trên nền `--card`, không dùng ảnh minh họa.

### 3.4 Nút

| Loại | Dáng |
|---|---|
| Chính | Nền `--hl`, chữ `--ink` 700, cao 48px (44 nhỏ), bo 8, bóng cứng `4px 4px 0` (màu `--paper` trên nền tối, `--ink` trên nền sáng) |
| Viền | Viền 1.5px, nền trong suốt |
| Tối | Nền `--ink`, chữ `--paper` |
| Nguy hiểm | Viền/nền `--higher`: Loại tin, Thu hồi token, Xóa nguồn cào |
| Google | Nền `--card`, viền 1.5px, logo Google chính thức (theo hướng dẫn thương hiệu Google), chữ "Tiếp tục với Google" |

Ô bấm tối thiểu 44×44px. Focus: viền `--ink` 2px + vòng `--hl` 5px.

### 3.5 Chuyển động

| Chuyển động | Thông số lấy từ artifact | Dùng ở |
|---|---|---|
| Nhấn nút | `transform .2s cubic-bezier(.23,1,.32,1)`; hover `translate(-2px,-2px)`, bóng 4px → 6px; nhấn `scale(.97)` | Mọi nút; hover chỉ khi `(hover:hover) and (pointer:fine)` |
| Hiện khối mới | `pop .35s cubic-bezier(.16,1,.3,1)` từ `opacity 0, translateY(10px)` | Đổi trạng thái panel, kết quả về, thông báo mới |
| Đổi màu | `background-color/color/border-color .15s` | Tab, chip lọc, hàng bảng |
| Tô dạ quang | `background-size 0% → 100%` theo `animation-timeline: view()` | Bài gốc trong chi tiết tin, ca khó |
| Đếm số giá | `@property --m/--k` chạy ~0.6s | Giá lớn khi kết quả vừa về (một lần) |
| Đóng dấu nhận định | `rotate(-9deg) scale(1.6) → rotate(-1.2deg) scale(1)` | Hộp nhận định khi kết quả vừa về |
| Ảnh tin hiện ra | Mờ → rõ 200ms khi ảnh tải xong; giữ khung đúng tỉ lệ để trang không nhảy | Thẻ tin, chi tiết |
| Nghiêng theo chuột, câu chuyện cuộn, gập cảnh | Như bản thử v3 | Chỉ ở trang chủ, màn ≥1000px |
| Ảnh sân lùi rồi tan | Ảnh `scale(1.13)` → `scale(1.03)` và lên 3% trong 0–14% quãng cuộn phần 2; mờ dần 8–15%; khung viền dịch 18px | Chỉ trang chủ, màn ≥1000px |
| Mây phủ | Khối cao 200vh chồng lên cuối phần 2 (`margin-top: -100vh`), 3 lớp mây chạy theo `view-timeline`; hiện dần 0–14%, phủ kín khoảng 55–75%, tan 80–100% để lộ phần sau | Chỉ trang chủ, màn ≥1000px |
| Dải mẩu bài | Hai hàng chạy ngược chiều 70s / 80s, có nút tạm dừng; giảm chuyển động thì đứng yên, cuộn ngang được | Trang chủ |
| Chuyển trang | View Transitions: cũ mờ ra 150ms, mới hiện 200ms trượt 8px; giá ở thẻ tin → giá ở chi tiết dùng chung `view-transition-name` | Giữa các route; thử cờ `experimental.viewTransition` của Next 15, lỗi thì bọc `router.push` bằng `document.startViewTransition` |

Chỉ animate `transform`, `opacity` (và `background-size` cho tô dạ quang). Trang trong ≤ 350ms. `prefers-reduced-motion: reduce` thì tắt hết.

### 3.6 Bảng nhãn hiển thị (enum → chữ)

| Trường | Giá trị → nhãn |
|---|---|
| Loại phòng | `phong_tro` Phòng trọ · `ccmn` Chung cư mini · `can_ho_dich_vu` Căn hộ dịch vụ · `nha_nguyen_can` Nhà nguyên căn · `unknown` Chưa rõ loại |
| Giá không có số | `hidden_explicit` "Bài không công khai giá" · `not_stated` "Bài không nêu giá" · `ambiguous` "Giá chưa rõ" |
| Dạng giá | `exact` "5,5 tr" · `range` "4–5 tr" · `starting_from` "Từ 3 tr" (không đưa vào so sánh) |
| Cách tính | `per_unit` "/tháng/phòng" · `per_person` "/người/tháng" (không nhân lên) |
| Phí | `deposit` Đặt cọc (mục riêng) · `electricity` Điện · `water` Nước · `service` Dịch vụ · `internet` Internet · `parking` Gửi xe · `other` Khác |
| Đơn vị phí | `per_kwh` /số · `per_m3` /khối · `per_person_month` /người/tháng · `per_unit_month` /phòng/tháng · `months_of_rent` tháng tiền thuê · `one_time` một lần; `free` "Miễn phí"; `state_rate` "Giá nhà nước"; không có = "Không đề cập" |
| Nội thất | `full` Đầy đủ · `basic` Cơ bản · `none` Không nội thất · `unknown` Không đề cập |
| Trạng thái duyệt | `auto_accepted` Tự nhận · `needs_review` Cần duyệt · `approved` Đã duyệt · `rejected` Đã loại · `duplicate` Trùng |
| Lý do cần duyệt | `conflict` Hai cách đọc khác nhau · `multi_listing` Nhiều phòng trong một bài · `basis_unknown` Chưa rõ giá phòng hay giá người · `possible_duplicate` Nghi trùng · `llm_error` LLM lỗi |
| Thao tác duyệt | `approve` Duyệt · `reject` Loại (bắt buộc lý do) · `split` Tách khỏi nhóm trùng · `merge` Gộp vào nhóm |
| So sánh | `ok` → nhận định · `insufficient_data` "Chưa đủ dữ liệu (7/10 phòng)" · `not_comparable` "Không so sánh được" + lý do |
| Phương pháp | `regex` Regex · `llm` LLM · `human` Người duyệt · `hybrid` Kết hợp |
| Nguồn bài | `paste` Dán chữ · `image` Ảnh chụp · `extension` Extension · `bot` Bot cào |

Định dạng số: tiền `5.500.000 đ` hoặc gọn `5,5 tr`; phần trăm `77,8%`; ngày `dd/mm/yyyy`; diện tích `30 m²`.

### 3.7 Quy tắc nội dung

1. Thiếu là thiếu: không có giá thì ghi "Chưa có giá", không hiện 0.
2. Giá thuê, phí và đặt cọc tách riêng, không cộng thành "tổng".
3. Nhóm so sánh dưới 10 phòng: không vẽ giá trung bình, ghi "Chưa đủ dữ liệu" kèm số phòng (ví dụ 7/10 phòng).
4. Câu nhận định trung tính, theo mức trung bình: "Cao hơn mức trung bình khoảng 14% của 12 phòng cùng phường."
5. Ghi "giá chào thuê trong bài đăng, không phải giá giao dịch" và khoảng ngày dữ liệu.
6. Dữ liệu demo có nhãn "Ví dụ tự tạo / Số liệu demo".
7. Số điện thoại và tên người đăng bị che (`[SĐT]`, "Người đăng đã ẩn"), kể cả chữ đọc từ ảnh chụp.
8. Giao diện không hiện thuật ngữ thống kê (P25, P75, trung vị, N): người mở web lần đầu không hiểu. Riêng màn Đánh giá cho nhóm nghiên cứu vẫn dùng P / R / F1.

---

## 4. Cách dựng

Logic gọi API, form, phân quyền và test của các màn trong **đã có**: 265 pytest pass (kiểm lại 27/10); 47 test trình duyệt pass theo báo cáo Codex số 3, chưa chạy lại độc lập. Với các màn đã có, việc dựng là **thay lớp giao diện**, giữ lớp dữ liệu. Với tính năng đã chốt ở mục 5, phải làm backend trước rồi mới làm giao diện.

### Bước 0: chuẩn bị (0,5 ngày)
1. Chốt token mục 3 vào `WS\apps\web\src\styles\tokens.css`.
2. Kiểm font Newsreader (300–600, nghiêng 300), Be Vietnam Pro (400–800), JetBrains Mono.
3. Gỡ số liệu bịa (mục 1.4 loại 1) nếu đang có trong code.
4. Thêm bộ token hai chế độ (mục 3.1), nút chuyển chế độ trong `SiteHeader` và script đặt chế độ trong `<head>`.
5. Đưa logo vào `WS\apps\web\public\brand\` (chép từ `WS\.tmp\brand\`); đổi tên hiển thị ReNER thành TrọCheck ở `SiteHeader`, `SiteFooter` và tiêu đề trang (metadata).

### Bước 1: trang chủ v3 vào `/`
1. Nguồn: `WS\.tmp\landing-v2\story-v3.html` (HTML + CSS thuần; chuyển động bằng `animation-timeline`, không cần thư viện).
2. Thay `HousingScene` và `ReadingHero` hiện tại bằng các component trong `WS\apps\web\src\features\landing\`:
   - `HeroScene`: ảnh sân, khung, nhãn ảnh AI, câu mở đầu.
   - `StoryStage`: phần 2, client vì có nghiêng theo chuột và đo chiều cao chữ.
   - `CloudBridge`: mây.
   - `ClipMarquee`: dải mẩu bài, client vì có nút tạm dừng.

   Ảnh sân và mây dùng bản webp, đặt trong `public\images\`.
3. Thay bài đăng và ảnh phòng thật bằng bản tự tạo (mục 2.1) trước khi commit.
4. Giữ nguyên khối `@supports (animation-timeline: view())` và `@media (min-width:1000px) and (prefers-reduced-motion:no-preference)`. Bản tĩnh phải đọc được đủ nội dung.
5. Các phần sau dải mẩu bài chuyển từ `WS\.tmp\landing-artifact\Main.dc.html` như cũ (`<sc-for>` → `.map()`, `<sc-if>` → điều kiện, `{{ x }}` → props) thành `StatsBand` (server), `HardCases`, `ExtensionDemo` (client), `MarketPreview` (server), `Principles`, `ExtractCheckCta`.
6. Làm các sửa ở mục 2.1.
7. Kiểm: chụp 1440 và 390 ở cả hai chế độ, tại các điểm cuộn mở đầu, từng bước, mây, dải mẩu bài; đo chữ đè trên ảnh.

### Bước 2: component dùng chung (1 ngày)

| Component | Ghi chú |
|---|---|
| `Button` | 5 loại mục 3.4; giữ kích thước khi đang gửi; khóa trước khi hydrate (đã có `useHydrated`) |
| `Highlight` + `EvidenceText` | Tô nhãn đúng offset code point; dùng chung chi tiết tin, bản đọc, duyệt, kiểm tra trích xuất |
| `LabelLegend`, `PriceReceipt`, `Verdict`, `RangeRuler`, `StripedEmpty` | Theo mục 3.3 |
| `ListingImage` | Ảnh tin có khung tỉ lệ cố định, ô thay thế khi không có ảnh (5.1) |
| `ImageDrop` | Kéo-thả/chọn ảnh chụp bài đăng, xem trước, báo lỗi dung lượng/định dạng (5.1) |
| `DataTable` | Đầu bảng tối, số tabular, cuộn ngang trong khung; hỗ trợ chọn nhiều dòng (5.4) |
| `FilterChip`, `Select`, `DateRange`, `SearchInput` | Bộ lọc Tìm trọ, Kho |
| `Modal`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState` | Theo trạng thái ở file 23 |
| `AppShell` + `NotificationBell` | Sidebar tối, topbar, menu tài khoản, chuông (5.3) |

### Bước 3: backend cho tính năng đã chốt (xem chi tiết mục 5)
Thứ tự đề xuất vì có phụ thuộc: email cho users → quản lý người dùng (khóa tài khoản, tạo tài khoản nhóm) → đổi/quên mật khẩu → Google → thông báo → ảnh (bảng `post_images`, đọc ảnh chụp) → tìm từ khóa, duyệt nhiều tin, ghi nhãn chuẩn → nguồn cào bằng bot → extension. Mỗi API mới: thêm test pytest, thêm vào allowlist BFF, chạy `npm run generate:api`.

### Bước 4: Codex làm bản thử HTML (thay cho Stitch)
Đổi ngày 28/10/2026 theo yêu cầu của bạn: hai Codex (gpt-6.1-sol, mức xhigh, qua 9Router) làm bản thử HTML cho từng màn, Claude hướng dẫn và kiểm. Bạn xem và chốt từng màn rồi mới dựng vào web (bước 5). File 23 vẫn là đặc tả nội dung và trạng thái của từng màn.

| | Codex số 5 | Codex số 6 |
|---|---|---|
| Brief | `WS\.tmp\codex-task-05-ban-thu-cong-khai.md` | `WS\.tmp\codex-task-06-ban-thu-khu-trong.md` |
| Phần chung phụ trách | Token hai chế độ, component, thanh đầu trang, chân trang, mục lục `index.html`, bảng mẫu `components.html` | Dữ liệu mẫu đúng dạng API (`_data\`), khung khu trong (`app.js`, `app.css`) |
| Thứ tự màn | Nền dùng chung → trang chủ đầy đủ (thêm nửa dưới) → Tìm trọ, Chi tiết tin, Thị trường → Đăng nhập, Tạo tài khoản, Quên/Đặt lại mật khẩu → Trang lỗi, Extension, Popup extension, Điều khoản | Dữ liệu mẫu → khung khu trong (chờ nền của Codex 5) → Phân tích, Bản đọc tin, Tài khoản, Thông báo → Kho, Nguồn cào, Hàng duyệt, Duyệt một tin → Kiểm tra trích xuất, Đánh giá, Người dùng |
| Báo cáo | `WS\.tmp\design-v4\_reports\codex5.md` | `WS\.tmp\design-v4\_reports\codex6.md` |

- Thư mục bản thử: `WS\.tmp\design-v4\`, xem tại http://localhost:4620/ (máy chủ `design-v4` trong `.claude\launch.json`).
- Bản đồ trang chung: `WS\.tmp\design-v4\_shared
outes.js`, do Claude giữ. Mọi link, menu, chân trang, sidebar lấy từ đây, để các trang nối với nhau chặt và không có link chết.
- Ảnh chụp: `WS\.tmp\design-v4\_shots\codex5\`, `codex6\`.
- Claude kiểm ở mỗi mốc: bấm từ trang chủ tới mọi màn, vai trò thấy đúng mục, hai chế độ, không có số bịa hay thuật ngữ thống kê.
- Bổ sung ngày 28/10 (bạn duyệt):
  - Kế hoạch skill bắt buộc: `WS\.tmp\design-v4\_reports\skill-plan-codex5-6.md`. Gồm taste-skill, skill của Emil, KusShoes, cùng 6 skill ECC/Emil/KusShoes thêm sau. Mỗi con ghi nhật ký skill có bằng chứng.
  - Giao 11 ảnh bài đăng và ảnh phòng thật làm tham chiếu riêng: `WS\.tmp\design-v4\_reports	-anh-tham-chieu.md`. Chỉ xem, không nhúng; tự viết bài mô phỏng các ca khó.
  - Luật không phá phần đã làm: làm theo thứ tự sửa lỗi → kiểm skill → 11 ảnh; không làm lại bố cục trang đã xong; dữ liệu mới chỉ thêm, không đổi số liệu nhóm so sánh.

### Bước 5: dựng từng màn theo ưu tiên
Thứ tự: P0 → P1 → P2. Mỗi màn làm 4 việc:
1. Dựng theo bản Stitch, dùng dữ liệu API thật (mục 1.3).
2. Đủ trạng thái: đang tải (skeleton sau 150ms), trống, lỗi có nút thử lại, chưa đủ dữ liệu, không đủ quyền.
3. Đúng 3 cỡ 1440 / 768 / 390, không tràn ngang, chữ tiếng Việt không bị cắt dấu.
4. Chuyển động theo mục 3.5.

Có thể giao Codex (qua 9Router) từng nhóm màn. Mỗi brief kèm: file này, file 23, bản thử đã chốt trong `WS\.tmp\design-v4\`, và yêu cầu "kiểm bằng cách bấm từ trang chủ".

### Bước 6: kiểm trước khi bàn giao
- [ ] Từ trang chủ bấm tới được **mọi** màn ở mục 2.4 mà không gõ địa chỉ.
- [ ] Mỗi màn khu nhóm: đúng vai trò vào được, sai vai trò thấy 403.
- [ ] Màn Người dùng: chỉ admin vào được; không tự khóa hay tự gỡ admin của mình; hệ thống luôn còn ít nhất 1 admin.
- [ ] Tìm trong mã: không còn "PhoBERT", "94.8", "94,8", "v2.4", "1,420", "1.428", "lượt xem".
- [ ] Mọi nút đều làm được việc thật; tính năng chưa duyệt thì không có nút.
- [ ] `/team/lab` chuyển hướng sang `/team/kiem-tra`; không còn chữ "Lab" trên giao diện.
- [ ] Ảnh chụp 1440 / 768 / 390 cho mọi màn, đã mở xem.
- [ ] Bật giảm chuyển động: không còn chuyển động.
- [ ] Contrast chữ ≥ 4.5:1, đo ở cả chế độ sáng và tối.
- [ ] Mọi màn có ảnh chụp ở cả chế độ sáng và tối.
- [ ] Giao diện không còn chữ "ReNER"; logo là file TrọCheck của bạn.
- [ ] Nhãn thực thể ghi đủ chữ, không viết tắt.
- [ ] `npm run typecheck`, `npm run build`, các bộ Playwright, `pytest` đều pass.
- [ ] Không commit ảnh phòng thật, ảnh do bot/extension tải về, `.env`, `data\db\`, `.tmp\`.

### Ước lượng thời gian (ước của mình, chưa làm thử để kiểm)

| Phần | Ngày công |
|---|---|
| Giao diện các màn hiện có (bước 0–2, 5) | 9–11 |
| 5.1 Ảnh (chưa gồm dựng extension cơ bản) | 3–5 |
| Dựng extension cơ bản (thu bài, token, gửi lô) | 3–5 |
| 5.3 Tài khoản | 5–7 |
| 5.4 Khu nhóm | 5–7,5 |
| 5.5 Quản lý người dùng | 1,5–2 |
| **Tổng** | **khoảng 27–37** |

---

## 5. Tính năng mở rộng

Trạng thái: **Đã chốt** = bạn đã duyệt, đã đưa vào kế hoạch và prompt Stitch. **Chờ duyệt** = chưa vẽ, chưa làm. Ước lượng là ước của mình, chưa làm thử.

### 5.1 Ảnh — **Đã chốt**

**A. Phân tích từ ảnh chụp bài đăng**
- Luồng: ở màn Phân tích, người dùng kéo-thả ảnh chụp bài → server dùng Gemini đọc chữ trong ảnh → che số điện thoại và tên → người dùng xem và sửa chữ đọc được → bấm Phân tích → chạy tiếp như bài dán chữ.
- API mới: `POST /analyses/ocr` (multipart; jpg/png/webp; ≤ 5 MB) trả chữ đã che + cảnh báo nếu ảnh mờ hoặc bị cắt; `POST /analyses` nhận thêm `source: "image"`.
- Ảnh gốc: mặc định không lưu sau khi đọc xong (chỉ giữ chữ). Muốn lưu thì thêm một công tắc.
- Dữ liệu thử: 11 ảnh ở `WS\.tmp\rental-reference-photos\`.
- Cần kiểm trước: model Gemini đang cấu hình (`gemini_model_id` trong `.env`) có nhận ảnh không. **Chưa kiểm.**
- Ước lượng: 1–2 ngày.

**B. Extension lưu ảnh đầu tiên khi cuộn**
- Extension theo dõi bài khi cuộn feed (mỗi bài là `role="article"`). Mỗi bài lấy ảnh đầu của phần đính kèm, bỏ avatar/emoji (lọc ảnh < 200px); bài video thì lấy ảnh bìa.
- Tải ảnh ngay khi thấy (link ảnh Facebook có hạn), nén WebP cạnh dài ≤ 1280px, gửi kèm chữ bài.
- Popup có công tắc "Lưu ảnh đầu tiên" (mặc định bật) và bộ đếm bài/ảnh đã lưu.
- Bộ chọn phần tử để trong file cấu hình riêng có version, vì class của Facebook hay đổi.
- Backend: bảng `post_images` (id, post_id, đường dẫn file, rộng, cao, `sha256` duy nhất để chống trùng, nguồn, thời điểm); `POST /ingest/images`; ảnh lưu ở `WS\data\images\` (không commit).
- Phụ thuộc: phải dựng extension cơ bản trước (hiện chưa có code).
- Ước lượng: phần ảnh 1,5–2,5 ngày + extension cơ bản 3–5 ngày.

**C. Hiện ảnh tin trên web**
- API: `ListingCard.image_url`, `ListingDetail.images[]`, `GET /media/{id}` trả ảnh đã nén.
- Web: ảnh trên thẻ Tìm trọ, khu ảnh ở Chi tiết tin, ô thay thế khi không có ảnh.
- Nguồn ảnh: từ extension (B) hoặc bot cào (5.4). Ảnh chụp bài đăng (A) **không** dùng làm ảnh phòng, vì đó là ảnh chữ.
- Ước lượng: ~0,5 ngày sau khi có nguồn ảnh.

### 5.2 Người đi thuê — Chờ duyệt

| Tính năng | Backend cần thêm | Web + Stitch | Ước lượng |
|---|---|---|---|
| Lưu phòng yêu thích | 1 bảng + 3 API | Nút lưu; trang "Phòng đã lưu" | 0,5–1 ngày |
| Lịch sử phân tích của tôi | 1 API danh sách | Khối trong Tài khoản hoặc trang riêng | ~0,5 ngày |
| Báo sai lệch | 1 bảng + 1 API + đổ vào Hàng duyệt | Nút trên Chi tiết tin + hộp chọn lý do | ~1 ngày |
| Sao chép tóm tắt | Không cần | Nút copy | ~0,2 ngày |
| Lời khuyên thuê trọ | Không cần (nội dung nhóm viết) | Khối nội dung | ~0,2 ngày |
| Xuất PDF/Excel thị trường | API xuất | Nút xuất | ~1 ngày |

### 5.3 Tài khoản — **Đã chốt**

| Tính năng | Backend | Web + Stitch | Ước lượng |
|---|---|---|---|
| Email cho tài khoản (nền cho các mục dưới) | Thêm cột `email` (duy nhất) + `email_verified` vào `users`, migration `0002`. Đăng ký mới **bắt buộc** email; tài khoản cũ thêm email ở Tài khoản. Đăng nhập bằng tên **hoặc** email. | Ô email ở Đăng ký, Tài khoản | ~0,5 ngày |
| Đổi mật khẩu | `POST /auth/password` {mật khẩu cũ, mới, nhập lại}; đổi xong đăng xuất các phiên khác | Khối "Đổi mật khẩu" trong Tài khoản | ~0,5 ngày |
| Quên mật khẩu | `POST /auth/password/forgot` {email} luôn trả 200 (không lộ email có tồn tại hay không); mã đặt lại dùng 1 lần, hạn 30 phút, lưu dạng băm; `POST /auth/password/reset` {mã, mật khẩu mới}. Gửi email qua SMTP cấu hình trong `.env`; máy local in email ra log hoặc dùng hộp thư thử. Giới hạn số lần gửi. | Màn "Quên mật khẩu" + màn "Đặt lại mật khẩu" (file 23 §A12); link ở Đăng nhập | 1,5–2 ngày |
| Đăng nhập Google | OAuth 2.0 (Authorization Code + PKCE): `GET /auth/google/start`, `GET /auth/google/callback`; bảng `oauth_accounts` (user, provider, subject). Email Google trùng tài khoản đã có thì yêu cầu đăng nhập rồi mới liên kết, không tự gộp. Cần tạo OAuth client trên Google Cloud và đặt redirect URI cho localhost. | Nút ở Đăng nhập, Đăng ký; mục "Liên kết Google" ở Tài khoản | 1–2 ngày |
| Thông báo | Bảng `notifications` (người nhận, loại, tiêu đề, nội dung, link, đã đọc, thời điểm); `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`. Sự kiện: phân tích xong; bài đóng góp được duyệt/loại; tin mới vào hàng duyệt (reviewer); lượt đánh giá mới (researcher); bot cào lỗi (admin). Web hỏi lại mỗi 60 giây, không dùng websocket. | Chuông trên topbar + bảng thả; trang `/thong-bao` (file 23 §A13) | 1,5–2 ngày |

### 5.4 Khu nhóm — **Đã chốt**

| Tính năng | Backend | Web + Stitch | Ước lượng |
|---|---|---|---|
| Tìm từ khóa trong Kho | Thêm tham số `q` cho `GET /team/posts` (tìm trong chữ bài; có thể dùng SQLite FTS5) | Ô tìm trên Kho (§B5) | ~0,5 ngày |
| Duyệt nhiều tin cùng lúc | `POST /team/reviews/batch` {danh sách (tin, version), hành động: duyệt hoặc loại, lý do}. Trả kết quả **từng tin** (thành công / đã bị sửa 409 / lỗi). Tách và gộp vẫn làm từng tin. | Ô chọn nhiều + thanh hành động trên Hàng duyệt (§A2) | 0,5–1 ngày |
| Ghi vào nhãn chuẩn | `PUT /lab/gold/{post_id}` {nhãn, giá trị chuẩn, version}; lưu lịch sử người sửa. Chỉ sửa được bài thuộc tập dev; tập test đã đóng băng thì khóa, để số đánh giá không bị lệch. | Nút "Ghi vào nhãn chuẩn" ở Kiểm tra trích xuất (§B6) | ~1 ngày |
| Nguồn cào bằng bot | Bảng `sources` (loại, link nhóm, tên, bật/tắt, lịch chạy, lần chạy cuối, trạng thái) + `crawl_runs` (bắt đầu, kết thúc, số bài, số ảnh, lỗi). API: CRUD `/team/sources`, `POST /team/sources/{id}/run`, `GET /team/sources/{id}/runs`. Bot: Playwright chạy trình duyệt với một tài khoản Facebook riêng của nhóm, cuộn nhóm, lấy chữ + ảnh đầu, đưa vào pipeline như extension; chống trùng theo permalink; giới hạn số bài mỗi lần. Rủi ro kỹ thuật: Facebook đổi giao diện hoặc chặn tài khoản bot. | Màn "Nguồn cào" (§A14); nút trên Kho | 3–5 ngày |

### 5.5 Quản lý người dùng — **Đã chốt**

Hệ thống chưa có chỗ cho admin quản lý tài khoản; hiện muốn đổi vai trò phải sửa thẳng trong database. Đăng ký chỉ tạo tài khoản Người đi thuê, nên tài khoản cho nhóm (người thu, người duyệt, nghiên cứu) phải tạo hoặc nâng quyền ở màn này.

- **Route:** `/team/nguoi-dung`, chỉ vai trò `admin` thấy và vào được. Mục "Người dùng" trong sidebar nhóm "Khu nhóm".
- **Backend:**
  - Thêm cột vào `users`: `disabled_at`, `disabled_reason`, `last_login_at` (migration cùng đợt với email ở 5.3).
  - Bảng `user_events` (ai làm, với tài khoản nào, việc gì, giá trị cũ → mới, lý do, thời điểm) để có lịch sử.
  - `GET /admin/users?q&role&status&page`: tìm theo tên/email, lọc vai trò, lọc trạng thái.
  - `GET /admin/users/{id}`: chi tiết + lịch sử thay đổi.
  - `POST /admin/users`: tạo tài khoản nhóm (tên, email, vai trò); gửi email đặt mật khẩu lần đầu (dùng luồng quên mật khẩu ở 5.3).
  - `PATCH /admin/users/{id}`: đổi vai trò; khóa/mở khóa (khóa bắt buộc lý do).
  - `POST /admin/users/{id}/password-reset`: gửi link đặt lại mật khẩu cho người dùng.
- **Quy tắc:**
  - Không tự gỡ quyền admin hay tự khóa chính mình.
  - Hệ thống luôn còn ít nhất 1 admin đang hoạt động.
  - Khóa tài khoản thì đăng xuất mọi phiên và thu hồi mọi token extension của người đó.
  - Tài khoản bị khóa đăng nhập sẽ thấy "Tài khoản đã bị khóa, liên hệ quản trị nhóm".
  - Mọi thay đổi ghi vào `user_events`; người bị đổi vai trò nhận thông báo (5.3).
- **Web + Stitch:** màn Người dùng (file 23 §A16): bảng tài khoản, bảng thả chi tiết, hộp đổi vai trò, hộp khóa, hộp tạo tài khoản nhóm.
- **Ước lượng:** 1,5–2 ngày.
