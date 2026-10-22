# Quyết định kiến trúc (ADR)

Mỗi quyết định quan trọng một file, theo mẫu MADR rút gọn: bối cảnh → lựa chọn → quyết định → hệ quả → khi nào xem lại. Quyết định bị thay thì giữ file cũ, đổi trạng thái thành "Bị thay bởi ADR-xxxx".

| ADR | Quyết định | Trạng thái |
|---|---|---|
| [0001](ADR-0001-stack-demo.md) | Next.js + FastAPI + SQLite + Gemini + Chrome MV3 cho bản demo | Đề xuất |
| [0002](ADR-0002-extension-hai-che-do.md) | Extension có hai chế độ Thu thập và Nhận định, kèm giới hạn bắt buộc | Đề xuất |
| [0003](ADR-0003-llm-chi-tim-span.md) | LLM chỉ tìm đoạn chữ; code tất định quy đổi số; loại quote không có trong bài | Đề xuất |
| [0004](ADR-0004-mo-hinh-gia.md) | Mô hình giá tách visibility / amount_form / basis / period | Đề xuất |
| [0005](ADR-0005-nhom-so-sanh-n10.md) | Nhóm so sánh và ngưỡng N ≥ 10 | Đề xuất |
| [0006](ADR-0006-dieu-kien-vao-thong-ke.md) | Tin vào thống kê khi được duyệt hoặc Regex/LLM đồng thuận không cờ | Đề xuất |

"Đề xuất" chuyển thành "Đã chốt" khi cả nhóm đồng ý; ghi ngày và người chốt trong file.

## Mẫu

```markdown
# ADR-xxxx: <tên>
Trạng thái: Đề xuất | Đã chốt (ngày, người) | Bị thay bởi ADR-yyyy
## Bối cảnh
## Các lựa chọn
## Quyết định
## Hệ quả
## Xem lại khi
```
