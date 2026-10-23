"""Contract, privacy, authorization and read-only behavior for team directories."""
import pytest
from sqlalchemy import select

from app.models import Post, User


@pytest.mark.parametrize("endpoint", ["users", "sources"])
def test_directory_permissions_and_read_only(api, endpoint):
    path = "/api/v1/team/" + endpoint
    assert api.client().get(path).status_code == 401
    for role in ["renter", "collector", "reviewer"]:
        assert api.client(role).get(path).status_code == 403
    for role in ["admin", "researcher"]:
        client = api.client(role)
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "private, no-store"
        for method in ["post", "patch", "put", "delete"]:
            assert getattr(client, method)(path).status_code == 405
    for query in ["page=0", "page_size=101", "page=-1"]:
        assert api.client("admin").get(path + "?" + query).status_code == 422


def test_directory_email_redaction_filter_pagination(api):
    with api.session() as session:
        renter = session.scalar(select(User).where(User.username == "renter"))
        renter.email = "private-address@example.invalid"
        session.commit()
    admin = api.client("admin")
    researcher = api.client("researcher")
    row = admin.get("/api/v1/team/users?q=renter").json()["items"][0]
    assert row["email"] == "private-address@example.invalid"
    assert row["email_redacted"] is False
    response = researcher.get("/api/v1/team/users?q=renter")
    assert "private-address" not in response.text and "example.invalid" not in response.text
    assert response.json()["items"][0]["email"] == "***@***"
    assert researcher.get("/api/v1/team/users?q=private-address").json()["total"] == 0
    assert admin.get("/api/v1/team/users?q=private-address").json()["total"] == 1
    for viewer in [admin, researcher]:
        body = viewer.get("/api/v1/team/users").json()
        assert body["total"] == 6
        assert all(set(row) == {"user_id", "username", "email", "email_redacted", "roles", "created_at"}
                   for row in body["items"])
        first = viewer.get("/api/v1/team/users?page_size=2").json()
        second = viewer.get("/api/v1/team/users?page_size=2&page=2").json()
        assert len(first["items"]) == len(second["items"]) == 2
        assert not {row["user_id"] for row in first["items"]} & {row["user_id"] for row in second["items"]}
    assert admin.get("/api/v1/team/users?role=reviewer").json()["total"] == 2
    assert admin.get("/api/v1/team/users?q=%25").json()["total"] == 0
    assert admin.get("/api/v1/team/users?role=owner").status_code == 422


def test_sources_aggregate_shared_posts_without_inventing_crawler_state(api):
    with api.session() as session:
        owner = session.scalar(select(User).where(User.username == "collector"))
        for demo, mode, contributed, group in [(False, "collect", False, "group-a"),
                                               (False, "collect", False, "group-a"),
                                               (True, "collect", False, "group-demo"),
                                               (False, "analyze", False, "private-group"),
                                               (False, "analyze", True, "contributed-group")]:
            session.add(Post(collector_id=owner.id, mode=mode, contributed=contributed, is_demo=demo,
                             source_type="facebook_group", source_group_id=group, source_group_name=group))
        session.commit()
    client = api.client("researcher")
    body = client.get("/api/v1/team/sources?demo=true").json()
    assert body["total"] == 2  # DEMO_MODE=false cannot be bypassed by a query.
    assert body["configuration_available"] is False
    assert {row["source_group_id"]: row["posts_count"] for row in body["items"]} == {
        "group-a": 2, "contributed-group": 1}
    assert all(set(row) == {"source_type", "source_group_id", "source_group_name", "is_demo",
                            "posts_count", "last_seen_at"} for row in body["items"])
    api.set_demo(True)
    assert client.get("/api/v1/team/sources").json()["total"] == 3
    assert client.get("/api/v1/team/sources?demo=false").json()["total"] == 2
    page = client.get("/api/v1/team/sources?page_size=1&page=2").json()
    assert len(page["items"]) == 1 and page["total"] == 3
    with api.session() as session:
        assert len(list(session.scalars(select(Post)))) == 5  # GET did not mutate records.
