# ADR-0002: Extension hai chế độ, có giới hạn bắt buộc

Trạng thái: Đề xuất

## Bối cảnh

Nhóm cần 300–500 bài cho kho thị trường trong 2–3 tuần. Meta không còn Groups API; điều khoản hạn chế thu thập tự động. Proposal mô tả extension hai chế độ: Thu thập (tự đọc bài khi người dùng lướt, mở "Xem thêm") và Nhận định (chọn một bài).

## Các lựa chọn

| Lựa chọn | Ưu | Nhược |
|---|---|---|
| A. Chỉ Nhận định từng bài + đóng góp | Ít rủi ro điều khoản | Khó đạt 300 bài kịp hạn |
| B. Hai chế độ; Thu thập do người dùng bật, giới hạn chặt | Đủ dữ liệu; đúng proposal | Phụ thuộc giao diện Facebook; rủi ro tài khoản bị hỏi xác minh |
| C. Bot tự chạy nền bằng trình duyệt tự động | Thu nhanh | Trái nguyên tắc người dùng chủ động; dễ bị chặn; không đúng proposal v1.3 |

## Quyết định

Chọn **B**, với các giới hạn trong [đặc tả extension §8](../03-system/05-extension.md#8-giới-hạn-bắt-buộc-không-thương-lượng): người dùng bật, chỉ nhóm mình là thành viên và nằm trong danh sách cho phép, không tự cuộn, 50 bài/phiên, dừng khi bị yêu cầu xác minh, che SĐT trên máy.

## Hệ quả

- Có đường dự phòng (Nhận định + đóng góp, dán văn bản, nhập file) khi Thu thập hỏng.
- Bộ chọn tách ra file cấu hình để sửa nhanh khi Facebook đổi giao diện.

## Xem lại khi

Tài khoản thu bị hạn chế lặp lại, hoặc nhóm có nguồn dữ liệu được cho phép khác.
