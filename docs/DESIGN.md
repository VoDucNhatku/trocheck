# TrọCheck: hệ giao diện

Nguồn token chạy thật: [`apps/web/src/styles/tokens.css`](../apps/web/src/styles/tokens.css). Tài liệu này mô tả các quyết định giao diện; khi lệch nhau, sửa cả hai trong cùng một PR.

## Hướng

**Bản đọc có căn cứ.** Trả lời tiền nhà trước, cho xem đoạn chữ gốc ngay cạnh, dành chỗ rõ cho phần chưa biết. Người thuê đọc phiếu giá; nhóm vận hành làm việc trên bảng đối chiếu.

## Màu

Mặc định là **chế độ tối**; `data-theme="light"` chuyển sang chế độ sáng. Mọi màn có đủ cả hai chế độ.

| Vai trò | Tối | Sáng |
|---|---|---|
| Nền trang `--night` | `#111214` | `#EEECE6` |
| Mặt thẻ, panel `--night2` | `#1A1B1E` | `#FFFDF8` |
| Chữ chính `--on-night` | `#F4F1EA` | `#15161A` |
| Chữ phụ `--on-night2` | `#BDB9AE` | `#4A473F` |
| Viền `--edge`, `--edge2` | `#555650`, `#88857B` | `#CFC9BB`, `#7A766D` |
| Nhấn (nền nút, highlight) `--hl` | `#FFE14D` | `#FFE14D` |
| Chữ nhấn `--hl-text` | `#FFE14D` | `#8A6400` |
| Giấy, mực (phiếu, mẩu bài) `--paper`, `--card`, `--ink` | `#F4F1EA`, `#FFFDF8`, `#15161A` | giữ nguyên |

- `--hl` chỉ dùng làm **nền**. Chữ màu vàng dùng `--hl-text`, để chế độ sáng vẫn đủ tương phản.
- Nhãn thực thể trong bài: giá `--price`, diện tích `--area`, vị trí `--location`, loại phòng `--room`, phí `--fee`.
- Tương phản chữ tối thiểu 4,5:1, chữ lớn 3:1.

## Chữ

- Tiêu đề: **Newsreader** (chữ có chân), dùng tiết chế.
- Nội dung: **Be Vietnam Pro**.
- Số liệu, mã: **JetBrains Mono**.
- Chữ nhỏ nhất 12px. Không bẻ dòng giữa một cụm ("12,5 tr", "Cầu Giấy", "25 m²", "diện tích"); xuống dòng giữa các cụm. Không dùng `nowrap` cho cả khối dài.

## Nút và tương tác

- **Nút chính:** nền `--hl`, viền 1,5px `--ink`, chữ `--ink`, bóng cứng `4px 4px 0 var(--btn-shadow)`, bo 8px, cao tối thiểu 48px (nút nhỏ 44px), chữ 14px đậm.
- **Nút phụ:** nền trong suốt, viền `--control-edge`, chữ `--on-night`.
- **Hiệu ứng:** rê chuột thì dịch `translate(-2px,-2px)`; nhấn thì `scale(.97)`; chuyển `transform` 160ms. Thẻ tin cũng nhấc lên khi rê chuột.
- Tab đang chọn và chip đang bật dùng nền `--hl`.
- `prefers-reduced-motion`: bỏ dịch, co và animation cuộn, giữ nguyên nội dung.

## Trang chủ

Trang chủ kể theo cảnh cuộn (CSS scroll-driven animation): ảnh sân, bài đăng được đọc thành từng dòng, phiếu giá in ra, đặt cạnh tin cùng phường, rồi mây khép cảnh. Tiếp theo là dải mẩu bài chạy liên tục (có nút tạm dừng), số liệu, các kiểu bài khó, minh họa extension, nguyên tắc dữ liệu và lời mời tìm phòng.

- Ảnh sân và mây là **ảnh minh họa**, có ghi rõ trên trang. Không dùng ảnh bài đăng hay ảnh phòng thật; chỗ cần ảnh phòng dùng khối giữ chỗ "Ảnh phòng (ví dụ)".
- Nội dung đọc được ngay cả khi chưa chạy JavaScript hoặc khi trình duyệt không hỗ trợ animation cuộn.

## Nội dung

- Giá dùng **giá trung bình** của nhóm tin tương tự; không hiện trung vị, P25, P75 hay "N" trên giao diện.
- Đơn vị ghi "/tháng"; chữ trích nguyên từ bài thì giữ nguyên.
- Số kiểu Việt Nam: "1,5 tháng", "4.400.000 đ", "+10,0%".
- Bài không ghi thì để "Không đề cập", không đoán.

## Bố cục

- Khổ kiểm: 1440, 390, 320. Không tràn ngang, không chữ đè.
- Khu nhóm trên điện thoại: bảng chuyển thành thẻ.
- Đầu trang công khai và khung khu nhóm dùng chung token; logo TrọCheck lấy từ `apps/web/public/brand/`.
