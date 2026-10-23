"""Read-only account directory and sources observed in shared posts. No crawler configuration exists."""
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.ids import iso
from app.models import Post, User
from app.services.users import ROLES


def list_users(session: Session, viewer: User, *, q: str, role: str | None, page: int, page_size: int) -> dict:
    query = select(User)
    if q:
        # Researcher search must not become an oracle for hidden email addresses.
        match = User.username.icontains(q, autoescape=True)
        if "admin" in viewer.roles:
            match = or_(match, User.email.icontains(q, autoescape=True))
        query = query.where(match)
    # Roles are a JSON array; do membership in Python, not a substring match in JSON text.
    rows = list(session.scalars(query.order_by(User.username, User.id)))
    if role:
        rows = [user for user in rows if role in user.roles]
    total = len(rows)
    items = []
    for user in rows[(page - 1) * page_size:page * page_size]:
        redacted = "admin" not in viewer.roles and user.email is not None
        items.append({"user_id": user.id, "username": user.username,
                      "roles": [role for role in user.roles if role in ROLES],
                      "email": "***@***" if redacted else user.email, "email_redacted": redacted,
                      "created_at": iso(user.created_at)})
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "current_user_id": viewer.id}


def list_sources(session: Session, *, include_demo: bool, page: int, page_size: int) -> dict:
    query = select(Post.source_type, Post.source_group_id, Post.source_group_name, Post.is_demo,
                   func.count().label("posts_count"), func.max(Post.last_seen_at).label("last_seen_at")) \
        .where(or_(Post.mode == "collect", Post.contributed.is_(True)))
    if not include_demo:
        query = query.where(Post.is_demo.is_(False))
    groups = query.group_by(Post.source_type, Post.source_group_id, Post.source_group_name, Post.is_demo).subquery()
    total = session.scalar(select(func.count()).select_from(groups))
    rows = session.execute(select(groups).order_by(groups.c.last_seen_at.desc(), groups.c.source_type,
                           groups.c.source_group_id, groups.c.source_group_name, groups.c.is_demo)
                           .offset((page - 1) * page_size).limit(page_size)).mappings()
    return {"items": [{**dict(row), "last_seen_at": iso(row["last_seen_at"])} for row in rows],
            "total": total, "page": page, "page_size": page_size,
            "configuration_available": False}
