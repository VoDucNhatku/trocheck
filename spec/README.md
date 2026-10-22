# spec — đặc tả máy đọc được

Nguồn chung cho backend, frontend, extension và script đánh giá. Tài liệu giải thích nằm ở [docs/02-data](../docs/02-data/01-tu-dien-du-lieu.md); khi hai bên lệch nhau, sửa cả hai trong cùng một PR.

| Thư mục | Nội dung | Ai dùng |
|---|---|---|
| [schemas/ingest-post.schema.json](schemas/ingest-post.schema.json) | Một bài extension gửi lên | Extension, API (M0) |
| [schemas/ingest-batch.schema.json](schemas/ingest-batch.schema.json) | Lô bài ở chế độ Thu thập (≤ 20 bài) | Extension, API |
| [schemas/listing-extraction.schema.json](schemas/listing-extraction.schema.json) | Kết quả trích xuất chuẩn hóa của một bài | Pipeline, API, web, đánh giá |
| [fixtures/](fixtures/README.md) | Bài mẫu tự tạo + kết quả mong đợi | Test pipeline, seed demo, test giao diện |
| [tools/check_fixtures.py](tools/check_fixtures.py) | Kiểm fixture đúng schema và vị trí ký tự khớp đoạn trích | Mọi người, trước khi mở PR |

## Kiểm tra

```bash
python -m pip install -r spec/tools/requirements.txt   # chỉ cần một lần
python spec/tools/check_fixtures.py                    # in PASS/FAIL từng file, exit 0 khi tất cả đạt
```

Không cài `jsonschema` thì script vẫn kiểm vị trí ký tự, chỉ bỏ qua phần schema.

## Quy ước

- Tên trường và enum tiếng Anh, khớp [từ điển dữ liệu](../docs/02-data/01-tu-dien-du-lieu.md).
- `start`/`end` là vị trí ký tự Unicode (code point) trên `text`; `quote` phải bằng đúng `text[start:end]`. Frontend JavaScript dùng UTF-16 nên phải đổi vị trí khi bôi màu chữ có emoji.
- Backend sinh model Pydantic tương ứng; OpenAPI của FastAPI là nơi web/extension sinh client.
