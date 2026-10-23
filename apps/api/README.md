# apps/api — FastAPI + pipeline M0–M9 + worker

API, pipeline trích xuất và worker chạy job. Đặc tả gốc: [API contract](../../docs/03-system/03-api-contract.md), [cơ sở dữ liệu](../../docs/03-system/04-co-so-du-lieu.md), [pipeline](../../docs/02-data/03-pipeline-xu-ly.md), [quy tắc chuẩn hóa](../../docs/02-data/04-quy-tac-chuan-hoa.md), [gộp trùng và thống kê](../../docs/02-data/05-gop-trung-va-thong-ke.md).

## Chạy

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # Linux/macOS: .venv/bin/python
.venv/Scripts/python -m app.cli init-db               # alembic upgrade head -> data/db/rener.sqlite
.venv/Scripts/python -m app.cli seed                  # cần SEED_PASSWORD trong root .env/process env; DEMO_MODE=true để thấy
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
.venv/Scripts/python -m app.worker.run                # worker, cửa sổ khác
.venv/Scripts/python -m pytest                        # test
.venv/Scripts/lint-imports                            # kiểm luật phân tầng
```

Từ gốc repo: `make setup|api|worker|dev|seed|test|lint|eval`, trên Windows `.\scripts\dev.ps1 <target>`.

Biến môi trường: xem [.env.example](../../.env.example). `GEMINI_API_KEY` và `GEMINI_MODEL_ID` chỉ cần cho worker; thiếu thì pipeline chạy Regex và ghi `llm_status = not_run`.

## Kiến trúc trong code

```mermaid
flowchart LR
    R[app/api<br/>router: kiểm input, gọi service] --> S[app/services<br/>nghiệp vụ + giao dịch DB]
    S --> P[app/pipeline<br/>M1–M9 hàm thuần]
    S --> M[app/models<br/>ORM SQLAlchemy]
    W[app/worker/run.py] --> S
    P -.chỉ llm_client.py.-> G[(Gemini)]
```

| Tầng | Thư mục | Không được |
|---|---|---|
| Presentation | `app/api/` (`routes.py`, `deps.py`) | Viết luật nghiệp vụ |
| Application | `app/services/` | Gọi mạng (trừ qua client được tiêm vào) |
| Domain | `app/pipeline/` | Import FastAPI, SQLAlchemy, models, services |
| Infrastructure | `app/models/`, `app/core/db.py`, `app/pipeline/llm_client.py`, `migrations/` | — |

`lint-imports` (cấu hình trong `pyproject.toml`) kiểm 3 hợp đồng: phân tầng router → service → pipeline/models; pipeline thuần; chỉ `llm_client.py` được dùng mạng. `tests/test_architecture.py` chạy lệnh này.

## Pipeline

| Module | File | Ghi chú |
|---|---|---|
| M0 | `services/ingest.py`, `pipeline/privacy.py` | Che SĐT lần hai, idempotency key, gộp trùng mức bài (`external_post_id` hoặc `text_hash` cùng nhóm), bài sửa → phiên bản mới |
| M1 | `pipeline/preprocess.py` | Không sửa `post.text`; tạo view `lower`/`folded` cùng độ dài + bản đồ về vị trí code point |
| M2 | `pipeline/classify.py`, `lexicon/classify.yaml` | Từ khóa; không chắc thì LLM quyết trong cùng lời gọi M3b |
| M3a | `pipeline/regex_extractor.py`, `lexicon/regex_rules.yaml` | Luật có `rule_id`, ví dụ đúng và ví dụ không được bắt (test tự kiểm); số tiền sau `cọc/điện/nước/dịch vụ…` cùng mệnh đề → FEE |
| M3b | `pipeline/llm_extractor.py`, `prompts/extract_v1.md`, `llm_client.py` | LLM chỉ trả quote + nhãn + `listing_index`; quote không có trong bài bị loại; tối đa 3 lần gọi gồm thử lại, tôn trọng `Retry-After`; cache theo `text_hash + prompt_version + model_id` (bảng `llm_cache`) |
| M4 | `pipeline/normalize.py`, `pipeline/assemble.py` | Dùng chung cho Regex và LLM; mỗi dòng bảng quy tắc là một test |
| M5 | `pipeline/reconcile.py`, `pipeline/engine.py` | `both_agree / regex_only / llm_only / conflict`; chế độ tiết kiệm chỉ gọi LLM khi thiếu giá/diện tích, ≥ 3 số tiền, nhiều phòng, basis chưa rõ hoặc loại bài chưa chắc |
| M6 | `services/processing.py` | Mỗi lần xử lý là một `extraction_run` mới; listing cũ thành `is_current = false` |
| M8 | `pipeline/dedup.py` | 4 điều kiện + cosine TF-IDF; ≥ 0,9 tự gộp, 0,8–0,9 vào Hàng duyệt (`possible_duplicate`) |
| M9 | `pipeline/market.py`, `services/market.py` | Tính khi đọc (không có snapshot); N < 10 → `insufficient_data`; loại cả cluster của tin đích; đếm tin bị loại theo lý do |
| M7 | [`eval/run_eval.py`](../../eval/run_eval.py) | Cùng code với sản phẩm; tập test chỉ chạy trên commit có tag `eval-freeze-v1` |

## Dữ liệu demo và dữ liệu thật

- `make seed` nạp 7 fixture + 87 bài tự tạo, tất cả `is_demo = true`. Chỉ hiện khi `DEMO_MODE=true`, không bao giờ trộn vào thống kê thật (AT17).
- Phường: `lexicon/wards.yaml` và `lexicon/places.yaml` **để trống**. Nhóm điền khi chốt 3–5 phường; `code` phải lấy từ nguồn chính thức. Bài demo dùng `wards.demo.yaml` với mã `DEMO-…`, chỉ áp cho bài demo.
- Tập chuẩn: `python -m app.cli import-gold data/gold/gold-v1.jsonl` (bài gold không vào kho thị trường; nhãn tập test bị khóa ở trang Lab).

## Ghi chú triển khai so với API contract

| Điểm | Lý do |
|---|---|
| Thêm `GET /health`, `POST /auth/logout`, `GET /auth/me`, `GET /team/extension-tokens` | Cần cho vận hành, đăng xuất, web biết vai trò, trang Cài đặt liệt kê token để thu hồi |
| `GET /listings`, `/listings/{id}`, `/market/summary`, `/stats/overview` không cần đăng nhập | Trang người đi thuê công khai; chỉ trả tin đã đóng góp và đủ điều kiện hiển thị |
| `/listings/{id}/comparison` cho phép chủ bài nhận định xem listing chưa đóng góp | Panel extension cần so sánh trước khi người dùng bấm Đóng góp (luong-web §2) |
| Comparison có thêm `message`, `disclaimer`, `is_demo` | Câu chữ §5 sinh ở API để web/extension không tự tính |
| Lỗi body không phải JSON trả 422 `validation_error` | Cùng hợp đồng với dữ liệu sai schema |
| `review_reasons` dùng `basis_unknown` (theo DB doc) | Web prototype đang dùng `unit_unknown`, cần đổi khi nối API |
| Lý do loại khỏi thống kê: `period_not_month`, `property_type_unknown`, `older_in_cluster`, `demo_data` | Đặc tả yêu cầu đếm theo từng lý do nhưng không đặt tên; `reason_codes` của comparison giữ đúng 5 mã trong contract |

## Chưa làm / chưa kiểm

- Chưa gọi Gemini thật: client viết theo REST `generateContent`, test bằng LLM giả. Cần chạy thử với khóa thật.
- Nhánh LLM-raw cho RQ2 chưa có trong `run_eval.py`.
- Web B1 đã nối stats/listings/detail/comparison bằng Server Components; các màn nhóm, auth UI, Thị trường chưa triển khai trong gói này.
- Ngưỡng gộp trùng, từ khóa phân loại và luật regex mới là giá trị khởi đầu; phải chỉnh trên bài pilot/dev, không bao giờ trên tập test.

## Tích hợp web B1

API/worker/CLI đọc `.env` ở repo root. Khởi tạo an toàn bằng `python scripts/init-local-env.py`; file có sẵn được giữ nguyên. Dùng đường dẫn SQLite tuyệt đối, ví dụ `sqlite:///F:/TMG Final Project/rener-vn-latest/data/db/web-api-dev.sqlite`; đường dẫn tương đối được tính theo cwd, có thể dẫn tới nhiều DB ngoài ý muốn. Không ghi đè/xóa DB có sẵn. Default của `Settings` khi không đặt DATABASE_URL cũng là đường dẫn tuyệt đối dưới repo.

`SEED_PASSWORD` nay đọc qua Settings, vì vậy `.env` root có hiệu lực cho CLI; đối số hoặc biến môi trường tiến trình được ưu tiên. Thiếu mật khẩu thì seed dừng với thông báo, không dùng mật khẩu mặc định. Script khởi tạo sinh secret/mật khẩu mà không in ra log. Seed idempotent nạp demo và gọi worker `drain` với Regex; worker nền chạy riêng bằng `python -m app.worker.run`.

`app/schemas/public.py` khai báo response DTO cho listings/detail/comparison/stats, bảo toàn nullable và các khóa serializer. `/listings` thêm `is_demo` ở envelope để xác định dataset ngay cả khi kho rỗng; các trường cũ vẫn giữ. Không thay ngưỡng, phân loại hay luật thống kê. Mảng query dùng key lặp: `ward=A&ward=B&type=ccmn&type=phong_tro`.

Xuất OpenAPI không cần server hay kết nối DB:

```powershell
.\.venv\Scripts\python.exe -m app.export_openapi openapi.json
```

Client web sinh bằng `npm run generate:api` tại `apps/web`; script quản lý file tạm tự động. Hợp đồng được kiểm bằng `tests/test_public_contract.py` (OpenAPI validation, so nguyên response với serializer, null, evidence, phân tách demo/thật). Bộ browser E2E chạy API/worker service trên DB cô lập; xem [README web](../web/README.md).

Các lệnh Windows ở repo root: `.\scripts\dev.ps1 lint`, `check-fixtures`, `generate-api`, `test-web`, `test-e2e`. Lệnh tương ứng API trực tiếp: `.\.venv\Scripts\python.exe -m pytest`, `.\.venv\Scripts\lint-imports.exe`.
