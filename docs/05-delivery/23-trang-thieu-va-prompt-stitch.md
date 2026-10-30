# Các màn cần làm trên Stitch và prompt

Cập nhật 28/10/2026, sau khi chốt trang chủ. Tên hiển thị của sản phẩm là **TrọCheck**; mọi màn vẽ ở cả chế độ sáng và tối. Đi kèm [22-ke-hoach-dung-giao-dien.md](22-ke-hoach-dung-giao-dien.md): file 22 nói trang nào lấy từ đâu, dựng thế nào và các tính năng đã chốt. File này là phần bạn làm trên Stitch.

- **Phần A**: 16 màn chưa có bản vẽ.
- **Phần B**: 6 màn Stitch cũ còn tốt, vẽ lại theo style mới.

## Đường dẫn

Thư mục gốc dự án (**WS**):

```text
C:\Users\Asus\.codex\visualizations\2026\10\26\01a175c3-2040-7cb2-aec8-69bc64b965c1\rener-github-review-20261026
```

| Cần | Đường dẫn |
|---|---|
| Ảnh trang chủ đã chốt (tải lên Stitch làm tham chiếu style) | `WS\.tmp\landing-v2\shots\v3\`: `dark-s00.png` + `light-s00.png` (mở đầu), `dark-s82.png` + `light-s82.png` (phiếu giá + biểu đồ), `dark-feed.png` + `light-feed.png` (dải mẩu bài). Bản chạy: `WS\.tmp\landing-v2\story-v3.html` |
| Logo TrọCheck (tải lên Stitch) | `WS\.tmp\stitch-trocheck\screen.png` |
| Landing artifact cũ (tham khảo các phần sau của trang chủ) | https://claude.ai/artifact/6y1t6u7odKT8VBj98SCEGb (mã nguồn: `WS\.tmp\landing-artifact\Main.dc.html`) |
| Màn Stitch cũ cho phần B (mở `screen.png`, tải lên Stitch) | B1 `WS\.tmp\stitch-10\trang_3_chi_ti_t_ph_ng_rener\`<br>B2 `WS\.tmp\stitch-10\trang_4_th_tr_ng_rener\`<br>B3 `WS\.tmp\stitch-10\trang_5_ph_n_t_ch_b_i_ng_rener\`<br>B4 `WS\.tmp\stitch-10\trang_6_ng_nh_p_rener\`<br>B5 `WS\.tmp\stitch-10\trang_7_kho_d_li_u_rener\`<br>B6 `WS\.tmp\stitch-10\trang_10_lab_rener\` |
| HTML màn hỏng (đọc tham khảo cho A1–A4) | `WS\.tmp\stitch-10\_da-loai-hong\` |
| Ảnh bài đăng thật (gợi ý nội dung cho màn tải ảnh chụp) | `WS\.tmp\rental-reference-photos\` |
| Ảnh tham chiếu Cosmos (đăng nhập chia đôi) | `WS\.tmp\design-refs\cosmos\03-login-split.webp` |
| File ZIP Stitch gốc | `C:\Users\Asus\Downloads\stitch_rener_rental_intelligence_platform (10).zip` |
| **Nơi để bản xuất mới** | `WS\.tmp\stitch-11\<số>-<tên-màn>\screen.png` + `code.html` (ví dụ `WS\.tmp\stitch-11\A01-tim-tro\`) |

## Cách dùng

1. Tải lên Stitch: ảnh logo và các ảnh trang chủ ở bảng trên (cả bản sáng và bản tối).
2. Mỗi màn: dán **Khối style**, rồi dán prompt của màn.
3. Mỗi màn tạo bản desktop 1440px ở **cả chế độ sáng và tối**, và bản điện thoại 390px (ít nhất một chế độ). Đặt tên thư mục có đuôi `-sang` / `-toi`.
4. Xuất vào thư mục `stitch-11` như bảng trên. Mở ảnh kiểm tra; file chỉ vài chục byte là hỏng, xuất lại.

Prompt để Stitch **tự sáng tạo bố cục**. Bắt buộc chỉ có dữ liệu, trạng thái và quy tắc nội dung.

Trong prompt:
- **BỎ**: số liệu bịa (PhoBERT, 94,8%, lượt xem…). Luôn bỏ.
- **THÊM**: tính năng bạn đã chốt (nhóm 5.1, 5.3, 5.4, 5.5 ở file 22).
- **CHỜ**: tính năng chưa duyệt (nhóm 5.2). Chưa vẽ.

---

## Khối style (dán trước mọi prompt)

```text
PHONG CÁCH TrọCheck — "giấy ngà và bút dạ quang". Giữ đúng style ảnh tham chiếu (trang chủ TrọCheck).

LOGO: dùng đúng ảnh logo TrọCheck đã tải lên (biểu tượng nhà + khiên có dấu tích, chữ "TrọCheck"). Không vẽ logo khác, không gõ tên thành logo chữ. Trên nền tối, chữ logo màu sáng: "Trọ" xanh bạc hà #78F0C2, "Check" #F4F1EA.

HAI CHẾ ĐỘ: mỗi màn vẽ cả chế độ SÁNG và TỐI. Thanh đầu trang (hoặc topbar khu trong) có nút chuyển sáng/tối dạng hai ô mặt trời / mặt trăng.
- Sáng: nền giấy #F4F1EA (vùng kể chuyện #EEECE6); thẻ/form #FFFDF8; chữ mực #15161A; chữ phụ #4A473F–#55524A; chú thích #6B675E; đường kẻ #DDD8CC.
- Tối: nền #111214; thẻ/form #1A1B1E; viền #2C2C29–#3A3A36; chữ #F4F1EA; chữ phụ #BDB9AE; đoạn văn #D2CEC3.
- Vật thể giấy (bài đăng gốc, phiếu giá, mẩu bài, hộp kết luận) giữ nền sáng #FFFDF8 ở cả hai chế độ.
- Sidebar khu trong và đầu bảng: nền tối #111214 ở cả hai chế độ.
Nhấn chính: vàng dạ quang #FFE14D (nền nút chính, tô chữ, vòng focus); chữ trên nền vàng luôn #15161A. Chữ màu vàng chỉ dùng trên nền tối; trên nền sáng đổi thành vàng đậm #8A6400. Xanh mực #2337C6 chỉ cho link và chấm "tin này".
Sắc thái: thấp hơn / thành công = #1E6B45; cao hơn / lỗi / nguy hiểm = #B42318; gần = #55524A; chưa đủ dữ liệu = viền đứt + nền sọc chéo mảnh.
5 NHÃN THỰC THỂ (tô như bút dạ quang lên chữ, chữ trên nền màu luôn #15161A, tên nhãn nhỏ 9,5–12px đậm ngay phía trên đoạn tô, GHI ĐỦ CHỮ, KHÔNG VIẾT TẮT):
Giá #FFE14D · Diện tích #8FE8BF · Vị trí #9FD3FF · Loại phòng #D4C2FF · Phí #FFB89A.

CHỮ: tiêu đề Newsreader (serif, đậm 500, chữ khít -0.03em). Từ nhấn viết nghiêng, CÙNG CỠ với phần còn lại của tiêu đề (trang công khai: màu vàng; trang trong: nét mảnh có gạch dạ quang vàng phía dưới). Không ngắt dòng giữa một cụm từ. Nội dung Be Vietnam Pro 400–700. Số tiền lớn Newsreader 600 số đều nhau. ID, token, số liệu kỹ thuật JetBrains Mono. Toàn bộ chữ tiếng Việt có dấu đầy đủ.

HÌNH KHỐI: viền 1.5px (#15161A ở chế độ sáng, #3A3A36 ở chế độ tối); bo góc nút 8px, thẻ 12px, khung lớn 14px, ảnh 10px; chip lọc bo tròn.
Nút chính: nền vàng #FFE14D, chữ đậm #15161A, cao 48px, bóng CỨNG lệch 4px 4px 0 (màu mực ở chế độ sáng, màu giấy ở chế độ tối). Nút phụ: viền 1.5px, nền trong. Nút nguy hiểm: viền đỏ #B42318. Nút Google: nền trắng ngà, viền 1.5px, logo Google chính thức, chữ "Tiếp tục với Google".
"Phiếu giá" = thẻ trắng ngà: nhãn "Giá thuê" là ô vàng nhỏ, giá lớn, dòng kẻ đứt dưới giá, các dòng phí cách đều có ô màu nhỏ ở đầu dòng, thiếu thì ghi "Không đề cập", mép dưới răng cưa như hóa đơn.
Thước giá = trục ngang, vạch nét đứt "Trung bình · 5,1 tr", cờ vàng #FFE14D chữ #15161A "Phòng này · 5,5 tr", mũi đo vàng ghi "% chênh" giữa hai vạch (như biểu đồ trang chủ). KHÔNG vẽ dải khoảng giá, KHÔNG ghi "P25", "P75", "trung vị" hay "N" ở bất kỳ màn nào; số lượng ghi thành chữ ("14 phòng").
Ảnh tin: khung tỉ lệ cố định 4:3, bo 10px, viền 1.5px. Tin không có ảnh: ô cùng kích thước chứa một dòng trích bài có tô nhãn (không dùng ảnh minh họa).

ĐỊNH DẠNG: tiền "5.500.000 đ" hoặc gọn "5,5 tr"; phần trăm "24,3%"; ngày "28/10/2026"; diện tích "30 m²". Ô bấm tối thiểu 44px.

TRÁNH (style): gradient trang trí, glassmorphism, bóng mờ lớn, icon emoji, ảnh stock, avatar người thật (ảnh đại diện mặc định = chữ cái đầu trên nền màu).
CẤM bịa số liệu hệ thống: không có độ chính xác %, F1, "PhoBERT", "AI v2.4", lượt xem, % tăng trưởng, tốc độ ms, "online".
Số giá/diện tích mẫu được phép nhưng phải hợp lý (phòng trọ Hà Nội 2–7 triệu/tháng) và có nhãn nhỏ "Ví dụ".
Mọi số giá đều là "giá chào thuê trong bài đăng, không phải giá giao dịch" — ghi câu này ở chân mỗi trang có giá.
CHƯA VẼ (chờ duyệt): lưu phòng yêu thích, lịch sử phân tích, báo sai lệch, sao chép tóm tắt, lời khuyên thuê trọ, xuất PDF/Excel thị trường.
```

---

# Phần A: 16 màn cần tạo mới

## A1. Tìm trọ `/tim-tro` (thay `trang_2` hỏng) · P0

- **Dữ liệu:** thẻ tin (ảnh nếu có, loại phòng, phường, địa danh, giá + cách tính, diện tích, phí, ngày đăng, nhận định + %), tổng số tin, số tin ẩn vì không có giá, ngày cập nhật, cờ demo. Lọc theo phường (nhiều), loại (nhiều), khoảng giá, khoảng diện tích, chỉ tin có giá, sắp xếp, phân trang.
- **Trạng thái:** đang tải, không có kết quả, lỗi, dữ liệu demo.

```text
Màn "Tìm trọ" của TrọCheck, trang công khai cho sinh viên tìm phòng ở Hà Nội.
Header giống trang chủ: logo TrọCheck (ảnh logo đã tải lên), menu Tìm trọ (đang chọn) · Thị trường · Extension, bên phải "Đăng nhập", nút vàng "Tạo tài khoản" và nút chuyển sáng/tối (mặt trời / mặt trăng).

Mục tiêu: lọc nhanh và đọc giá đúng.

Nội dung:
- Tiêu đề Newsreader "Tìm trọ" + dòng phụ "Dữ liệu cập nhật 27/10/2026 · giá chào thuê, không phải giá giao dịch". Công tắc nhỏ "Dữ liệu demo / Kho thật".
- Bộ lọc: Phường (chọn nhiều, chip: Cầu Giấy, Dịch Vọng Hậu, Nghĩa Đô, Yên Hòa, Thạch Hòa…), Loại phòng (Phòng trọ, Chung cư mini, Căn hộ dịch vụ, Nhà nguyên căn), Giá từ–đến (triệu/tháng), Diện tích từ–đến (m²), ô tick "Chỉ tin có giá", Sắp xếp (Mới nhất, Giá tăng dần, Giá giảm dần). Nút "Xóa lọc". Trên điện thoại bộ lọc thành ngăn trượt từ dưới lên.
- Dòng kết quả: "86 tin · 12 tin ẩn vì bài không công khai giá (hiện)".
- Lưới thẻ tin (3 cột desktop, 1 cột mobile). Mỗi thẻ: ẢNH đầu tiên của bài ở trên (khung 4:3); nếu tin không có ảnh thì cùng khung đó hiện một dòng trích bài có tô bút dạ quang. Dưới ảnh: nhãn loại phòng; phường + địa danh; GIÁ lớn Newsreader "4,5 tr" + đơn vị "/tháng/phòng" hoặc "/người/tháng"; diện tích "28 m²"; tối đa 3 phí dạng chip nhỏ (Điện 3,5k/số · Nước 100k/người · Cọc 1 tháng — cọc có viền khác để tách khỏi phí); câu nhận định trung tính có viền theo sắc thái ("Thấp hơn mức trung bình khoảng 12% của các phòng cùng phường" / "Chưa đủ dữ liệu để so sánh"); ngày đăng. Cả thẻ là link sang chi tiết. Vẽ trộn thẻ có ảnh và thẻ không có ảnh.
- Thẻ đặc biệt: bài không công khai giá → chỗ giá ghi "Bài không công khai giá", không hiện số 0. Giá "Từ 3 tr" ghi "chưa đưa vào so sánh".
- Phân trang "Trang 1 / 9" + Trước/Sau.
- Trạng thái trống: "Không có tin khớp bộ lọc" + nút "Xóa bớt điều kiện".
- Chân trang: câu lưu ý giá chào thuê + khoảng ngày dữ liệu.

Được tự sáng tạo: vị trí bộ lọc (thanh dính đầu trang hay cột trái), cách thẻ tin hiện nhãn. Hover thẻ: nhấc -2px và bóng cứng 4px; ảnh hiện dần khi tải xong.
```

## A2. Hàng duyệt `/team/duyet` (thay `trang_8` hỏng) · P1

- **Dữ liệu:** mỗi dòng có id, lý do, đoạn trích, loại, phường, thời điểm vào hàng, version, cờ demo; số đếm theo 5 lý do. Lọc theo lý do, phân trang.
- **THÊM (5.4):** chọn nhiều tin rồi Duyệt hoặc Loại một lượt; kết quả báo từng tin.
- **Trạng thái:** trống, lỗi, đang tải, kết quả hàng loạt có tin bị xung đột.

```text
Màn "Hàng duyệt" trong khu nhóm TrọCheck, cho người duyệt xem các tin máy chưa chắc.
Dùng khung khu trong: sidebar tối bên trái (nhóm "Đọc tin": Phân tích bài đăng, Tìm trọ, Thị trường; nhóm "Khu nhóm": Kho dữ liệu, Nguồn cào, Hàng duyệt (đang chọn, có số 12), Kiểm tra trích xuất, Đánh giá, Người dùng (chỉ admin); dưới cùng: tên tài khoản + vai trò, "Về trang chủ"). Topbar sáng mỏng có breadcrumb, chuông thông báo, nút tài khoản.

Nội dung:
- Tiêu đề Newsreader "Hàng duyệt" + câu phụ "Tin máy đọc chưa chắc. Mỗi quyết định ghi lại người duyệt và lý do."
- Tab lọc theo lý do, mỗi tab có số: Tất cả 12 · Hai cách đọc khác nhau 3 · Nhiều phòng trong một bài 4 · Chưa rõ giá phòng hay giá người 3 · Nghi trùng 2 · LLM lỗi 0 (tab số 0 vẫn hiện, mờ).
- Danh sách (bảng desktop, thẻ mobile): ô chọn; lý do (chip có viền, chữ rõ); đoạn trích 1–2 dòng có tô nhãn; loại phòng; phường; "chờ 3 giờ"; mã tin mono rút gọn; nút "Mở duyệt". Dòng demo có nhãn "Ví dụ".
- Ô "Chọn tất cả trên trang". Khi có tin được chọn: thanh hành động dính đáy màn hình "Đã chọn 4 tin" + nút vàng "Duyệt 4 tin" + nút viền đỏ "Loại 4 tin" + "Bỏ chọn". Loại hàng loạt mở hộp bắt buộc nhập lý do (dùng chung cho cả lô). Tách và gộp không có ở đây, chỉ làm từng tin.
- Vẽ thêm trạng thái kết quả sau khi duyệt hàng loạt: "3 tin đã duyệt · 1 tin đã bị người khác sửa, mở lại để xem" với danh sách từng tin và trạng thái của nó.
- Phân trang.
- Trạng thái trống: "Hàng duyệt trống. Không có tin nào cần người xem." với minh họa phiếu giá đã đóng dấu.

Được tự sáng tạo: cách thể hiện "thời gian chờ" và mức ưu tiên (ví dụ vạch thời gian), miễn là chữ vẫn đọc được.
```

## A3. Duyệt một tin `/team/duyet/[id]` (thay `trang_9` hỏng) · P1

- **Dữ liệu:** tin, version, trạng thái, lý do, cụm trùng, bài gốc + link, span Regex, span LLM, trạng thái LLM, model, tin nghi trùng (cosine, giá, diện tích), lịch sử, ảnh tin nếu có.
- **Thao tác:** Duyệt · Loại (bắt buộc lý do ≤ 500 ký tự) · Tách khỏi nhóm trùng · Gộp vào nhóm. Luôn gửi version; người khác đã sửa thì báo xung đột.

```text
Màn "Duyệt một tin" trong khu nhóm TrọCheck (cùng sidebar/topbar với Hàng duyệt).

Câu hỏi của màn: "Máy đọc tin này có đúng không, và quyết định gì?"
Bố cục gợi ý "Bảng đối chiếu" — tự sáng tạo nếu có cách tốt hơn:
- Đầu trang: breadcrumb "Hàng duyệt / Tin 01J…"; LÝ DO CẦN DUYỆT hiện đầu tiên và to (ví dụ "Hai cách đọc khác nhau ở GIÁ").
- Cột trái: ảnh đầu của bài (nếu có, nhỏ) + bài gốc đã che liên hệ ("Người đăng đã ẩn", "[SĐT]"), tô bút dạ quang 5 nhãn, công tắc "Regex / LLM / Cả hai" (chỗ hai bên lệch có viền đứt đỏ). Link "Mở bài gốc".
- Cột phải: bảng các trường (Giá, Cách tính, Diện tích, Loại phòng, Vị trí, Điện, Nước, Cọc…). Mỗi dòng: Regex đọc · LLM đọc · Giá trị chọn (ô sửa được; sửa rồi thì có dấu "đã sửa"). Ô trống ghi "Không đọc được", không ghi 0.
- Khối "Nghi trùng": 1–3 tin giống, mỗi tin: độ giống 0,92, giá, diện tích, link.
- Khối "Lịch sử": ai làm gì, lúc nào, lý do.
- Thanh quyết định dính đáy: nút vàng "Duyệt", nút viền "Tách khỏi nhóm trùng", nút viền "Gộp vào nhóm…", nút viền đỏ "Loại tin". Nút đang gửi giữ kích thước, có vòng quay nhỏ.

Vẽ thêm 3 trạng thái nhỏ:
(a) Hộp "Loại tin này?" có ô bắt buộc "Lý do loại" (0/500), nút "Hủy" và nút đỏ "Loại tin".
(b) Xung đột: "Tin đã được sửa (phiên bản 4). Tải lại để xem khác biệt trước khi duyệt." + nút "Tải bản mới" + bảng khác biệt cũ → mới.
(c) Hộp "Gộp vào nhóm" chọn cụm đích từ danh sách nghi trùng.
Có cảnh báo khi rời trang mà còn sửa chưa lưu.
```

## A4. Đánh giá `/team/danh-gia` (thay `trang_11` hỏng) · P1

- **Dữ liệu:** danh sách lượt chạy (run id, split dev/test, đóng băng, phương pháp, phiên bản, thời gian, commit). Mỗi lượt: P/R/F1 theo nhãn cho `regex` / `llm` / `hybrid`; số lỗi theo phương pháp × loại lỗi. **Hiện chưa có lượt chạy nào.**

```text
Màn "Đánh giá" trong khu nhóm TrọCheck (cùng sidebar), cho người nghiên cứu xem kết quả so sánh Regex, LLM và Kết hợp.

Nội dung:
- Tiêu đề Newsreader "Đánh giá" + câu "Mỗi lượt chạy đóng băng dữ liệu, phiên bản và commit. Số chỉ đọc từ lượt chạy, không nhập tay."
- Chọn lượt chạy: danh sách hoặc dropdown, mỗi lượt: mã mono, split (dev/test), nhãn "Đã đóng băng", ngày giờ, commit rút gọn.
- Bảng P / R / F1 theo 5 nhãn (Giá, Diện tích, Vị trí, Loại phòng, Phí) × 3 phương pháp (Regex, LLM, Kết hợp). Ô số mono; ô cao nhất mỗi hàng in đậm (không chỉ tô màu). Dạng bảng nhiệt nhạt bằng độ đậm của MỘT màu, có chú giải.
- Khối "Loại lỗi": thanh ngang đếm lỗi theo loại (thiếu nhãn, thừa nhãn, sai ranh giới, sai nhãn, sai chuẩn hóa) cho từng phương pháp, số ở cuối thanh.
- Khối "Thông tin lượt chạy": phiên bản lexicon, prompt, model, thời gian, commit — bảng mono.
- Link "Mở trong Kiểm tra trích xuất" cho từng loại lỗi.
- TRẠNG THÁI TRỐNG (vẽ to như màn chính thứ hai): "Chưa có lượt đánh giá nào. Chạy `make eval` trên máy nhóm rồi tải lại trang." + khung lệnh mono có nút sao chép.
Không bịa số: số mẫu ghi nhãn "Ví dụ".
```

## A5. Đăng ký `/dang-ky` · P0

- **Quy tắc:** tên tài khoản 3–30 ký tự (chữ không dấu, số, gạch dưới); **email bắt buộc** (5.3); mật khẩu ≥ 8 ký tự có chữ hoa và số; nhập lại mật khẩu; đồng ý điều khoản. Trùng tên hoặc trùng email → báo. Thử nhiều lần → báo chờ. Tạo xong tự đăng nhập. Tài khoản mới là người đi thuê.
- **THÊM (5.3):** "Tiếp tục với Google".

```text
Màn "Tạo tài khoản" của TrọCheck.
Bố cục chia đôi: nửa trái form trên nền giấy; nửa phải vùng tối #111214 kể ngắn vì sao nên tạo tài khoản — dùng "bài đăng có tô dạ quang biến thành phiếu giá" như trang chủ (bài mẫu nhỏ có nhãn Giá, Diện tích, Vị trí, Loại phòng, Phí + phiếu giá, ghi "ví dụ tự tạo"). Không dùng ảnh người.

Form:
- Logo TrọCheck, tiêu đề Newsreader "Tạo tài khoản TrọCheck", câu phụ "Đọc rõ tiền nhà, trước khi hỏi thuê."
- Nút "Tiếp tục với Google" ở trên cùng, rồi đường kẻ "hoặc tạo bằng tên tài khoản".
- Ô "Tên tài khoản" + gợi ý "3–30 ký tự: chữ không dấu, số hoặc gạch dưới".
- Ô "Email" + gợi ý "Dùng để lấy lại mật khẩu".
- Ô "Mật khẩu" có nút hiện/ẩn + 3 điều kiện tick dần khi gõ: Ít nhất 8 ký tự · Một chữ hoa · Một chữ số.
- Ô "Nhập lại mật khẩu".
- Ô tick "Tôi đồng ý điều khoản sử dụng" (link sang trang Điều khoản).
- Nút vàng đầy chiều ngang "Tạo tài khoản".
- Dưới: "Đã có tài khoản? Đăng nhập" · "Xem tin trọ trước".

Vẽ thêm trạng thái: lỗi từng ô (viền đỏ, câu lỗi ngay dưới ô, có icon); "Tên tài khoản đã có người dùng"; "Email này đã có tài khoản — Đăng nhập?"; "Bạn thử quá nhiều lần, thử lại sau 10 phút"; nút đang gửi.
Mobile: nửa phải thu thành dải tối mỏng phía trên form.
```

## A6. Tài khoản `/tai-khoan` · P1

- **Dữ liệu:** tên tài khoản, email, vai trò; token extension (tạo, danh sách, thu hồi); đăng xuất.
- **THÊM (5.3):** thêm/sửa email, đổi mật khẩu, liên kết/hủy liên kết Google, link sang Thông báo.

```text
Màn "Tài khoản" trong khu trong TrọCheck (cùng sidebar, topbar có chuông).

Nội dung (chia khối rõ, có thể dùng mục lục trái trên desktop):
- Hồ sơ: chữ cái đầu trong ô vuông bo góc (không ảnh), tên tài khoản, email (nhãn "Đã xác nhận" hoặc "Chưa có email" + nút "Thêm email"), các vai trò dạng chip có giải thích khi rê chuột (Người đi thuê / Người thu thập / Người duyệt / Nghiên cứu / Quản trị).
- Đổi mật khẩu: Mật khẩu hiện tại · Mật khẩu mới (3 điều kiện tick dần) · Nhập lại · nút "Đổi mật khẩu". Trạng thái thành công: "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất."
- Đăng nhập bằng Google: chưa liên kết → nút "Liên kết Google"; đã liên kết → email Google + nút viền "Hủy liên kết" (nếu chưa có mật khẩu thì không cho hủy, ghi lý do).
- Kết nối extension: câu "Token cho phép extension Chrome gửi bài vào tài khoản của bạn." Ô "Tên token" + nút vàng "Tạo token". Vừa tạo: khung viền vàng hiện token mono, nút "Sao chép", cảnh báo "Token chỉ hiện một lần. Lưu lại ngay.", nút "Đã lưu". Bảng token: Tên · Tạo ngày · Hết hạn · Dùng lần cuối · Trạng thái · nút viền đỏ "Thu hồi" (có hộp xác nhận). Trống: "Chưa có token nào".
- Thông báo: link "Xem tất cả thông báo".
- Tài khoản bị khóa thì không vào được màn này; màn Đăng nhập báo "Tài khoản đã bị khóa, liên hệ quản trị nhóm".
- Cuối trang: nút viền "Đăng xuất".
```

## A7. Bản đọc tin `/phan-tich/[id]` + các trạng thái · P0

- **Dữ liệu:** trạng thái xử lý, loại bài, đọc một phần, bài đủ chữ không, chữ bài, các tin đọc được, đã đóng góp, so sánh với nhóm; **nguồn: dán chữ hoặc ảnh chụp** (5.1).

```text
Màn "Bản đọc tin" của TrọCheck, kết quả sau khi người dùng gửi một bài cho thuê (dán chữ hoặc tải ảnh chụp). Trong khu trong (cùng sidebar).
Ý tưởng "Phiếu đọc": giá thuê đặt lên đầu, phí và cọc tách riêng, mọi con số trỏ được về đúng đoạn chữ trong bài.

Màn chính (đã đọc xong):
- Đầu: "Bản đọc tin" + ngày giờ + nhãn nguồn ("Dán chữ" hoặc "Ảnh chụp") + nhãn "Chỉ mình bạn thấy" + nút "Phân tích bài khác".
- Cột trái "Phiếu giá": GIÁ THUÊ lớn "5.500.000 đ /tháng/phòng"; Diện tích; Loại phòng; Phòng (1 phòng ngủ · WC riêng · có gác · nội thất đầy đủ); Vị trí (địa danh + phường, độ chắc chắn "suy ra từ tên đường"); khối "Các khoản phí — tách khỏi giá thuê" (Điện 3.500 đ/số · Nước 100.000 đ/người/tháng · Internet miễn phí · Gửi xe: Không đề cập); khối riêng "Đặt cọc: 1 tháng tiền thuê". Bấm một dòng → đoạn tương ứng trong bài bên phải sáng lên.
- Cột phải: bài gốc đã che, tô 5 nhãn, chú giải. Nếu nguồn là ảnh chụp: phía trên có ảnh thu nhỏ (bấm để phóng to) và dòng "Chữ do máy đọc từ ảnh, bạn đã kiểm trước khi gửi".
- Dưới: "So với nhóm": câu nhận định trung tính có viền sắc thái, thước giá (vạch "Trung bình" + cờ "Phòng này"), dòng "Trung bình 5 tr · 14 phòng cùng nhóm · dữ liệu 05/10–25/10/2026", tối đa 3 tin tương tự (ảnh nhỏ nếu có, loại, diện tích, giá kèm đơn vị, mũi tên cùng dòng).
- Hộp "Đóng góp bài này vào kho chung?" nút "Đóng góp" / "Không, cảm ơn"; sau đó hiện "Đã đóng góp".
- Bài nhiều phòng: tab "Phòng 1 · Phòng 2" ở đầu phiếu giá.

Vẽ thêm 5 trạng thái thu nhỏ:
(a) Đang đọc: phiếu giá dạng khung xương, "Đang đọc bài…" + "Không hiện phần trăm vì hệ thống không biết trước tổng việc".
(b) Đọc một phần: "LLM không phản hồi, kết quả chỉ từ Regex. Một số trường có thể thiếu." + "Đọc lại".
(c) Không phải bài cho thuê: "Đây là bài tìm phòng, không trích giá." + nút dán bài khác.
(d) Bài không công khai giá: chỗ giá ghi "Bài không công khai giá", phần so sánh hiện giá tham khảo của nhóm.
(e) Chưa đủ dữ liệu so sánh: khối sọc chéo "Mới có 7 tin tương tự (cần ít nhất 10)", không vẽ thước.
Lỗi: "Không đọc được bài này" + mã lỗi mono + "Thử lại".
```

## A8. Khung khu trong: sidebar, topbar, menu tài khoản, chuông · P0

```text
Thiết kế KHUNG dùng chung cho mọi trang trong của TrọCheck (không có nội dung trang).
- Sidebar trái ~240px, nền tối #111214 ở cả hai chế độ, chữ #F4F1EA/#BDB9AE: logo TrọCheck (biểu tượng + chữ bản sáng); nhóm "Đọc tin" (Phân tích bài đăng, Tìm trọ, Thị trường); nhóm "Khu nhóm" (Kho dữ liệu, Nguồn cào, Hàng duyệt + số chờ, Kiểm tra trích xuất, Đánh giá, Người dùng) — mục không đủ quyền thì ẩn hẳn, "Người dùng" chỉ admin thấy; nhóm "Cá nhân" (Thông báo + số chưa đọc, Tài khoản). Mục đang chọn: nền #1A1B1E + vạch vàng #FFE14D bên trái 3px. Dưới cùng: "Về trang chủ".
- Topbar mỏng (nền sáng ở chế độ sáng, nền tối ở chế độ tối): breadcrumb trái; phải là nút chuyển sáng/tối, CHUÔNG THÔNG BÁO (chấm số chưa đọc) và nút tài khoản (ô chữ cái đầu + tên + mũi tên).
- Bảng thả của chuông: 5 thông báo gần nhất, mỗi dòng có icon theo loại, tiêu đề, 1 dòng mô tả, thời gian ("5 phút trước"), dòng chưa đọc có chấm vàng; nút "Đánh dấu đã đọc hết"; link "Xem tất cả". Trống: "Chưa có thông báo".
- Menu tài khoản bật xuống từ góc phải (mờ + trượt 4px): tên, email, vai trò, Tài khoản, Về trang chủ, đường kẻ, "Đăng xuất".
- Tablet: sidebar thu thành cột icon 64px có tooltip. Mobile: sidebar thành ngăn kéo từ trái, mở bằng nút menu; đóng bằng Esc hoặc bấm ra ngoài.
- Vẽ 3 vai trò để thấy menu khác nhau: Người đi thuê (Đọc tin + Cá nhân), Người duyệt (thêm Kho, Nguồn cào, Hàng duyệt), Quản trị (đủ, gồm Người dùng).
Không có ô tìm kiếm toàn cục, không dòng "hệ thống online".
```

## A9. Trang lỗi: 404 / 403 / 500 / hết phiên · P1

```text
4 màn trạng thái lỗi của TrọCheck, cùng một hệ: nền giấy, minh họa là MỘT PHIẾU GIÁ bị đóng dấu đỏ nghiêng (như con dấu "ví dụ tự tạo" trên landing), tiêu đề Newsreader, 1 câu giải thích, tối đa 2 nút.
- 404: dấu "KHÔNG TÌM THẤY". "Trang hoặc tin này không có. Có thể tin đã bị gỡ khỏi kho." Nút vàng "Về Tìm trọ", nút viền "Về trang chủ".
- 403: dấu "KHÔNG ĐỦ QUYỀN". "Trang này dành cho người duyệt. Tài khoản của bạn là Người đi thuê." Nút "Về bàn làm việc".
- 500: dấu "LỖI". "Máy chủ đang gặp sự cố. Dữ liệu của bạn không bị mất." Nút "Thử lại" + mã lỗi mono nhỏ.
- Hết phiên: dấu "HẾT PHIÊN". "Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục đúng trang đang xem." Nút "Đăng nhập lại".
403 và hết phiên vẽ trong khung khu trong; 404 và 500 vẽ trong trang công khai.
```

## A10. Extension: giới thiệu và kết nối `/extension` · P2

```text
Màn "Extension TrọCheck" (trang công khai), giới thiệu tiện ích Chrome đọc bài trên Facebook.
- Đầu trang: tiêu đề Newsreader "Nhận định ngay trên Facebook." + nhãn trạng thái "Đang phát triển".
- 3 bước có số tròn: bấm nút TrọCheck cạnh bài hoặc bôi đen chữ → xem trước chữ sẽ gửi (số điện thoại đã che trên máy bạn) → đọc giá, phí và nhận định.
- Khối "Tự lưu khi bạn cuộn": khi cuộn nhóm Facebook, extension lưu chữ bài và ẢNH ĐẦU TIÊN của mỗi bài; bật/tắt trong popup; có bộ đếm.
- Mô phỏng trình duyệt có panel bên phải 4 trạng thái (xem trước / đang đọc / kết quả / chưa đủ dữ liệu), như phần extension trên landing.
- Khối "Kết nối": hướng dẫn tạo token ở trang Tài khoản, nút "Tạo token" (cần đăng nhập).
- Link "Dùng bản web: Phân tích bài đăng".
```

## A11. Điều khoản và dữ liệu `/dieu-khoan` · P2

```text
Trang văn bản "Điều khoản và dữ liệu" của TrọCheck (đồ án học tập TMG301), dễ đọc như một trang báo.
- Cột chữ rộng tối đa 680px, tiêu đề Newsreader, mục lục dính bên trái trên desktop.
- Các mục: TrọCheck là bản demo học tập · Số liệu là giá chào thuê trong bài đăng, không phải giá giao dịch · Dữ liệu được thu thế nào (dán chữ, ảnh chụp, extension, bot) · Số điện thoại và tên người đăng được che · Ảnh được lưu thế nào · Bạn chủ động chọn đóng góp bài vào kho chung · Tài khoản, email và đăng nhập Google · Liên hệ nhóm.
- Mỗi mục mở đầu bằng một câu in đậm tóm ý, có từ khóa gạch dạ quang.
- Ngày cập nhật ở đầu trang.
```

## A12. Quên mật khẩu + Đặt lại mật khẩu · P1 (5.3)

- **Luồng:** nhập email → luôn báo "nếu email có tài khoản, mình đã gửi link" (không tiết lộ email có tồn tại hay không) → mở link trong email → đặt mật khẩu mới. Link dùng 1 lần, hạn 30 phút.

```text
2 màn của TrọCheck, cùng bố cục chia đôi với Đăng nhập/Đăng ký (form trái, vùng tối phải nhưng đơn giản hơn: chỉ một phiếu giá lớn mờ).

Màn 1 "Quên mật khẩu":
- Tiêu đề "Quên mật khẩu", câu "Nhập email của tài khoản. Mình sẽ gửi link đặt lại mật khẩu."
- Ô "Email", nút vàng "Gửi link đặt lại", link "Quay lại đăng nhập".
- Trạng thái đã gửi: icon phong bì nét mảnh, "Nếu email này có tài khoản TrọCheck, link đặt lại đã được gửi. Link có hạn 30 phút." + nút viền "Gửi lại" (đếm ngược 60 giây) + "Quay lại đăng nhập".
- Lỗi: email sai định dạng; gửi quá nhiều lần.

Màn 2 "Đặt lại mật khẩu" (mở từ link trong email):
- Tiêu đề "Đặt mật khẩu mới", dòng nhỏ hiện tên tài khoản.
- Ô "Mật khẩu mới" (3 điều kiện tick dần) + "Nhập lại", nút vàng "Lưu mật khẩu mới".
- Thành công: "Đã đặt lại mật khẩu. Các thiết bị khác đã bị đăng xuất." + nút "Đăng nhập".
- Link hết hạn/đã dùng: dấu đỏ nghiêng "HẾT HẠN", "Link này đã hết hạn hoặc đã được dùng." + nút "Gửi link mới".

Vẽ thêm mẫu EMAIL đặt lại mật khẩu (khổ 600px): logo TrọCheck, 1 câu, nút vàng "Đặt lại mật khẩu", dòng "Link có hạn 30 phút. Nếu bạn không yêu cầu, bỏ qua email này."
```

## A13. Thông báo `/thong-bao` · P1 (5.3)

- **Loại thông báo:** phân tích xong; bài đóng góp được duyệt/loại; tin mới vào hàng duyệt (reviewer); lượt đánh giá mới (researcher); bot cào lỗi (admin).

```text
Màn "Thông báo" trong khu trong TrọCheck (cùng sidebar, mục "Thông báo" đang chọn).
- Tiêu đề Newsreader "Thông báo" + nút viền "Đánh dấu đã đọc hết".
- Bộ lọc chip: Tất cả · Chưa đọc · Phân tích · Đóng góp · Hàng duyệt · Nguồn cào (chỉ hiện loại mà vai trò được nhận).
- Danh sách nhóm theo ngày ("Hôm nay", "Hôm qua", "28/10/2026"). Mỗi dòng: icon nét mảnh theo loại (không màu loè), tiêu đề đậm (ví dụ "Bản đọc tin đã xong"), 1 dòng mô tả ("Chung cư mini 30 m² · 5,5 tr/tháng"), thời gian, chấm vàng nếu chưa đọc, cả dòng là link tới nơi liên quan.
- Mẫu nội dung: "Bản đọc tin đã xong" · "Bài bạn đóng góp đã được duyệt" · "Bài bạn đóng góp bị loại: trùng với tin đã có" · "3 tin mới cần duyệt" · "Lượt đánh giá dev-2026-10-28 đã xong" · "Nguồn cào 'Phòng trọ Cầu Giấy' lỗi: Facebook yêu cầu xác minh".
- Trống: "Chưa có thông báo nào."
- Phân trang hoặc "Xem thêm" ở cuối.
```

## A14. Nguồn cào (quản lý bot) `/team/nguon-cao` · P1 (5.4)

- **Dữ liệu:** mỗi nguồn: loại (nhóm Facebook), link, tên, bật/tắt, lịch chạy, lần chạy cuối, trạng thái; lịch sử các lượt chạy (bắt đầu, kết thúc, số bài, số ảnh, lỗi). Thao tác: thêm, sửa, bật/tắt, chạy ngay, xóa.

```text
Màn "Nguồn cào" trong khu nhóm TrọCheck (cùng sidebar, mục "Nguồn cào" đang chọn), để nhóm quản lý bot thu bài từ các nhóm Facebook.

Nội dung:
- Tiêu đề Newsreader "Nguồn cào" + câu "Bot cuộn từng nhóm, lấy chữ bài và ảnh đầu tiên, rồi đưa vào Kho để đọc." + nút vàng "Thêm nguồn".
- Danh sách nguồn (bảng desktop, thẻ mobile): tên nhóm; link rút gọn mono; công tắc Bật/Tắt; lịch ("Mỗi 6 giờ"); lần chạy cuối ("2 giờ trước · 38 bài · 31 ảnh"); trạng thái bằng chữ + icon (Đang chạy / Xong / Lỗi / Tạm dừng) — lỗi có câu ngắn ("Facebook yêu cầu xác minh"); nút "Chạy ngay"; menu ⋯ (Sửa, Xem lịch sử, Xóa).
- Đang chạy: dòng có vòng quay nhỏ và bộ đếm bài tăng dần, nút "Dừng".
- Bảng thả "Thêm/Sửa nguồn": Tên · Link nhóm Facebook · Lịch chạy (chọn: thủ công / mỗi 1, 3, 6, 12, 24 giờ) · Số bài tối đa mỗi lần · Ô tick "Lưu ảnh đầu tiên" (mặc định bật) · nút "Lưu".
- Trang "Lịch sử chạy" của một nguồn: bảng các lượt (bắt đầu, thời lượng, số bài, số ảnh, số bài trùng bỏ qua, lỗi), bấm lượt để xem log rút gọn mono.
- Hộp xác nhận xóa nguồn (nút đỏ), ghi rõ "Bài đã thu vẫn giữ trong Kho".
- Trống: "Chưa có nguồn nào. Thêm link một nhóm Facebook để bắt đầu."
Không vẽ số liệu tổng tăng trưởng hay "live feed".
```

## A15. Popup extension · P2 (5.1)

```text
Thiết kế POPUP của tiện ích Chrome TrọCheck (khổ 360×520px), cùng style TrọCheck nhưng gọn.
- Đầu: logo TrọCheck nhỏ + tên tài khoản đã kết nối (hoặc "Chưa kết nối" + nút "Dán token").
- Công tắc lớn "Tự lưu khi cuộn" (bật/tắt) + mô tả 1 dòng "Lưu chữ bài và ảnh đầu tiên khi bạn cuộn nhóm Facebook".
- Công tắc "Lưu ảnh đầu tiên" (mặc định bật).
- Bộ đếm phiên này: "24 bài · 19 ảnh · 3 bài trùng bỏ qua", số dùng Newsreader.
- Danh sách 3 bài vừa lưu: ảnh nhỏ (hoặc ô chữ nếu không ảnh), 1 dòng trích, trạng thái gửi (Đã gửi / Đang gửi / Lỗi).
- Trạng thái dừng: dải cảnh báo "Facebook yêu cầu xác minh. Đã tạm dừng." + nút "Tiếp tục".
- Chân: link "Mở TrọCheck", "Cài đặt".
Vẽ thêm: (a) chưa kết nối, (b) đang lưu, (c) tạm dừng.
```

---

## A16. Người dùng `/team/nguoi-dung` · P1 (5.5)

- **Ai dùng:** chỉ admin.
- **Dữ liệu:** tên tài khoản, email, vai trò, ngày tạo, lần đăng nhập cuối, trạng thái (hoạt động / đã khóa + lý do), đã liên kết Google chưa, lịch sử thay đổi (ai đổi gì, cũ → mới, lý do, lúc nào).
- **Thao tác:** tìm, lọc; đổi vai trò; khóa/mở khóa (khóa bắt buộc lý do); gửi link đặt lại mật khẩu; tạo tài khoản nhóm.
- **Quy tắc hiện trên giao diện:** không tự khóa hay tự gỡ admin của mình; luôn còn ít nhất 1 admin; khóa thì người đó bị đăng xuất và mất mọi token extension.

```text
Màn "Người dùng" trong khu nhóm TrọCheck (cùng sidebar; mục "Người dùng" chỉ admin thấy, đang chọn). Dùng để quản trị tài khoản và vai trò.

Nội dung:
- Tiêu đề Newsreader "Người dùng" + câu "Đăng ký chỉ tạo tài khoản Người đi thuê. Tạo tài khoản nhóm hoặc nâng quyền ở đây." + nút vàng "Tạo tài khoản nhóm".
- Thanh lọc: ô tìm "Tên hoặc email…", chip vai trò (Tất cả · Người đi thuê · Người thu thập · Người duyệt · Nghiên cứu · Quản trị), chip trạng thái (Hoạt động · Đã khóa).
- Bảng (thẻ trên mobile): ô chữ cái đầu + tên tài khoản; email (hoặc "Chưa có email" mờ); vai trò dạng chip có chữ; nhãn nhỏ "Google" nếu đã liên kết; ngày tạo; "Đăng nhập lần cuối 2 giờ trước"; trạng thái bằng chữ + icon (Hoạt động / Đã khóa); menu ⋯ (Đổi vai trò, Gửi link đặt lại mật khẩu, Khóa / Mở khóa). Dòng của chính mình có nhãn "Bạn".
- Bấm một dòng → bảng thả bên phải "Chi tiết tài khoản": thông tin trên + khối "Lịch sử" (ví dụ "admin đổi vai trò: Người đi thuê → Người duyệt · 28/10/2026 · lý do: thành viên nhóm").
- Hộp "Đổi vai trò": danh sách ô tick 5 vai trò, mỗi vai trò 1 dòng giải thích quyền; ô "Lý do" (không bắt buộc); nút "Lưu". Với chính mình: ô Quản trị bị khóa + câu "Bạn không thể tự gỡ quyền quản trị".
- Hộp "Khóa tài khoản": ô bắt buộc "Lý do khóa", câu cảnh báo "Người này sẽ bị đăng xuất và mất mọi token extension", nút đỏ "Khóa tài khoản". Mở khóa: hộp xác nhận đơn giản.
- Hộp "Tạo tài khoản nhóm": Tên tài khoản · Email · Vai trò (ô tick) · nút vàng "Tạo và gửi email đặt mật khẩu". Sau khi tạo: "Đã tạo. Email đặt mật khẩu đã gửi tới …".
- Lỗi: "Hệ thống phải còn ít nhất 1 quản trị đang hoạt động"; tên hoặc email đã có.
- Trống khi lọc: "Không có tài khoản khớp".
Không vẽ số liệu tổng "người dùng mới tuần này" hay biểu đồ tăng trưởng.
```

---

# Phần B: vẽ lại 6 màn Stitch cũ theo style mới

Mở `screen.png` cũ ở đường dẫn trong bảng đầu file, tải lên Stitch, dán **Khối style**, rồi dán prompt.

## B1. Chi tiết tin (`trang_3`) → `/tin/[id]`

```text
Vẽ lại màn "Chi tiết phòng" này theo PHONG CÁCH TrọCheck ở trên. Giữ bố cục 2 cột.
GIỮ: tiêu đề "Chung cư mini · 1 phòng ngủ · 32 m²", địa danh + phường, ngày đăng, nguồn nhóm Facebook + link "Mở bài gốc"; khối giá bên phải; bài gốc có tô 5 nhãn + chú giải; bảng phí từng dòng có đơn vị; thước so với khu; tin tương tự cuối trang.
BỎ: "Ảnh thực tế AI xác thực", "Minh bạch", "Thang máy", "Số người ở tối đa".
THÊM: khu ảnh tin theo style mới (ảnh lớn + dải ảnh nhỏ nếu có nhiều; khung 4:3 bo 10px viền 1.5px; nhãn nhỏ nguồn ảnh "Ảnh từ bài đăng"); tin không có ảnh thì khu này là "Phiếu giá" lớn cạnh bài gốc.
CHƯA VẼ (chờ duyệt): "Lưu phòng", "Sao chép tóm tắt", "Báo sai lệch".
SỬA:
- Đặt cọc tách thành mục riêng, không nằm trong "các khoản phí".
- Câu so sánh trung tính "Thấp hơn mức trung bình khoảng 8% của 14 phòng cùng nhóm" trong hộp viền xanh đậm, không nền xanh lá to.
- Thêm dòng "Trung bình 5,6 tr · 14 phòng cùng nhóm · dữ liệu 05/10–25/10/2026" và câu "giá chào thuê, không phải giá giao dịch".
- Thẻ tin tương tự có ảnh nhỏ (hoặc ô chữ khi không có ảnh), loại, diện tích, giá + đơn vị, nhận định ngắn.
- Khối "Lịch sử giá" nhỏ nếu bài được đăng lại (ngày → giá).
- Bài nhiều phòng: chip "Phòng 1 · Phòng 2" ở đầu.
Vẽ thêm trạng thái "Chưa đủ dữ liệu so sánh (7/10 tin)" với khối sọc chéo thay cho thước.
```

## B2. Thị trường (`trang_4`) → `/thi-truong`

```text
Vẽ lại màn "Giá thuê theo khu vực" này theo PHONG CÁCH TrọCheck. Đây là trang công khai (thanh đầu trang như trang chủ: logo TrọCheck, menu, nút sáng/tối).
GIỮ: ma trận phường × loại phòng (giá trung bình lớn + giá trung bình/m² + số phòng, ví dụ "14 phòng"); ô thiếu dữ liệu; cột phải so giá trung bình giữa các phường; công tắc "Giá theo phòng / Giá theo người"; chọn phường.
BỎ: "Báo cáo thị trường Q4/2026", "Tổng mẫu 1,428 / Độ tin cậy NER 94,8%", "Biến động giá mạnh nhất", "Tìm kiếm nhiều nhất / lượt xem", "Kỳ khảo sát Tháng 10".
CHƯA VẼ (chờ duyệt): "Lời khuyên thuê trọ", "Xuất Excel", "Tải PDF".
SỬA:
- Tiêu đề kiểu landing: "Ô nào ít hơn 10 tin, ô đó để trống." + dòng "Dữ liệu 05/10–25/10/2026 · cửa sổ 30 ngày · giá chào thuê, không phải giá giao dịch".
- Đầu bảng nền tối #111214 chữ sáng; giá trung bình Newsreader, số phòng mono. BỎ: dải P25–P75, chữ "trung vị".
- Ô N < 10: nền sọc chéo + "Chưa đủ dữ liệu (6/10 tin)".
- Biểu đồ cột phải: thanh ngang 1 màu mực, số ở cuối thanh, chỉ phường đủ dữ liệu.
- Dòng nhỏ "Đã loại 23 tin: 7 thiếu phường, 4 không có giá, 12 đang chờ duyệt".
- Bấm một ô → sang Tìm trọ đã lọc đúng phường + loại.
- Mobile: ma trận thành danh sách theo phường, mở ra các loại.
```

## B3. Phân tích bài đăng (`trang_5`) → `/phan-tich`

```text
Vẽ lại màn "Phân tích bài đăng" này theo PHONG CÁCH TrọCheck, trong khung khu trong (sidebar tối, topbar có chuông).
GIỮ: 2 cột — trái nhập bài, phải kết quả; nút "Phân tích ngay" + "Xóa"; 3 bài mẫu (ghi "ví dụ tự tạo"); thanh 3 bước (Che thông tin · Gán nhãn · So sánh); giá lớn; chip 5 nhãn; thẻ phí; thước giá; hộp "Đóng góp bài này"; 2 cảnh báo ca đặc biệt (bài tìm phòng; giá ib).
BỎ: "NER Evaluation Engine v2.4", "Độ chính xác NER 94,8% PhoBERT", "Cấu hình mô hình bóc tách" và 2 ô tick, "Kho tham chiếu 1,420 bài", "Hoàn tất (0,42s)".
THÊM — hai cách nhập, dạng 2 tab ở cột trái: "Dán chữ" | "Tải ảnh chụp".
- Tab "Tải ảnh chụp": vùng kéo-thả lớn viền đứt ("Kéo ảnh chụp bài đăng vào đây hoặc chọn file · JPG, PNG, WebP · tối đa 5 MB"), xem trước ảnh thu nhỏ, nút "Đọc chữ từ ảnh".
- Sau khi đọc: hiện "Chữ đọc được từ ảnh" trong ô sửa được (số điện thoại đã thành [SĐT]), cảnh báo nếu ảnh mờ hoặc bài bị cắt ("Ảnh có thể chưa chụp hết bài"), nút "Phân tích".
- Trạng thái đang đọc ảnh (khung xương), lỗi (ảnh quá lớn, sai định dạng, không đọc được chữ).
SỬA:
- Tab "Dán chữ": trước khi gửi có bước "Xem nội dung sẽ gửi" (đã che số điện thoại, "Không gửi tên người đăng"), ô tick "Tôi đã dán đủ nội dung, gồm phần 'Xem thêm'".
- Thanh tiến trình không có phần trăm, không có thời gian.
- Cọc tách khỏi các thẻ phí, thành dòng "Đặt cọc".
- Kết quả đầy đủ mở sang màn "Bản đọc tin"; ở đây chỉ tóm tắt + nút "Xem bản đọc đầy đủ".
```

## B4. Đăng nhập (`trang_6`) → `/dang-nhap`

```text
Vẽ lại màn "Đăng nhập" theo PHONG CÁCH TrọCheck, cùng bố cục chia đôi với "Tạo tài khoản" (form trái, vùng tối kể chuyện bài đăng → phiếu giá bên phải).
GIỮ: ô có nhãn, nút hiện/ẩn mật khẩu, "Quay lại trang chủ", "Quên mật khẩu?", "Đăng nhập với Google".
BỎ: 4 thẻ "Tài khoản demo click để điền", "Bảo mật SSL 256-bit", "ReNER Engine v2.4", "Điều khoản AI".
SỬA:
- Tiêu đề "Đăng nhập TrọCheck". Nút "Tiếp tục với Google" ở trên, đường kẻ "hoặc".
- Ô "Tên tài khoản hoặc email" + ô "Mật khẩu" + link "Quên mật khẩu?" cạnh nhãn mật khẩu.
- Ô tick "Giữ đăng nhập trên máy này".
- Nút vàng "Vào bàn làm việc"; dưới: "Lần đầu đến TrọCheck? Tạo tài khoản" · "Xem tin trọ trước".
Trạng thái: sai tên/email hoặc mật khẩu (một câu lỗi chung, không nói ô nào sai); tài khoản đã bị khóa ("Tài khoản đã bị khóa, liên hệ quản trị nhóm"); "Phiên đã hết hạn, đăng nhập lại để tiếp tục"; tài khoản Google chưa liên kết ("Email này đã có tài khoản. Đăng nhập bằng mật khẩu rồi liên kết Google trong Tài khoản."); nút đang gửi.
```

## B5. Kho dữ liệu (`trang_7`) → `/team/kho`

```text
Vẽ lại màn "Kho dữ liệu" theo PHONG CÁCH TrọCheck, khung khu trong (sidebar tối, topbar có chuông; KHÔNG ô tìm nhanh toàn cục, KHÔNG "Hệ thống AI NER v2.4 Online").
GIỮ: 4 thẻ đếm; bộ lọc Trạng thái / Nhóm Facebook / Người thu / Khoảng ngày; bảng: Nhóm, Ngày đăng, Ngày thấy, Đoạn trích + chip nhãn, Loại bài, Trạng thái; "Xuất CSV"; phân trang; ô tìm từ khóa.
BỎ: "+14,2% tuần này", "Live Feed", phần trăm cạnh thẻ, "Tốc độ bóc tách 320ms PhoBERT", "Tỷ lệ tin rác", "Meta Graph Webhook", "Khớp 97,4% cấu trúc".
THÊM:
- Ô tìm "Tìm trong chữ bài…" trên thanh lọc; từ khóa tìm thấy được tô vàng nhạt trong đoạn trích.
- Nút viền "Nguồn cào" ở đầu trang dẫn tới màn quản lý bot (thay cho "Đồng bộ nguồn cào" / "Thêm nguồn cào mới").
- Cột "Nguồn" (Dán chữ / Ảnh chụp / Extension / Bot) và ảnh đầu nhỏ 40px nếu có.
SỬA:
- 4 thẻ đếm = số bài theo trạng thái (Đã đọc · Cần duyệt · Không phải bài cho thuê · Lỗi), chỉ có số.
- Thêm lọc "Loại bài" (Cho thuê / Tìm phòng / Khác) và lọc "Nguồn".
- Mỗi dòng có nút "Đọc lại" (bài lỗi), nhãn "Đã đóng góp" / "Ví dụ".
- Cột job: Chờ / Đang đọc / Xong / Lỗi + số lần thử + mã lỗi mono.
- Nút Xuất có CSV/JSONL + ô "Gồm dữ liệu demo".
- Bảng cuộn ngang trong khung trên màn hẹp; mobile thành thẻ.
```

## B6. Kiểm tra trích xuất (`trang_10`, tên cũ "Lab") → `/team/kiem-tra`

```text
Vẽ lại màn "AI Lab" này theo PHONG CÁCH TrọCheck và ĐỔI TÊN thành "Kiểm tra trích xuất". Khung khu trong; vùng đối chiếu có thể dùng nền tối #111214.
Tiêu đề Newsreader "Kiểm tra trích xuất" + câu "Đặt cách Regex, LLM và nhãn chuẩn đọc cùng một bài cạnh nhau để tìm vì sao máy đọc sai."
GIỮ: chọn bài mẫu hoặc dán chữ + nút "Chạy kiểm tra"; 3 tầng (Regex · LLM · Nhãn chuẩn) mỗi tầng là bài có tô nhãn; cảnh báo chỗ lệch; bảng token (Từ · Regex · LLM · Nhãn chuẩn · Trạng thái); bảng giá trị chuẩn hóa theo trường.
BỎ: mọi chữ "Lab", "AI Lab", "PhoBERT", "Deep Learning", "Transformer", "v2.4", "Checkpoint #8420", "Evaluation sandbox", 3 ô F1 cứng, "Tốc độ 0,8ms / 42ms", khối "Khuyến nghị".
THÊM — "Ghi vào nhãn chuẩn":
- Ở tầng "Nhãn chuẩn" có nút "Sửa nhãn": cho kéo chọn đoạn chữ và gán 1 trong 5 nhãn, sửa giá trị chuẩn hóa từng trường.
- Nút vàng "Ghi vào nhãn chuẩn" + ô ghi chú lý do; sau khi ghi hiện "Đã ghi · phiên bản 3 · bởi <tên>" và link "Lịch sử nhãn".
- Bài thuộc tập test đã đóng băng: nút bị khóa, ghi rõ "Tập test đã đóng băng, không sửa nhãn để giữ số đánh giá".
- Bài chưa có nhãn chuẩn: tầng 3 hiện "Bài này chưa có nhãn chuẩn" + nút "Tạo nhãn chuẩn từ bản LLM".
CHƯA VẼ (chờ duyệt): không có. ("Xuất JSON" / "Báo cáo .CSV" bỏ.)
SỬA:
- Tầng 2 tên là "LLM".
- Chỗ lệch: viền đứt đỏ + chú thích "LLM gán 'nước 100k/người' là GIÁ, nhãn chuẩn là PHÍ".
- Ô trạng thái bằng chữ (Khớp / Regex thiếu / LLM sai nhãn), không chỉ màu; nhãn BIO dạng mono.
- Link "Xem số liệu tổng ở trang Đánh giá" thay cho các ô F1.
- Trạng thái đang chạy (khung xương) và lỗi LLM (chỉ còn tầng Regex).
```

---

## Checklist trước khi giao bản Stitch để dựng

- [ ] Đủ 16 màn phần A + 6 màn phần B, mỗi màn có bản 1440 và 390, nằm trong `WS\.tmp\stitch-11\`.
- [ ] Mỗi `screen.png` mở được, không phải file hỏng.
- [ ] Không màn nào còn số bịa: PhoBERT, 94,8%, v2.4, lượt xem, % tăng trưởng, tốc độ ms.
- [ ] Không còn chữ "Lab"; dùng "Kiểm tra trích xuất".
- [ ] Mỗi màn có bản 1440 ở cả chế độ sáng và tối.
- [ ] Logo là ảnh TrọCheck đã tải lên; không còn chữ "ReNER" trên màn.
- [ ] Nhãn thực thể ghi đủ chữ (Giá, Diện tích, Vị trí, Loại phòng, Phí), không viết tắt.
- [ ] Không màn nào có tính năng còn chờ duyệt (lưu phòng, lịch sử phân tích, báo sai lệch, sao chép, lời khuyên, xuất PDF/Excel thị trường).
- [ ] Màn Người dùng có trạng thái "tự gỡ quản trị bị khóa" và lỗi "phải còn ít nhất 1 quản trị".
- [ ] Mỗi trang có giá đều có câu "giá chào thuê, không phải giá giao dịch" và khoảng ngày dữ liệu.
- [ ] Thẻ tin vẽ cả trường hợp có ảnh và không có ảnh.
- [ ] Mọi nút có chữ; nút chỉ có icon thì có tên; ô bấm ≥ 44px.
- [ ] Đặt cọc luôn tách khỏi các khoản phí.
- [ ] Màn có so sánh đều có trạng thái "Chưa đủ dữ liệu (7/10 phòng)".
- [ ] Không màn nào ghi "P25", "P75", "trung vị" hay "N"; so sánh dùng giá trung bình.
