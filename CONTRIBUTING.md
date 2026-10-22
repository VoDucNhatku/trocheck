# Cách làm việc chung

## Luồng một việc

```text
Issue  →  branch  →  commit  →  Pull Request  →  review (1 người)  →  merge vào main
```

1. **Issue**: mỗi việc một issue, dùng template (Tính năng / Dữ liệu / Lỗi). Ghi rõ ca nghiệm thu (mã AT/E nếu có) và tài liệu đặc tả liên quan.
2. **Branch** từ `main` mới nhất: `feat/<mô-tả>`, `fix/<mô-tả>`, `data/<mô-tả>`, `docs/<mô-tả>`. Ví dụ `feat/regex-price-rules`.
3. **Commit** ngắn, tiếng Anh, theo dạng `<loại>: <việc>`: `feat: add price regex rules`, `fix: keep basis unknown without /phong`, `docs: update api contract`.
4. **PR** dùng template: vấn đề, thay đổi, cách đã kiểm, phần chưa kiểm. Gắn issue bằng `Closes #<số>`.
5. **Review**: ít nhất một thành viên khác đọc và chạy thử phần liên quan. PR đổi luật dữ liệu (giá, basis, điều kiện thống kê) cần TV1 duyệt.
6. **Merge** khi đạt định nghĩa "xong" bên dưới. Không push thẳng lên `main`.

## Định nghĩa "xong"

- Chạy được trên máy người khác theo README của phần đó.
- Có test cho logic (pipeline, API); có ảnh chụp các trạng thái cho giao diện.
- Ca nghiệm thu liên quan trong [demo và nghiệm thu](docs/05-delivery/02-demo-va-nghiem-thu.md) đã chạy, có bằng chứng.
- `python spec/tools/check_fixtures.py` vẫn đạt nếu PR đụng `spec/`.
- Không có khóa API, `.env`, dữ liệu thật hay số điện thoại trong diff.
- Tài liệu trong `docs/` được sửa nếu hành vi khác đặc tả.

## Ai sở hữu phần nào

| Thư mục | Chủ chính | Review chéo |
|---|---|---|
| `apps/api/app/pipeline/`, `docs/02-data/`, `eval/` | TV1 | TV2 |
| `apps/api/` (còn lại), `docs/03-system/` (API, CSDL) | TV2 | TV1 |
| `apps/web/`, `docs/01-product/` | TV3 | TV2 |
| `apps/extension/`, `docs/03-system/05-extension.md`, `data/` | TV4 | TV2 |
| `spec/`, `docs/decisions/` | Cả nhóm | — |

## Đổi một quyết định đã ghi

Viết hoặc sửa ADR trong [docs/decisions](docs/decisions/README.md): bối cảnh, lựa chọn, quyết định, hệ quả. Cập nhật tài liệu và schema bị ảnh hưởng trong cùng PR.

## Dữ liệu

Không commit dữ liệu thật. Đọc [data/README.md](data/README.md).
