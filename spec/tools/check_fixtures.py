"""Check spec fixtures: schema validity (if jsonschema is installed) and evidence offsets.

Usage: python spec/tools/check_fixtures.py
Exit code 0 when every fixture passes.
"""
import json
import sys
from pathlib import Path

SPEC = Path(__file__).resolve().parent.parent
SCHEMAS = SPEC / "schemas"
FIXTURES = SPEC / "fixtures"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def iter_evidence(node):
    if isinstance(node, dict):
        if {"start", "end", "quote", "label"} <= node.keys():
            yield node
        for value in node.values():
            yield from iter_evidence(value)
    elif isinstance(node, list):
        for item in node:
            yield from iter_evidence(item)


def schema_validators():
    try:
        from jsonschema import Draft202012Validator
        from referencing import Registry, Resource
    except ImportError:
        print("jsonschema not installed: skipping schema validation (offset checks still run)")
        return None, None
    registry = Registry()
    for path in SCHEMAS.glob("*.schema.json"):
        schema = load(path)
        resource = Resource.from_contents(schema)
        registry = registry.with_resources([(schema["$id"], resource), (path.name, resource)])
    ingest = Draft202012Validator(load(SCHEMAS / "ingest-post.schema.json"), registry=registry)
    extraction = Draft202012Validator(load(SCHEMAS / "listing-extraction.schema.json"), registry=registry)
    return ingest, extraction


def main():
    ingest, extraction = schema_validators()
    failures = 0
    files = sorted(FIXTURES.glob("*.json"))
    for path in files:
        doc = load(path)
        problems = []
        text = doc["input"]["text"]
        if ingest is not None:
            problems += [f"input: {e.message}" for e in ingest.iter_errors(doc["input"])]
            problems += [f"expected: {e.message}" for e in extraction.iter_errors(doc["expected"])]
        for evidence in iter_evidence(doc["expected"]):
            actual = text[evidence["start"]:evidence["end"]]
            if actual != evidence["quote"]:
                problems.append(f"offset {evidence['start']}:{evidence['end']} gives {actual!r}, quote is {evidence['quote']!r}")
        if "[SĐT]" not in text and "LH" in text:
            problems.append("contact line present but phone not masked")
        status = "PASS" if not problems else "FAIL"
        print(f"{status} {path.name}")
        for problem in problems:
            print(f"   - {problem}")
        failures += bool(problems)
    print(f"{len(files) - failures}/{len(files)} fixtures passed")
    return 1 if failures or not files else 0


if __name__ == "__main__":
    sys.exit(main())
