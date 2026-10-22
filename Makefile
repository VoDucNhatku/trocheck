# Commands from docs/03-system/01-kien-truc.md §5. Windows without make: scripts/dev.ps1 <target>.
API := apps/api
PY  := $(API)/.venv/bin/python
ifeq ($(OS),Windows_NT)
PY  := $(API)/.venv/Scripts/python
endif

.PHONY: setup dev api worker web test seed eval lint check-fixtures generate-api test-web test-e2e

setup:
	python -m venv $(API)/.venv
	$(PY) -m pip install -e "$(API)[dev]"
	cd $(API) && ../../$(PY) -m app.cli init-db
	cd apps/web && npm install

api:
	cd $(API) && ../../$(PY) -m uvicorn app.main:app --reload --port 8000

worker:
	cd $(API) && ../../$(PY) -m app.worker.run

web:
	cd apps/web && npm run dev

dev:
	$(MAKE) -j3 api worker web

test:
	cd $(API) && ../../$(PY) -m pytest

lint:
	cd $(API) && .venv/bin/lint-imports || .venv/Scripts/lint-imports

seed:
	cd $(API) && ../../$(PY) -m app.cli seed

eval:
	$(PY) eval/run_eval.py --split dev --methods regex,llm,hybrid

check-fixtures:
	$(PY) spec/tools/check_fixtures.py

generate-api:
	cd apps/web && npm run generate:api

test-web:
	cd apps/web && npm run test:integration

test-e2e:
	cd apps/web && npm run test:e2e
