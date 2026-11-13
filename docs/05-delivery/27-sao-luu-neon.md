# Sao lưu Neon PostgreSQL

Đối chiếu ngày 13/11/2026: Neon Free có lịch sử khôi phục tối đa 6 giờ,
giới hạn 1 GB thay đổi; có 1 snapshot thủ công, không có lịch sao lưu tự động
của dịch vụ trên gói Free. Đây là cửa sổ khôi phục ngắn, không thay thế bản
sao độc lập. Nguồn: [gói Neon](https://neon.com/docs/introduction/plans).

Chủ dự án nên xuất hằng ngày và trước migration, giữ bản sao mã hóa ngoài máy
triển khai và ngoài repo; thí dụ giữ 7 bản ngày và 4 bản tuần. Tệp dump chứa
dữ liệu cá nhân và thông tin xác thực đã băm, chỉ người phụ trách được đọc.

## Xuất bằng pg_dump

Dùng bộ công cụ PostgreSQL cùng phiên bản chính với máy chủ hoặc mới hơn.
Thiết lập riêng các biến `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`,
`PGSSLMODE=require` và `PGPASSFILE` trong phiên làm việc bảo mật;
không dán thông tin kết nối vào lệnh, lịch sử shell hoặc báo cáo.
`PGPASSFILE` trỏ đến tệp mật khẩu được giới hạn quyền đọc. Thư mục đích
phải tồn tại và có quyền truy cập riêng.

```powershell
$backupPath = 'D:\Downloads\trocheck-pg\backups\trocheck-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
pg_dump --format=custom --no-owner --no-privileges --file $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Xuất cơ sở dữ liệu thất bại' }
pg_restore --list $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Không đọc được danh mục bản sao' }
Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath
```

`pg_dump` tạo ảnh chụp nhất quán khi ứng dụng vẫn chạy. Kiểm tra danh mục
chỉ chứng minh tệp đọc được: định kỳ khôi phục vào **cơ sở dữ liệu thử nghiệm
riêng, trống**, rồi so sánh số bảng, số dòng quan trọng, đăng nhập và phân tích
bằng dữ liệu tự tạo. Chuyển toàn bộ biến kết nối sang đích thử nghiệm trước
`pg_restore --no-owner --no-privileges --exit-on-error --dbname <ten-db-thu-nghiem> <tep.dump>`.
Không chạy restore vào production và không dùng `--clean` tại đó.

Quy trình này chưa được thực thi trên Neon của dự án trong tác vụ H.
Tham khảo: [hướng dẫn pg_dump của Neon](https://neon.com/docs/manage/backup-pg-dump).
