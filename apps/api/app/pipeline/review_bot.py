"""Pure, grounded shadow review. This module cannot publish or edit a listing."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.pipeline.llm_extractor import LlmClient, LlmFatalError, LlmTransientError
from app.pipeline.normalize import parse_rent

PROMPT_FILE = Path(__file__).parent / "prompts" / "review_bot_v1.md"


class Check(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    passed: bool | None
    quote: str | None


class Checks(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rental_offer: Check
    single_room: Check
    rent_supported: Check
    location_supported: Check


class Verdict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    verdict: Literal["approve", "reject", "unsure"]
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    reason: str = Field(min_length=1, max_length=500)
    checks: Checks


@dataclass
class BotOutcome:
    status: str = "error"
    verdict: str | None = None
    confidence: float | None = None
    reason: str = "Không đọc được kết quả duyệt của bot."
    checks: dict = field(default_factory=dict)
    error_code: str | None = None
    retryable: bool = False
    calls: int = 0
    tokens_in: int = 0
    tokens_out: int = 0


def prompt_version() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8").splitlines()[0].split("prompt_version:", 1)[1].strip(" ->")


def review(text: str, listing: dict, review_reasons: list[str], client: LlmClient) -> BotOutcome:
    """One attempt; the durable queue handles retries and budgets outside the pure pipeline."""
    payload = json.dumps({"post_text": text, "listing": listing, "review_reasons": review_reasons},
                         ensure_ascii=False)
    prompt = PROMPT_FILE.read_text(encoding="utf-8").replace("{{INPUT_JSON}}", payload)
    outcome = BotOutcome(calls=1)
    try:
        response = client.generate(prompt)
        outcome.tokens_in, outcome.tokens_out = response.tokens_in, response.tokens_out
        output = Verdict.model_validate_json(response.text)
    except (ValidationError, ValueError):
        outcome.error_code = "invalid_output"
        return outcome
    except LlmTransientError as exc:
        outcome.error_code, outcome.retryable = exc.code, True
        outcome.reason = "Dịch vụ mô hình tạm thời không khả dụng."
        return outcome
    except LlmFatalError as exc:
        outcome.error_code = exc.code
        outcome.reason = "Dịch vụ mô hình từ chối yêu cầu."
        return outcome

    checks = output.checks.model_dump()
    rent_quote = checks["rent_supported"]["quote"]
    quoted_rent = parse_rent(rent_quote) if rent_quote else {}
    stored_rent = listing.get("rent", {})
    verdict, reason = output.verdict, output.reason.strip()
    if not reason:
        outcome.error_code = "invalid_output"
        return outcome
    if any(check["quote"] is not None and (not check["quote"].strip() or check["quote"] not in text)
           for check in checks.values()):
        verdict, reason = "unsure", "Không tìm thấy trích dẫn nguyên văn trong bài đăng."
    elif "rent" in listing and any(quoted_rent.get(key) is not None and quoted_rent[key] != stored_rent.get(key)
             for key in ("amount_vnd", "min_vnd", "max_vnd")):
        verdict, reason = "unsure", "Trích dẫn giá không khớp với giá đang lưu của tin."
    elif verdict == "approve" and (
        not all(check["passed"] is True for check in checks.values())
        or any(not checks[name]["quote"] for name in ("rent_supported", "location_supported"))
    ):
        verdict, reason = "unsure", "Chưa đủ bằng chứng xác nhận giá, vị trí và một phòng cho thuê."
    outcome.status, outcome.verdict, outcome.reason = "ok", verdict, reason
    outcome.confidence, outcome.checks = output.confidence, checks
    return outcome
