"""Room photos from the extension: checked here, stored on Cloudinary, listed for the public site.

Cloudinary signed upload (cloudinary.com/documentation/upload_images#authenticated_requests,
/authentication_signatures): sign every parameter except file, api_key, resource_type and cloud_name,
sorted by name and joined with '&', with the API secret appended, hashed with SHA-1.
"""
from __future__ import annotations

import hashlib
import time
from typing import Callable

import httpx
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.core.ids import seconds_to_vn_midnight, vn_day_start
from app.models import IdempotencyKey, Post, PostImage, User
from app.services import users

Uploader = Callable[[bytes, str, Settings], dict]


def sign(params: dict[str, object], secret: str) -> str:
    payload = "&".join(f"{key}={params[key]}" for key in sorted(params))
    return hashlib.sha1((payload + secret).encode("utf-8")).hexdigest()


def sniff(data: bytes) -> str | None:
    """Trust the bytes, not the Content-Type header."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def configured(settings: Settings) -> bool:
    return bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)


def upload_to_cloudinary(data: bytes, public_id: str, settings: Settings) -> dict:
    params = {"folder": settings.cloudinary_folder, "public_id": public_id, "timestamp": int(time.time())}
    form = {**{k: str(v) for k, v in params.items()}, "api_key": settings.cloudinary_api_key,
            "signature": sign(params, settings.cloudinary_api_secret)}
    url = f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}/image/upload"
    try:
        response = httpx.post(url, data=form, files={"file": ("photo", data)}, timeout=30)
    except httpx.HTTPError:
        raise ApiError(502, code="image_store_unreachable", message="Không kết nối được nơi lưu ảnh. Hãy thử lại sau.")
    if response.status_code != 200:
        raise ApiError(502, code="image_store_rejected", message="Nơi lưu ảnh từ chối ảnh này.")
    body = response.json()
    if not str(body.get("secure_url", "")).startswith("https://res.cloudinary.com/"):
        raise ApiError(502, code="image_store_rejected", message="Nơi lưu ảnh trả về kết quả lạ.")
    return body


def add(session: Session, user: User, idempotency_key: str, data: bytes, settings: Settings,
        uploader: Uploader | None = None) -> dict:
    if not configured(settings):
        raise ApiError(503, code="images_unavailable", message="Máy chủ chưa bật lưu ảnh.")
    seen = session.get(IdempotencyKey, (idempotency_key, user.id))
    post = session.get(Post, seen.result_ref) if seen and seen.result_ref else None
    if post is None:
        raise ApiError(404, message="Chưa có bài này trong kho. Gửi bài trước rồi gửi ảnh.")
    if not data or len(data) > settings.post_image_max_bytes:
        raise ApiError(413, code="image_too_large", message="Ảnh rỗng hoặc lớn hơn giới hạn cho phép.")
    if sniff(data) is None:
        raise ApiError(415, code="image_type", message="Chỉ nhận ảnh JPEG, PNG hoặc WebP.")
    digest = hashlib.sha256(data).hexdigest()
    existing = session.scalar(select(PostImage).where(PostImage.post_id == post.id, PostImage.content_hash == digest))
    if existing is not None:
        return {"status": "duplicate", "url": existing.url}
    count = len(session.scalars(select(PostImage.id).where(PostImage.post_id == post.id)).all())
    if count >= settings.post_image_max_per_post:
        raise ApiError(409, code="image_limit", message="Bài này đã đủ số ảnh cho phép.")
    if settings.ingest_image_daily_limit and not users.has_role(user, "collector"):
        today = session.scalar(select(func.count()).select_from(PostImage)
                               .where(PostImage.uploaded_by == user.id, PostImage.created_at >= vn_day_start()))
        if today >= settings.ingest_image_daily_limit:
            raise ApiError(429, code="daily_limit",
                           message=f"Hôm nay tài khoản này đã gửi đủ {settings.ingest_image_daily_limit} ảnh.",
                           headers={"Retry-After": str(seconds_to_vn_midnight())})
    stored = (uploader or upload_to_cloudinary)(data, f"{post.id}-{digest[:16]}", settings)
    image = PostImage(post_id=post.id, content_hash=digest, url=stored["secure_url"], public_id=str(stored.get("public_id", "")),
                      width=stored.get("width"), height=stored.get("height"), uploaded_by=user.id)
    session.add(image)
    try:
        session.commit()
    except IntegrityError:  # the same file raced in twice
        session.rollback()
        return {"status": "duplicate", "url": stored["secure_url"]}
    return {"status": "created", "url": image.url}


def display_url(url: str) -> str:
    """A 3:2 crop sized for the site instead of the full original."""
    return url.replace("/image/upload/", "/image/upload/c_fill,w_720,h_480,q_auto,f_auto/", 1)


def recent(session: Session, limit: int) -> dict:
    rows = session.execute(
        select(PostImage.url, PostImage.post_id).join(Post, Post.id == PostImage.post_id)
        .where(Post.contributed.is_(True), Post.is_demo.is_(False))
        .order_by(PostImage.created_at.desc()).limit(limit * 4)).all()
    items, posts = [], set()
    for url, post_id in rows:
        if post_id in posts:
            continue
        posts.add(post_id)
        items.append({"url": display_url(url), "width": 720, "height": 480})
        if len(items) == limit:
            break
    return {"items": items}
