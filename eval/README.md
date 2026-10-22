# eval — đánh giá trích xuất

**Trạng thái:** chưa code. Phụ trách chính: TV1, TV4. Đặc tả: [kế hoạch đánh giá](../docs/04-evaluation/01-ke-hoach-danh-gia.md).

## Cấu trúc dự kiến

```text
eval/
  run_eval.py        # --split dev|test --methods regex,llm,hybrid[,llm_raw]
  metrics/           # span strict/partial, giá trị chuẩn hóa, trả rỗng đúng, gắn phòng, PRICE↔FEE
  splits/            # test.json (id + sha256) khóa từ đầu
  runs/<run_id>/     # manifest.json, metrics.json, errors.csv (đã ẩn danh) — commit được
  report/            # bảng và hình cho báo cáo cuối
```

## Quy tắc

- Dùng **cùng code pipeline** với `apps/api`, không viết lại.
- `--split test` chỉ chạy khi commit có tag `eval-freeze-*`; script từ chối nếu không có.
- Mỗi lần chạy ghi manifest đầy đủ version (mẫu trong kế hoạch đánh giá §7).
- `errors.csv` không chứa số điện thoại hay link bài thật.
