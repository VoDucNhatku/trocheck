"""ULID ids (data dictionary §3: `id` is a ULID) and UTC timestamps."""
import os
import time
from datetime import UTC, datetime, timedelta

_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def new_id() -> str:
    """26-char Crockford base32 ULID: 48-bit ms timestamp + 80 random bits."""
    value = (int(time.time() * 1000) << 80) | int.from_bytes(os.urandom(10), "big")
    chars = []
    for _ in range(26):
        value, rem = divmod(value, 32)
        chars.append(_ALPHABET[rem])
    return "".join(reversed(chars))


def utcnow() -> datetime:
    """Naive UTC (SQLite stores no zone; every timestamp in the DB is UTC)."""
    return datetime.now(UTC).replace(microsecond=0, tzinfo=None)


VN_OFFSET = timedelta(hours=7)


def vn_day_start(now: datetime | None = None) -> datetime:
    """Start of the current day in Vietnam (UTC+7, no daylight saving) as naive UTC. Daily limits reset here."""
    local = (now or utcnow()) + VN_OFFSET
    return local.replace(hour=0, minute=0, second=0, microsecond=0) - VN_OFFSET


def seconds_to_vn_midnight(now: datetime | None = None) -> int:
    now = now or utcnow()
    return int((vn_day_start(now) + timedelta(days=1) - now).total_seconds()) + 1


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt.astimezone(UTC).replace(tzinfo=None) if dt.tzinfo else dt


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")
