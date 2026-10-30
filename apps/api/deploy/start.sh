#!/bin/sh
# Container entry: migrate, seed demo data once, keep the job worker alive, serve the API.
set -e

python -m app.cli init-db

# Demo data is created once per disk. SEED_PASSWORD becomes the password of every demo
# account (admin, reviewer, collector, researcher, renter), so it must be long and private.
marker=/srv/data/.seeded
if [ "${DEMO_MODE:-false}" = "true" ] && [ -n "${SEED_PASSWORD:-}" ] && [ ! -f "$marker" ]; then
    python -m app.cli seed && touch "$marker"
fi

# Analyses are queued jobs: without this loop they stay "queued" forever.
(while true; do python -m app.worker.run || true; sleep 5; done) &

# The Gemini key belongs to the worker only (AGENTS.md): the API process starts without it.
exec env -u GEMINI_API_KEY uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
