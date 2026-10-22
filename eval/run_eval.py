"""Evaluate Regex / LLM / Hybrid on the gold set (docs/04-evaluation/01-ke-hoach-danh-gia.md).

    python eval/run_eval.py --split dev --methods regex,llm,hybrid
    python eval/run_eval.py --split test ...   # only on a commit tagged eval-freeze-v1 (AT18)

Runs the same pipeline code as the product (apps/api/app/pipeline). Writes
eval/runs/<run_id>/manifest.json, metrics.json, errors.csv. errors.csv holds normalised values
and error types only, never post text, so it can be committed.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "apps" / "api"))

from app.pipeline.engine import run_pipeline, versions  # noqa: E402

LABELS = ("PRICE", "AREA", "LOC", "ROOM", "FEE")
METHOD_MODE = {"regex": "eval_regex", "llm": "eval_llm", "hybrid": "eval_hybrid"}
FREEZE_TAG = "eval-freeze-v1"


# --- loading ---------------------------------------------------------------------------

def load_gold(path: Path, split: str) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [r for r in rows if r["split"] == split]


def git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def _display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.name


def frozen_commit() -> bool:
    return FREEZE_TAG in git("tag", "--points-at", "HEAD").split()


# --- metrics ---------------------------------------------------------------------------

def system_spans(extraction: dict) -> set[tuple[int, int, str]]:
    out = set()
    for listing in extraction["listings"]:
        fields = [listing[k] for k in ("rent", "area", "room", "location")] + listing["fees"]
        for field in fields:
            for ev in field.get("evidence", []):
                out.add((ev["start"], ev["end"], ev["label"]))
    return out


def prf(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else None
    r = tp / (tp + fn) if tp + fn else None
    f = 2 * p * r / (p + r) if p and r else (0.0 if p is not None and r is not None else None)
    return {"precision": p, "recall": r, "f1": f, "tp": tp, "fp": fp, "fn": fn, "support": tp + fn}


def overlaps(a, b) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def entity_scores(pairs: list[tuple[set, set]]) -> dict:
    out = {}
    for mode in ("strict", "partial"):
        per = {}
        totals = [0, 0, 0]
        for label in LABELS:
            tp = fp = fn = 0
            for gold, system in pairs:
                g = [s for s in gold if s[2] == label]
                sy = [s for s in system if s[2] == label]
                if mode == "strict":
                    hit = len(set(g) & set(sy))
                    tp += hit
                    fp += len(sy) - hit
                    fn += len(g) - hit
                else:
                    matched = {i for i, s in enumerate(sy) if any(overlaps(s, x) for x in g)}
                    found = {i for i, x in enumerate(g) if any(overlaps(s, x) for s in sy)}
                    tp += len(found)
                    fp += len(sy) - len(matched)
                    fn += len(g) - len(found)
            per[label] = prf(tp, fp, fn)
            totals = [totals[0] + tp, totals[1] + fp, totals[2] + fn]
        per["micro"] = prf(*totals)
        out[mode] = per
    return out


def price_fee_confusion(pairs: list[tuple[set, set]]) -> dict:
    """Spans with the same boundaries (or overlapping) but PRICE<->FEE swapped."""
    price_as_fee = fee_as_price = 0
    for gold, system in pairs:
        for g in gold:
            for s in system:
                if overlaps(g, s):
                    if g[2] == "PRICE" and s[2] == "FEE":
                        price_as_fee += 1
                    elif g[2] == "FEE" and s[2] == "PRICE":
                        fee_as_price += 1
    return {"gold_PRICE_system_FEE": price_as_fee, "gold_FEE_system_PRICE": fee_as_price}


def value_of(field: str, v: dict | None):
    if v is None:
        return None
    if field == "rent":
        return (v.get("visibility"), v.get("amount_form"), v.get("amount_vnd"), v.get("min_vnd"), v.get("max_vnd"),
                v.get("basis"), v.get("period"))
    if field == "area":
        def r(x):
            return None if x is None else round(float(x) * 2) / 2
        return (v.get("amount_form"), r(v.get("value_m2")), r(v.get("min_m2")), r(v.get("max_m2")))
    if field == "room":
        return v.get("property_type")
    if field == "location":
        return (v.get("ward_code"), (v.get("street") or "").lower() or None, (v.get("landmark") or "").lower() or None)
    if field == "fees":
        return sorted((f["type"], f.get("amount_vnd"), f["unit"]) for f in v)
    raise ValueError(field)


def empty_value(field: str, v: dict | None) -> bool:
    if v is None:
        return True
    if field in ("rent", "area"):
        return v.get("amount_form") == "none"
    if field == "room":
        return v.get("property_type") in (None, "unknown")
    if field == "location":
        return not any(v.get(k) for k in ("ward_code", "street", "landmark"))
    return not v


def error_type(field: str, gold: dict, system: dict | None, gold_spans: set, sys_listing: dict | None) -> str:
    if field == "rent" and system is not None:
        if gold.get("amount_form") == "none" and gold.get("visibility") == "hidden_explicit" \
                and system.get("amount_form") != "none":
            return "E-HIDE"
        for ev in system.get("evidence", []):
            if any(g[2] == "FEE" and overlaps((ev["start"], ev["end"]), g) for g in gold_spans):
                return "E-FEE"
        if gold.get("amount_form") != system.get("amount_form"):
            return "E-FORM"
        if gold.get("basis") != system.get("basis"):
            return "E-BASIS"
    if field == "location":
        return "E-LOC"
    if system is None:
        return "E-MULTI"
    return "E-OTHER"


def evaluate(gold_rows: list[dict], method: str, llm=None) -> tuple[dict, list[dict], dict]:
    mode = METHOD_MODE[method]
    pairs = []
    fields = ("rent", "area", "room", "location", "fees")
    value_ok = {f: [0, 0] for f in fields}
    abstain_ok = {f: [0, 0] for f in fields}
    false_price = [0, 0]
    pairing = [0, 0]
    post_type = [0, 0]
    errors = []
    cost = {"llm_calls": 0, "tokens_in": 0, "tokens_out": 0, "latency_ms": 0}
    for row in gold_rows:
        result = run_pipeline(row["text"], mode=mode, llm=llm)
        if result.llm:
            cost["llm_calls"] += result.llm.calls
            cost["tokens_in"] += result.llm.tokens_in
            cost["tokens_out"] += result.llm.tokens_out
            cost["latency_ms"] += result.llm.latency_ms
        ext = result.extraction
        gold_spans = {(s["start"], s["end"], s["label"]) for s in row.get("spans", [])}
        pairs.append((gold_spans, system_spans(ext)))
        expected = row["expected"]
        post_type[0] += ext["post_type"] == expected["post_type"]
        post_type[1] += 1
        by_index = {lst["listing_index"]: lst for lst in ext["listings"]}
        multi = len(expected["listings"]) > 1
        for g in expected["listings"]:
            s = by_index.get(g["listing_index"])
            for f in fields:
                gv = g.get(f)
                sv = s.get(f) if s else None
                if f != "fees" and empty_value(f, gv):
                    abstain_ok[f][1] += 1
                    abstain_ok[f][0] += empty_value(f, sv)
                ok = value_of(f, gv) == value_of(f, sv if sv is not None else ([] if f == "fees" else None))
                value_ok[f][1] += 1
                value_ok[f][0] += ok
                if not ok:
                    errors.append({"post_id": row["post_id"], "method": method, "listing_index": g["listing_index"],
                                   "field": f, "error_type": error_type(f, gv or {}, sv, gold_spans, s) if f != "fees" else "E-OTHER",
                                   "gold": json.dumps(value_of(f, gv), ensure_ascii=False),
                                   "system": json.dumps(value_of(f, sv) if sv is not None else None, ensure_ascii=False)})
            if g["rent"].get("amount_form") == "none":
                false_price[1] += 1
                false_price[0] += bool(s and s["rent"].get("amount_form") != "none")
            if multi:
                pairing[1] += 1
                pairing[0] += bool(s and value_of("rent", s["rent"]) == value_of("rent", g["rent"])
                                   and value_of("area", s["area"]) == value_of("area", g["area"]))

    def rate(pair):
        return {"value": pair[0] / pair[1] if pair[1] else None, "n": pair[1]}

    metrics = {
        "entities": entity_scores(pairs),
        "normalized_correct": {f: rate(v) for f, v in value_ok.items()},
        "correct_abstention": {f: rate(v) for f, v in abstain_ok.items() if f != "fees"},
        "false_price_rate": rate(false_price),
        "price_fee_confusion": price_fee_confusion(pairs),
        "listing_pairing": rate(pairing),
        "post_type_accuracy": rate(post_type),
        "cost": {**cost, "posts": len(gold_rows)},
    }
    return metrics, errors, cost


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--split", required=True, choices=["pilot", "dev", "test"])
    parser.add_argument("--methods", default="regex,llm,hybrid")
    parser.add_argument("--gold", default=str(REPO / "data" / "gold" / "gold-v1.jsonl"))
    parser.add_argument("--out", default=str(REPO / "eval" / "runs"))
    parser.add_argument("--run-id")
    parser.add_argument("--notes", default="")
    args = parser.parse_args(argv)

    methods = [m.strip() for m in args.methods.split(",") if m.strip()]
    if args.split == "test" and not frozen_commit():
        print(f"Refusing to run on the test split: HEAD is not tagged {FREEZE_TAG} (AT18).", file=sys.stderr)
        return 2
    gold_path = Path(args.gold)
    if not gold_path.exists():
        print(f"Gold file not found: {gold_path} (data/ is never committed; see data/README.md)", file=sys.stderr)
        return 2

    llm = None
    if any(m in ("llm", "hybrid") for m in methods):
        key, model = os.environ.get("GEMINI_API_KEY"), os.environ.get("GEMINI_MODEL_ID")
        if not key or not model:
            print("LLM methods need GEMINI_API_KEY and GEMINI_MODEL_ID in the environment.", file=sys.stderr)
            return 2
        from app.pipeline.llm_client import GeminiClient
        llm = GeminiClient(key, model, temperature=0.0)

    rows = load_gold(gold_path, args.split)
    started = datetime.now(UTC)
    run_id = args.run_id or f"{started:%Y-%m-%d-%H%M}-{args.split}"
    out = Path(args.out) / run_id
    if out.exists():
        print(f"{out} already exists; runs are never overwritten.", file=sys.stderr)
        return 2
    out.mkdir(parents=True)

    all_metrics, all_errors = {}, []
    totals = {"calls": 0, "tokens_in": 0, "tokens_out": 0}
    for method in methods:
        metrics, errors, cost = evaluate(rows, method, llm if method != "regex" else None)
        all_metrics[method] = metrics
        all_errors += errors
        totals["calls"] += cost["llm_calls"]
        totals["tokens_in"] += cost["tokens_in"]
        totals["tokens_out"] += cost["tokens_out"]

    v = versions(getattr(llm, "model_id", None))
    manifest = {
        "run_id": run_id, "split": args.split, "frozen": frozen_commit(), "git_commit": git("rev-parse", "HEAD"),
        "methods": methods,
        "versions": {"pipeline": v["pipeline_version"], "regex": v["regex_version"], "prompt": v["prompt_version"],
                     "normalizer": v["normalizer_version"], "model_id": v["model_id"]},
        "llm": {"temperature": 0.0, "max_attempts": 3, **totals},
        "gold": {"file": _display_path(gold_path),
                 "sha256": hashlib.sha256(gold_path.read_bytes()).hexdigest(), "n_posts": len(rows),
                 "n_listings": sum(len(r["expected"]["listings"]) for r in rows)},
        "started_at": started.isoformat(), "finished_at": datetime.now(UTC).isoformat(),
        "notes": args.notes,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps(all_metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    with (out / "errors.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["post_id", "method", "listing_index", "field", "error_type", "gold", "system"])
        writer.writeheader()
        writer.writerows(all_errors)
    print(f"wrote {out}")
    for method, metrics in all_metrics.items():
        micro = metrics["entities"]["strict"]["micro"]
        print(f"{method:7s} strict micro F1={micro['f1']}  rent correct={metrics['normalized_correct']['rent']['value']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
