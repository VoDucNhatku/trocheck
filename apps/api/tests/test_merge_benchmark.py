"""Opt-in slow My Posts measurement on 5,000 invented PostgreSQL listings."""
import importlib.util
import json
import os
from pathlib import Path
from statistics import median
import sys
from time import perf_counter

import pytest
from sqlalchemy import event, func, select, update

from app.core.ids import utcnow
from app.models import ExtractionRun, Listing, ListingDistrict, Post, PostSubmission, PostVersion, User
from app.services import my_posts


@pytest.mark.slow
@pytest.mark.skipif(os.environ.get("MERGE_BENCHMARK") != "1", reason="opt-in PostgreSQL My Posts measurement")
def test_postgres_my_posts_benchmark(api):
    assert api.settings.database_url == "postgresql+psycopg://api_test@127.0.0.1:54329/trocheck_merge"
    handoff = Path(__file__).resolve().parents[3] / "_handoff"
    path = handoff / "my-posts-before.py"
    spec = importlib.util.spec_from_file_location("my_posts_before", path)
    baseline = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = baseline
    spec.loader.exec_module(baseline)
    # Four distinct ward/district pools, all represented on the owner's newest page.
    districts = ("thu-duc", "quan-1", "binh-thanh", "quan-3")
    now = utcnow()
    with api.session() as session:
        owner = session.scalar(select(User.id).where(User.username == "collector"))
        posts, versions, runs, listings, mentions, submissions = [], [], [], [], [], []
        for i in range(5000):
            key, group = f"merge-b{i:05}", i % len(districts)
            posts.append(dict(id="p-" + key, collector_id=owner, source_type="import_file", mode="collect",
                              contributed=True, is_demo=False, status="extracted"))
            versions.append(dict(id="v-" + key, post_id="p-" + key,
                                 text=f"Invented benchmark rental fixture group {group}.",
                                 text_hash=key, text_complete=True))
            runs.append(dict(id="r-" + key, post_version_id="v-" + key, mode="production",
                             pipeline_version="test", regex_version="test", prompt_version="test",
                             normalizer_version="test", llm_status="not_run"))
            listings.append(dict(id="l-" + key, run_id="r-" + key, post_id="p-" + key, listing_index=0,
                                 review_status="approved", rent_form="exact", rent_amount_vnd=2_000_000 + (i % 20) * 50_000,
                                 rent_period="month", rent_basis="per_unit", property_type="phong_tro", area_m2=22,
                                 ward_code=f"MERGE-BENCH-W{group}", observed_at=now))
            mentions.append(dict(listing_id="l-" + key, district_key=districts[group]))
            submissions.append(dict(post_id="p-" + key, user_id=owner, first_sent_at=now))
        for model, rows in ((Post, posts), (PostVersion, versions), (ExtractionRun, runs),
                            (Listing, listings), (ListingDistrict, mentions), (PostSubmission, submissions)):
            session.execute(model.__table__.insert(), rows)
        session.execute(update(Post).values(current_version_id=select(PostVersion.id)
                                            .where(PostVersion.post_id == Post.id).scalar_subquery()))
        session.commit()
        assert session.scalar(select(func.count()).select_from(Listing)) == 5000

    def measure(module):
        with api.session() as session:
            owner = session.scalar(select(User).where(User.username == "collector"))
            statements = []

            def record(_conn, _cursor, statement, _parameters, _context, _many):
                statements.append(statement)

            event.listen(session.bind, "before_cursor_execute", record)
            try:
                start = perf_counter()
                page = module.search(session, owner, api.settings, group="all", page=1, limit=20)
                elapsed = (perf_counter() - start) * 1000
            finally:
                event.remove(session.bind, "before_cursor_execute", record)
        assert len(page["items"]) == 20
        return elapsed, len(statements), page

    # Warm both paths, then alternate order to reduce systematic cache/order bias.
    _, _, expected = measure(baseline)
    _, _, actual = measure(my_posts)
    assert actual == expected
    results = {"listings": 5000, "page_size": 20, "location_groups": len(districts), "runs_per_case": 5,
               "clock": "perf_counter; service search; fresh ORM sessions; warm database caches",
               "baseline": "byte copy of HEAD:apps/api/app/services/my_posts.py",
               "before": {"runs_ms": [], "sql_statements": []}, "after": {"runs_ms": [], "sql_statements": []}}
    for repeat in range(5):
        cases = (("before", baseline), ("after", my_posts))
        for label, module in cases if repeat % 2 == 0 else reversed(cases):
            elapsed, queries, page = measure(module)
            assert page == expected
            results[label]["runs_ms"].append(round(elapsed, 3))
            results[label]["sql_statements"].append(queries)
            print(label, "ms", round(elapsed, 3), "SQL", queries, flush=True)
    for label in ("before", "after"):
        results[label]["median_ms"] = round(median(results[label]["runs_ms"]), 3)
    (handoff / "my-posts-benchmark.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BENCHMARK", json.dumps(results, ensure_ascii=False), flush=True)
