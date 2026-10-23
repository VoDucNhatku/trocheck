"""Standard error body (api-contract §1). No traceback or API key ever reaches the client."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.ids import new_id

log = logging.getLogger("rener.api")

STATUS_CODES = {401: "unauthenticated", 403: "forbidden", 404: "not_found", 409: "conflict",
                422: "validation_error", 429: "rate_limited", 503: "unavailable"}


class ApiError(Exception):
    def __init__(self, status: int, code: str | None = None, message: str = "",
                 field_errors: dict | None = None, headers: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code or STATUS_CODES.get(status, "error")
        self.message = message
        self.field_errors = field_errors
        self.headers = headers


def not_found(what: str = "Không tìm thấy") -> ApiError:
    return ApiError(404, message=what)


def forbidden(message: str = "Tài khoản không có quyền thực hiện thao tác này") -> ApiError:
    return ApiError(403, message=message)


def conflict(message: str) -> ApiError:
    return ApiError(409, message=message)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or new_id()


def _body(request: Request, code: str, message: str, field_errors: dict | None = None) -> dict:
    error = {"code": code, "message": message, "request_id": _request_id(request)}
    if field_errors:
        error["field_errors"] = field_errors
    return {"error": error}


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_id(request: Request, call_next):
        request.state.request_id = new_id()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError):
        return JSONResponse(_body(request, exc.code, exc.message, exc.field_errors),
                            status_code=exc.status, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields = {}
        for err in exc.errors():
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            fields[".".join(loc) or "body"] = err["msg"]
        return JSONResponse(_body(request, "validation_error", "Dữ liệu gửi lên không hợp lệ", fields),
                            status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 400:  # unparsable body: same contract as any invalid data
            return JSONResponse(_body(request, "validation_error", "Body không phải JSON hợp lệ"), status_code=422)
        code = STATUS_CODES.get(exc.status_code, "error")
        return JSONResponse(_body(request, code, str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):
        log.exception("unhandled error request_id=%s", _request_id(request))
        return JSONResponse(_body(request, "internal_error", "Lỗi máy chủ"), status_code=500)
