# data — quy ước lưu dữ liệu

**Không commit dữ liệu thật.** Mọi thư mục dưới đây (trừ README) nằm trong `.gitignore`. Dữ liệu thật lưu trên máy nhóm hoặc thư mục chia sẻ riêng của nhóm.

```text
data/
  db/          rener.sqlite              DB của web (tự tạo khi chạy)
  gold/        gold-v1.jsonl             Tập chuẩn gán tay (đã che SĐT)
               splits/                   pilot.json, dev.json, test.json (danh sách id + sha256)
  exports/     *.csv, *.jsonl            Xuất từ kho để phân tích
  replay/      *.html                    Trang mẫu kiểm tra extension (tự tạo, không có thông tin cá nhân)
```

| Loại dữ liệu | Nơi lưu | Commit lên GitHub? |
|---|---|---|
| Bài mẫu tự tạo | `spec/fixtures/` | Có |
| Bài thật thu từ Facebook | `data/db/` | Không |
| Tập chuẩn gán tay | `data/gold/` | Không (nộp kèm báo cáo nếu giảng viên yêu cầu, sau khi kiểm ẩn danh) |
| Danh sách chia tập (id + hash) | `data/gold/splits/` → sao sang `eval/splits/` | Chỉ id và hash, không có nội dung |
| Kết quả đánh giá | `eval/runs/` | Có (chỉ số và lỗi đã ẩn danh) |

Định dạng một dòng của `gold-v1.jsonl`: `{"post_id", "split", "cluster_key", "text", "spans": [{start, end, label}], "expected": <listing-extraction>}`.
