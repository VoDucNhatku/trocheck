"""Durable reservations count attempted provider calls, including rolled-back jobs."""
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LlmDailyUsage(Base):
    __tablename__ = "llm_daily_usage"
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    calls: Mapped[int] = mapped_column(Integer, nullable=False)
    review_calls: Mapped[int] = mapped_column(Integer, nullable=False)
