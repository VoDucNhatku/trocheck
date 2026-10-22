# ADR-0003: LLM chỉ tìm đoạn chữ; code tất định quy đổi số

Trạng thái: Đề xuất

## Bối cảnh

LLM có thể bịa giá trị và tính toán sai ("5tr5" thành 5.050.000). Đề tài cần so sánh Regex, LLM và Hybrid công bằng, và mỗi giá trị phải chỉ được đoạn chữ nguồn.

## Quyết định

- LLM trả **đoạn trích nguyên văn** (`quote`) + nhãn + `listing_index`, không trả số đã quy đổi.
- Quote phải tìm thấy trong bài; không thấy thì **loại giá trị đó**.
- Bộ chuẩn hóa M4 (code tất định) quy đổi cho cả Regex và LLM. Hai phương pháp chỉ khác ở bước tìm span.
- Lời gọi LLM ghi `model_id`, `prompt_version`, nhiệt độ; kết quả cache theo nội dung + version.

## Hệ quả

- Lỗi tìm span tách khỏi lỗi tính số, dễ phân tích (RQ3).
- Quote có thật vẫn có thể sai vai trò (cọc bị coi là giá); đối chiếu M5 và luật ngữ cảnh xử lý phần này.
- Đánh giá RQ2 cần thêm nhánh LLM không yêu cầu quote để so.

## Xem lại khi

Model mới trả vị trí ký tự đáng tin cậy, hoặc nhóm bổ sung mô hình học máy (CRF/PhoBERT).
