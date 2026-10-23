"""eval/run_eval.py on a synthetic gold file built from spec/fixtures (never real data)."""
import json
import os
import subprocess
import sys

from tests.conftest import FIXTURES, REPO

RUNNER = REPO / "eval" / "run_eval.py"


def gold_file(tmp_path, split="dev"):
    lines = []
    for path in sorted(FIXTURES.glob("F*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        spans = []
        for listing in doc["expected"]["listings"]:
            for field in [listing[k] for k in ("rent", "area", "room", "location")] + listing["fees"]:
                spans += [{"start": e["start"], "end": e["end"], "label": e["label"]} for e in field.get("evidence", [])]
        lines.append(json.dumps({"post_id": doc["id"], "split": split, "cluster_key": doc["id"],
                                 "text": doc["input"]["text"], "spans": sorted({json.dumps(s, sort_keys=True) for s in spans}),
                                 "expected": doc["expected"]}, ensure_ascii=False))
    lines = [json.dumps({**json.loads(l), "spans": [json.loads(s) for s in json.loads(l)["spans"]]}, ensure_ascii=False)
             for l in lines]
    path = tmp_path / "gold.jsonl"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def run(*args):
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, str(RUNNER), *args], capture_output=True, text=True, encoding="utf-8",
                          env=env)


def test_regex_run_writes_manifest_metrics_errors(tmp_path):
    out = tmp_path / "runs"
    r = run("--split", "dev", "--methods", "regex", "--gold", str(gold_file(tmp_path)), "--out", str(out),
            "--run-id", "t1")
    assert r.returncode == 0, r.stderr
    manifest = json.loads((out / "t1" / "manifest.json").read_text(encoding="utf-8"))
    metrics = json.loads((out / "t1" / "metrics.json").read_text(encoding="utf-8"))["regex"]
    assert manifest["gold"]["n_posts"] == 7 and manifest["versions"]["regex"]
    assert metrics["normalized_correct"]["rent"]["value"] == 1.0
    assert metrics["post_type_accuracy"]["value"] == 1.0
    assert metrics["false_price_rate"]["value"] == 0.0
    assert metrics["entities"]["strict"]["PRICE"]["recall"] == 1.0
    errors = (out / "t1" / "errors.csv").read_text(encoding="utf-8")
    assert "Cho thuê" not in errors  # no post text in committed error files
    # Runs are never overwritten.
    again = run("--split", "dev", "--methods", "regex", "--gold", str(gold_file(tmp_path)), "--out", str(out),
                "--run-id", "t1")
    assert again.returncode == 2


def test_at18_test_split_needs_freeze_tag(tmp_path):
    r = run("--split", "test", "--methods", "regex", "--gold", str(gold_file(tmp_path, "test")),
            "--out", str(tmp_path / "runs"))
    assert r.returncode == 2 and "eval-freeze-v1" in r.stderr


def test_llm_methods_need_key(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = run("--split", "dev", "--methods", "hybrid", "--gold", str(gold_file(tmp_path)), "--out", str(tmp_path / "r"))
    assert r.returncode == 2
