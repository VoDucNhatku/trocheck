# Mục lục tài liệu

| Phần | File | Trả lời câu hỏi |
|---|---|---|
| **00 Proposal** | [README](00-proposal/README.md) · [PDF v1.3](00-proposal/proposal-ReNER-VN-v1.3.pdf) | Đề tài yêu cầu gì; repo này khớp proposal ở đâu, khác ở đâu |
| **01 Sản phẩm** | [Tầm nhìn và người dùng](01-product/01-tam-nhin-va-nguoi-dung.md) | Ai dùng, vấn đề gì, phạm vi đến đâu |
| | [Hành trình người dùng](01-product/02-hanh-trinh-nguoi-dung.md) | Từng người dùng đi qua những bước nào (J1–J5) |
| | [Tính năng và màn hình](01-product/03-tinh-nang-va-man-hinh.md) | Web và extension có những màn nào, mỗi màn có gì |
| **02 Dữ liệu** | [Từ điển dữ liệu](02-data/01-tu-dien-du-lieu.md) | Tên trường, enum, nghĩa của từng khái niệm |
| | [Hướng dẫn gán nhãn](02-data/02-huong-dan-gan-nhan.md) | Gán BIO và giá trị chuẩn cho tập chuẩn thế nào |
| | [Pipeline xử lý](02-data/03-pipeline-xu-ly.md) | Bài đi qua M0–M9 ra sao |
| | [Quy tắc chuẩn hóa](02-data/04-quy-tac-chuan-hoa.md) | "5tr5", "3k5/số", "4x8" thành giá trị gì |
| | [Gộp trùng và thống kê](02-data/05-gop-trung-va-thong-ke.md) | Khi nào hai tin là một phòng; trung vị và nhận định tính thế nào |
| **03 Hệ thống** | [Kiến trúc](03-system/01-kien-truc.md) | Thành phần, trách nhiệm, cấu trúc code |
| | [Luồng web](03-system/02-luong-web.md) | Request đi qua đâu trong từng hành trình |
| | [API contract](03-system/03-api-contract.md) | Endpoint, dữ liệu vào/ra, lỗi |
| | [Cơ sở dữ liệu](03-system/04-co-so-du-lieu.md) | Bảng, cột, ràng buộc, lưu giữ |
| | [Extension](03-system/05-extension.md) | Extension làm gì, gửi gì, nghiệm thu thế nào (bàn giao) |
| **04 Đánh giá** | [Kế hoạch đánh giá](04-evaluation/01-ke-hoach-danh-gia.md) | Chia tập, chỉ số, RQ1–RQ4, đóng băng |
| **05 Bàn giao** | [Lộ trình và phân công](05-delivery/01-lo-trinh-va-phan-cong.md) | Ai làm gì, đến khi nào |
| | [Demo và nghiệm thu](05-delivery/02-demo-va-nghiem-thu.md) | Kịch bản demo, các ca phải chạy được |
| | [Rủi ro và pháp lý](05-delivery/03-rui-ro-va-phap-ly.md) | Rủi ro dữ liệu, điều khoản nền tảng |
| | [Đưa lên mạng](05-delivery/25-host-vercel-render.md) | Vercel (web) và Render (API) |
| | [Đăng nhập Google](05-delivery/26-google-login.md) | Cấu hình và luồng OAuth |
| **Bối cảnh UI** | [Product](PRODUCT.md) | Người dùng, mục tiêu và nguyên tắc đọc thiết kế |
| | [Design](DESIGN.md) | Màu, chữ, nút, tương tác và quy tắc nội dung giao diện |
| **Quyết định** | [ADR](decisions/README.md) | Vì sao chọn như vậy, khi nào xem lại |

Đặc tả máy đọc được: [spec/](../spec/README.md). Khi tài liệu và schema lệch nhau, sửa cả hai trong cùng một PR.
