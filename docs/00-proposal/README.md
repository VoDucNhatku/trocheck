# Proposal và đối chiếu

[proposal-ReNER-VN-v1.3.pdf](proposal-ReNER-VN-v1.3.pdf) là đề cương đã nộp (9 trang): *ReNER-VN: Trích xuất thông tin và nhận định giá thuê nhà từ bài đăng Facebook Groups bằng phương pháp lai Regex – LLM có neo nguồn.* File giữ nguyên, không sửa. Tên mentor và thành viên trong PDF còn để trống.

## Đề bài yêu cầu gì

Đề tài 8 của TMG301: xây bot đọc bài đăng bất động sản lộn xộn trên Facebook Groups, điền bảng chuẩn gồm **Giá, Diện tích, Vị trí, Số phòng**, trên nền **gán nhãn chuỗi** (sequence labeling) và **biểu thức chính quy** (regex) hoặc prompt LLM; trích xuất thành công từ **10 bài thực tế phức tạp**.

## Proposal cam kết gì → nằm ở đâu trong repo

| Proposal | Repo |
|---|---|
| O1 — lược đồ đầu ra, bộ nhãn BIO, hướng dẫn gán nhãn | [Từ điển dữ liệu](../02-data/01-tu-dien-du-lieu.md), [hướng dẫn gán nhãn](../02-data/02-huong-dan-gan-nhan.md), [spec/schemas](../../spec/schemas/) |
| O2 — extension Chrome hai chế độ Thu thập và Nhận định | [Đặc tả extension](../03-system/05-extension.md), [ADR-0002](../decisions/ADR-0002-extension-hai-che-do.md) |
| O3 — ba hệ trích xuất (Regex, LLM có neo nguồn, Lai) + bộ chuẩn hóa | [Pipeline](../02-data/03-pipeline-xu-ly.md), [quy tắc chuẩn hóa](../02-data/04-quy-tac-chuan-hoa.md), [ADR-0003](../decisions/ADR-0003-llm-chi-tim-span.md) |
| O4 — kho thị trường + nhận định giá theo nhóm tương tự | [Gộp trùng và thống kê](../02-data/05-gop-trung-va-thong-ke.md), [ADR-0005](../decisions/ADR-0005-nhom-so-sanh-n10.md) |
| O5 — tập chuẩn và đánh giá RQ1–RQ4 | [Kế hoạch đánh giá](../04-evaluation/01-ke-hoach-danh-gia.md) |
| O6 — web app: Trích xuất, So sánh, Bảng dữ liệu, Thị trường, Đánh giá | [Tính năng và màn hình](../01-product/03-tinh-nang-va-man-hinh.md): Chi tiết tin + Lab (trích xuất, so sánh), Kho dữ liệu (bảng), Thị trường, Đánh giá |
| Bảng 3 — kế hoạch 05/10–01/11 | [Lộ trình](../05-delivery/01-lo-trinh-va-phan-cong.md) |

## Chỗ repo cụ thể hóa hoặc điều chỉnh so với proposal

| Điểm | Proposal | Repo | Lý do |
|---|---|---|---|
| Dữ liệu extension gửi | HTML thô của bài, tách bài bằng Python ở backend; lưu HTML để Replay | Extension gửi **chữ đã che SĐT** + link + thời gian; Replay dùng trang HTML mẫu tự tạo | HTML thô chứa tên, bình luận, thuộc tính trang (dữ liệu cá nhân); chữ đã che đủ cho pipeline |
| Độ tin cậy cao/trung bình/thấp | Hai nguồn khớp → cao | Ghi `agreement` (both_agree / regex_only / llm_only / conflict), không hiển thị như xác suất | Hai phương pháp có thể cùng sai; đây là trạng thái quy trình |
| Nhóm tương tự | Gồm cả nội thất | Chưa dùng nội thất ở bản demo | Nhiều bài không ghi nội thất |
| Giá | Giá về đồng/tháng, cờ "bao điện nước", giá theo người | Thêm `visibility`, `amount_form`, `basis`, `period` tách riêng | Phân biệt "ib giá", "từ 3tr", giá/người, giá/ngày ([ADR-0004](../decisions/ADR-0004-mo-hinh-gia.md)) |
| RQ2 | Neo nguồn có giảm bịa không | Thêm nhánh LLM không yêu cầu quote để so | Cần đối chứng mới trả lời được |
| RQ4 | So trung vị nhóm từ nhãn tay với từ hệ thống | Làm ở nhóm thô + kiểm tay mẫu kho | ~100 bài không đủ để có nhóm N ≥ 10 ở mức phường × loại × diện tích |
| Đồng thuận gán chéo | Kappa | F1 mức thực thể giữa hai người là số chính; kappa phụ | Kappa trên token bị phóng đại vì phần lớn token là `O` |

Các điều chỉnh không đổi mục tiêu, câu hỏi nghiên cứu hay phạm vi của proposal. Nên trình bày ngắn trong báo cáo cuối mục "Thay đổi so với đề cương".
