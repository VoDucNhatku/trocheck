# apps/web — Next.js

Next.js 15 (App Router), React 19. Gọi API FastAPI qua `API_BASE_URL` (phía server) và proxy `/api/workspace/*` (phía trình duyệt). Hệ màu, chữ và nút: [docs/DESIGN.md](../../docs/DESIGN.md).

## Chạy trên Windows

Cần Node.js 20+ và Python 3.11+ cho backend/generator. Từ repo root:

```powershell
python scripts/init-local-env.py
# Nếu python mặc định < 3.11, đặt $env:RENER_PYTHON tới python.exe >= 3.11 trước setup.
.\scripts\dev.ps1 setup
.\scripts\dev.ps1 seed
```

Ba terminal riêng, tại repo root:

```powershell
.\scripts\dev.ps1 api
.\scripts\dev.ps1 worker
.\scripts\dev.ps1 web
```

Web: http://localhost:3000 · API: http://127.0.0.1:8000/docs. Có thể dùng `.\scripts\dev.ps1 dev` để chạy chung; API/worker của lệnh này chạy ẩn và được dừng khi web thoát. Lệnh trả lỗi nếu native command thất bại; đường dẫn repo có dấu cách được hỗ trợ.

Next chỉ đọc `apps/web/.env.local` khi chạy từ `apps/web`, **không tự đọc `.env` ở repo root**:

```dotenv
API_BASE_URL=http://127.0.0.1:8000/api/v1
API_TIMEOUT_MS=8000
```

Tên chuẩn là `API_BASE_URL`, chỉ dùng phía server. `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_API_URL` cũ không dùng. Secret/Gemini key không thuộc cấu hình web. API/worker đọc `.env` root. Script khởi tạo chỉ ghi khi file chưa tồn tại, dùng secret ngẫu nhiên và DB phát triển riêng với đường dẫn tuyệt đối; hãy kiểm cấu hình hiện có khi script giữ file cũ.

## Luồng dữ liệu

- Server Components → `lib/api/client.ts` → transport `openapi-fetch` + `generated.ts` → FastAPI. `adapters.ts` là điểm đổi DTO sang shape UI; component không biết HTTP.
- `npm run generate:api` xuất OpenAPI trực tiếp từ app Python, không cần API đang chạy/DB kết nối; `openapi-typescript` sinh `src/lib/api/generated.ts`. Không sửa tay file sinh. Mặc định dùng `apps/api/.venv`; có thể đặt `RENER_PYTHON`.
- Mọi HTTP read có timeout và `cache: no-store`. Chỉ listing 404 gọi `notFound`; comparison lỗi nằm riêng cạnh nội dung tin, có Thử lại. Metadata được resolve trước streaming; không đặt route loading boundary bao ngoài bước kiểm listing để giữ HTTP 404. Loading danh sách, pending khi mở card và loading comparison vẫn có.
- `types.ts` đặt tên UI cho DTO sinh; transport, adapter, catalog, query và thuật toán evidence được giữ từ B1. UI dùng Be Vietnam Pro tự phục vụ, Lucide, CSS Modules và một bộ token; `RentDisplay`, `StatusBadge` dùng chung. Card không có ảnh phòng giả, giá và phí hiển thị riêng.
- Không fallback mock, không đọc `data/demo/extension-sample.json`. `mock-data.ts`, `prototype-types.ts` và `local-samples.ts` là nguồn prototype cũ; **chỉ** `features/landing/illustrations.ts` dùng mock cho ví dụ tự tạo có nhãn. Không gọi API bằng ID minh họa và không dùng chúng để lấp lỗi kho.
- `is_demo` quyết định badge; dữ liệu thật không bị gán thành nguồn extension. `DEMO_MODE=true` trên API: mặc định bộ demo, `?demo=false` chọn kho thật; `DEMO_MODE=false`: chỉ kho thật, kể cả khi query yêu cầu demo. Link card/similar/quay lại và điều hướng công khai giữ lựa chọn.
- URL web giữ tiếng Việt: `phuong`/`loai` lặp, `gia_min`/`gia_max` tính triệu, `dt_min`/`dt_max`, `co_gia=1`, `sap_xep`, `trang`. Giá đổi sang đồng đúng một lần ở `parseFilters`. API nhận `ward=A&ward=B&type=ccmn&type=phong_tro`, không phải key `ward[]` hay chuỗi dấu phẩy.
- API lọc/sort/page, trả `hidden_no_price` và tổng. Đổi lọc/sort về trang đầu. Danh mục phường lấy **tất cả** các trang không lọc cùng dataset, chỉ tái sử dụng trong request, không suy từ market summary.
- Nullable dates/giá/phí giữ nguyên; không tự tính thống kê, cộng tiền/phí hay nhân giá/người. Evidence dùng Unicode code points; thao tác bằng chuột/bàn phím.

## Kiểm tra

Trong `apps/web`:

```powershell
npm install
npm run generate:api
npm run typecheck
npm run test:integration
npm run build
npx playwright install chromium  # chỉ khi máy chưa có browser tương thích
npm run test:e2e
npm run start                  # production tại :3000
```

Build không fetch API lúc prerender (ba route động). Khi sửa nguồn rồi build lại, dừng web đang dùng cùng `.next`, sau đó chạy lại `npm run start`.

E2E tự chạy API thật tại **18000**, web production tại **3001**, seed DB trong thư mục tạm, xử lý Regex và duyệt bằng service hợp lệ. Endpoint điều khiển lỗi chỉ nằm trong test harness, không tồn tại ở app thật. Không dùng/ghi DB của người dùng. Test cần bản build mới; các port này phải trống. Ảnh và trace nằm ở `.tmp/b1-ui-evidence` và `.tmp/b1-ui-browser-results` (git ignored). Bộ 13 ca gồm kiểm hồi quy dữ liệu, URL, loading/error/empty/404, bàn phím/reduced motion và 3 trang × 360/390/768/1440px; báo cáo contrast/layout ở thư mục ảnh. Ảnh B1 cũ được giữ riêng tại `.tmp/b1-evidence`.

`next lint --help` vẫn có trong Next 15.5.28; repo chưa cấu hình/cài ESLint, nên không ghi `npm run lint` là kiểm tra đã đạt. Không đổi toolchain trong B1.
