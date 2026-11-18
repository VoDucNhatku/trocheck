"""Invented fixtures: output parity, bounded plans, and measured service timings."""
import importlib.util
import itertools
import json
import os
from pathlib import Path
from statistics import median
import sys
from time import perf_counter

import pytest
from sqlalchemy import event, select, text, update

from app.core.ids import utcnow
from app.models import ExtractionRun, Job, Listing, ListingDistrict, Post, PostSubmission, PostVersion, User
from app.pipeline import market as rules
from app.pipeline.old_districts import area_catalog
from app.services import market, my_posts


HANDOFF = Path(__file__).resolve().parents[3] / "_handoff"


def baseline_module(filename, name):
    path = HANDOFF / filename
    if not path.exists():
        pytest.skip("requires the byte copy of HEAD in _handoff")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def seed(session, count, *, varied=False):
    owner = session.scalar(select(User).where(User.username == "collector"))
    now = utcnow()
    districts = ("thu-duc", "quan-1", "binh-thanh", "quan-3")
    ward = sorted(area_catalog()["thu-duc"].ward_codes)[0]
    posts, versions, runs, listings, mentions, submissions, jobs = [], [], [], [], [], [], []
    for i in range(count):
        key = f"perf{i:05}" if varied else f"merge-b{i:05}"
        group, state = (i + i // 12) % 4 if varied else i % 4, i % 12 if varied else 5
        pid, vid, rid = "p-" + key, "v-" + key, "r-" + key
        posts.append(dict(id=pid, collector_id=owner.id, source_type="import_file", mode="collect",
                          contributed=state != 10, is_demo=False,
                          status={3: "failed", 4: "rejected_type"}.get(state, "extracted")))
        versions.append(dict(id=vid, post_id=pid, text=f"Invented benchmark rental fixture group {group}.",
                             text_hash=key, text_complete=True))
        runs.append(dict(id=rid, post_version_id=vid, mode="production", pipeline_version="test",
                         regex_version="test", prompt_version="test", normalizer_version="test", llm_status="not_run"))
        submissions.append(dict(post_id=pid, user_id=owner.id, first_sent_at=now))
        if state in (0, 1, 2):
            # Equal timestamps also exercise the latest-job id tie breaker and ignored job kinds.
            for suffix, status, kind in (("a", "succeeded", "extract"),
                                         ("b", ("queued", "running", "failed")[state], "reprocess"),
                                         ("c", "failed", "bot_review")):
                jobs.append(dict(id=f"j-{key}-{suffix}", post_version_id=vid, kind=kind,
                                 status=status, created_at=now))
        if state == 9:
            continue
        statuses = {6: "needs_review", 7: "rejected", 8: "duplicate"}
        for index in range(3 if varied and state in (5, 6, 11) else 1):
            lid = f"l-{key}-{index}" if varied else "l-" + key
            location = (group + index) % 4
            listings.append(dict(id=lid, run_id=rid, post_id=pid, listing_index=index,
                                 review_status=statuses.get(state, "approved") if index == 0 else
                                 ("needs_review" if index == 1 else "rejected"),
                                 rent_form="exact", rent_amount_vnd=None if varied and i % 7 == 0 else
                                 2_000_000 + (i % 20) * 50_000 + index * 100_000,
                                 rent_min_vnd=1_800_000 if varied else None,
                                 rent_period="day" if varied and i % 8 == 0 else "month", rent_basis="per_unit",
                                 property_type="ccmn" if varied and (i + index) % 5 == 0 else "phong_tro",
                                 area_m2=None if varied and i % 9 == 0 else (22 if not varied else 15 + i % 40 + index * 11),
                                 ward_code=ward if varied and location == 0 else f"MERGE-BENCH-W{location}",
                                 multi_area=bool(varied and i % 11 == 0), observed_at=now))
            mentions.append(dict(listing_id=lid, district_key=districts[location]))
    for model, rows in ((Post, posts), (PostVersion, versions), (ExtractionRun, runs), (Listing, listings),
                        (ListingDistrict, mentions), (PostSubmission, submissions), (Job, jobs)):
        if rows:
            session.execute(model.__table__.insert(), rows)
    session.execute(update(Post).values(current_version_id=select(PostVersion.id)
                                        .where(PostVersion.post_id == Post.id).scalar_subquery()))
    session.commit()
    return owner


def test_search_matches_head_all_filters(api, monkeypatch):
    before = baseline_module("my-posts-before.py", "perf_my_posts_before")
    old_market = baseline_module("market-service-before.py", "perf_market_before")
    old_rules = baseline_module("market-pipeline-before.py", "perf_rules_before")
    old_market.m = old_rules
    before.market = old_market
    fixed_now = utcnow()
    # Queue estimates and the comparison window must use the same instant on both paths.
    for module in (my_posts, before, market, old_market):
        monkeypatch.setattr(module, "utcnow", lambda: fixed_now)
    with api.session() as session:
        owner = seed(session, 72, varied=True)
        # Stale-version and non-current rows must not influence status or matching.
        session.add(PostVersion(id="v-stale", post_id="p-perf00009", text="Invented stale version.", text_hash="stale"))
        session.flush()
        session.add(ExtractionRun(id="r-stale", post_version_id="v-stale", mode="production",
                                 pipeline_version="test", regex_version="test", prompt_version="test",
                                 normalizer_version="test", llm_status="not_run"))
        session.flush()
        session.add_all([Listing(id="l-stale", post_id="p-perf00009", run_id="r-stale", listing_index=0,
                                 review_status="approved", is_current=True, observed_at=fixed_now),
                         Listing(id="l-inactive", post_id="p-perf00009", run_id="r-perf00009", listing_index=1,
                                 review_status="approved", is_current=False, observed_at=fixed_now),
                         Job(id="j-stale", post_version_id="v-stale", kind="extract", status="failed")])
        # Owner visibility also covers analysis, demo, and posts with no current version.
        for i in (10, 11):
            session.get(Post, f"p-perf{i:05}").mode = "analyze"
        session.get(Post, "p-perf00023").is_demo = True
        session.get(Post, "p-perf00021").current_version_id = None
        session.commit()
        old_owned = before._owned(owner)
        assert {r.status for r in session.execute(select(old_owned))} == {
            "received", "failed", "not_rental", "published", "needs_review", "rejected"}
        ward = sorted(area_catalog()["thu-duc"].ward_codes)[0]
        filters = ({}, {"areas": ("thu-duc",)}, {"wards": (ward,)},
                   {"price_min": 2_100_000, "price_max": 2_700_000},
                   {"area_min": 20, "area_max": 40}, {"types": ("phong_tro",)},
                   {"areas": ("thu-duc", "quan-1"), "types": ("ccmn", "phong_tro"),
                    "price_min": 1_000_000, "area_max": 45},
                   {"wards": ("99999",)}, {"price_max": 1})
        checked = 0
        for group, sort, rental_only, values, page in itertools.product(
                ("all", "published", "waiting", "other"), my_posts.SORTS, (False, True), filters, (1, 2)):
            kwargs = dict(group=group, page=page, limit=7)
            expected = before.search(session, owner, api.settings,
                                     filters=before.Filters(sort=sort, rental_only=rental_only, **values), **kwargs)
            actual = my_posts.search(session, owner, api.settings,
                                     filters=my_posts.Filters(sort=sort, rental_only=rental_only, **values), **kwargs)
            assert actual == expected, (group, sort, rental_only, values, page)
            checked += 1
        print("PARITY", session.bind.dialect.name, checked, "full responses", flush=True)


def plan_nodes(node):
    yield node
    for child in node.get("Plans", ()):
        yield from plan_nodes(child)


def test_postgres_list_plan_is_set_based(api):
    with api.session() as session:
        if session.bind.dialect.name != "postgresql":
            pytest.skip("PostgreSQL EXPLAIN ANALYZE guard")
        owner = seed(session, 2000)
        session.execute(text("ANALYZE"))
        sub, order = my_posts._order(my_posts._filtered(owner, "all", my_posts.Filters()), my_posts.Filters())
        query = select(sub).order_by(*order).limit(20)
        sql = str(query.compile(session.bind, compile_kwargs={"literal_binds": True}))
        plan = session.execute(text("EXPLAIN (ANALYZE, FORMAT JSON) " + sql)).scalar_one()[0]
        HANDOFF.mkdir(exist_ok=True)
        (HANDOFF / "list-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
        nodes = list(plan_nodes(plan["Plan"]))
        worst_join = max((n.get("Rows Removed by Join Filter", 0) * n["Actual Loops"] for n in nodes), default=0)
        subplan_loops = max((n["Actual Loops"] for n in nodes if n.get("Parent Relationship") == "SubPlan"), default=0)
        print("PLAN", {"worst_join_removed": worst_join, "max_subplan_loops": subplan_loops}, flush=True)
        # Work bounds, not elapsed time: reject quadratic joins and per-owner correlated status work.
        assert worst_join <= 20_000, worst_join
        assert subplan_loops <= 20, subplan_loops


def test_comparisons_prepare_eligible_pool_once(api, monkeypatch):
    with api.session() as session:
        seed(session, 48, varied=True)
        targets = list(session.scalars(select(Listing).order_by(Listing.id).limit(20)))
        counts = {"ward": 0, "district": 0}
        original, original_district = rules.eligible_pool, rules.district_pool

        def counted(*args, **kwargs):
            counts["ward"] += 1
            return original(*args, **kwargs)

        def counted_district(*args, **kwargs):
            counts["district"] += 1
            return original_district(*args, **kwargs)

        monkeypatch.setattr(rules, "eligible_pool", counted)
        monkeypatch.setattr(rules, "district_pool", counted_district)
        results = market.comparisons(session, targets, api.settings)
        assert len(results) == 20
        assert counts["ward"] == 1, counts
        assert counts["district"] <= 2, counts
        print("POOL_CALLS", counts, flush=True)


def test_search_runs_status_once_and_keeps_empty_page_totals(api):
    with api.session() as session:
        owner = seed(session, 36)
        statements = []

        def record(_conn, _cursor, statement, _parameters, _context, _many):
            statements.append(statement)

        event.listen(session.bind, "before_cursor_execute", record)
        try:
            body = my_posts.search(session, owner, api.settings, group="all", page=999, limit=20)
        finally:
            event.remove(session.bind, "before_cursor_execute", record)
        assert body["items"] == []
        assert (body["total"], body["matched_listings"], body["total_sent"]) == (36, 36, 36)
        # The status job source occurs in just the shared page/summary statement.
        assert sum("jobs.kind" in sql for sql in statements) == 1


def test_candidate_load_does_not_materialize_orm_entities(api):
    with api.session() as session:
        seed(session, 36)
        listing = session.scalar(select(Listing).order_by(Listing.id))
        targets = market._targets(session, [listing])
        session.expunge_all()
        loaded = []

        def record_load(target, _context):
            loaded.append(type(target).__name__)

        for model in (Listing, Post):
            event.listen(model, "load", record_load)
        try:
            rows = market._candidate_rows(session, targets)
        finally:
            for model in (Listing, Post):
                event.remove(model, "load", record_load)
        assert rows
        assert all(isinstance(row, rules.MarketRow) for row in rows)
        assert loaded == []
        assert not session.identity_map


@pytest.mark.skipif(os.environ.get("PERF_MEASURE") != "1", reason="opt-in before/after measurement")
@pytest.mark.parametrize("size", [360, 5000])
def test_search_measurement(api, size):
    before = baseline_module("my-posts-before.py", "perf_timing_before")
    old_market = baseline_module("market-service-before.py", "perf_timing_market_before")
    old_market.m = baseline_module("market-pipeline-before.py", "perf_timing_rules_before")
    before.market = old_market
    with api.session() as session:
        seed(session, size)
        assert session.bind.dialect.name == "postgresql"
        session.execute(text("ANALYZE"))
        session.commit()
    results = {"posts": size, "runs_per_case": 5, "cases": {}}
    for case, group, values in (("newest", "all", {}), ("price_asc", "all", {"sort": "price_asc"}),
                                 ("area_newest", "all", {"areas": ("thu-duc",)}), ("waiting", "waiting", {})):
        def measure(module):
            with api.session() as session:
                owner = session.scalar(select(User).where(User.username == "collector"))
                statements = []

                def record(_conn, _cursor, statement, _parameters, _context, _many):
                    statements.append(statement)

                event.listen(session.bind, "before_cursor_execute", record)
                try:
                    start = perf_counter()
                    body = module.search(session, owner, api.settings, group=group, page=1, limit=20,
                                         filters=module.Filters(**values))
                    elapsed = (perf_counter() - start) * 1000
                finally:
                    event.remove(session.bind, "before_cursor_execute", record)
                return round(elapsed, 3), len(statements), body

        _, _, expected = measure(before)
        assert measure(my_posts)[2] == expected
        timings = {label: {"runs_ms": [], "sql_statements": []} for label in ("before", "after")}
        for repeat in range(5):
            cases = (("before", before), ("after", my_posts))
            for label, module in cases if repeat % 2 == 0 else reversed(cases):
                elapsed, count, body = measure(module)
                assert body == expected
                timings[label]["runs_ms"].append(elapsed)
                timings[label]["sql_statements"].append(count)
                print("TIMING", size, case, label, elapsed, "ms", count, "SQL", flush=True)
        for metric in timings.values():
            metric["median_ms"] = round(median(metric["runs_ms"]), 3)
        results["cases"][case] = timings
    (HANDOFF / f"perf-timings-{size}.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print("MEASUREMENT", json.dumps(results), flush=True)
