# apps/extension — Chrome Manifest V3

**Trạng thái:** chưa code. **Giao cho bên làm extension**; TV4 là đầu mối trong nhóm.

Đọc trước khi bắt đầu:

1. [Đặc tả extension](../../docs/03-system/05-extension.md) — hai chế độ, luồng, dữ liệu gửi, tiêu chí nghiệm thu E1–E12, giới hạn bắt buộc.
2. [Schema một bài](../../spec/schemas/ingest-post.schema.json) và [schema lô](../../spec/schemas/ingest-batch.schema.json).
3. [API contract §2](../../docs/03-system/03-api-contract.md#2-extension--api) — các endpoint extension gọi.
4. [Màn hình extension](../../docs/01-product/03-tinh-nang-va-man-hinh.md#4-màn-hình-extension) — popup, xem trước, panel kết quả.

## Bàn giao gì

| Hạng mục | Yêu cầu |
|---|---|
| Mã nguồn trong thư mục này | Build ra bản "Load unpacked"; README cách build và cài |
| File cấu hình bộ chọn | Tách riêng, có version |
| Trang kiểm tra | Vài trang HTML mẫu tự tạo để thử bộ chọn (không chứa dữ liệu cá nhân thật) |
| Bằng chứng nghiệm thu | Kết quả E1–E12 (ảnh/video + số bài trên web khớp bộ đếm) |

## Khi chưa có backend

Có thể dựng extension với một server giả trả đúng các phản hồi trong API contract. Kiểm dữ liệu gửi đi bằng [schema](../../spec/schemas/ingest-post.schema.json) trước khi nối API thật.
