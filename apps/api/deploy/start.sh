#!/bin/sh
# Container entry: migrate, ensure admin, seed demo data, keep the worker alive, serve the API.
set -e

python -m app.cli init-db
# Re-read real posts stored with older extraction rules (regex only, idempotent, keeps every review decision).
if ! python -m app.cli reprocess-real --limit 1000; then
    echo "reprocess-real: lỗi khi đọc lại bài cũ; tiếp tục khởi động, bài giữ kết quả trích cũ."
fi
if ! python -m app.cli ensure-admin >/dev/null 2>&1; then
    echo "ensure-admin: không tạo được tài khoản quản trị; tiếp tục khởi động, kiểm tra cấu hình ADMIN_USERNAME/ADMIN_PASSWORD."
fi

# Seeding can run on every start: existing accounts and demo posts are preserved.
# SEED_PASSWORD is used only for new demo accounts and must be long and private.
if [ "${DEMO_MODE:-false}" = "true" ] && [ -n "${SEED_PASSWORD:-}" ]; then
    python -m app.cli seed
fi

# Analyses are queued jobs: without this loop they stay "queued" forever.
(while true; do python -m app.worker.run || true; sleep 5; done) &

# The Gemini key belongs to the worker only: the API process starts without it.
exec env -u GEMINI_API_KEY uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
