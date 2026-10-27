# UI giấy ngà + backend main — 26/10/2026

## Phạm vi

Nhánh `codex/restore-paper-ui`, trên main `9804875`. Khôi phục giao diện trước Stitch từ `94e1e2a`, giữ lớp API/DTO và backend hiện tại. Bản TMG301 gốc và server cổng 3000 không bị thay đổi.

Khôi phục token, font, logo, hero nhiều lớp, các phần minh họa trang chủ, bộ lọc ngang/chip, card, chi tiết, footer và trạng thái tải/lỗi theo hệ giấy ngà. Giữ checkbox native, URL/dataset, phân trang, pending, Escape/trả focus và skip link. Bỏ scroll pin/pre-hide; minh họa không gọi API bằng ID mẫu. Điều hướng chỉ đến route/anchor có thật.

Không sửa backend, schema, lớp HTTP/client, dữ liệu thật hoặc secret của bản gốc. Không thêm dependency.

## Kiểm tra thực tế

- TypeScript: pass.
- Integration: 4/4 pass.
- Next production build: pass, 3 route dynamic.
- Playwright: 13/13 pass (47.1s), bao gồm 3 trang ở 360/390/768/1440px, layout/contrast, filter/sort/page, demo/kho thật, evidence Unicode, error/retry và HTTP404.
- Live smoke: API18001 có 94 listing trong stats, 88 tin public, 20 card/trang; số web khớp API. Chi tiết có comparison N=13, trung vị 3.1tr, giá tin 3.4tr; không có pageerror.
- Backend không thay đổi; full pytest đã đạt 249/249 trong lượt kiểm main trước đó, không chạy lại cho lượt chỉ sửa UI.

## Bản xem thử riêng

- Web: http://127.0.0.1:3002
- API: http://127.0.0.1:18001/docs
- DB demo: `data/db/web-api-dev.sqlite`, chỉ trong clone. Seed 94 bài và xử lý 94 job bằng Regex.
- Env chỉ nằm trong clone, bị git ignore. Không commit/push.
- Ảnh live `.tmp/paper-home-1440.png`, `.tmp/paper-listings-1440.png`, `.tmp/paper-detail-1440.png`, `.tmp/paper-detail-390.png`; ảnh các trạng thái và contrast JSON ở `.tmp/b1-ui-evidence/`.

## Giới hạn

Giữ phạm vi ba trang public. Extension là minh họa, chưa có UI thị trường/khu nhóm/Lab/đánh giá. Chưa kiểm Gemini thật hoặc nhập bài extension JSON cũ vào DB. Kho thật của clone chưa có dữ liệu.
