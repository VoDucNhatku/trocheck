"""Every rule in lexicon/regex_rules.yaml matches its examples and none of its counter-examples."""
import pytest
import yaml

from app.pipeline.preprocess import TextView
from app.pipeline.regex_extractor import LEXICON, load_rules

RAW = yaml.safe_load((LEXICON / "regex_rules.yaml").read_text(encoding="utf-8"))
CASES = [(r["id"], ex, True) for r in RAW["rules"] for ex in r.get("examples", [])] + \
        [(r["id"], ex, False) for r in RAW["rules"] for ex in r.get("not_examples", [])]


@pytest.mark.parametrize("rule_id,text,should_match", CASES, ids=lambda v: str(v))
def test_rule_examples(rule_id, text, should_match):
    rule = next(r for r in load_rules().rules if r.id == rule_id)
    view = TextView.build(text)
    haystack = view.folded if rule.view == "folded" else view.lower
    assert bool(rule.regex.search(haystack)) is should_match


def test_every_rule_has_examples():
    for r in RAW["rules"]:
        assert r.get("examples"), r["id"]
