"""The diagnostic CLI prints aggregates and geographic labels, never raw post content."""
import json

from sqlalchemy import event, select

from app import cli
from app.models import Listing, Post
from tests.test_predict_comparison import add_listing


def test_eligibility_report_is_read_only_and_private(api, monkeypatch, capsys):
    phone = "090" + "123" + "4567"
    link = "https://www.facebook.com/groups/invented-room/posts/000000000001"
    person = "Example Private Person"
    raw = f"Phòng trọ phường Linh Trung, Thủ Đức, 22m2, 2tr. {person} {phone} {link}"
    with api.session() as session:
        add_listing(session, "unresolved-1", text=raw, review_status="needs_review")
        add_listing(session, "unresolved-2", text="Phòng trọ Linh Trung, Thủ Đức", review_status="needs_review")
        add_listing(session, "unknown", text=f"Địa chỉ: khu thử nghiệm chưa có từ điển. {person}",
                    district=None, rent_basis="unknown", rent_form="none", rent_amount_vnd=None)
        add_listing(session, "eligible", ward="TEST-WARD")
        demo = add_listing(session, "demo", ward="TEST-WARD")
        demo.post.is_demo = True
        session.commit()
        before = [(row.id, row.review_status, row.rent_amount_vnd) for row in session.scalars(select(Listing))]
        contributed = dict(session.execute(select(Post.id, Post.contributed)).all())
    monkeypatch.setattr(cli, "get_settings", lambda: api.settings)
    statements = []
    with api.session() as session:
        engine = session.bind
    def record(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)
    event.listen(engine, "before_cursor_execute", record)
    try:
        cli.main(["eligibility-report"])
    finally:
        event.remove(engine, "before_cursor_execute", record)
    output = capsys.readouterr().out
    assert all(value not in output for value in (raw, phone, link, person, "facebook", "https://"))
    body = json.loads(output)
    assert body["total_listings"] == 4 and body["eligible_listings"] == 1
    assert body["excluded_counts"] == {"ward_unresolved": 3, "not_accepted": 2,
                                       "basis_unknown": 1, "price_not_exact": 1}
    assert body["reason_combinations"][0] == {"reasons": ["not_accepted", "ward_unresolved"], "n": 2}
    assert len(body["reason_combinations"]) <= 10
    phrases = {row["phrase"]: row["n"] for row in body["unresolved_location_phrases"]}
    assert phrases["Phường Linh Trung"] == 2
    assert phrases["[unrecognized location withheld]"] == 1
    assert len(phrases) <= 30 and all(len(phrase) <= 80 for phrase in phrases)
    assert all(sql.lstrip().upper().startswith("SELECT") for sql in statements)
    with api.session() as session:
        assert before == [(row.id, row.review_status, row.rent_amount_vnd) for row in session.scalars(select(Listing))]
        assert contributed == dict(session.execute(select(Post.id, Post.contributed)).all())


def test_report_counts_older_cluster_members_and_ignores_superseded_listings(api):
    from datetime import timedelta

    from app.core.ids import utcnow
    from app.models import Cluster
    from app.services.market import eligibility_report

    with api.session() as session:
        session.add(Cluster(id="same"))
        session.flush()
        add_listing(session, "older", ward="TEST-WARD", cluster_id="same", observed_at=utcnow() - timedelta(hours=1))
        add_listing(session, "newer", ward="TEST-WARD", cluster_id="same")
        add_listing(session, "superseded", is_current=False)
        body = eligibility_report(session, api.settings)
    assert body["total_listings"] == 2 and body["eligible_listings"] == 1
    assert body["excluded_counts"] == {"older_in_cluster": 1}
    assert body["reason_combinations"] == [{"reasons": ["older_in_cluster"], "n": 1}]
