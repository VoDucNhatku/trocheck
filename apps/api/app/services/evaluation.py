"""Evaluation runs: read eval/runs/<run_id>/{manifest,metrics}.json written by eval/run_eval.py
(luong-web §5). Errors are summarised, not dumped, because error rows quote post text."""
from __future__ import annotations

import csv
import json
from pathlib import Path

from app.core.config import Settings
from app.core.errors import not_found


def _runs_dir(settings: Settings) -> Path:
    return Path(settings.eval_runs_dir)


def list_runs(settings: Settings) -> dict:
    root = _runs_dir(settings)
    items = []
    if root.exists():
        for manifest in sorted(root.glob("*/manifest.json"), reverse=True):
            data = json.loads(manifest.read_text(encoding="utf-8"))
            items.append({k: data.get(k) for k in ("run_id", "split", "frozen", "methods", "versions",
                                                   "started_at", "finished_at", "git_commit")})
    return {"items": items}


def get_run(settings: Settings, run_id: str) -> dict:
    folder = _runs_dir(settings) / run_id
    if "/" in run_id or "\\" in run_id or ".." in run_id or not (folder / "manifest.json").exists():
        raise not_found("Không có lần chạy này")
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    metrics_file = folder / "metrics.json"
    metrics = json.loads(metrics_file.read_text(encoding="utf-8")) if metrics_file.exists() else None
    errors = {}
    errors_file = folder / "errors.csv"
    if errors_file.exists():
        with errors_file.open(encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                key = (row.get("method"), row.get("error_type"))
                errors[key] = errors.get(key, 0) + 1
    return {"manifest": manifest, "metrics": metrics,
            "error_counts": [{"method": m, "error_type": t, "count": c} for (m, t), c in sorted(errors.items())]}
