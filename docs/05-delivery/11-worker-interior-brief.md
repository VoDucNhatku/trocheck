# Brief giao worker: ReNER — không gian đọc tin và vận hành dữ liệu

Đây là yêu cầu được người dùng ủy quyền: đọc nguồn, tự quyết định hướng sản phẩm trong phạm vi dưới đây, lập plan rõ ràng rồi xây giao diện trang trong nối backend thật. Người dùng muốn bạn có thể chat trực tiếp, giải thích quyết định bằng tiếng Việt và tiếp nhận chỉnh hướng trong lúc làm. Chỉ dùng một worker; không tự gọi thêm agent.

## 1. Mục tiêu và định nghĩa sản phẩm

Bạn là product designer kiêm design engineer và fullstack implementer của ReNER-VN. Hãy tạo một công cụ tìm hiểu tin trọ dành cho sinh viên: đọc đúng giá/phí, nhìn thấy bằng chứng, biết điều gì còn thiếu, so sánh có căn cứ, và hỗ trợ nhóm thu/duyệt/đánh giá dữ liệu.

Hướng đã chọn: **bàn làm việc đọc tin**, ấm áp như landing nhưng chính xác và gọn như một công cụ làm việc tốt. Sau đăng nhập, người thuê vào màn Phân tích bài đăng; thành viên nhóm có thêm không gian vận hành theo quyền. Thành công là một người mới hoàn thành được việc, không phải số lượng trang hay số hiệu ứng.

Người dùng giao quyền sáng tạo cho bạn. Không mở lại phỏng vấn thương hiệu hoặc xin duyệt những lựa chọn UI thông thường. Trước khi code phải viết plan và quyết định thiết kế; sau đó được triển khai local theo thứ tự trong brief. Nếu thiếu một quyết định làm thay đổi quy tắc nghiệp vụ, ghi đúng chỗ thiếu và hỏi một câu tập trung, đồng thời làm tiếp phần độc lập. Không bịa API, dữ liệu hoặc trạng thái để lấp chỗ trống.

## 2. Dự án và nguồn bắt buộc

### ReNER, dự án đích
- GitHub: https://github.com/VoDucNhatku/rener-vn
- Workspace được phép sửa: `C:\Users\Asus\.codex\visualizations\2026\10\26\01a175c3-2040-7cb2-aec8-69bc64b965c1\rener-github-review-20261026`
- Bản preview hiện tại: http://127.0.0.1:3002/ ; API local hiện có: http://127.0.0.1:18001/api/v1 . Kiểm tra lại trước khi dùng, không suy đoán tiến trình còn chạy.
- Bản gốc cổng 3000 tại `D:\DEMO kế hoạch kì 5\DEMO kế hoạch kì 5\TMG301\rener-vn` phải được giữ nguyên.
- Workspace có nhiều thay đổi chưa commit từ việc khôi phục paper UI và dựng landing. Đọc `git status`, giữ chúng; không reset/clean/stash mất file hoặc thay branch tùy tiện. Không pull đè bản đang làm.
- Landing vừa có sân nhà, parallax và mây phủ khi cuộn. Giữ hướng landing hiện tại, không thiết kế lại phần đó trong nhiệm vụ này. Có thể thêm điều hướng thật tới các màn mới khi cần.
- Stack có sẵn: Next.js/React/TypeScript, CSS Modules, Be Vietnam Pro + Newsreader + JetBrains Mono, GSAP/Motion, FastAPI + SQLAlchemy + Alembic, SQLite local và worker NLP. Dùng stack đang có.

Đọc trước: `AGENTS.md`, `README.md`, `docs/DESIGN.md`, `docs/01-product/01-tam-nhin-va-nguoi-dung.md`, `02-hanh-trinh-nguoi-dung.md`, `03-tinh-nang-va-man-hinh.md`; `docs/02-data/` về dữ liệu/chuẩn hóa/thống kê; `docs/03-system/03-api-contract.md`; `apps/api/README.md`; `docs/05-delivery/09-khoi-phuc-ui-giay-2026-10-26.md` và `10-landing-scroll-brief.md`.

API contract thực tế phải đối chiếu `apps/api/app/api/routes.py`, schemas, services, models và OpenAPI. Backend và quy tắc dữ liệu là nguồn thật; mockup là tham khảo thiết kế.

### KusShoes, tham khảo cách xây sản phẩm
- GitHub đã xác minh: https://github.com/EXE-CAPSTONE-TEAM/KusShoes
- Local, chỉ đọc: `D:\DEMO kế hoạch kì 5\DEMO kế hoạch kì 5\TMG301\KusShoes`
- Có `FE` React/Vite và `BE` FastAPI/PostgreSQL, router/service/model, auth, admin, jobs, tests.
- Đọc `AGENTS.md`, `README.md`, `docs/DESIGN.md`, `docs/ADMIN_DESIGN_SYSTEM.md`, `docs/api-contract.md`, `docs/integration-runbook.md`, `FE/ADMIN_FE_BE_INTEGRATION.md`; rồi lần theo code cần thiết.

Chọn ba luồng và đọc xuyên FE tới BE: (1) đăng nhập/session/guard/role; (2) danh sách → lọc/phân trang → chi tiết → thao tác → lỗi; (3) tiến độ job hoặc vận hành admin. Với mỗi luồng, ghi đường dẫn code thật, điều đáng học, và cách áp dụng cho ReNER. Học cách tổ chức shell, form, bảng, lỗi, quyền, dữ liệu và feedback; không bê mô hình giày/3D, billing, subscription, credit, financial dashboard hay toàn bộ kiến trúc sang ReNER. Không sửa hay chạy migration trên KusShoes.

### Kho skill UI của người dùng
- GitHub riêng tư: https://github.com/VoDucNhatku/tong-hop-repo-hay
- Mirror đọc được: `D:\Downloads\claude-howto-research`
- Bài nhận xét: `web\<repo>\README.md`; source đã clone: `.sources\<repo>`. Dùng mirror local nếu GitHub không truy cập được.
- Xem metadata/nhận xét trước, chỉ đọc skill UI phù hợp theo giai đoạn; không cài cả kho và không đưa dependency chỉ vì skill nhắc tới.

Các ứng viên đúng ngữ cảnh: `.sources\emilkowalski-skills\skills\emil-design-eng\SKILL.md`, `animate\SKILL.md`, `animation-performance\SKILL.md`, `review-animations\SKILL.md`; `.sources\taste-skill\skills\taste-skill\SKILL.md`. Đọc có chọn lọc, tối đa vài skill một giai đoạn.

Skill local để thiết kế/xây/soát: `C:\Users\Asus\.codex\skills\design-web\SKILL.md`, `build-ui\SKILL.md`, `review-frontend\SKILL.md`. Thông báo ngắn khi bắt đầu dùng. Skill không được thay thế yêu cầu người dùng, nghiệp vụ ReNER, hay tạo các checkpoint xin phép lặp lại khi đã được ủy quyền. Thực sự áp dụng vào code và bằng chứng render, không chỉ liệt kê tên skill trong báo cáo.

## 3. Hai bộ ảnh, phải xem cả hai

### A. Mẫu giao diện Stitch
- ZIP gốc: `C:\Users\Asus\Downloads\stitch_rener_rental_intelligence_platform (10).zip`.
- Đã trích an toàn các trang vào `<workspace>\.tmp\stitch-10\`, mỗi thư mục có `screen.png` và `code.html`; có thêm `warm_analytical_clarity\DESIGN.md`.
- Có 11 màn: trang chủ, tìm trọ, chi tiết phòng, thị trường, phân tích bài đăng, đăng nhập, kho dữ liệu, hàng duyệt, duyệt một tin, Lab, đánh giá.
- Kiểm kê trước cho thấy ảnh trang 2, 8, 9, 11 chỉ 28 byte và không phải ảnh dùng được. Tự kiểm chứng lại; bỏ qua ảnh hỏng, có thể đọc HTML để hiểu ý tưởng nhưng không giả vờ đã xem ảnh. Các ảnh 1, 3, 4, 5, 6, 7, 10 phải mở xem thật, không đánh giá chỉ qua tên file.
- Báo cho người dùng từng màn: giữ ý gì, cần thay gì để khớp ReNER, thiếu trạng thái nào, ảnh nào cần gửi lại. Thiếu ảnh không chặn các phần đã đủ dữ kiện.

### B. 11 ảnh bài đăng và phòng trọ người dùng vừa cung cấp
- Bản sao nguyên trạng nằm trong `<workspace>\.tmp\rental-reference-photos\`; đọc `manifest.json` rồi mở đủ 11 ảnh. Đây là bộ khác với 11 màn Stitch.
- Các cặp 01–02, 03–04, 05–06, 07–08 lần lượt là screenshot bài đăng và ảnh phòng tương ứng; 09–11 là các tin có giá hashtag/nội dung ngắn hoặc bị cắt.
- Bộ này giúp hiểu đời sống trọ Việt Nam, nội dung và tỷ lệ ảnh, không phải danh mục phòng đã xác thực để nhập thẳng vào kho.
- Một số screenshot chứa thông tin liên hệ; không in lại, không commit, không đặt nguyên ảnh bài thật vào public, fixture hoặc ảnh demo công khai. Thư mục `.tmp` đã bị Git bỏ qua. Nếu cần dữ liệu demo, tự viết lại ví dụ ẩn danh có nhãn rõ. Không tự gán những ảnh này vào một listing API không liên quan.
- Không xây OCR/image understanding, hệ thu thập ảnh mới hay kho ảnh sản phẩm chỉ từ yêu cầu tham khảo này. Backend hiện trích chữ, không suy thông tin từ ảnh.

Những tình huống bắt buộc nhận ra từ ảnh:
1. Tin B08 có giá 5,2 triệu/tháng và nhiều khoản phí; diện tích không được ghi thì để thiếu. Có gác hoặc căn phòng trông rộng không chứng minh diện tích hay loại pháp lý.
2. Tin 4,7 triệu có phí theo người, theo phòng và một khoản điện hành lang thiếu đơn vị rõ; giữ đơn vị/độ chưa rõ theo luật hiện có, không gộp phí thành giá thuê.
3. Tin 6 triệu có điện, nước, dịch vụ, gửi xe; ngày trong nội dung không tự thành ngày đăng hoặc trạng thái còn phòng đã xác minh.
4. Tin 6,5 triệu có chiều cao gác 1,6m: đó không phải diện tích m². Cọc 1,5 tháng là cọc; nước m³ và nước nóng theo người không phải cùng khoản; dịch vụ đã gồm Wi-Fi không có nghĩa tự cộng thêm internet.
5. Giá kiểu hashtag `#3tr490k` hoặc `#1tr499k` phải theo quy tắc chuẩn hóa có sẵn; không tự thêm `/tháng/phòng` hay kết luận rẻ nếu bài không cho căn cứ.
6. “20P” quảng cáo nhiều phòng không phải 20 phòng ngủ và không cho phép sinh 20 listing giống nhau. “Xem thêm” hoặc screenshot bị cắt phải làm rõ mức độ thiếu nội dung.
7. Tiện ích, vật nuôi, PCCC và ngày trống do người đăng mô tả không được biến thành chứng nhận hoặc cam kết của ReNER.

## 4. Quyết định hướng giao diện

Ngôn ngữ: tiếng Việt tự nhiên. Cảm giác: phòng đọc sáng, giấy ấm, mực xanh rừng, nhãn bằng chứng có màu. Mượn từ KusShoes độ gọn, nhịp bố cục và hành vi nhất quán; phát triển một bản sắc ReNER riêng.

Kế thừa token đang có: paper `#f6f4ee`, ink `#172b25`, forest `#244b3c`, amber `#f2cd64`, muted `#59655b`, surface `#fffdf7`; giữ palette nhãn NER hiện có. Mở rộng có lý do trong một hệ token; không tạo một bảng màu thứ hai rải ở từng component.

Font là phần phải chăm thật: Be Vietnam Pro cho đọc, form và điều hướng; Newsreader dùng tiết chế cho tiêu đề trang/một điểm nhấn; JetBrains Mono cho ID, nhãn kỹ thuật và con số phù hợp. Kiểm tra dấu tiếng Việt, độ cao dòng, chữ nghiêng, số tiền và đơn vị ở kích thước thật. Tiêu đề trong app khoảng 28–36px, body 14–16px, bảng dày có thể 13px khi vẫn dễ đọc. Không dùng serif cho cả form/bảng, không tạo thêm nhiều font mới. Đo text wrap thay vì chỉ chọn font trông đẹp ở tiếng Anh.

Shell: sidebar khoảng 224–240px, header khoảng 56–64px, nội dung có nhịp khoảng cách rõ và vùng đọc vừa phải. Mobile chuyển thành điều hướng gọn/drawer và một cột, không ép cả bàn làm việc desktop xuống 390px. Sidebar phân rõ **Đọc tin** và **Không gian nhóm** theo quyền thật. Không mặc định đưa mọi người vào một bảng KPI giống nhau.

Điểm nhận diện chức năng: **Bản đọc tin**. Trên desktop, bố cục nối nguyên văn/bằng chứng → trường chuẩn hóa → ngữ cảnh so sánh. Chọn một trường thì thấy đúng đoạn trích và lý do; dữ liệu thiếu xuất hiện thành câu “Cần hỏi thêm” có căn cứ. Mobile dùng các vùng/tabs rõ ràng, không làm mất nguồn. Không biến sản phẩm thành một ô chat AI chung chung.

Một ý tưởng nhỏ được phép ưu tiên khi phần cốt lõi đã chắc: phiếu thông tin để sao chép giá/phí, phần chưa rõ, N và ngày dữ liệu dưới dạng văn bản có nguồn. Chỉ dùng dữ liệu hiện có, không sáng tác kết luận, không mở rộng backend thành mạng xã hội hoặc sàn đặt phòng.

Tránh các dấu hiệu giao diện làm qua loa: lưới card bo tròn giống nhau ở mọi trang, gradient tím/xanh mặc định, icon trang trí cạnh mọi dòng, glass/neon, số liệu giả, biểu đồ không trục, card doanh thu không liên quan, trang quá rỗng, nhãn “AI powered” thay cho thông tin hữu ích, placeholder thay cho label. Không dựng bản HTML độc lập rồi bỏ đó; xây trực tiếp trong app thật.

## 5. Sản phẩm phải có, theo thứ tự

### P0 — hành trình cá nhân hoàn chỉnh

**Đăng nhập `/dang-nhap`**: form account/password theo schema backend, label và autocomplete đúng, hiện/ẩn mật khẩu, pending khóa gửi lặp, lỗi có chỗ rõ, giữ đích quay lại với đường dẫn nội bộ đã kiểm tra. Thành công chuyển tới `/phan-tich` hoặc đích ban đầu. Dùng `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`; session cookie thật. Hết phiên và sai quyền là hai trạng thái riêng. Giai đoạn này dùng tài khoản được cấp/seed; chưa có API đăng ký/khôi phục mật khẩu thì không vẽ nút OAuth/register/reset giả.

**Phân tích `/phan-tich` và `/phan-tich/[id]`**: ô dán văn bản đủ lớn, đếm ký tự/giới hạn có căn cứ, bài mẫu tự tạo có nhãn, preview nội dung che liên hệ trước gửi. Không chỉ đặt `phone_masked=true` khi thực tế chưa che. Tạo analysis đúng schema/idempotency; mở trang ID thật. Hiện queued/running/succeeded/failed và kết quả một phần từ backend; polling có hủy khi rời trang, dừng ở terminal status và backoff hợp lý, không phần trăm giả. Kết quả gồm nguyên văn đã che, evidence tương tác, giá/phí/đơn vị, cảnh báo trường thiếu, nhóm so sánh nếu có và hành động đóng góp vào kho là lựa chọn rõ ràng, mặc định chưa đóng góp. Không gọi LLM từ browser.

**Tìm trọ/chi tiết**: giữ đầy đủ hành vi đang có ở `/tim-tro` và `/tin/[id]`, query nhiều giá trị, phân trang, back/reload và chế độ demo/kho thật. Chỉ điều chỉnh bề mặt cho hợp hệ trong nếu có lợi, không làm mất tính năng hoặc trộn dữ liệu. Không gắn ảnh phòng mẫu thành bằng chứng của một tin không có ảnh thật.

**Thị trường `/thi-truong`**: dùng `GET /market/summary`, bộ lọc và đơn vị rõ; trung vị/P25/P75/N/ngày dữ liệu/nhóm bị loại khi API có. Thiếu dữ liệu thì giải thích. Không thêm trend tăng giảm hoặc bản đồ khi API không có dữ liệu tương ứng. Biểu đồ phải có đơn vị/trục/mốc và một bảng đọc được bằng bàn phím; không chỉ truyền ý bằng màu. Nói rõ đây là giá chào thuê.

**Tài khoản `/tai-khoan`**: thông tin và vai trò từ `/auth/me`, đăng xuất; khu kết nối extension dùng đúng các endpoint token hiện có. Tạo token hiển thị bí mật đúng lần API trả về, sao chép có feedback, thu hồi có xác nhận và trạng thái lỗi thật. Không hiển thị lại token thô khi backend chỉ giữ hash. Chưa hoàn tất extension thật thì ghi đúng mức sẵn sàng.

### P1 — không gian nhóm làm được việc

**Kho `/team/kho`**: bảng bài, nguồn/thời điểm/trạng thái/cờ cần xem; chỉ tạo bộ lọc mà API nhận thật. Bộ lọc/phân trang đồng bộ URL. Mở một bài để xem ngữ cảnh, xử lý lại theo quyền và đọc kết quả API; xuất CSV/JSON theo endpoint/quyền researcher. Không thay mọi bảng bằng card lớn. Hành động hàng không vô tình kích hoạt khi chọn text.

**Hàng duyệt `/team/duyet` và `/team/duyet/[id]`**: lý do cần duyệt hiển thị trước; trái là bài gốc, phải là trường Regex/LLM/giá trị chọn, sửa và giải thích. Duyệt/loại/tách/gộp chỉ khi schema và backend thực sự hỗ trợ; không gửi payload tưởng tượng. Hủy không ghi dữ liệu; thao tác phá hủy có xác nhận, loại có lý do. Giữ `expected_version`, xử lý 409 bằng thông báo và tải lại so sánh, không ghi đè im lặng. Có cảnh báo rời trang khi còn chỉnh sửa chưa lưu.

**Lab `/team/lab`**: đọc được Regex/LLM/nhãn chuẩn cạnh nhau, legend nhất quán, chọn field/evidence có phản hồi; BIO hoặc bảng kỹ thuật nằm trong disclosure phù hợp. Tách kết quả không chạy/chưa có/lỗi khỏi kết quả rỗng đúng. Giữ khóa tập test, chỉ đọc gold khi API cho phép; không dùng nhãn test để chỉnh quy tắc/prompts.

**Đánh giá `/team/danh-gia`**: chọn run thật, P/R/F1 và các bảng/error links theo response hiện có, giữ nhãn đóng băng nếu có. Chưa có run thì là empty state hữu ích, không số liệu mẫu giả. Nếu một chi tiết thiếu endpoint, ghi gap chính xác và xây phần có thật trước.

Menu và API dùng quyền thực tế `renter`, `collector`, `reviewer`, `researcher`, `admin`; đọc `require_roles` trước khi suy cách admin kế thừa. Không dựng màn quản lý người dùng nếu backend không có API. Guard ở server/API; ẩn menu chỉ là UX. Kiểm quyền khi truy cập thẳng URL và khi gửi mutation.

### Chưa mở rộng trong đợt này

Đăng ký công khai/OAuth mới, thanh toán/gói thuê bao, chat với chủ nhà, đặt cọc/đặt phòng, OCR, scraping tự động, đề xuất AI không có nguồn, lịch sử cá nhân/favorite đồng bộ chưa có API, dashboard doanh thu và quảng cáo. Các ý tưởng này có thể ghi backlog ngắn, không xây để tăng số tính năng.

## 6. Chăm tương tác tới từng control

Trước khi nhân component ra các trang, dựng và xem thật một bộ nền: primary/secondary/destructive/icon button, text/password/textarea/select, chip lọc, tabs, row action, popover, drawer/dialog, inline error, toast và skeleton.

Với mỗi control, chốt và kiểm đủ default/hover/pressed/focus-visible/disabled/loading/success/error có liên quan. Mục tiêu là phản hồi rõ, yên, chính xác: hover khoảng 100–140ms, pressed tức thì và dịch/scale rất nhẹ nếu hợp; menu 140–180ms, drawer 180–220ms, đổi vùng nội dung khoảng 120–180ms và di chuyển không quá vài px. Đây là ngân sách khởi đầu để chỉnh theo cảm nhận thật, không bắt mọi thành phần chạy cùng một preset.

Không `transition: all`, không resize layout theo frame, không set React state mỗi frame, không animation chờ vô hạn ngoài trạng thái đang xử lý thật. Ưu tiên transform/opacity, easing có chủ đích; popover xuất phát từ đúng trigger, đảo/hủy chuyển động không giật, nội dung dài không nhảy. Loading giữ kích thước nút; double-click không tạo hai mutation. Animation phải giúp hiểu việc vừa xảy ra, không làm người dùng đợi mới bấm được.

Dialog/drawer: quản lý focus, Escape, trap focus khi modal, trả focus, nhãn accessible; menu đóng khi chọn. Toast không thay thế lỗi tại field; trạng thái success chỉ xuất hiện sau thành công thực. Reduced motion giữ đầy đủ thông tin và thao tác, giảm/bỏ chuyển động không cần thiết. Hover không là cách duy nhất để lộ hành động. Kiểm trên bàn phím và touch.

Lập bảng interaction contract: nút/điều khiển → trigger → kết quả → endpoint/hoặc hành vi local → quyền → pending/lỗi → cách kiểm. Không còn control bấm không làm gì hoặc link `#` giả. Nếu capability chưa có, dùng mô tả rõ thay cho một nút đánh lừa.

## 7. Hợp đồng dữ liệu và auth không được phá

Các luật trong `AGENTS.md` và `docs/02-data` thắng. Thiếu là null kèm lý do, không 0; không nhân giá theo người; không cộng rent + fee thành tổng; không tự quy đổi giá “từ”/khoảng thành một số; N < 10 chưa kết luận; cùng basis/nhóm/điều kiện; không tự tính lại thống kê trong browser. Offset evidence là Unicode code point trên text đã che. Giữ data-is-demo và các timestamp nullable. Nhận định trung tính, không khẳng định phòng còn trống hoặc khuyên phải thuê.

Mọi trang có loading/empty/error/success, 401/403 khi có quyền, và trạng thái một phần/chưa đủ dữ liệu khi phù hợp. Type từ OpenAPI, tiền integer đồng; không dùng index làm ID hay fake ID để nối một màn thật.

Thiết kế đường gọi API cùng origin cho browser nếu phù hợp Next: kiểm proxy/rewrite hoặc BFF hẹp, cookie HttpOnly/Secure/SameSite/Path, forward Cookie/Set-Cookie đúng, CSRF/origin cho mutation và CORS nếu tách domain. Không chuyển session sang localStorage cho tiện. Không cache dữ liệu private giữa người dùng; logout phải xóa trạng thái và cache phù hợp. Chưa có threat model hợp lý thì chưa thêm proxy tổng quát nhận URL tùy ý.

Không in secret/mật khẩu/token/chuỗi kết nối đầy đủ vào log hoặc screenshot. Gemini key chỉ ở môi trường worker, tuyệt đối không vào `NEXT_PUBLIC_*`, bundle, client request hoặc commit.

## 8. Vercel + database miễn phí: định hướng và việc phải thẩm định

Người dùng muốn bắt đầu bằng chi phí hạ tầng $0. Hướng ưu tiên: **Next.js trên Vercel Hobby + FastAPI theo adapter chính thức + Neon Postgres Free + worker NLP được triển khai tách bạch**. Đây là mục tiêu kiến trúc, chưa phải hạ tầng đã được cấp tài khoản/khởi tạo/deploy.

Đã kiểm tra nguồn chính thức ngày 26/10/2026; khi triển khai phải kiểm tra lại:
- Vercel FastAPI trở thành một Function: https://vercel.com/docs/frameworks/backend/fastapi
- Hobby dành cho cá nhân, phi thương mại, có quota: https://vercel.com/docs/plans/hobby
- Python/Node Function trên Hobby với Fluid hiện tối đa 300 giây: https://vercel.com/docs/functions/limitations
- Neon Free hiện công bố 1 GB/project và 100 CU-hours/project/tháng, có scale-to-zero: https://neon.com/pricing ; https://neon.com/blog/neon-free-plan-1-gb-per-project
- Vercel Daemons đã public beta, có cả Hobby: https://vercel.com/docs/daemons ; https://vercel.com/changelog/vercel-daemons-is-now-in-public-beta
- Quota/giới hạn daemon: https://vercel.com/docs/daemons/limits . Hiện Hobby có 5 Active CPU-hours/tháng, storage tạm, chỉ production; project đặt root vào subfolder như `apps/web` chưa gắn daemon được. Không suy “free” nghĩa là không giới hạn hay preview cũng chạy worker.
- Cron Hobby hiện mỗi job chỉ chạy hằng ngày, không dùng để giả làm hàng xử lý tức thì: https://vercel.com/docs/cron-jobs/usage-and-pricing

Backend hiện đã có SQLAlchemy và Alembic, nhưng dependency hiện chưa có Postgres driver. Không kết luận chỉ sửa DATABASE_URL là đã xong. Lập gap list: driver, URL TLS/connection pooling, migration trên DB scratch, JSON/date/constraints/indexes, transaction và job-claim concurrency, seed/demo separation, rollback và kiểm tra parity với SQLite. Không di chuyển database hiện tại hoặc ghi vào cloud production trong nhiệm vụ UI này.

Worker hiện là `python -m app.worker.run`, có vòng lặp claim job và `--once`. Đánh giá ưu tiên chạy worker này bằng một daemon nhỏ cùng Neon, riêng môi trường secret; chọn cấu trúc root/deployment đúng điều kiện beta. Không thay bằng BackgroundTasks không đảm bảo, request tự gọi chính nó, Cron mỗi phút trên Hobby, hoặc browser phải giữ tab để chạy job. Nếu beta/account/quota không phù hợp, giữ phương án demo worker local được ghi rõ, hoặc đề xuất một cơ chế durable thực sự đã kiểm tra free tier; không gắn nhãn hosted hoàn chỉnh khi laptop còn phải bật.

Quan trọng với Neon: worker poll DB liên tục có thể giữ compute thức và ăn ngân sách compute dù không có tin. Đo chu kỳ poll/idle, backoff hoặc lịch chạy theo phiên demo; nêu tradeoff độ trễ và chi phí, không hứa scale-to-zero trong khi cứ query mỗi vài giây. App serverless cũng phải giới hạn connection pool và đóng transaction đúng cách.

Tài liệu deployment cần sơ đồ web/API/worker/DB, topology root/đa project khi cần, env chỉ tên biến, migration/backup/restore, hạn mức và cách biết gần vượt, cách dừng worker, cold start, quota LLM tách khỏi hosting. Hạ tầng miễn phí không có nghĩa Gemini/LLM chắc chắn miễn phí. Chỉ chuẩn bị cấu hình và hướng dẫn có thể review; chưa tạo dịch vụ cloud, đổi DNS, deploy/push/migrate hay bật dịch vụ tính phí nếu người dùng chưa yêu cầu hành động đó.

## 9. Cách làm và sản phẩm bàn giao

### Giai đoạn A — hiểu và chốt plan
1. Kiểm workspace/branch/chỉnh sửa cũ và đọc tài liệu ReNER cần thiết.
2. Khảo sát ba luồng KusShoes, đối chiếu từng pattern sẽ dùng.
3. Xem ảnh Stitch hợp lệ và toàn bộ bộ ảnh phòng; lập bảng match/gap.
4. Đọc skill UI chọn lọc, chốt token/type/motion và bố cục đặc trưng.
5. Viết plan sản phẩm gồm sitemap, flow sau login theo role, phạm vi P0/P1/backlog, bảng màn–endpoint–quyền–state, interaction contract, danh sách API có sẵn/thiếu, thứ tự vertical slice và tiêu chí nghiệm thu.
6. Viết ngắn trong chat hướng đã chọn và phần đang làm tiếp, rồi thực thi local theo plan. Không dừng chỉ ở moodboard hoặc danh sách ý tưởng.

### Giai đoạn B — triển khai từng luồng hoàn chỉnh
Auth + shell → phân tích/kết quả → thị trường + account/token → kho/hàng duyệt → Lab/đánh giá → polish. Mỗi luồng phải đi từ giao diện tới API và trở về đầy đủ trạng thái, không xây hết các màn tĩnh rồi mới nối backend. Chỉ bổ sung backend nhỏ khi thực sự cần nối capability đã có; thay đổi nghiệp vụ/API lớn phải được mô tả riêng trước.

Bảo vệ các preview đang chạy: không khởi động dev và production cùng dùng một `.next`. Dùng cổng dev riêng, ví dụ 3003, với output dir riêng hoặc workspace snapshot giữ đủ thay đổi chưa commit. Nếu cần thay config distDir để hỗ trợ, làm tối thiểu và giải thích. Không giết toàn bộ node/python. Backend/test data của bạn nên tách để không làm hỏng kho demo hiện tại.

### Giai đoạn C — kiểm bằng sản phẩm thật
- Typecheck/build và test hiện có phù hợp; thêm test có giá trị cho auth guard, session/logout, API errors, polling/idempotency, quyền, review 409 và mutation, URL state và evidence Unicode. Không viết test chỉ chép lại CSS.
- Render và chụp screenshot thật ở 1440/1024/768/390/360, mở ảnh xem; thêm trạng thái focus/hover/open/pending/error/empty và nội dung dài. Không chỉ dựa vào build xanh.
- Đo contrast trên bề mặt thực: body ≥ 4.5, chữ lớn/control boundary ≥ 3. Dùng tool/script đo và xử lý phát hiện.
- Kiểm keyboard, focus, Escape, reduced motion, touch, overflow, dấu tiếng Việt và số tiền/đơn vị dài. Không pageerror/hydration mismatch.
- Kiểm privacy: không secret/contact thật trong public, log, fixture, snapshot công khai; không dữ liệu thật vào Git.
- Trình bày giới hạn chính xác: mobile viewport giả lập không phải đã test điện thoại thật; chưa test Safari thì nói vậy. Không chạy Gemini tốn phí để chụp màn cho đẹp.

Các artifact cần có, viết ngắn nhưng dùng được, paths tính từ workspace:
1. `docs/05-delivery/12-interior-product-plan.md`: plan sản phẩm, sitemap/roles, API matrix, interaction contract, slices và tiêu chí xong.
2. `docs/05-delivery/13-kusshoes-patterns.md`: pattern đã đọc, nguồn file thật và cách áp dụng có chọn lọc.
3. `docs/05-delivery/14-interior-reference-audit.md`: ảnh hợp/hỏng, giữ/chỉnh/thiếu gì; phân biệt UI Stitch với ảnh đời thực.
4. Cập nhật `docs/DESIGN.md` cho khu trong, không xóa lịch sử landing.
5. `docs/05-delivery/15-vercel-neon-plan.md`: phương án free tier, worker/pooling/idle, gaps, nguồn chính thức và checklist đưa lên cloud.
6. `docs/05-delivery/16-interior-delivery.md`: các luồng đã làm, file chính, cách chạy, tài khoản test chỉ hướng dẫn an toàn, kiểm thử thực tế và giới hạn.

Khi báo tiến độ, tập trung vào điều đã thấy, quyết định và việc tiếp theo; giữ cuộc chat bằng tiếng Việt và cho người dùng sửa hướng. Khi giao, mở link preview thật, chỉ ra những điều hoạt động được và những gì chưa hoàn tất. Không gọi một bộ trang có nút giả hoặc chưa có quyền thật là sản phẩm hoàn chỉnh.
