"""M3b grounding and M5 reconciliation with a fake LLM (no network)."""
import json

from app.pipeline.engine import run_pipeline
from app.pipeline.llm_extractor import LlmResponse, LlmTransientError
from tests.conftest import load_fixture


class FakeLLM:
    model_id = "fake-model"
    temperature = 0.0

    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls = 0

    def generate(self, prompt):
        self.calls += 1
        out = self.outputs.pop(0) if self.outputs else self.last
        self.last = out
        if isinstance(out, Exception):
            raise out
        return LlmResponse(text=out if isinstance(out, str) else json.dumps(out, ensure_ascii=False),
                           tokens_in=10, tokens_out=5)


def spans(*items):
    return [{"listing_index": i, "label": label, "quote": q} for i, label, q in items]


F01 = load_fixture("F01-basic-ccmn")["input"]["text"]
F01_LLM = {"post_type": "rental_offer", "spans": spans(
    (0, "ROOM", "CCMN"), (0, "AREA", "30m2"), (0, "PRICE", "5tr5/th/phòng"),
    (0, "FEE", "điện 3k5/số"), (0, "FEE", "nước 100k/người"), (0, "FEE", "cọc 1 tháng"),
    (0, "LOC", "gần ĐH FPT"))}


def test_both_agree_auto_accepts():
    result = run_pipeline(F01, llm=FakeLLM(F01_LLM), mode="eval_hybrid")
    listing = result.extraction["listings"][0]
    assert result.llm_status == "ok"
    assert listing["rent"]["agreement"] == "both_agree"
    assert listing["rent"]["amount_vnd"] == 5_500_000
    assert result.listing_meta[0].review_status == "auto_accepted"


def test_hallucinated_quote_is_dropped():
    # AT13: the LLM invents "6tr/tháng", which is not in the post.
    bad = {"post_type": "rental_offer", "spans": spans((0, "PRICE", "6tr/tháng"), (0, "AREA", "30m2"))}
    result = run_pipeline(F01, llm=FakeLLM(bad), mode="eval_hybrid")
    assert result.llm.dropped_quotes == 1
    listing = result.extraction["listings"][0]
    assert listing["rent"]["amount_vnd"] == 5_500_000
    assert listing["rent"]["agreement"] == "regex_only"
    assert all(e["quote"] != "6tr/tháng" for e in listing["rent"]["evidence"])


def test_llm_error_keeps_regex_partial():
    # AT12: quota exhausted on every attempt -> Regex result, partial, needs_review.
    fake = FakeLLM(LlmTransientError("http_429", retry_after=0), LlmTransientError("http_429", 0),
                   LlmTransientError("http_429", 0))
    text = "Cho thuê phòng trọ 25m2 giá 3tr/tháng, cọc 1 tháng. LH [SĐT]"
    result = run_pipeline(text, llm=fake, mode="production", llm_max_attempts=3, sleep=lambda s: None)
    assert fake.calls == 3
    assert result.llm_status == "error" and result.partial
    listing = result.extraction["listings"][0]
    assert listing["rent"]["amount_vnd"] == 3_000_000
    assert result.listing_meta[0].review_status == "needs_review"
    assert "llm_error" in result.listing_meta[0].review_reasons


def test_invalid_json_is_retried_within_budget():
    fake = FakeLLM("not json", F01_LLM)
    result = run_pipeline(F01, llm=fake, mode="eval_hybrid", llm_max_attempts=3)
    assert fake.calls == 2 and result.llm_status == "ok"


def test_conflict_is_flagged_not_averaged():
    other = dict(F01_LLM, spans=[s for s in F01_LLM["spans"] if s["label"] != "PRICE"]
                 + spans((0, "PRICE", "3k5/số")))
    result = run_pipeline(F01, llm=FakeLLM(other), mode="eval_hybrid")
    rent = result.extraction["listings"][0]["rent"]
    assert rent["agreement"] == "conflict" and rent["decision"] == "needs_review"
    assert rent["amount_vnd"] == 5_500_000  # kept, not averaged
    assert "conflict" in result.listing_meta[0].review_reasons


def test_economy_mode_skips_llm_when_not_needed():
    fake = FakeLLM(F01_LLM)
    text = "Cho thuê CCMN 30m2 giá 5tr/th/phòng. Gần chợ. LH [SĐT]"
    result = run_pipeline(text, llm=fake, mode="production")
    assert fake.calls == 0 and result.llm_status == "not_run"
    assert result.extraction["listings"][0]["rent"]["agreement"] == "regex_only"


def test_llm_resolves_uncertain_post_type():
    fake = FakeLLM({"post_type": "spam", "spans": []})
    result = run_pipeline("Ai cần 5tr liên hệ nhé", llm=fake, mode="production")
    assert result.extraction["post_type"] == "spam"
    assert result.extraction["listings"] == []


def test_ambiguous_quote_picks_nearest_occurrence():
    from app.pipeline.llm_extractor import LlmOutput, ground

    text = "P1 20m2 giá 3tr. P2 30m2 giá 3tr."
    out = LlmOutput.model_validate({"post_type": "rental_offer", "spans": spans(
        (0, "AREA", "20m2"), (0, "PRICE", "3tr"), (1, "AREA", "30m2"), (1, "PRICE", "3tr"))})
    located, dropped = ground(text, out)
    by_listing = {(sp.listing_index, sp.label): sp.start for sp in located}
    assert dropped == 0
    assert by_listing[(0, "PRICE")] < by_listing[(1, "AREA")] < by_listing[(1, "PRICE")]
