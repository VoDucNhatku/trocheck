# ADR-0001: Công nghệ cho bản demo

Trạng thái: Đề xuất

## Bối cảnh

Proposal (mục 4) đã nêu Chrome Extension, FastAPI, SQLite, Next.js, Gemini API. Mục tiêu là demo chạy local trên máy nhóm, 4 người, hạn 01/11/2026. Pipeline NLP viết bằng Python và phải dùng chung cho sản phẩm và đánh giá.

## Các lựa chọn

| Lựa chọn | Ưu | Nhược |
|---|---|---|
| A. Next.js + FastAPI + SQLite (WAL) + một worker | Đúng proposal; một file DB, không cần cài server; Python dùng chung | SQLite không hợp nhiều người ghi đồng thời |
| B. Như A nhưng PostgreSQL qua Docker | Sẵn sàng cho nhiều người dùng | Thêm việc cài đặt; máy nhóm có thể chưa có Docker |
| C. Một app full-stack JavaScript | Ít ngôn ngữ | Phải viết lại NLP hoặc gọi Python từ xa |

## Quyết định

Chọn **A**. Job lưu trong SQLite, worker là một tiến trình Python riêng. Truy cập dữ liệu qua ORM để chuyển sang PostgreSQL ít thay đổi.

## Hệ quả

- Chạy local bằng một lệnh, không phụ thuộc dịch vụ ngoài trừ Gemini.
- Một worker ghi tại một thời điểm là đủ cho quy mô demo.
- Khóa Gemini chỉ nằm ở worker.

## Xem lại khi

Có nhiều người dùng ghi đồng thời, cần chạy 24/7 trên server, hoặc job chờ lâu vì nhiều bài → chuyển PostgreSQL và cân nhắc thư viện hàng đợi.
