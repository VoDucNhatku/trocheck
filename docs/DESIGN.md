# ReNER-VN — landing nhà ở, cuộn theo cảnh

## Khu trong — Codex 3, 27/10/2026

Phần này thay thế các quy định khu trong cũ; lịch sử landing/public phía dưới giữ nguyên.
Hướng **bản đọc có căn cứ**: trả lời tiền nhà trước, cho xem đoạn nguồn ngay cạnh, dành khoảng rõ cho phần chưa biết.
Nhóm duyệt làm việc trên bảng đối chiếu; khách thuê đọc phiếu tiền nhà. Density 7, variance 4, motion 3.

### Màu, chữ và hình học

Chỉ mở rộng `[data-workspace]` trong tokens.css; không đổi token landing.

| Vai trò | Token / giá trị |
|---|---|
| Giấy / bề mặt / vùng phụ | paper #f6f4ee / surface #fffdf7 / subtle #eeece3 |
| Chữ chính / phụ / chú thích | ink #172b25 / ink-2 #43564a / ink-3 #59655b |
| Hành động / hover / active | accent #244b3c / #193c2e / #122f23, chữ surface |
| Chọn / hover nền | accent-subtle #e7ede4 / hover #e7ebe1 |
| Đường cấu trúc / viền control | border #d9dcd0 / border-strong #7d887b (đo ≥3:1 trước bàn giao) |
| Cần chú ý | amber #f2cd64, nền #fff3ce, chữ #80420d |
| Lỗi | danger #a33124 / danger-surface #fcece6 |

Be Vietnam Pro: body14/1.65, đọc nguồn16/1.8, label14/1.5, caption12/1.6, section16/600, H1 28/1.4.
Newsreader chỉ auth title và caption ảnh, tối đa32px trong app. Giá36/1.3/600, mobile28;
giá khoảng dài được wrap ở ranh giới có nghĩa. JetBrains Mono chỉ ID/code/offset; tiền và bảng dùng tabular-nums.
Không uppercase micro-label lặp. Kiểm “phường Nguyễn Thái Bình”, “12.500.000 đ/tháng/phòng”, “ặ ẩ ỡ”.

Spacing4/8/12/16/24/32/48. Gutter desktop32, tablet24, phone16. Sidebar216px, main fluid tối đa1480px.
Ở1440: 216 sidebar + 2×32 gutter + 1160 nội dung; Reading chia 1,15:1, gutter32px; cột nguồn đi cùng câu hỏi để giảm khoảng trống. Dưới1100 drawer thay sidebar;
Dưới700 một cột, kết quả trước nguồn; ở768 kiểm tra cột ngắn và wrap theo nội dung. Không vùng cuộn lồng trong card.
Radius: surface16, control8, auth input14; chip pill chỉ lọc; status4. Không shadow trên panel đứng yên;
popover/dialog dùng shadow --shadow-overlay hiện có. Layer: sticky10, menu30, dialog native top-layer.

### Component và trạng thái bắt buộc

Mọi control có focus outline2px accent offset3px. Hover chỉ pointer fine; active tức thì. Disabled vẫn đọc được,
native disabled và lời giải thích gần control. Pending khóa mutation đồng bộ bằng ref, không đổi chiều cao nút.

| Component | Kích thước / bình thường | Hover / active / focus | Pending / lỗi / disabled |
|---|---|---|---|
| Button | min44px, pad12×16,14/600,radius8; một primary/view | hover120ms đổi màu; active accent-active; focus chung | min-width giữ nhãn, aria-busy, disabled; lỗi cạnh thao tác |
| Input / select | min44px, font16, pad10×12, border-strong1px; auth52px | border accent, outline chung | aria-invalid, error id nối describedby; không xóa nội dung |
| Checkbox/radio | native20px trong label min44px | accent/focus chung | khóa khi pending |
| Chip | min44px hit, nội dung32, radius full | aria-pressed + border accent; không scale | disabled có lý do |
| Tabs / segmented | min44px, label14, track vừa nội dung | chọn bằng underline2px hoặc surface; bàn phím native | không animation chuyển nội dung |
| Dialog | max480px, padding28; native dialog | Escape và trả focus; tên/mô tả; autoFocus thao tác an toàn | pending chặn đóng; lỗi giữ draft |
| Popover/menu | width280px tối đa viewport−32; dòng44px | origin trigger; Escape/outside đóng, return focus | logout lỗi tại menu, khóa lặp |
| Toast/notice | text14, pad12×16, status hoặc alert | không phủ nút | success/error có chữ; không tự biến mất lỗi cần xử lý |
| Table row | min56px, padding12; header sentence case12 | action rõ, hover nền nhẹ | skeleton giữ pitch; empty một hàng colspan |
| Status | chữ12/500, pad2×6, radius4 | không tương tác nếu không có action | nhãn demo/quyền/job là các trục riêng |
| Skeleton | thanh tĩnh theo hình nội dung | không shimmer | aria-busy/status có tên |
| Empty / no-match | heading16 + một câu + action có thật | không ảnh trang trí | kho rỗng khác lọc không khớp; error có retry |

Motion: hover100–140ms, menu160ms opacity/translate4px, drawer200ms transform, vùng120–180ms nếu giúp hiểu;
ease-out dùng token --ease-out cubic-bezier(.16,1,.3,1). Không animation vào trang, count-up, scale(0),
transition:all, state mỗi frame. Reduced motion bỏ chuyển động; thay đổi bằng bàn phím tức thì.

### Page patterns và giới hạn

- Auth: form trái, ảnh minh họa sân nhà phải, caption riêng, không chữ đè ảnh; mobile form trước, ảnh thu nhỏ/ẩn.
- Analyze: vùng dán là khối chính; “toàn bộ bài” và quyền riêng tư cạnh nút gửi, không % tiến độ giả.
- Reading: giá lớn và kỳ/basis; phí dạng dải ô có đơn vị; cọc riêng; thước P25/trung vị/P75 từ API;
  N<10 chỉ giải thích; câu hỏi còn thiếu từ field reasons; chọn field liên kết đúng evidence Unicode.
- Review: nguyên văn ở trên bảng Regex/LLM/giá trị chọn; editor mở theo nhóm; quyết định sticky trong flow,
  không che cuối trang. 409 giữ draft, dùng bản mới phải có thao tác rõ; lý do loại bắt buộc.
- Market: đồ thị thanh ngang theo phường/loại ở trước bảng phân vị, có đơn vị/trục và nguồn; không tính lại median ở client.
- Account: danh tính tách khu kết nối, token hiện một lần; actions có xác nhận và lỗi riêng.
- Kho/hàng duyệt: bảng phẳng; đoạn bài và lý do là cột chính; lọc và phân trang server.
- Lab/evaluation: input/run selector gọn, kết quả có nhịp phân đoạn, chứng cứ/mẫu số liền metric;
  dữ liệu nghiên cứu chưa có hiện rõ, không ngụy tạo chart.

Cấm: gradient/glass/glow/neon, icon trong ô màu, emoji trang trí, panel lồng lặp, badge nhiều màu, chữ đệm,
số hoặc nút bịa, hover nhấc card. NER màu chỉ trong evidence cùng nhãn; source thật có emoji vẫn giữ nguyên.

Checklist trước bàn giao: 1440/1024/768/390/360 không overflow; label/focus/Escape/return focus; pending/error/empty;
null không thành0, phí không cộng, per-person không nhân; role server; ảnh minh họa có caption; contrast text≥4.5,
control≥3; ảnh trước/sau mở xem; hai critique rounds cho auth/Reading/Review; tests mới và hồi quy có output.
Các tỉ lệ đo và chênh lệch có lý do ghi tại20-redesign-delivery.md, không coi các giá trị token là bằng chứng đã đo.

---

Cập nhật landing 26/10/2026: theo yêu cầu mới, trang ngoài dùng cảnh sân nhà Việt Nam do AI tạo, nền kem và điểm nhấn vàng/xanh. Giữ nguyên API, tìm trọ, chi tiết, số liệu kho và demo/kho thật. Ảnh là minh họa không gian, không phải ảnh tin cho thuê. Thiết kế trang bên trong chưa đổi ở bước này.

- `HousingScene`: ảnh ưu tiên tải bằng Next Image, native sticky + transform/opacity, không video hoặc chặn cuộn. Ảnh lùi nhẹ và khung tiền cảnh chuyển động độc lập trong một đoạn ngắn; nội dung HTML cuộn tự nhiên.
- Đoạn mây theo script tham chiếu: sau khi khối chữ cuối rời khung, ba lớp ảnh mây có alpha tràn từ hai mép và phía trước theo tiến độ cuộn. Đoạn chuyển dài 0,75 lần chiều cao cảnh, kết thúc ở nền kem. Phần đọc tin kéo lên 34svh với gradient để hiện từ trong mây; cuộn ngược đảo lại toàn bộ. Reduced motion bỏ mây và khoảng cuộn bổ sung.
- `ReadingHero`: bố cục mới cho ví dụ gốc/giá/phí/so sánh, không để thẻ chồng che bằng chứng. Chữ và CTA có sẵn khi chưa chạy JavaScript.
- Palette giới hạn trong landing: cream `#f6f4ee`, ink `#172b25`, forest `#244b3c`, amber `#f2cd64`, muted `#59655b`, white `#fffdf7`. Be Vietnam Pro cho nội dung, Newsreader cho tiêu đề, JetBrains Mono cho nhãn.
- Mobile có crop và khoảng cuộn riêng. `prefers-reduced-motion` bỏ ghim, bỏ transform, giữ đầy đủ nội dung. RAF chỉ chạy trong lúc nội suy cuộn, không cập nhật React state mỗi frame; dọn listener/observer khi rời trang.
- Brief và nguồn tham khảo: `docs/05-delivery/10-landing-scroll-brief.md`. Dùng nguyên lý UI từ scroll-craft và animation-performance trong kho nghiên cứu local, không đưa dịch vụ sinh video/API ngoài vào ứng dụng.

---

## Giai đoạn trước: UI giấy ngà trên backend hiện tại

Cập nhật 26/10/2026 theo yêu cầu người dùng: giữ giao diện prototype giấy ngà/vàng, ghép với FastAPI/SQLite của main. Bản local gốc không bị sửa. Mọi quyết định Stitch bên dưới là lịch sử, không phải hướng áp dụng hiện tại.

- Khôi phục token nền giấy #f6f4ee, Newsreader, Be Vietnam Pro, JetBrains Mono, highlight vàng, logo và bố cục trước Stitch (94e1e2a).
- Trang chủ giữ minh họa nhiều lớp, bài khó, panel extension và nguyên tắc; các minh họa luôn ghi rõ tự tạo. Không pin cuộn hoặc giấu hero trong lúc chờ animation.
- Tìm trọ giữ bộ lọc ngang/chip và card cũ, thêm phân trang API; giữ native checkbox, trạng thái pending, đồng bộ URL và demo/kho thật.
- Chi tiết giữ bố cục cũ, evidence tương tác và comparison API độc lập. Không đổi DTO, backend, luật giá/phí, evidence offset hay thống kê.
- Điều hướng chỉ tới trang/anchor có thật. Extension là minh họa, chưa cài đặt từ web. Menu có Escape/trả focus, skip link có đích focus.
- Outline control được tăng tương phản; test layout/contrast và hành vi chạy ở 360/390/768/1440px.

---

## Tài liệu Stitch trước khi khôi phục

# ReNER-VN — hệ giao diện Stitch

Chốt S0 ngày 24/10/2026. Đã áp dụng vào ba trang công khai ở B1-UI. Nguồn token chạy thật là [`tokens.css`](../apps/web/src/styles/tokens.css); tài liệu này ghi quyết định và hợp đồng component. Quy tắc dữ liệu/API vẫn theo `AGENTS.md` và `docs/02-data`, không suy từ mockup.

## Nguồn và lựa chọn

Đã đối chiếu `DESIGN.md`, `code.html` và `screen.png` của `trang_ch_rener`, `trang_2_t_m_tr_rener`, `trang_3_chi_ti_t_ph_ng_rener` trong ZIP người dùng cung cấp. Bản tham chiếu được giữ riêng ở `.tmp/stitch-reference-2026-10-24/`; không chép HTML/CDN/ảnh phòng vào ứng dụng.

- Chọn nền xanh rất nhạt `#f9f9ff`, primary `#005243` từ frontmatter và HTML/ảnh. Bỏ hướng nền ngà `#FAFAF7` trong diễn giải DESIGN và palette xanh tím/nền ngà của prototype cũ. `#146c5a` trở thành hover/focus, không là primary thứ hai.
- Dùng Be Vietnam Pro 400/500/600/700 đã cài, tự phục vụ latin/vietnamese. Không tải Newsreader/JetBrains cho UI. Lucide từ package hiện có; logo House + chữ ReNER VN. Chưa đổi thương hiệu sang TrọCheck.
- Bo panel 12px, control 8px, tag 4px; chuẩn hóa các tên radius mâu thuẫn của bản xuất thành ba mức này. Border nhẹ phân vùng, không dùng bóng lớn để phân cấp.
- Bố cục giữ hero hai phần, sidebar lọc và lưới tin, chi tiết hai cột. Chỉ đưa vào màn các thao tác có dữ liệu/hành vi thật.
- Giữ theme sáng của hướng được chọn; chưa triển khai dark theme. Cùng màu token cho mọi trang/trạng thái.

## Token

| Vai trò | Giá trị |
|---|---|
| Canvas / surface | `--paper #f9f9ff` / `--surface #ffffff` |
| Surface phụ / hover | `--subtle #f0f3ff` / `--hover #e8eeff` |
| Chữ chính / phụ / chú thích | `--ink #111c2d` / `--ink-2 #3f4945` / `--ink-3 #575f6d` |
| Primary / hover / active | `#005243` / `#146c5a` / `#003d32`, chữ trắng |
| Primary nhẹ / điểm nhấn | `--accent-subtle #e6f4f1` / `--accent-soft #a3f2db` |
| Border panel / control | `#e2e6ee` / `#78867f` |
| Focus | `#146c5a`, outline 2px, offset 2px; checkbox offset 3px |
| Error / error surface | `#b42318` / `#fff1ef` |
| Warning / warning surface | `#9a3412` / `#ffedd5` |
| Success / success surface | `#166534` / `#dcfce7` |
| Nhận định gần trung vị | `#3f4754` trên `#e8eeff` |

Màu NER đi kèm chữ nhãn và nền nổi, không dùng màu làm dấu hiệu duy nhất. Chữ nhãn là `#111c2d`:

| Nhãn | Nền | Nội dung |
|---|---|---|
| PRICE / GIÁ | `#fde68a` | Giá thuê |
| AREA / DT | `#bfdbfe` | Diện tích |
| LOC / VT | `#bbf7d0` | Vị trí |
| ROOM / PN | `#ddd6fe` | Loại phòng và thông tin phòng |
| FEE / PHÍ | `#fed7aa` | Các khoản phí |

Chữ nền 14px/1.55; chú thích 12px, label 13px, nội dung lớn 16px. H1 trang 28–40px, H2 20–28px, hero 30–40px; `letter-spacing: -0.02em`, heading balance. Giá card 22px; giá chi tiết 32px, co theo viewport. Số dùng tabular numerals. Nhãn NER inline 11px/đậm để không chồng dòng nguồn.

Spacing theo 4px: 4/8/12/16/20/24/32/40/48/64/96. Container nội dung 1200px, gutter 32px, mobile 16px. Header 72px desktop. Chuyển màu 150–250ms; bỏ scroll pin/reveal che nội dung và animation làm lưới tin đổi vị trí. Reduced motion rút animation/transition về tức thời. Layer hiện có: sticky 20, skip link 40; layer dialog/portal dành cho giai đoạn sau, chưa cần token chạy thật.

## Component đã triển khai

| Component | Trách nhiệm và trạng thái |
|---|---|
| `SiteHeader`, `SiteFooter`, `Logo` | Public nav có active route, link giữ dataset, mobile menu có aria-expanded/Escape/trả focus; skip link tới main. Footer ghi giới hạn giá chào thuê, link tới nội dung có thật. |
| `.button`, `.button-secondary` | Anchor dùng cho điều hướng, button dùng cho thao tác. Target tối thiểu 44px, hover/active/focus, disabled có ngữ nghĩa. Không giả submit thành công. |
| `StatusBadge` | Neutral/info/success/warning/danger, chữ mô tả state. Demo, text incomplete, nhận định là các trục riêng; không gọi mọi kết quả là xác thực. |
| `RentDisplay` | Tái dùng `rentHeadline`/`formatVnd`; exact/range/from/hidden/null, period và basis. Giá/người khác giá/phòng; không cộng phí, không đổi null thành 0. |
| `FilterBar`, `ListingSort` | Fieldset/legend, label thật, checkbox native. Min/max debounce 450ms, lựa chọn checkbox đổi ngay và đồng bộ URL. Pending thông báo qua status; URL và backend vẫn là nguồn bộ lọc. |
| `ListingGrid`, `ListingCard` | List ngữ nghĩa, một anchor/card, không lồng button. Loại/diện tích/vị trí thay ảnh; giá, phí riêng, verdict/ngày/demo từ API; đang mở có status. Giữ client boundary của grid đã kiểm hồi quy production. |
| `Pagination` | Dùng total/page/page_size từ API, link trước/sau có tên; giữ query lặp và demo, không tự lọc hay đổi kích thước trang. |
| `DetailBody`, `EvidenceHighlighter` | Giá/trường/phí chọn hai chiều với đoạn nguồn; aria-pressed, bàn phím, màu nhãn. Thuật toán tách Unicode code point và evidence key không đổi. Phí có đơn vị, thiếu là “Không đề cập”. |
| `ComparisonPanel`, `PriceDistributionBar` | Message, disclaimer, N, median/P25/P75 và similar từ API. Không đủ dữ liệu thì nêu lý do; comparison lỗi/retry độc lập với detail. Chỉ chặn vị trí chữ tooltip trong biên panel, không thay vị trí dữ liệu của marker. |
| `ApiState`, `LoadingState`, route skeleton, not-found | Error có thông điệp và Thử lại; skeleton/status không dựng số liệu giả. Kho rỗng khác không khớp lọc, ngày null có chữ thay thế. Chỉ listing 404 là not-found; giữ HTTP 404 trước streaming. |

## Hợp đồng component cho B2/B3/B6 (specification, chưa có màn chạy)

Các màn tương lai dùng token và component trên; không tạo palette/font thứ hai. Mapping 17 màn/trạng thái ở [hướng dẫn Stitch](05-delivery/06-huong-dan-su-dung-stitch.md#4-bản-đồ-màn-hình-sang-repo).

| Thành phần chốt ở S0 | Hợp đồng cho giai đoạn sau |
|---|---|
| `TeamShell` | PublicHeader vẫn dành cho khách; shell nhóm có sidebar/nav theo `roles` API, active route, menu mobile, account/logout. API kiểm quyền; không suy quyền từ lựa chọn role trên mẫu. |
| Field/form | Label luôn hiện, hint/error nối aria-describedby, required/invalid rõ, 44px control, lỗi giữ dữ liệu nhập. Pending chống gửi lặp, API error/retry; không thêm handler giả. Dùng kiểu input/enum đúng schema. |
| Table | Caption, th scope, hàng và action có tên; sort/filter/page phía API, pending/empty/error riêng. Mobile dùng vùng cuộn có nhãn hoặc hàng xếp dọc; không cắt input. |
| Dialog | Native dialog hoặc portal; tên và mô tả, focus vào control phù hợp, trap/return focus, Escape, nút hủy. Xác nhận thu hồi/xóa có tên đối tượng; pending/error và 409 theo contract. |
| `ExtensionTokenPanel` | Cùng panel cho tài khoản/khu nhóm: A=list; B=POST xong, raw token hiện một lần và copy thật; C=dialog thu hồi. GET không tái hiện raw token, expires_at từ API, không có IP/thiết bị/SSO giả. Kiểm quyền và trạng thái lỗi khi triển khai B2. |
| State nhóm | Phân biệt auth 401/403, conflict 409, rate limit 429, job/LLM/review/contribution/text/statistics; chỉ hiện field response có. Không dùng một badge “thành công” cho cả sáu trục. |

## Control → dữ liệu và hành vi công khai

Tất cả endpoint dưới đây tương đối với `/api/v1`, public read, cùng chế độ `demo`:

| Control/vùng | Nguồn/hành vi |
|---|---|
| Trang chủ / Kho tin hiện có | `GET /stats/overview`: total_listings, eligible_listings, updated_at, is_demo. Static hero/cases có nhãn ví dụ tự tạo, không gọi API bằng ID ví dụ. |
| Phường, loại, min/max giá/diện tích, có giá | `GET /listings` qua parser/adapter B1. `phuong`, `loai` lặp → `ward`, `type` lặp; triệu → đồng một lần; `co_gia=1` → has_price. Catalog phường đọc mọi trang không lọc cùng dataset, lỗi riêng. |
| Sort/phân trang/xóa lọc | `sap_xep`, `trang` trên URL → sort/page API; thay lọc/sort về trang đầu. Xóa lọc giữ demo/sort. Back của trình duyệt giữ URL trước khi mở tin; link “Về danh sách” mở danh sách cùng dataset theo hành vi B1. |
| Chuyển demo/kho thật | Demo trên URL gửi backend; `is_demo` response quyết định nhãn/link. Backend DEMO_MODE=false vẫn kiểm soát dữ liệu. |
| Mở tin/evidence/Bài gốc | `GET /listings/{id}`; evidence thao tác tại UI trên văn bản đã che SĐT, permalink chỉ hiện khi API trả. |
| Comparison/similar | `GET /listings/{id}/comparison`; chỉ điều hướng ID thật API trả, giữ dataset. Lỗi không xóa phần tin đã tải. |
| Thử lại | Router refresh request hiện tại, không fallback mock. |

Backlog chưa dựng control: search tự do/điểm nóng/facet count/basis filter cần hợp đồng API; yêu thích cần lưu trữ và auth; ảnh phòng cần dữ liệu/nguồn hợp lệ; form phân tích, market, auth/team/Lab/eval/extension thuộc các gói sau. Không đưa nút chết vào public nav.

## Responsive và kiểm chứng

Lưới tin: 3 cột từ 1200px, 2 ở 961–1199px và 600–767px (không sidebar), 1 ở 768–960px hoặc dưới 600px; sidebar desktop 264px, tablet 232px, panel lọc đóng/mở dưới 768px. Chi tiết xếp dọc dưới 961px, giá trước evidence/phí rồi comparison/thông tin. Hero xếp dọc trên điện thoại. Không cắt văn bản nguồn để ép cao bằng ảnh mẫu.

Bằng chứng và giới hạn kiểm tra tại [bàn giao S0/B1-UI](05-delivery/08-ket-qua-s0-b1-ui-2026-10-24.md). Chromium kiểm 360/390/768/1440px, no horizontal overflow/card overlap/clipped controls; kiểm focus, reduced motion, lỗi và null. Đo các text node hiển thị đạt AA trong 12 tổ hợp trang/viewport; không coi đây là chứng nhận WCAG toàn bộ hay kiểm đa trình duyệt.
