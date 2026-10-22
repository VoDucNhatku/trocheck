# Lộ trình và phân công

Hạn nộp theo proposal: **01/11/2026**. Repo được dựng ngày 14/10/2026, tức đang ở tuần 2 của kế hoạch gốc (05/10–01/11). Lộ trình dưới đây dồn kế hoạch gốc vào thời gian còn lại, giữ nguyên các mốc chính.

## 1. Ba mốc

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m
    section M1 Dữ liệu và khung
    Chốt phường, guideline, pilot 20 bài     :m1a, 2026-10-15, 4d
    Extension v0 thu được bài                :m1b, 2026-10-15, 5d
    Khung API + DB + worker                  :m1c, 2026-10-15, 5d
    Regex v0, khung web                      :m1d, 2026-10-15, 5d
    section M2 Lõi chạy được
    Gán nhãn ~100 bài, khóa split            :m2a, 2026-10-20, 6d
    LLM có neo nguồn + đối chiếu             :m2b, 2026-10-20, 6d
    Thu kho 300–500 bài                      :m2c, 2026-10-18, 9d
    Web: Tìm trọ, Chi tiết, Lab, Duyệt       :m2d, 2026-10-20, 7d
    Gộp trùng + thống kê + script đánh giá   :m2e, 2026-10-22, 5d
    section M3 Đóng băng và nộp
    Đóng băng + chạy test                    :crit, m3a, 2026-10-29, 2d
    Trang Đánh giá, Thị trường, hoàn thiện UI :m3b, 2026-10-27, 4d
    Báo cáo, slide, diễn tập demo            :m3c, 2026-10-29, 3d
```

| Mốc | Hạn | Điều kiện đạt (kiểm được) |
|---|---|---|
| **M1 — Dữ liệu và khung** | 19/10 | Danh sách phường và nhóm Facebook đã chốt; guideline v1 + kết quả gán chéo pilot; extension gửi được ≥ 30 bài thật vào DB; `make dev` chạy API + web rỗng; Regex v0 qua các ca trong [quy tắc chuẩn hóa](../02-data/04-quy-tac-chuan-hoa.md) mục giá |
| **M2 — Lõi chạy được** | 26/10 | Tập chuẩn ~100 bài + split có hash; pipeline M0–M9 chạy trên kho; kho ≥ 300 bài; web có Tìm trọ, Chi tiết, Lab, Duyệt; script đánh giá chạy trên dev |
| **M3 — Đóng băng và nộp** | 01/11 | Tag `eval-freeze-v1` trước khi chạy test (29/10); kết quả test (30/10); trang Đánh giá và Thị trường; báo cáo + slide; demo diễn tập ít nhất một lần trên máy trình bày |

## 2. Phân công theo vai trò

| Vai trò | M1 (15–19/10) | M2 (20–26/10) | M3 (27/10–01/11) |
|---|---|---|---|
| **TV1 — NLP** | Guideline v1, pilot gán chéo; tiền xử lý M1; Regex v0 + bảng test chuẩn hóa | Regex v1, chuẩn hóa M4, đối chiếu M5 (cùng TV2); gán nhãn; script đánh giá | Phân tích lỗi RQ3; chạy test; viết phần phương pháp + kết quả |
| **TV2 — LLM & Backend** | Khung FastAPI, DB, worker, auth, `POST /ingest/batch`; thử Gemini | LLM M3b có neo nguồn; API listings/analyses/comparison; gộp trùng M8, thống kê M9 | Ổn định; giới hạn tốc độ; hỗ trợ demo; phần kiến trúc trong báo cáo |
| **TV3 — Frontend** | Khung Next.js, hệ token màu/chữ, layout 2 khu; wireframe | Tìm trọ, Chi tiết (bôi màu nhãn), Lab, Duyệt; panel kết quả cho extension (nếu dùng chung component) | Đánh giá, Thị trường; trạng thái lỗi/rỗng; kiểm tương phản, bàn phím, mobile |
| **TV4 — Extension & Data** | Bàn giao [đặc tả extension](../03-system/05-extension.md); extension v0; chọn nhóm Facebook | Điều phối thu kho 300–500 bài; gán nhãn cùng TV1; kiểm tay mẫu kho | Chọn và khóa test (cùng TV1, trước khi chỉnh); RQ4; kịch bản demo |

Một người có thể đổi vai; mỗi vùng việc phải có một người chịu trách nhiệm.

## 3. Đường găng

```text
Chốt phường + nhóm FB → extension thu được bài → kho 300 bài → thống kê có N ≥ 10
Guideline → pilot → gán ~100 bài → khóa split → chỉnh trên dev → đóng băng → test
```

Hai chuỗi chạy song song. Nếu chuỗi trên chậm (Facebook chặn, extension hỏng), dùng [đường dự phòng](../03-system/05-extension.md#6-khi-facebook-đổi-giao-diện) để vẫn có kho. Nếu chuỗi dưới chậm, thu nhỏ tập chuẩn nhưng **không bỏ** split và đóng băng.

## 4. Nhịp làm việc

- **Mỗi ngày:** cập nhật issue của mình (đang làm / xong / bị chặn).
- **Thứ 2 và thứ 5:** họp 20 phút xem lỗi trên dev và việc bị chặn.
- **Mỗi thay đổi** đi qua branch + PR, theo [CONTRIBUTING](../../CONTRIBUTING.md).

## 5. So với kế hoạch gốc trong proposal

| Proposal (Bảng 3) | Ở đây |
|---|---|
| Tuần 05–11/10: chốt khu vực, lược đồ, nhãn; extension v0; regex v0 | Dồn vào M1 (15–19/10) |
| 12–18/10: gán nhãn, gán chéo; regex v1 | M1 pilot + M2 gán nhãn |
| 12–25/10: LLM, màn chính, thu kho | M2 |
| 19–25/10: đối chiếu, gộp trùng, nhận định, script đánh giá | M2 |
| 26/10–01/11: đóng băng, test, hoàn thiện, báo cáo | M3, giữ nguyên |
