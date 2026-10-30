# Nhật ký skill đợt thiết kế lại

Ngày 27/10/2026. Đề bài codex-task-03 ưu tiên hơn skill. Không agent, commit, push, deploy.
Không chờ chọn prototype vì người dùng đã ủy quyền chọn và yêu cầu tiếp tục. Không áp gate phỏng vấn của skill.
M = `D:/Downloads/claude-howto-research/.sources/`; K = `D:/DEMO kế hoạch kì 5/DEMO kế hoạch kì 5/TMG301/KusShoes/.agents/skills/`;
C = `C:/Users/Asus/.codex/skills/`. M/taste nằm ở `taste-skill/skills/taste-skill`; M/emil ở `emilkowalski-skills/skills/`.

## A — nghiên cứu và khám phá

| Skill / tài liệu đã đọc | Áp dụng cụ thể | Bằng chứng |
|---|---|---|
| M design-taste-frontend v2: SKILL, toàn bộ app-screens; tells, type, colour, copy, critique | Mỗi màn trả lời một câu hỏi; giữ font/palette ReNER; phân biệt app với landing |19: màn/câu hỏi/quyền; DESIGN: hợp đồng khu trong |
| M taste: layout, imagery, research; library/app.json, directions.json | Auth sân nhà; biến tấu open plane, phiếu đọc và bàn đối chiếu | `.taste-skill/app/direction.json`, seed706906306; ảnh prototype |
| K redesign-skill, Design Audit | Chỉ ra giá bị chìm, panel lặp, micro-label, auth thiếu ảnh | Audit trong19; `.tmp/redesign-shots/before/` |
| K stitch-skill | Khung atmosphere/color roles/bans; density7, variance4, motion3 | DESIGN; không perpetual motion/gradient |
| C design-web | Hướng theo tác vụ, render/đo thật |19;55 ảnh final; `final-layout.json`, `contrast-final.json` |
| M emil-design-eng | Bảng trạng thái, nhấn tức thì, popover theo trigger | DESIGN; Shell.tsx, workspace.module.css; test Escape/trả focus |
| M prototype và K prototype | Picker thật:3 auth cả login/register,3 Reading,3 Review; API demo, mutation thử local | `*-prototype-{1,2,3}-1440.png`, `workbench-prototypes-contact.png`; lựa chọn/loại trong19 |
| M find-animation-opportunities; animation-vocabulary | Chỉ feedback và định hướng không gian; loại count-up/evidence entrance/panel reveal |19: recipe; menu160ms, drawer200ms, hover120ms |

Prototype đã gỡ khỏi src; bản lưu chỉ tại `.tmp/redesign-prototype-source`. Production không có route thử.

## B — xây trên hệ thống thật

| Skill | Thay đổi cụ thể | Bằng chứng |
|---|---|---|
| C backend-engineer | Contract đăng ký trước; renter tại server, insert-only, unique409, session cookie, IP limit | API contract; schemas/users/routes/config/registration_limit; generated.ts |
| K tdd | Viết hành vi đăng ký trước implementation qua HTTP boundary, không dùng seed upsert | `apps/api/tests/test_registration.py`:16 ca; pytest toàn bộ265 ca pass |
| C build-ui | Next/CSS Modules với API thật; auth, source/evidence, đối chiếu, bảng/đồ thị | Các component workspace; browser tests;55 ảnh final |
| M animate; animation-performance | CSS opacity/transform cho overlay, màu cho controls; không state mỗi frame | keyframes/reduced-motion trong workspace.module.css; package files không đổi |
| K minimalist-skill | Giấy ngà, serif tiết chế ở auth, bảng phẳng/đường kẻ | CSS workspace/research/auth; contact sheets final |
| K responsive-adapter | Drawer dưới1100, stack dưới700, bảng nghiên cứu cuộn có nhãn, kho thành hàng dọc |1440/1024/768/390/360; `final-layout.json` không overflow |
| M mobile-native | Input16px, nút44px, safe-area toolbar, hover fine pointer, bỏ tap highlight | CSS; nút hiện mật khẩu44px; drawer/focus/reduced-motion tests |

## C — kiểm và phản biện

| Skill | Phát hiện / sửa | Bằng chứng |
|---|---|---|
| M taste inspect --app + critique | Bỏ inset shadow nav; căn phải số; helper auth13px, h1mobile28; giảm empty padding; hai vòng critique |20; `.tmp/redesign-shots/inspect/<màn>/{report.json,output.txt}`; round1/round2/final |
| M break-ui + catalog liên quan | Username30; tiếng Việt dài,12.500.000,range/null, nguồn dài emoji; queue0/1/200 phân trangserver | redesign.spec.ts; `reading-worst-*`, `queue-worst-*`; không ship data toggle |
| C review-frontend | Phân cấp, focus lỗi409, field không evidence, vùng chạm hiện mật khẩu; xem tablet/mobile thật | Login useEffect focus; Reading disabled; final contacts;17 test interior |
| M review-animations | Chỉ hai overlay entrance; không page entrance/infinite idle; reduced motion tức thì | CSS audit; browser reduced-motion; motion report inspector |
| C security-review | roles/consentstrict/duplicate, không echo mật khẩu; cookie, origin, allowlist, safe next |16pytest auth; browser cross-origin403/roles422/HttpOnly; giới hạn peer-IP trong20 |
| C verification-before-completion | Build/typecheck/integration/pytest/layers/fixtures/ba bộ browser, ảnh/đo | Bảng output trong20; ghi cả lỗi trung gian và giới hạn |

### Inspector và ngoại lệ

Native transport báo `CDP timeout: Page.enable`. `.tmp/inspect-playwright.mjs` thay phần khởi động Chrome/CDP bằng
Playwright đã cài; giữ nguyên upstream probes, rules, screenshots, report. Wrapper session đăng nhập admin vào18004
bằng file credential tạm, không in bí mật. Chạy `node .tmp/inspect-all.mjs`:11 màn ×3 widths,0FAIL trên từng màn.

Dùng `--allow emoji` vì ký tự này nằm trong bài nguồn/excerpt và cần giữ offset; không có emoji trang trí UI.
Cream/fonts theo yêu cầu người dùng. Không áp luật bốn ảnh/một ảnh động của landing cho app. Auth dùng ảnh sân nhà
tự tạo có nhãn minh họa. Lý do giữ WARN trong20. Không sửa skill nguồn, cài package hoặc đưa ảnh phòng thật vào sản phẩm.
Các skill cố ý không dùng theo đề bài không được đánh dấu đã áp dụng.
