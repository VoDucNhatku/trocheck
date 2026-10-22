# Bài mẫu (fixtures)

Tất cả là **bài tự tạo**, `is_demo = true`, không phải dữ liệu Facebook thật. Mỗi file gồm `input` (đúng [ingest-post.schema.json](../schemas/ingest-post.schema.json)) và `expected` (đúng [listing-extraction.schema.json](../schemas/listing-extraction.schema.json)). Evidence trong `expected` là nhãn chuẩn, nên `method = human`.

| File | Ca kiểm | Nghiệm thu |
|---|---|---|
| [F01-basic-ccmn.json](F01-basic-ccmn.json) | Giá rõ /phòng/tháng; điện, nước, cọc là phí | AT01 |
| [F02-hidden-price.json](F02-hidden-price.json) | "Giá ib" → giấu giá, không có số | AT02 |
| [F03-per-person.json](F03-per-person.json) | Giá theo người, không nhân với số người | AT04 |
| [F04-multi-listing.json](F04-multi-listing.json) | Hai phòng, giá–diện tích đúng cặp | AT05 |
| [F05-starting-from-range.json](F05-starting-from-range.json) | "Từ 4tr", diện tích dạng khoảng | AT03 |
| [F06-seeking.json](F06-seeking.json) | Bài cần thuê: không tạo listing | AT07 |
| [F07-includes-fees.json](F07-includes-fees.json) | Giá bao điện nước, phí dịch vụ riêng | — |

Dùng ba cách:

1. **Test pipeline:** chạy M1–M5 trên `input.text`, so với `expected` (so giá trị chuẩn hóa; evidence so theo đoạn trích).
2. **Seed demo:** `make seed` nạp các bài này với nhãn DEMO để web có dữ liệu khi chưa thu bài thật. Không bao giờ tính vào thống kê thật hay đánh giá.
3. **Test giao diện:** dựng màn Chi tiết, panel extension với dữ liệu đã biết trước.

Thêm ca mới: tạo file `Fxx-<mô-tả>.json`, chạy `python spec/tools/check_fixtures.py`, thêm dòng vào bảng trên.
