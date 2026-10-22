# Hướng dẫn gán nhãn (tập chuẩn)

Dùng cho người gán tay ~100 bài của tập chuẩn. Mục tiêu: hai người gán cùng một bài thì ra cùng kết quả. Gặp trường hợp không có trong file này → ghi vào mục "Ca chưa có luật" ở cuối và hỏi TV1; không tự đặt luật riêng.

## 1. Hai lớp nhãn

| Lớp | Gán cái gì | Dùng để |
|---|---|---|
| **Span (BIO)** | Đoạn chữ nào là giá, diện tích, vị trí, phòng, phí | Đo Precision/Recall/F1 mức thực thể; chính là bài toán gán nhãn chuỗi của đề tài |
| **Giá trị chuẩn** | Mỗi listing có giá trị gì theo [từ điển dữ liệu](01-tu-dien-du-lieu.md) | Đo tỉ lệ chuẩn hóa đúng, trả rỗng đúng, và tính trung vị chuẩn cho RQ4 |

## 2. Năm nhãn thực thể

| Nhãn | Gán cho | Ví dụ gán | Không gán |
|---|---|---|---|
| `PRICE` | Số tiền thuê định kỳ, gồm cả đơn vị đi liền | `5tr5/th`, `3.5 triệu/tháng`, `từ 3tr`, `1tr5/người` | "cọc 1 tháng", "điện 3k5" |
| `AREA` | Diện tích hoặc kích thước phòng | `30m2`, `25 mét vuông`, `4x8m` | "tầng 3" |
| `LOC` | Mốc, đường, phường, quận cũ | `gần ĐH FPT`, `ngõ 12 Trần Phú`, `P. Thạch Hòa` | Tên nhóm Facebook |
| `ROOM` | Loại hình, số phòng, đặc điểm phòng | `CCMN`, `1PN`, `studio`, `gác lửng`, `khép kín` | "full nội thất" (không gán, chỉ ghi ở giá trị `furnishing`) |
| `FEE` | Mọi khoản phí ngoài tiền thuê | `điện 3k5/số`, `nước 100k/người`, `cọc 1 tháng`, `dịch vụ 150k`, `free wifi` | Giá thuê |

Lược đồ BIO: token đầu của thực thể là `B-<NHÃN>`, các token sau là `I-<NHÃN>`, còn lại `O`.

```text
Giá  5tr5     /        th       ,  điện   3k5    /      số
O    B-PRICE  I-PRICE  I-PRICE  O  B-FEE  I-FEE  I-FEE  I-FEE
```

Tokenizer cố định cho cả dự án: tách theo khoảng trắng và dấu câu, giữ nguyên `5tr5`, `3k5`, `30m2` là một token. Quy tắc tách token nằm cùng code tiền xử lý; người gán làm trên công cụ đã tách sẵn.

## 3. Luật biên span

1. **Gồm cả đơn vị liền sau số**: `5tr5/th` là một span, không tách `5tr5` và `/th`.
2. **Không gồm từ dẫn**: "Giá 5tr5" → chỉ `5tr5`; "điện 3k5" → `điện 3k5/số` là FEE vì từ "điện" xác định loại phí (ngoại lệ có chủ đích: với FEE, giữ từ chỉ loại phí trong span).
3. **Khoảng giá là một span**: `3 - 3,5tr` là một PRICE.
4. **Nhiều phòng**: mỗi giá là một span riêng; quan hệ giá ↔ phòng ghi ở lớp giá trị chuẩn (listing_index).
5. **Viết sai, không dấu vẫn gán**: `gia 3tr`, `dt 25m`.
6. **Emoji và ký tự trang trí**: không nằm trong span trừ khi ở giữa thực thể.

## 4. Luật cho lớp giá trị chuẩn

| Tình huống | Gán |
|---|---|
| "ib giá", "inbox", "liên hệ" và không có số | `rent.visibility = hidden_explicit`, không có span PRICE |
| Bài không nhắc tới giá | `rent.visibility = not_stated` |
| "từ 3tr" | `amount_form = starting_from`, `min_vnd = 3000000` |
| "1tr5/người, phòng 2 người" | `basis = per_person`, `amount_vnd = 1500000`. **Không** tự nhân thành 3 triệu |
| "3tr bao điện nước" | `amount_vnd = 3000000`, `includes = [electricity, water]` |
| "5tr5/th" không có /phòng, /người | `basis = unknown` trừ khi luật ngữ cảnh trong [quy tắc chuẩn hóa](04-quy-tac-chuan-hoa.md) áp dụng |
| Hai phòng giá khác nhau | Hai listing, mỗi listing có giá và diện tích của chính nó |
| Bài cần thuê / ở ghép / bán | Gán `post_type`, không tạo listing |
| Phường không ghi, chỉ có mốc | Ghi `landmark`, `ward_code` để trống |

## 5. Quy trình gán và đo đồng thuận

1. **Pilot 15–20 bài**: hai người gán độc lập, ngồi đọc bất đồng, sửa file này. Bài pilot không dùng làm test.
2. **Gán chính**: chia phần còn lại; mỗi bài một người gán.
3. **Gán chéo 20 bài**: chọn ngẫu nhiên, người thứ hai gán độc lập.
4. **Đo đồng thuận ở mức thực thể**: F1 giữa hai người coi một người làm "chuẩn" (span khớp biên + nhãn). Có thể báo thêm Cohen's kappa trên token, nhưng kappa token bị phóng đại vì phần lớn token là `O`, nên không dùng làm số chính.
5. **Hòa giải**: bất đồng được thảo luận, kết quả cuối ghi vào tập chuẩn; lý do bất đồng phổ biến ghi lại cho phần phân tích lỗi (RQ3).

## 6. Công cụ

Dùng công cụ gán nhãn span có xuất JSON/CoNLL (ví dụ Doccano hoặc Label Studio), hoặc file JSON theo [schema](../../spec/schemas/listing-extraction.schema.json). Lưu ở `data/gold/` (không commit dữ liệu thật, xem [data/README](../../data/README.md)). Mỗi bài trong tập chuẩn có `cluster_id` để chia tập theo phòng.

## 7. Ca chưa có luật

| Ngày | Bài (đã ẩn danh) | Vấn đề | Quyết định | Người quyết |
|---|---|---|---|---|
| | | | | |
