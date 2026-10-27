# Lab và Đánh giá — bàn giao Codex

## Phạm vi và luồng

- `/team/lab` và `/team/danh-gia` dùng `requireUser(path, ['researcher'])` ở server. Admin kế thừa qua `hasRole`; người thiếu vai trò nhận `<Forbidden />` theo mẫu Kho. API kiểm quyền riêng và trả HTTP 401/403. HTML Forbidden hiện trả HTTP 200 theo mẫu Kho; API trả 403. Không coi thông báo Forbidden là bằng chứng HTML có status 403.
- Lab nhận văn bản hoặc `post_id`, gọi `POST /lab/run`. Ba cột Regex / LLM / nhãn chuẩn dùng cùng legend PRICE, AREA, LOC, ROOM, FEE. Chọn trường hoặc đoạn trích cập nhật highlight và thông báo; offset dùng Unicode code point qua highlighter dùng chung. Giá trị hiển thị từ extraction, giá thuê và phí riêng; không nhân giá/người hay tính thống kê.
- `GET /lab/gold/{post_id}` chỉ được gọi với bài có ID và `split != test`; gold chỉ hiển thị sau response cho phép. Response 404 là chưa có nhãn; 403 là bị khóa/không được đọc; lỗi khác có thử lại riêng. Split test chặn cả evidence, giá trị và BIO gold, kể cả nếu response Lab chứa dữ liệu gold.
- LLM chỉ có sẵn khi `rows.llm.available === true`; không gọi Gemini. Chưa chạy Lab, chưa có LLM, lỗi và chạy xong với span/listing rỗng là các trạng thái khác nhau. BIO và chuỗi chuẩn hóa kỹ thuật nằm trong disclosure.
- Đánh giá đọc `GET /eval/runs` rồi `GET /eval/runs/{run_id}`. Hiện manifest, frozen, P/R/F1 strict micro, bảng strict/partial từng nhãn, tỉ lệ chuẩn hóa/để trống kèm n, nhầm giá–phí và `error_counts`. Không tính lại chỉ số; số 0 khác null. Chuyển run hủy request cũ và không giữ chỉ số của run trước.
- Khi không có run: thông báo chưa có cơ sở hiển thị chỉ số, hướng dẫn chạy đánh giá dev và link Lab. Metrics null, metrics rỗng, lỗi tải danh sách/chi tiết, 401/403 được phân biệt. Dữ liệu riêng tư dùng client BFF hiện có, không cache và không lưu session vào localStorage.

## Thiết kế và giới hạn API

Kế thừa token khu làm việc: giấy `--paper`, bề mặt `--surface`, mực `--ink`, xanh rừng `--accent`, vàng `--amber`, năm màu nhãn sẵn có. Be Vietnam Pro cho nội dung, Newsreader chỉ tiêu đề Intro, JetBrains Mono cho ID/offset/số liệu. Không palette mới, biểu đồ, animation mới hoặc `transition: all`. Bảng hẹp có vùng cuộn ngang được đặt tên và focus bằng bàn phím.

Đã mở xem ảnh Lab Stitch hợp lệ; HTML hai màn chỉ được tham khảo cấu trúc. Không dùng số liệu, tên mô hình PhoBERT, checkpoint, tài khoản hoặc nhãn test từ mockup. PNG Đánh giá hỏng nên chỉ đọc HTML theo brief.

API hiện không có danh sách bài/gold dành riêng cho researcher, nên Lab nhận mã bài nhập vào thay vì dựng danh sách lựa chọn giả. Không có endpoint đọc từng dòng lỗi, liên kết bài lỗi hay tải báo cáo đánh giá. `error_counts = []` không phân biệt thiếu errors.csv và tệp không có lỗi; UI nói rõ giới hạn này. Tất cả metadata runner còn lại được giữ trong disclosure manifest/metrics gốc.

## File tạo mới

1. `apps/web/src/app/(workspace)/team/lab/page.tsx`
2. `apps/web/src/app/(workspace)/team/danh-gia/page.tsx`
3. `apps/web/src/features/workspace/Lab.tsx`
4. `apps/web/src/features/workspace/Evaluation.tsx`
5. `apps/web/src/features/workspace/research.module.css`
6. `apps/web/tests/browser/research.spec.ts`
7. `apps/web/playwright.research.config.ts`
8. Tài liệu này.

Không sửa shared UI, types, BFF hoặc backend. Ngoại lệ đã được người dùng cho phép trong chat: khi chạy dev, Next tự thêm duy nhất `.next-codex/types/**/*.ts` vào `include` của `apps/web/tsconfig.json`; kiểm JSON xác nhận không mất include cũ và không đổi thiết lập khác. Không commit, push, deploy hay gọi Gemini.

## Kiểm chứng ngày 27/10/2026

- Web dev riêng: `RENER_DIST_DIR=.next-codex`, `API_BASE_URL=http://127.0.0.1:18003/api/v1`, cổng **3006**. Giữ nguyên API đang chạy, không khởi động lại hoặc đổi DB/mật khẩu. Không cần fallback production.
- `npm run typecheck`: **exit 0**, output `tsc --noEmit`, chạy lại sau khi sửa test.
- PowerShell: `$env:PW_CHANNEL = 'chrome'; npx.cmd playwright test --config playwright.research.config.ts`: **exit 0, `14 passed (37.7s)`**, một worker, Chrome đã cài trên máy.
- Lượt đầu: 11 đạt, 3 lỗi do assertion test. Đã đối chiếu backend: bài `seeking` không tạo listing nhưng Lab vẫn trả raw Regex spans. Hai test khác bắt nhầm `__next-route-announcer__` có role alert; sửa selector về alert trong main. Lượt chạy đầy đủ sau đó đạt 14/14. Không sửa backend hoặc UI để làm test qua.
- Đã kiểm anonymous/401, researcher đăng nhập thật, renter Forbidden + API 403, admin kế thừa, Regex thật trên F01–F06, evidence Unicode có emoji, pending chống gửi lặp, chọn field/evidence, mở BIO bằng bàn phím, bài lưu sẵn, gold 404, lỗi/thử lại giữ input, khóa test, gold 403, LLM rỗng, metrics 0/null/frozen/chuyển run và hết phiên. Ba luồng chính có thu thập `pageerror` đều không ghi nhận lỗi.
- API đánh giá thật: `{"items":[]}`. Gold dev, nhãn khóa và run có metrics dùng response mô phỏng chỉ trong Playwright; không ghi run/gold vào API, không có fallback mock trong sản phẩm. Các ảnh có `contract` trong tên là bằng chứng test giao diện, không phải kết quả đánh giá thực nghiệm.
- **15 PNG** được chụp và đã mở xem. Các lần chụp đều kiểm `documentElement.scrollWidth <= innerWidth`, đạt. Đưa trang về đầu trước khi chụp full page để sidebar sticky không bị ghi ở vị trí giữa ảnh.
- **20 cặp màu** từ computed CSS tokens của trình duyệt: **0 lỗi**, chữ thấp nhất **5,13:1** (cần 4,5), viền control thấp nhất **3,36:1** (cần 3). Dữ liệu ở [contrast.json](../../.tmp/research-shots/contrast.json). Đây là kiểm các cặp token đang dùng, không phải chứng nhận WCAG toàn bộ.

### Ảnh đã xem

Thư mục: [research-shots](../../.tmp/research-shots/).

| Nhóm | Ảnh | Nhận xét khi mở xem |
|---|---|---|
| Lab, Regex API thật | `lab-live-result-1440.png`, `lab-live-result-768.png`, `lab-live-result-390.png` | Desktop ba cột bằng chứng; tablet/mobile xếp dọc. Đoạn chọn có viền và thông báo. Bảng mobile cuộn ngang trong vùng riêng. |
| Đánh giá, API thật rỗng | `eval-live-empty-1440.png`, `eval-live-empty-768.png`, `eval-live-empty-390.png` | Không có KPI/số mẫu giả; select khóa, nút tải lại và hướng dẫn/link Lab rõ. |
| Đánh giá, response test | `eval-contract-run-1440.png`, `eval-contract-run-768.png`, `eval-contract-run-390.png` | Bảng P/R/F1, 0 khác null, manifest và bảng lỗi đọc được; bảng rộng cuộn trong vùng riêng. |
| Các trạng thái khác | `lab-pending-1440.png`, `lab-error-390.png`, `research-forbidden-1440.png`, `lab-bio-open-768.png`, `lab-reduced-focus-390.png`, `lab-test-lock-contract-1440.png` | Pending khóa nút; lỗi có thử lại; Forbidden không lộ dữ liệu nhóm; BIO có focus rõ; gold tập test bị khóa trong cả BIO và JSON chuẩn hóa. |

Không thấy chữ chồng hoặc tràn ngang toàn trang trong ảnh đã xem. Một số ảnh có chỉ báo môi trường dev của Next; đây không phải control sản phẩm. Không có mật khẩu/token/số liên hệ thật trong ảnh.

## Chưa kiểm và khoảng trống còn lại

Chưa chạy build production, trình duyệt khác hoặc điện thoại thật. Chưa có LLM cache thật, gold dev thật hoặc run đánh giá thật để kiểm tích hợp các phần đó; đã kiểm response contract bằng browser routes. API chưa có endpoint từng dòng lỗi/tải báo cáo hoặc danh sách bài riêng cho researcher như đã nêu ở trên. Không còn vướng cấu hình; không cần đề xuất sửa thêm file ngoài phạm vi.
