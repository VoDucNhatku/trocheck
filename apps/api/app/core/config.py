"""Settings from environment / .env (see .env.example at the repo root).

Business thresholds are configuration, not constants (ADR-0005, gop-trung-va-thong-ke §5).
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(REPO_ROOT / ".env",), extra="ignore")

    # API
    database_url: str = f"sqlite:///{(REPO_ROOT / 'data' / 'db' / 'rener.sqlite').as_posix()}"
    secret_key: str = "change-me"
    allowed_origins: str = "http://localhost:3000"
    session_cookie_name: str = "rener_session"
    session_max_age_seconds: int = 7 * 24 * 3600
    extension_token_days: int = 30
    cookie_secure: bool = False
    # Explicit opt-in for local development only; production has no mail delivery yet.
    password_reset_dev_log: bool = False
    password_reset_base_url: str = "http://localhost:3000"
    # Google OAuth credentials stay on the API server, never in the browser bundle.
    google_client_id: str = ""
    google_client_secret: str = Field(default="", repr=False)
    google_redirect_uri: str = ""

    # Limits (api-contract §5)
    max_text_length: int = 20_000
    ingest_batch_max: int = 20
    ingest_rate_per_minute: int = 60
    max_running_analyses_per_user: int = 1
    register_rate_limit: int = Field(default=10, ge=1, le=1000)
    register_window_seconds: int = Field(default=600, ge=1, le=86400)
    idempotency_retention_days: int = 7
    assess_retention_days: int = 7

    # Worker / LLM (worker only; the key is never read by the API process)
    gemini_api_key: str = ""
    gemini_model_id: str = ""
    llm_max_attempts: int = 3
    llm_timeout_seconds: float = 45
    llm_temperature: float = 0.0
    job_max_attempts: int = 5
    job_lock_seconds: int = 120
    worker_poll_seconds: float = 1.0

    # Business rules (gop-trung-va-thong-ke)
    market_min_n: int = 10
    market_window_days: int = 30
    market_near_median_percent: float = 10.0
    market_similar_count: int = 3
    dedup_area_tolerance_m2: float = 2.0
    dedup_price_tolerance_percent: float = 10.0
    dedup_suggest_cosine: float = 0.8
    dedup_auto_cosine: float = 0.9

    # Demo data (spec/fixtures + generated demo posts) is shown only in demo mode
    # and never mixed into real statistics or evaluation (AT17).
    demo_mode: bool = False
    seed_password: str = ""

    eval_runs_dir: Path = REPO_ROOT / "eval" / "runs"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
