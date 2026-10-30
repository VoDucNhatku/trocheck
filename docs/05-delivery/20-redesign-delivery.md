# Bàn giao thiết kế lại khu trong và đăng ký ReNER

Ngày 27/10/2026, Codex số3. Nhánh `codex/restore-paper-ui`, HEAD `7152eac`; chưa commit/push/deploy.
Preview local: `http://127.0.0.1:3011/dang-nhap`, đăng ký tại `/dang-ky`. API test riêng18004, SQLite tạm,
worker Regex-only. Có thể tự tạo tài khoản renter để xem luồng người thuê; quyền nhóm vẫn do server kiểm.

## Thay đổi và lý do

Đã khám phá ba hướng thật cho auth, Reading và Review qua picker trên route tạm. Chọn **Sân nhà**, **Phiếu đọc**,
**Bảng đối chiếu**; lý do chọn và loại từng hướng trong [19-redesign-plan.md](19-redesign-plan.md).
Route/picker/bản thua đã gỡ khỏi src. Bản lưu chỉ ở `.tmp/redesign-prototype-source`.

| Màn | Câu trả lời chính / thay đổi |
|---|---|
| Đăng nhập/đăng ký | Form trái, ảnh sân nhà có caption phải; đăng ký thật, lỗi đúng trường, hiện mật khẩu, điều khoản, pending, safe return. Mobile ưu tiên form |
| Phân tích | Vùng dán bài là khối chính; xác nhận đã dán đủ bài và quyền riêng tư sát hành động; phần hướng dẫn nhẹ hơn |
| Bản đọc tin | Giá thuê lớn; phí giữ đơn vị, cọc riêng; nguyên văn cạnh kết quả; câu hỏi còn thiếu sao chép được; thước P25/median/P75 từ API chỉ khi đủ điều kiện |
| Duyệt tin | Lý do ở đầu, nguồn toàn chiều ngang, bảng Regex/LLM/giá trị chọn; editor mở theo trường; quyết định sticky, một primary; giữ draft/409/merge/split/confirm |
| Shell | Sidebar216px; account popover có vai trò/tài khoản/đăng xuất thật; Escape/trả focus, outside/tab-out; drawer mobile |
| Thị trường | Thanh ngang theo nhóm có trục, đơn vị, N và nguồn; bảng phân vị vẫn đầy đủ; frontend không tính lại median |
| Tài khoản | Danh tính riêng với kết nối; danh sách kết nối phẳng, token chỉ hiện một lần và thu hồi có xác nhận |
| Kho/hàng duyệt | Tổng từ API, bảng phẳng, lý do và đoạn bài dẫn nhịp; chưa có dữ liệu khác không khớp bộ lọc; phân trang server |
| Lab/Đánh giá | Các phần có đường kẻ thay panel lồng; bảng bằng chứng/BIO/metric đầy đủ; đồ thị strict micro-F1 có trục0–100%, không vẽ khi metric thiếu |

Giữ giấy ngà, xanh rừng, vàng và font hiện có. Học kỷ luật của KusShoes, khoảng trắng/ảnh của Cosmos, nhịp giá-phí-cọc
của11 bài trọ, phân cấp giá của Stitch; không chép thương hiệu hoặc số liệu mẫu. Nguồn web và ứng dụng cụ thể trong19;
bảng chuẩn KusShoes tại [18-kusshoes-standard.md](18-kusshoes-standard.md).

## File thay đổi

Các đường dẫn dưới đây tương đối từ repo root; các nhóm liệt kê đủ file của đợt này.

| Nhóm | File |
|---|---|
| API đăng ký | `apps/api/app/api/routes.py`, `app/core/config.py`, `app/core/registration_limit.py` (mới), `app/main.py`, `app/schemas/__init__.py`, `app/services/users.py` — các đường dẫn `app/` trong nhóm này thuộc `apps/api/` |
| Test API | `apps/api/tests/test_registration.py` (mới) |
| Auth web/BFF types | `apps/web/src/app/dang-ky/page.tsx` (mới), `apps/web/src/features/workspace/Login.tsx`, `auth.module.css` (mới, cùng thư mục); `apps/web/src/lib/workspace/safe-path.ts`, `apps/web/src/lib/api/generated.ts` |
| Workspace | `apps/web/src/features/workspace/{Account,Analyze,Evaluation,Lab,Market,Reading,ReviewDetail,Shell,Team,ui}.tsx`; `workspace.module.css`, `research.module.css` cùng thư mục |
| Token | `apps/web/src/styles/tokens.css` — chỉ thêm radius dưới `[data-workspace]` |
| Browser tests | `apps/web/playwright.interior.config.ts`; `apps/web/tests/browser/{interior,public,stitch}.spec.ts`; `apps/web/tests/browser/redesign.spec.ts` (mới). Public/stitch chỉ cho phép API test qua biến môi trường |
| Capture helpers | `apps/web/scripts/redesign-auth.mjs`, `apps/web/scripts/redesign-pages.mjs` (mới; dùng demo API/credential tạm, không in bí mật) |
| Tài liệu | `docs/DESIGN.md`, `docs/03-system/03-api-contract.md`, `docs/05-delivery/{18-kusshoes-standard,19-redesign-plan,20-redesign-delivery,21-skill-log}.md` |
| Ignore | `.gitignore`: `.taste-skill/` |

Không sửa source landing/public, package/dependency, migration, dữ liệu chuẩn hay pipeline.
`CLAUDE-HANDOFF-2026-10-26.md` có sẵn từ trước, không thuộc thay đổi này.
Config public tạm và các include do Next tự thêm đã được dọn sau kiểm.

## Kiểm bằng lệnh

Web chạy từ `apps/web`; backend từ `apps/api`. Chrome cài trên máy (`PW_CHANNEL=chrome`).
Không dùng các cổng3000–3009/18000–18003; kiểm public riêng3012/18005.

| Lệnh / cấu hình | Kết quả quan sát |
|---|---|
| `npm run generate:api` | Thành công, generated.ts có RegisterRequest và auth/register |
| `RENER_DIST_DIR=.next-codex3-prod`, API_BASE_URL tới18004; `npm run build` | Exit0, compiled/types/static pages thành công; có `/dang-ky`, không có prototype route |
| `npm run typecheck` | Exit0, `tsc --noEmit` không lỗi |
| `npm run test:integration` |4tests,4pass,0fail |
| `.venv/Scripts/python.exe -m pytest -q` |265 ca tới100%, exit0;16 ca đăng ký gồm trong tổng này |
| `.venv/Scripts/lint-imports.exe` |89files,314dependencies; `Contracts: 3 kept, 0 broken` |
| `apps/api/.venv/Scripts/python.exe spec/tools/check_fixtures.py` từ root | `7/7 fixtures passed` |
| `npx playwright test -c playwright.interior.config.ts`, INTERIOR_WEB3011, INTERIOR_API18004 |17passed; quyền/cookie/đăng ký, các thao tác duyệt thật, keyboard, pending, lỗi, responsive/worst-case |
| `npx playwright test -c playwright.research.config.ts`, RESEARCH_WEB3011, RESEARCH_API18004/api/v1 |14passed (2.0m); Regex thật, gold lock, metric/null, API error/retry,401/403 |
| Public config tạm: public/housing-scene/stitch, production riêng3012/API18005 |16passed (4.1m); filter, source/evidence, comparison, landing scroll, mobile, reduced motion, contrast |
| `node scripts/redesign-pages.mjs`, INTERIOR_WEB3011, REDESIGN_ROUND=final |55 ảnh:11 màn ×5 widths; `overflow:false` tất cả; `errors:[]` |
| `node .tmp/redesign-contrast.mjs` |24pairs, failures=[]; textmin5.0529, controlmin3.3617 |
| `node .tmp/inspect-all.mjs` |11 màn ×1440/768/390;0FAIL từng màn; bảng WARN bên dưới |
| `node .tmp/redesign-ruler-check.mjs` |Thước giá render ở1440/768/390, không overflow; N13, P25=2.700.000, median=3.100.000, P75=3.300.000 lấy nguyên từ demo API |
| `git diff --check` |Không whitespace error; Git có cảnh báo chính sách LF/CRLF trên một số file |

Các lỗi trung gian đã xử lý, không che khỏi bàn giao:

- Test đăng ký409 phát hiện focus chạy trước lúc input được mở lại: thay RAF bằng effect theo fields/busy, test pass.
- Next từng giữ generated type của route prototype đã xóa: dọn đúng file type tạm đó, build lại thành công.
- Preview public cũ giữ manifest CSS sau rebuild nên một lượt7fail/9pass; xác nhận CSS400, khởi động lại đúng preview
  do Codex mở, chạy lại16/16pass. Windows teardown của webServer có lúc chờ tiến trình con; dừng đúng PID preview/API
  tự mở sau16 dòngok để Playwright kết thúc và in summary. Không dừng server của người khác.
- Một lượt research13pass/1fail do chưa rời Lab trong5 giây sau click Đánh giá khi nhiều browser kiểm đồng thời.
  Cùng test/code chạy riêng1/1pass, rồi cả bộ14/14pass; không nới assertion hoặc xóa test. Vẫn có rủi ro flaky trên máy bận.
- Native CDP inspector timeout Page.enable; dùng bridge transport đã nêu trong21, không sửa probe/rule.
- Pytest có Starlette/httpx deprecation warning sẵn có; không đổi dependency trong đợt thiết kế.

## Ảnh đã mở xem và hai vòng tự phê bình

Gốc ảnh: `.tmp/redesign-shots/`. Trước sửa đã giữ bản sao trong `before/` để test sau không ghi đè bằng chứng.
Đã mở contact trước ở desktop/tablet/mobile, các ảnh đối chiếu nguồn Cosmos/Stitch và11 ảnh trọ theo đề bài.

| Giai đoạn | Ảnh đã mở xem |
|---|---|
| Trước | `before/codex2-{desktop,tablet,mobile,modal}-contact.png`; login/reading/review/market/account/store/queue1440/768/390 qua contact; Analyze trước riêng; Lab/Evaluation trước trong research-shots đã sao lưu |
| Prototype | `auth-prototype-{1,2,3}-1440.png`, `register-prototype-1-1440.png`; `workbench-prototypes-contact.png` chứa3 Reading và3 Review |
| Vòng1 | `round1-contact-{1440,768,390}.png`; `reading-round1-1440.png`, `review-round1-1440.png`, `register-round1-{1440,390}.png` |
| Vòng2 | `reading-round2-1440.png`, `review-round2-1440.png`, `register-round2-390.png` |
| Cuối | `final-contact-{1440,768,390}.png` chứa đủ11 màn; `reading-final-1440.png`, `review-final-768.png`, `register-final-390.png`; contact từ các inspector fold |
| Trạng thái | `auth-pending-final.png`, `auth-duplicate-final.png`, `account-menu-final-390.png`; review conflict/unsaved/required/error/pending trong interior-shots; Lab result và evaluation contract-run trong research-shots |

Các file `*-final-{1440,1024,768,390,360}.png` là ảnh full page; contact chỉ ghép viewport đầu để so nhịp.
Ảnh screenshot toolbar sticky có thể nằm giữa ảnh full-page vì vị trí đáy viewport; cuộn tiếp vẫn đọc được toàn bộ hàng.
`reading-demo-ruler-{1440,768,390}.png` kiểm nhánh đủ mẫu: mount một listing demo sẵn có vào response analysis chỉ
trong browser, giữ nguyên text/evidence/quantile từ API, không ghi DB. Đã mở ảnh/crop thước giá và `states-contact.png`.

### Ba điểm yếu mỗi vòng của các màn chính

| Màn/vòng | Ba điểm yếu phát hiện | Sửa và kết quả |
|---|---|---|
| Auth1 | Checkbox bị kéo theo kích thước input; đăng ký có khoảng trên quá lớn; tiêu đề/helper chưa cân | Input selector loại checkbox, checkbox20 trong label44; class register riêng thay id trong CSS Modules; giảm weight, căn lại form |
| Auth2 | Helper nhỏ; h1phone lớn; focus409/vùng chạm hiện mật khẩu chưa đạt | Helper13px/h1phone28; effect trả focus sau busy; eye44px. Form giữ kích thước pending và username30 được kiểm |
| Reading1 | Giá chưa dẫn mắt; phí/cọc giống dòng metadata; cột nguồn ngắn bỏ khoảng lớn | Giá36px/28phone, feesgrid và cọc riêng; Cần hỏi thêm nằm dưới nguồn, có copy |
| Reading2 | Click evidence trên phone khó tìm nguồn; thiếu evidence vẫn trông bấm được; số tiền dài cần ưu tiên | Chọn trường scroll/focus nguồn; disabled/no arrow khi không evidence; sốexact đầy đủ VND, kiểm12.500.000/range/null |
| Review1 | Panel lặp dài; editor và giải thích lệch hàng; quyết định ở cuối | Bảng4cột, editor details/giải thích hàng2; toolbar sticky |
| Review2 | Reject cạnh tranh primary; control chưa thống nhất; active nav giả elevation | Reject outline, primary chỉ chấp nhận; control44; nav active border-left thay shadow.409/draft/confirm giữ đủ |

### Các màn còn lại: ba vấn đề đã xử lý

| Màn | Vấn đề → sửa |
|---|---|
| Shell | Sidebar nặng →216px/nền giấy; tài khoản không có nhóm thao tác →popover; phone chật →drawer/focus |
| Analyze | Hai cột ngang vai →editor lớn; panel hướng dẫn cạnh tranh →section ruled; chữ đệm/eyebrow lặp →bỏ eyebrow |
| Market | Bảng số khó scan →bar plot; thiếu nhịp giữa lọc/dữ liệu →nguồn và N sát chart; số lệch →căn phải |
| Account | Các card giống nhau →profile/connection tách; ledger bị bọc nhiều →phẳng; empty thừa padding →giảm28 |
| Store | Không rõ quy mô →countAPI; panel nặng →flat table; rỗng/lọc không khớp lẫn nhau →copy/action riêng |
| Queue | Lý do chìm →cột dẫn; tổng khó thấy →headlineAPI; phone bảng khó đọc →hàng dọc và giữ paging |
| Lab | Panel lồng →ruled sections; chú thích tranh chỗ nhập →aside nhẹ; mobile chật →stack theo tác vụ |
| Evaluation | Metric chỉ là bảng →strict micro-F1plot; phần cùng trọng lượng →section rules; chưa có run thiếu định hướng →empty có link Lab thật |

Tự chấm trên ảnh, theo design40%/usability30%/creativity20%/content10%, có điều chỉnh app-screens:

| Nhóm | Design | Usability | Creativity | Content | Tổng |
|---|---:|---:|---:|---:|---:|
| Auth |8|8|7|8|7.8|
| Reading |8|8|8|8|8.0|
| Review |7.5|8|7.5|8|7.7|
| Các màn dữ liệu |7.5|8|7|8|7.6|

Đây là tự đánh giá, không phải chứng nhận hay đánh giá người dùng. Điểm yếu còn lại: Reading nguồn ngắn vẫn lệch chiều
cao hai cột; Review mobile phải cuộn nhiều khi mở editor; màn Kho có bộ lọc dài trước dữ liệu trên điện thoại.

## Contrast và inspector

`contrast-final.json` lấy computed tokens từ trang đang render:24 cặp gồm normal/hover/active, cảnh báo/lỗi và control.
Chữ thấp nhất5.0529:1, viền3.3617:1. Primary9.6172:1; evidence labels9.9592–11.8206:1, opacity1, từ browser tests
và `.tmp/research-shots/contrast.json` (20 cặp). Không tuyên bố đã đo mọi tổ hợp pixel của ảnh minh họa.

| Màn | FAIL | WARN |
|---|---:|---:|
| Login |0|3|
| Register |0|3|
| Analyze |0|3|
| Reading |0|2|
| Review |0|1|
| Market |0|1|
| Account |0|2|
| Store |0|1|
| Queue |0|1|
| Lab |0|1|
| Evaluation |0|2|

Output đầy đủ: `.tmp/redesign-shots/inspect/<name>/output.txt`, report.json và ảnh desktop/tablet/mobile.
Inspector chạy nguyên probes/rules qua Chrome/CDP bridge, có `--allow emoji` cho **nội dung nguồn** cần bảo toàn.

- `palette-cream`: giữ theo thương hiệu/yêu cầu người dùng; contrast đã đo.
- `colour-sprawl` ở auth: màu nằm trong ảnh minh họa sân nhà, không phải màu control/status cạnh tranh nhau.
- `mixed-font-headline` ở authphone: report nhận logo link `ReNER VN` là heading; ReNER và VN có hai font thương hiệu.
  H1 thực tế chỉ Newsreader, không trộn font giữa câu.
- `ragged-row` ở Reading/Analyze/Account: hai phần khác nhiệm vụ và lượng dữ liệu; không kéo cao khung rỗng để giả cân.
  Reading đã chuyển câu hỏi sang cột nguồn; nguồn dài vẫn chảy tự nhiên.
- `panel-void` Analyze: khoảng nghỉ45px trong guide; vùng nhập300px để dán bài thật, không lấp bằng số/ảnh giả.
- `hero-void` Evaluation: API chưa có run; màn trống có hướng dẫn/đường đi thật. Không vẽ metric giả để lấp chỗ.

Inspector đôi khi báo button token gốc `#2337c6` trong phần tổng hợp; control trong `[data-workspace]` dùng forest
`#244b3c`, được kiểm bằng computed tokens/ảnh. Không lấy màu tổng hợp đó làm bằng chứng contrast.

## Bảo mật, giới hạn và việc chưa kiểm

Đăng ký luôn renter, schema từ chối extra roles; usernameASCII3–30; mật khẩu8–200 Unicode code points, có uppercase
và decimal digit; confirm khớp, accept_terms booleanstrict true.409 có code `username_taken`, không ghi đè user cũ;
uniqueconstraint bảo vệ race. Dùng hash/session sẵn có, HttpOnly/SameSite=Lax, Secure theo cấu hình. Lỗi không echo
mật khẩu. BFF allowlist chỉ thêm auth/register và giữ origin check/safe return. Không thêm schema DB/migration.

Rate limit mặc định10 lần thử/600giây: đủ cho sửa form ở demo, hạn chế tạo lặp; tính cả payload invalid.
Bounded10000 peerIP, có Retry-After, mutex. **Giới hạn theo transport peer, trong một process**; không tin XFF tự gửi.
Khi đi qua Next BFF, các trình duyệt dùng chung IP của BFF. Restart xóa cửa sổ; nhiều worker không chia sẻ bộ đếm.
Đây là giới hạn demo local, chưa phải rate limiter phân tán cho môi trường triển khai.

Chưa kiểm Safari/Firefox/Edge, điện thoại thật/bàn phím ảo/screen reader thật; chưa load-test nhiều worker hoặc
race đăng ký đồng thời ở quy mô lớn. Không gọi Gemini; LLM cached/missing và evaluation có dữ liệu được kiểm bằng
response đúng contract trong browser test, không tuyên bố đã chạy một benchmark mô hình mới. Test-split gold không
dùng để tune hoặc prompt. Ảnh trọ thật không ra khỏi `.tmp`, không có secret/env/data thật mới trong thay đổi.

Không có OAuth/OTP/reset password/onboarding lưu sở thích, chat/đặt phòng/thanh toán; không tạo link/nút giả.
Nhật ký áp dụng và ngoại lệ skill: [21-skill-log.md](21-skill-log.md).
