"""Bounded, per-process sliding window for the local single-process API."""
from collections import deque
from math import ceil
from threading import Lock
from time import monotonic

from app.core.errors import ApiError


class RegistrationLimit:
    def __init__(self):
        self._attempts: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, ip: str, limit: int, window: int) -> None:
        now = monotonic()
        with self._lock:
            for key in list(self._attempts):
                queue = self._attempts[key]
                while queue and queue[0] <= now - window:
                    queue.popleft()
                if not queue:
                    del self._attempts[key]
            if ip not in self._attempts and len(self._attempts) >= 10000:
                raise ApiError(429, message="Hãy thử tạo tài khoản sau", headers={"Retry-After": str(window)})
            queue = self._attempts.setdefault(ip, deque())
            if len(queue) >= limit:
                raise ApiError(429, message="Bạn đã thử tạo tài khoản nhiều lần. Hãy thử lại sau.",
                               headers={"Retry-After": str(max(1, ceil(queue[0] + window - now)))})
            queue.append(now)
