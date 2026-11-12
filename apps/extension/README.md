# TrọCheck Collector

Tiện ích Chrome (Manifest V3) lưu các bài cho thuê trọ đã hiện trên nhóm Facebook, ngay trong trình duyệt của người dùng. Mã nguồn gốc do Nguyễn Tấn Tài viết, giấy phép MIT (xem `LICENSE`).

## Cài

1. Trên web, vào trang **Extension** và bấm **Tải extension**, rồi giải nén file.
2. Mở `chrome://extensions` (Chrome) hoặc `edge://extensions` (Microsoft Edge), bật Developer mode, chọn **Load unpacked** và chọn thư mục `trocheck-collector`.
3. Vào trang **Tài khoản**, bấm **Kết nối extension trên trình duyệt này**, rồi mở nhóm Facebook hoặc tìm kiếm bài viết và cuộn. Bảng tin, trang cá nhân, Pages, Marketplace và Messenger không được lưu.

Sau khi sửa code: tải lại extension rồi tải lại tab Facebook. Khi phát triển có thể nạp thẳng thư mục `extension/`.

File tải trên web nằm ở `apps/web/public/downloads/trocheck-collector.zip`. Sửa `extension/` xong thì chạy `npm run build:zip`; `npm test` báo lỗi nếu file zip đã cũ.

## Làm được gì

| Bước | Việc | Dữ liệu đi đâu |
|---|---|---|
| Lưu bài | Đọc chữ, link và ảnh của bài đã hiện, tự mở "Xem thêm". Che số điện thoại thành `[SĐT]` trước khi lưu | IndexedDB trên máy |
| Lọc | Phân loại bài cho thuê, có giá, số căn | Chữ đã che gửi tới TypeSafe, cần API key riêng |
| Trích xuất | Tách loại phòng, địa chỉ, giá, diện tích | Chữ đã che gửi tới Ollama Cloud, cần API key riêng |
| Gửi về kho | `POST /ingest/batch` tới API TrọCheck, tối đa 20 bài/lô, ảnh qua `PUT /ingest/images` | Tự động sau khi kết nối; có thể tắt trong Cài đặt. Chữ đã che số điện thoại, không gửi tên người đăng riêng |

## Nối với web

1. Trên web, vào **Tài khoản → Các kết nối của bạn** và bấm **Kết nối extension trên trình duyệt này**. Tài khoản nào đã đăng nhập cũng gửi được bài; tài khoản không có vai trò `collector` bị giới hạn số bài mới và số ảnh mỗi ngày.
2. Bài đủ chữ và ảnh sẽ tự gửi về kho sau khi lưu. Lỗi mạng sẽ tự thử lại; mã bị từ chối sẽ dừng gửi và báo nguyên nhân; chạm giới hạn ngày thì phần còn lại nằm trên máy và tự gửi tiếp sau 0 giờ.
3. Trong **Cài đặt** có thể tắt tự động gửi, ngắt kết nối hoặc dán mã thủ công. Nút **Gửi về kho TrọCheck** vẫn dùng được; lọc và trích xuất vẫn chạy thủ công.

Địa chỉ API mặc định là `https://trocheck-api.onrender.com/api/v1`; khi phát triển có thể đổi sang `http://127.0.0.1:8000/api/v1`.

## Kiểm tra

```sh
npm ci
npm test
```

Mẫu DOM Facebook thật chứa dữ liệu cá nhân nên không đưa lên git (`tests/fixtures/*.html`, `expected-*.json`). Máy không có các file này sẽ bỏ qua 3 test liên quan.

## Giới hạn

- Khác [đặc tả](../../docs/03-system/05-extension.md): tự chạy khi mở nhóm chứ chưa có công tắc, chưa có danh sách nhóm được phép và giới hạn 50 bài/phiên.
- Chưa có chế độ Nhận định (nút trên bài Facebook).
- Chưa mở album `+N` để lấy ảnh chưa hiện; giao diện Facebook đổi có thể làm đọc thiếu.
- Kết quả lọc và trích xuất do model đưa ra, có thể sai.
