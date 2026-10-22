# Kế hoạch đánh giá

Phần này trả lời các câu hỏi nghiên cứu RQ1–RQ4 của proposal. Nguyên tắc: **mọi điều chỉnh làm trên tập phát triển; hệ thống được đóng băng rồi chạy đúng một lần trên tập kiểm thử.**

## 1. Hai tập dữ liệu, không trộn

| Tập | Kích thước mục tiêu | Gán nhãn | Dùng để |
|---|---|---|---|
| **Tập chuẩn** (`gold`) | ~100 bài | Tay, theo [hướng dẫn gán nhãn](../02-data/02-huong-dan-gan-nhan.md) | Đo trích xuất, RQ1–RQ4 |
| **Kho thị trường** (`market`) | 300–500 bài | Tự động (pipeline) + duyệt một phần | Thống kê giá, nhận định; kiểm tay một mẫu cho RQ4 |

Bài trong tập chuẩn **không** dùng làm ví dụ mẫu trong prompt nếu nó thuộc tập test.

## 2. Chia tập chuẩn

| Phần | Số bài | Vai trò |
|---|---|---|
| Pilot | 15–20 | Sửa hướng dẫn gán nhãn; không tính vào kết quả |
| Dev | phần còn lại (~80–90) | Viết luật regex, chọn ví dụ prompt, chỉnh ngưỡng, đọc lỗi |
| Test | 10 bài phức tạp | Chạy một lần sau đóng băng |

**Chia theo cụm phòng:** các bài đăng lại của cùng một phòng phải nằm cùng một phần (tránh "học thuộc" bài test qua bản đăng lại). Gán `cluster_key` trước khi chia.

**Chọn 10 bài test có hệ thống**, không chọn theo cảm tính. Mỗi bài phủ ít nhất một ô khó:

| Ô khó | Ví dụ |
|---|---|
| Nhiều số tiền (giá + cọc + điện + nước + dịch vụ) | `3tr5/th, cọc 1th, điện 3k5, nước 100k/ng, dv 150k` |
| Giá theo người | `1tr5/người, phòng 2 người` |
| Giá dạng khoảng hoặc "từ" | `từ 2tr8`, `3–3,5tr` |
| Giấu giá | `ib giá` |
| Nhiều phòng trong một bài | `P1 20m2 2tr8; P2 30m2 3tr5` |
| Viết tắt, không dấu, teencode | `cho thue phong 25m 3tr2 gan dh` |
| Địa danh cũ (quận/huyện đã bỏ) | `Q. Thạch Thất` |
| Bao phí trong giá | `3tr bao điện nước` |

Chọn 10 bài test **trước** khi bắt đầu chỉnh luật/prompt, ghi danh sách + hash vào `eval/splits/test.json`, không mở nhãn của chúng cho đến ngày chạy test.

Nếu kịp gán thêm (~120 bài), giữ thêm 20 bài **kiểm thử thường** (không chọn theo độ khó) để có ước lượng ít thiên lệch hơn. 10 bài phức tạp quá ít để kết luận mạnh; báo cáo phải ghi rõ giới hạn này.

## 3. Ba phương pháp so sánh

Cùng tập, cùng tiền xử lý, **cùng bộ chuẩn hóa M4**; chỉ khác bước tìm span.

| Phương pháp | Mô tả |
|---|---|
| **Regex** | M3a + M4 |
| **LLM** | M3b (có yêu cầu trích nguyên văn + lọc quote không có trong bài) + M4 |
| **Hybrid** | M3a + M3b + M5 đối chiếu. Khi đánh giá, LLM chạy trên **mọi** bài (không dùng chế độ tiết kiệm), để so công bằng; báo riêng chi phí nếu dùng chế độ tiết kiệm |

## 4. Chỉ số

| Chỉ số | Đo gì | Cách tính |
|---|---|---|
| P/R/F1 thực thể, strict | Tìm đúng đoạn và đúng nhãn | Khớp biên + khớp nhãn; theo từng nhãn PRICE/AREA/LOC/ROOM/FEE và micro trung bình |
| P/R/F1 partial (phụ) | Tìm gần đúng đoạn | Chồng lấn + đúng nhãn; định nghĩa cách tính điểm trước khi chạy |
| Chuẩn hóa đúng (end-to-end) | Ra đúng giá trị cuối | Trên **mọi** trường có trong gold: giá trị hệ thống = giá trị gold (tiền khớp tuyệt đối; diện tích lệch ≤ 0,5 m²; basis/period/visibility khớp) |
| Trả rỗng đúng | Không bịa khi bài không có | Trên các trường gold để trống: tỉ lệ hệ thống cũng để trống |
| Tỉ lệ điền sai giá | Bịa giá | Số listing gold không có giá số nhưng hệ thống điền giá / số listing gold không có giá số |
| Nhầm PRICE ↔ FEE | Lỗi khó nhất của đề | Ma trận nhầm giữa hai nhãn |
| Gắn đúng phòng | Bài nhiều phòng | Tỉ lệ listing có giá + diện tích đi đúng cặp như gold |
| Gộp trùng | M8 | Precision/Recall trên các cặp được người kiểm |
| Chi phí | Dùng được không | Số lần gọi LLM, token, thời gian trung bình/bài |

Công cụ gợi ý: `seqeval` (strict BIO) hoặc `nervaluate` (strict/exact/partial theo SemEval 2013) cho mức thực thể; chỉ số mức giá trị và gắn phòng tự viết trong `eval/`.

## 5. Thiết kế cho từng câu hỏi nghiên cứu

### RQ1 — Regex, LLM và Hybrid khác nhau thế nào trên từng trường?

Bảng chỉ số §4 cho ba phương pháp × năm nhãn, trên dev (sau chỉnh) và test (một lần). Báo cả số lượng thực thể (support) của mỗi ô.

### RQ2 — Neo nguồn và đối chiếu có giảm giá trị bịa của LLM không?

So ba nhánh trên cùng tập dev, cùng model và cùng nhiệt độ:

| Nhánh | Cấu hình |
|---|---|
| LLM-raw | Prompt không yêu cầu trích nguyên văn; nhận mọi giá trị |
| LLM-grounded | Prompt yêu cầu trích nguyên văn; **loại** giá trị có quote không có trong bài |
| Hybrid | LLM-grounded + đối chiếu với Regex |

Chỉ số chính: **tỉ lệ giá trị không có căn cứ** (giá trị mà không tìm được đoạn chữ đúng vai trò trong bài) và **tỉ lệ điền sai giá**; kèm recall để thấy cái giá phải trả (lọc nhiều quá thì bỏ sót). Ngoài ra, với cùng output của LLM-grounded, báo bao nhiêu giá trị bị bộ lọc chặn và trong đó bao nhiêu thực ra đúng. Không chấm nhánh LLM-raw trượt vì nó không trả quote; chất lượng giá trị chấm bằng cùng gold cho cả ba nhánh.

### RQ3 — Hiện tượng ngôn ngữ nào gây lỗi nhiều nhất?

Định nghĩa trước bảng loại lỗi, gán mỗi lỗi trên dev vào một loại:

| Mã | Loại lỗi |
|---|---|
| E-FEE | Phí bị lấy làm giá thuê (giả thuyết của proposal: lỗi phổ biến nhất) |
| E-BASIS | Giá theo người bị coi là giá phòng, hoặc ngược lại |
| E-FORM | Khoảng giá / "từ" bị xử lý như một số |
| E-MULTI | Bài nhiều phòng bị gán sai cặp |
| E-ABBR | Viết tắt, không dấu, teencode không đọc được |
| E-LOC | Địa danh cũ, mốc không map được |
| E-HIDE | Bài giấu giá bị điền giá |
| E-OTHER | Khác (ghi mô tả) |

Báo số lỗi mỗi loại theo phương pháp, kèm 1–2 ví dụ tiêu biểu (đã ẩn danh).

### RQ4 — Lỗi trích xuất làm lệch thống kê thị trường bao nhiêu?

Hai tầng, ghi rõ tầng nào đo gì:

1. **Lệch do giá trị:** trên tập chuẩn, giữ nguyên các nhóm theo nhãn tay, thay giá gold bằng giá hệ thống, so trung vị nhóm.
2. **Lệch do toàn pipeline:** chạy lại cả điều kiện vào thống kê + phân nhóm + gộp trùng bằng kết quả hệ thống; so số tin vào nhóm, số tin bị loại, trung vị, và số trường hợp nhận định đổi chiều (cao ↔ thấp ↔ chưa đủ dữ liệu).

**Giới hạn cỡ mẫu (tính trước):** ~100 bài chia cho 3–5 phường × 4 loại hình × 5 khoảng diện tích là ít nhất 60 ô, trung bình chưa tới 2 bài/ô. Vì vậy RQ4 trên tập chuẩn làm ở **nhóm thô** (theo loại hình, gộp các phường) và báo N từng nhóm. Kèm kiểm tay một mẫu ~30 listing của kho thị trường: so giá trị hệ thống với đọc tay, rồi xem các nhóm có N ≥ 10 trong kho bị ảnh hưởng thế nào.

## 6. Đóng băng và chạy test

1. Ghi phiên bản: `pipeline_version`, `regex_version`, `prompt_version`, `model_id`, `normalizer_version`, commit git. Gắn tag git `eval-freeze-v1`.
2. Chạy `eval/run_eval.py --split test` **một lần**. Lưu `eval/runs/<run_id>/` gồm manifest, metrics, errors.
3. Mọi thay đổi sau đó là phiên bản mới; kết quả trên test của phiên bản mới ghi là "sau khi đã xem test", không thay số chính.

## 7. Manifest của một lần chạy

```json
{
  "run_id": "2026-10-30-test-v1",
  "split": "test",
  "frozen": true,
  "git_commit": "<sha>",
  "methods": ["regex", "llm", "hybrid"],
  "versions": {"pipeline": "1.0.0", "regex": "1.0.0", "prompt": "1.0.0", "normalizer": "1.0.0", "model_id": "<gemini model id>"},
  "llm": {"temperature": 0, "max_attempts": 3, "calls": 0, "tokens_in": 0, "tokens_out": 0},
  "gold": {"file": "data/gold/gold-v1.jsonl", "sha256": "<hash>", "n_posts": 10, "n_listings": 0},
  "started_at": "…", "finished_at": "…",
  "notes": "Không chỉnh gì sau khi xem kết quả."
}
```

Số `0` và `<…>` là chỗ điền khi chạy thật.

## 8. Những gì báo cáo phải ghi rõ

- Đề cương **không đặt trước** con số kết quả.
- 10 bài test phức tạp là mẫu nhỏ, chọn theo độ khó, nên không đại diện cho phân bố bài thật.
- Mọi chỉ số giá là **giá chào thuê** trong mẫu đã thu.
- LLM qua API có thể thay đổi theo thời gian; ghi `model_id` và ngày chạy.
