# Chuẩn KusShoes áp dụng cho ReNER

Ngày 27/10/2026. Nguồn chỉ đọc: `D:/DEMO kế hoạch kì 5/DEMO kế hoạch kì 5/TMG301/KusShoes`.
`docs/DESIGN.md` được ưu tiên hơn code mẫu. Không sao chép tài sản hoặc thương hiệu.

| Nguồn đã khảo sát | Điều học và áp dụng | Cố ý không lấy |
|---|---|---|
| docs/DESIGN.md | Một nhiệm vụ chính mỗi view; token, kích thước và bảng trạng thái bắt buộc. Bổ sung hợp đồng khu trong ở DESIGN của ReNER. | Cam, font Inter/Roboto, control quá nhỏ cho điện thoại |
| docs/ADMIN_DESIGN_SYSTEM.md | Biểu đồ phải có trục, đơn vị, mẫu số và nguồn; số liệu gắn với dữ liệu thật. | KPI doanh thu, billing, chỉ số mô hình không có trong API |
| docs/api-contract.md; docs/integration-runbook.md; FE/ADMIN_FE_BE_INTEGRATION.md; FE/FE_ADMIN_SYNC_REQUIREMENTS.md | Hợp đồng trước; lỗi có mã; frontend không tự đoán quyền/trạng thái. | JWT, refresh, hạ tầng email/OTP |
| FE/src/styles/variables.css; index.css | Vai trò màu dùng chung, không tạo palette rải rác. | Các giá trị thương hiệu KusShoes |
| FE/src/pages/Login/{Login.tsx,Login.module.css,LoginArt.tsx,AccountRecovery.tsx}; utils/authValidation.ts | Lỗi tại trường; xác nhận mật khẩu; điều khoản; hiện mật khẩu; pending; client mirror backend. Auth ReNER dùng sân nhà minh họa sẵn có. | glass-panel, neon, scale entrance, reset/OAuth không có backend |
| FE/src/auth/routeGuard.ts; api/client.ts; hooks/useAsyncData.ts | Xác minh session trước render; abort/request identity; không để response cũ thắng response mới. | Cơ chế refresh token khác session ReNER |
| FE/src/components/{Sidebar,ConfirmDialog,TopProgressBar,LoadingDots,Select}; context/ToastContext.tsx | Control có tên; xác nhận thao tác; focus; pending đúng ngữ nghĩa. | Phần trăm tiến độ suy diễn thành tiến độ xử lý thật |
| FE/src/pages/Dashboard/Dashboard.tsx | Ưu tiên thông tin phát sinh từ dữ liệu (lockedCount). ReNER ưu tiên review reasons và câu hỏi còn thiếu. | Greeting/KPI thêm cho đủ khối |
| FE/src/pages/Projects/{Projects.tsx,ProjectsEmptyState.tsx} | Kho chưa có dữ liệu khác lọc không khớp; hành động khôi phục bộ lọc. | Project wizard, subscription |
| FE/src/pages/Settings/*; pages/Admin/{Users/AdminUsers.tsx,AuditLogs/AdminAuditLogs.tsx} | Nhóm thông tin theo tác vụ; lỗi gần thao tác; thay đổi cần xác nhận; session/token có vòng đời rõ. Đọc phần liên quan, không áp toàn bộ module. | Quản lý user, 2FA, privacy API chưa tồn tại trong ReNER |
| BE/app/{routers/auth.py,schemas/auth.py,services/auth_service.py,exceptions.py}; BE/tests/{test_auth.py,test_auth_hardening.py} | Đăng ký validate server; duplicate409; rate limit IP; cookie HttpOnly; test hành vi không chỉ test render. | Email, Google takeover, OTP; seed upsert của ReNER không được dùng làm register |

Chuẩn truyền sang ReNER: bảng phẳng, phân cấp bằng chữ và khoảng cách; form nhập liệu không làm mất draft khi lỗi;
chỉ một primary; enum map tập trung; quyền API; dữ liệu thiếu có giải thích; bằng chứng đo và ảnh thật trước bàn giao.
