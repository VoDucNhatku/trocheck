"""FastAPI app. OpenAPI at /docs; web and extension generate their client from /openapi.json.

    uvicorn app.main:app --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.auth_password import router as password_router
from app.api.team_admin import router as team_admin_router
from app.core import errors
from app.core.config import get_settings
from app.core.registration_limit import RegistrationLimit


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="ReNER-VN API",
        version="0.1.0",
        description="Trích xuất giá thuê trọ từ bài đăng và nhận định giá theo tin tương tự. "
                    "Giá chào thuê trong bài đăng đã thu, không phải giá giao dịch.",
    )
    app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])
    errors.install(app)
    app.state.registration_limit = RegistrationLimit()
    app.include_router(router)
    app.include_router(password_router)
    app.include_router(team_admin_router)
    return app


app = create_app()
