"""Opt-in PostgreSQL measurement. Baseline is a byte copy of the original service from git HEAD."""
import importlib.util
import json
import os
from pathlib import Path
from statistics import median
from time import perf_counter

import pytest
from sqlalchemy import event, func, select, update

from app.core.ids import utcnow
from app.models import ExtractionRun, Listing, ListingDistrict, Post, PostVersion, User
from app.pipeline.old_districts import area_catalog
from app.services import market


@pytest.mark.skipif(os.environ.get("PREDICT_BENCHMARK") != "1", reason="opt-in 5000-listing PostgreSQL measurement")
def test_postgres_comparison_benchmark(api):
    assert api.settings.database_url.endswith("/trocheck_predict")
    baseline_path = Path(__file__).resolve().parents[3] / "_handoff" / "market-before.py"
    spec = importlib.util.spec_from_file_location("market_before", baseline_path)
    baseline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(baseline)
    keys, now = list(area_catalog()), utcnow()
    with api.session() as session:
        owner = session.scalar(select(User.id).where(User.username == "collector"))
        posts, versions, runs, listings, districts = [], [], [], [], []
        for i in range(5000):
            key, group = f"b{i:05}", i % len(keys)
            posts.append(dict(id="p" + key, collector_id=owner, source_type="import_file", mode="collect",
                              contributed=True, is_demo=False, status="extracted"))
            text = (f"Phòng trọ thử nghiệm nhóm {group}, có gác, bếp riêng, cửa sổ, sân để xe. " * 16)
            versions.append(dict(id="v" + key, post_id="p" + key, text=text, text_hash=key, text_complete=True))
            runs.append(dict(id="r" + key, post_version_id="v" + key, mode="production", pipeline_version="test",
                             regex_version="test", prompt_version="test", normalizer_version="test", llm_status="not_run"))
            listings.append(dict(id="l" + key, run_id="r" + key, post_id="p" + key, listing_index=0,
                                 review_status="approved", rent_form="exact", rent_amount_vnd=2_000_000 + (i % 20) * 50_000,
                                 rent_period="month", rent_basis="per_unit", property_type="phong_tro", area_m2=22,
                                 ward_code=f"BENCH-W{group:02}", observed_at=now))
            districts.append(dict(listing_id="l" + key, district_key=keys[group]))
        for model, rows in ((Post, posts), (PostVersion, versions), (ExtractionRun, runs),
                            (Listing, listings), (ListingDistrict, districts)):
            session.execute(model.__table__.insert(), rows)
        session.execute(update(Post).values(current_version_id=select(PostVersion.id)
                                            .where(PostVersion.post_id == Post.id).scalar_subquery()))
        session.commit()
        assert session.scalar(select(func.count()).select_from(Listing)) == 5000
    ids = [f"lb{i * len(keys):05}" for i in range(20)]

    def measure(fn, size):
        timings, queries, text_loads = [], [], []
        result = None
        for _ in range(3):
            with api.session() as session:
                targets = list(session.scalars(select(Listing).where(Listing.id.in_(ids[:size])).order_by(Listing.id)))
                statements = []
                def record(_conn, _cursor, statement, _parameters, _context, _many):
                    statements.append(statement)
                event.listen(session.bind, "before_cursor_execute", record)
                try:
                    start = perf_counter()
                    result = fn(session, targets)
                    timings.append((perf_counter() - start) * 1000)
                finally:
                    event.remove(session.bind, "before_cursor_execute", record)
                queries.append(len(statements))
                text_loads.append(sum("post_versions.text" in sql for sql in statements))
        return {"median_ms": round(median(timings), 3), "runs_ms": [round(t, 3) for t in timings],
                "queries": queries, "text_queries": text_loads}, result

    old = lambda session, targets: {lst.id: baseline.comparison(session, lst, api.settings) for lst in targets}
    single = lambda session, targets: {lst.id: market.comparison(session, lst, api.settings) for lst in targets}
    batched = lambda session, targets: market.comparisons(session, targets, api.settings)
    results = {"listings": 5000, "location_groups": len(keys), "page": "20 targets in the same location pool",
               "runs_per_case": 3, "clock": "perf_counter; fresh ORM session, warm database caches"}
    baseline_metrics = {}
    for label, fn, size in (("before_one", old, 1), ("after_one", single, 1),
                            ("before_page20", old, 20), ("after_page20_single_calls", single, 20),
                            ("after_page20_batch", batched, 20)):
        metrics, bodies = measure(fn, size)
        results[label] = metrics
        numeric = {lid: {k: body[k] for k in ("status", "n", "mean_vnd", "median", "p25", "p75", "scope", "pool")}
                   for lid, body in bodies.items()}
        if label.startswith("before"):
            baseline_metrics[size] = numeric
        else:
            assert numeric == baseline_metrics[size]
        print(label, json.dumps(metrics), flush=True)
    results["pool_n"] = next(iter(bodies.values()))["n"]
    output = baseline_path.parent / "benchmark-results.json"
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BENCHMARK", json.dumps(results, ensure_ascii=False), flush=True)
