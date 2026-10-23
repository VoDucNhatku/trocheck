"""M3b grounded LLM extraction (pipeline-xu-ly §M3b, ADR-0003).

The LLM returns verbatim quotes + labels + listing_index (+ post_type), never converted numbers.
Every quote must be found in the post text; a quote that is not found is dropped (anti-hallucination).
The network client is injected (llm_client.GeminiClient in the worker, a fake in tests).
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Literal, Protocol

from pydantic import BaseModel, ValidationError

from app.pipeline.regex_extractor import Span

PROMPTS = Path(__file__).parent / "prompts"
PROMPT_FILE = PROMPTS / "extract_v1.md"


class LlmResponse(BaseModel):
    text: str
    tokens_in: int = 0
    tokens_out: int = 0


class LlmTransientError(Exception):
    """Network error, timeout, 429 or 5xx. `retry_after` is the provider's wait hint (seconds)."""

    def __init__(self, code: str, retry_after: float | None = None):
        super().__init__(code)
        self.code = code
        self.retry_after = retry_after


class LlmFatalError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class LlmClient(Protocol):
    model_id: str
    temperature: float

    def generate(self, prompt: str) -> LlmResponse: ...


class LlmSpanOut(BaseModel):
    listing_index: int = 0
    label: Literal["PRICE", "AREA", "LOC", "ROOM", "FEE"]
    quote: str


class LlmOutput(BaseModel):
    post_type: Literal["rental_offer", "seeking", "roommate", "sale", "spam", "other"]
    spans: list[LlmSpanOut] = []


@dataclass
class LlmOutcome:
    status: str  # ok | error
    post_type: str | None = None
    spans: list[Span] = field(default_factory=list)
    dropped_quotes: int = 0
    calls: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0
    error_code: str | None = None
    raw: dict | None = None


def prompt_version() -> str:
    first = PROMPT_FILE.read_text(encoding="utf-8").splitlines()[0]
    return first.split("prompt_version:", 1)[1].strip(" ->")


def build_prompt(text: str) -> str:
    template = PROMPT_FILE.read_text(encoding="utf-8")
    return template.replace("{{POST_TEXT}}", text)


def _occurrences(text: str, quote: str) -> list[int]:
    out, i = [], text.find(quote)
    while i >= 0:
        out.append(i)
        i = text.find(quote, i + 1)
    return out


def ground(text: str, output: LlmOutput) -> tuple[list[Span], int]:
    """Locate each quote in the post. Ambiguous quotes pick the occurrence nearest to the
    other spans of the same listing. Returns (spans, number of dropped quotes)."""
    located: list[tuple[LlmSpanOut, list[int]]] = []
    dropped = 0
    for item in output.spans:
        quote = item.quote.strip()
        hits = _occurrences(text, quote) if quote else []
        if not hits:
            dropped += 1
            continue
        located.append((item.model_copy(update={"quote": quote}), hits))
    anchors: dict[int, list[int]] = {}
    for item, hits in located:
        if len(hits) == 1:
            anchors.setdefault(item.listing_index, []).append(hits[0])
    spans = []
    used: dict[str, set[int]] = {}
    for item, hits in sorted(located, key=lambda x: x[0].listing_index):
        taken = used.setdefault(item.quote, set())
        free = [h for h in hits if h not in taken] or hits  # same quote in two rooms -> two places
        start = free[0]
        if len(free) > 1 and anchors.get(item.listing_index):
            center = sum(anchors[item.listing_index]) / len(anchors[item.listing_index])
            start = min(free, key=lambda h: abs(h - center))
        if item.label in ("PRICE", "AREA", "ROOM"):
            taken.add(start)
        spans.append(Span(start, start + len(item.quote), item.quote, item.label, "llm", None,
                          item.listing_index))
    spans.sort(key=lambda sp: (sp.listing_index, sp.start))
    return spans, dropped


def _parse(raw_text: str) -> tuple[LlmOutput, dict]:
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").split("\n", 1)[1] if "\n" in raw_text else raw_text
    data = json.loads(raw_text)
    return LlmOutput.model_validate(data), data


def extract(text: str, client: LlmClient, *, max_attempts: int,
            sleep: Callable[[float], None] = time.sleep,
            cached: dict | None = None) -> LlmOutcome:
    """Call the LLM at most `max_attempts` times in total (retries included)."""
    if cached is not None:
        output = LlmOutput.model_validate(cached)
        spans, dropped = ground(text, output)
        return LlmOutcome("ok", output.post_type, spans, dropped, raw=cached)
    outcome = LlmOutcome("error")
    prompt = build_prompt(text)
    started = time.monotonic()
    for attempt in range(1, max_attempts + 1):
        outcome.calls += 1
        try:
            response = client.generate(prompt)
            outcome.tokens_in += response.tokens_in
            outcome.tokens_out += response.tokens_out
            output, raw = _parse(response.text)
        except LlmTransientError as exc:
            outcome.error_code = exc.code
            if attempt < max_attempts:
                sleep(exc.retry_after if exc.retry_after is not None else 2 ** attempt)
            continue
        except (json.JSONDecodeError, ValidationError, IndexError):
            outcome.error_code = "invalid_output"
            continue
        except LlmFatalError as exc:
            outcome.error_code = exc.code
            break
        spans, dropped = ground(text, output)
        outcome.status, outcome.post_type, outcome.spans = "ok", output.post_type, spans
        outcome.dropped_quotes, outcome.raw, outcome.error_code = dropped, raw, None
        break
    outcome.latency_ms = int((time.monotonic() - started) * 1000)
    return outcome
