"""Validators for the shared JSON schemas in spec/schemas (source of truth for field names)."""
from __future__ import annotations

import json
from functools import lru_cache

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from app.core.config import REPO_ROOT

SCHEMAS = REPO_ROOT / "spec" / "schemas"


@lru_cache
def _registry() -> Registry:
    registry = Registry()
    for path in SCHEMAS.glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        resource = Resource.from_contents(schema)
        registry = registry.with_resources([(schema["$id"], resource), (path.name, resource)])
    return registry


@lru_cache
def extraction_schema() -> dict:
    return json.loads((SCHEMAS / "listing-extraction.schema.json").read_text(encoding="utf-8"))


@lru_cache
def listing_validator() -> Draft202012Validator:
    schema = extraction_schema()
    listing = {"$schema": schema["$schema"], "$defs": schema["$defs"], "$ref": "#/$defs/listing"}
    return Draft202012Validator(listing, registry=_registry())


@lru_cache
def extraction_validator() -> Draft202012Validator:
    return Draft202012Validator(extraction_schema(), registry=_registry())
