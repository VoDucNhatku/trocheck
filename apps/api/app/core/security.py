"""Password hashing, signed session cookies and extension tokens (stdlib only)."""
from __future__ import annotations

import base64
import os
import hashlib
import hmac
import json
import secrets
import time
import re

PBKDF2_ROUNDS = int(os.environ.get("RENER_PBKDF2_ROUNDS", "240000"))


def validate_password(value: str) -> str:
    if not 8 <= len(value) <= 200 or not any(c.isupper() for c in value):
        raise ValueError("Mật khẩu cần 8–200 ký tự và ít nhất một chữ hoa")
    return value


def normalize_email(value: str) -> str:
    value = value.strip().casefold()
    if len(value) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise ValueError("Nhập email đúng định dạng")
    return value


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt, digest = stored.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
    return hmac.compare_digest(check.hex(), digest)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def sign_session(user_id: str, secret: str, max_age: int, version: int = 0) -> str:
    payload = _b64(json.dumps({"u": user_id, "v": version, "exp": int(time.time()) + max_age}).encode())
    sig = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_session(cookie: str, secret: str, version: int | None = None) -> str | None:
    try:
        payload, sig = cookie.split(".")
    except ValueError:
        return None
    expected = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    data = json.loads(_unb64(payload))
    if data.get("exp", 0) < time.time():
        return None
    if version is not None and data.get("v", 0) != version:
        return None
    return data.get("u")


def new_token() -> str:
    return "rnr_" + secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def content_hash(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
