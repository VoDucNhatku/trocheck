"""Gemini REST client (worker only). The only module allowed to reach the network.

The API key comes from GEMINI_API_KEY in the worker environment and is sent in the
`x-goog-api-key` header; it is never logged or returned in errors.
"""
from __future__ import annotations

import re

import httpx

from app.pipeline.llm_extractor import LlmFatalError, LlmResponse, LlmTransientError

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiClient:
    def __init__(self, api_key: str, model_id: str, *, temperature: float = 0.0, timeout: float = 45):
        if not api_key or not model_id:
            raise ValueError("GEMINI_API_KEY and GEMINI_MODEL_ID are required for the LLM step")
        self._key = api_key
        self.model_id = model_id
        self.temperature = temperature
        self._http = httpx.Client(timeout=timeout)

    def generate(self, prompt: str) -> LlmResponse:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": self.temperature, "responseMimeType": "application/json"},
        }
        try:
            resp = self._http.post(ENDPOINT.format(model=self.model_id), json=body,
                                   headers={"x-goog-api-key": self._key})
        except httpx.TimeoutException:
            raise LlmTransientError("timeout") from None
        except httpx.HTTPError:
            raise LlmTransientError("network") from None
        if resp.status_code == 429 or resp.status_code >= 500:
            raise LlmTransientError(f"http_{resp.status_code}", _retry_after(resp))
        if resp.status_code >= 400:
            raise LlmFatalError(f"http_{resp.status_code}")
        data = resp.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            raise LlmTransientError("empty_candidate") from None
        usage = data.get("usageMetadata", {})
        return LlmResponse(text=text, tokens_in=usage.get("promptTokenCount", 0),
                           tokens_out=usage.get("candidatesTokenCount", 0))


def _retry_after(resp: httpx.Response) -> float | None:
    header = resp.headers.get("retry-after")
    if header and header.isdigit():
        return float(header)
    try:
        for detail in resp.json().get("error", {}).get("details", []):
            delay = detail.get("retryDelay")
            if delay:
                m = re.match(r"([\d.]+)s", delay)
                if m:
                    return float(m.group(1))
    except ValueError:
        pass
    return None
