# API + worker in one container (docs/05-delivery/25-host-vercel-render.md).
# Build from the repo root: config.py finds data/, spec/ and eval/ four levels above itself,
# so the repo layout is kept under /srv and the package is installed in editable mode.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv

COPY apps/api/pyproject.toml apps/api/README.md apps/api/
COPY apps/api/app apps/api/app
RUN pip install -e apps/api

COPY apps/api/alembic.ini apps/api/
COPY apps/api/migrations apps/api/migrations
COPY apps/api/deploy apps/api/deploy
COPY spec spec
COPY eval eval
COPY data/README.md data/

# /srv/data is the persistent disk: the SQLite DB lives in /srv/data/db.
ENV DATABASE_URL=sqlite:////srv/data/db/rener.sqlite
EXPOSE 8000
WORKDIR /srv/apps/api
CMD ["sh", "deploy/start.sh"]
