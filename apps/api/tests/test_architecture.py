"""Architecture rules as checks (handbook review A4): layers and a pure pipeline."""
import json
import os
import subprocess
import sys
from pathlib import Path

from app.schemas import IngestPost
from tests.conftest import SPEC

API = Path(__file__).resolve().parents[1]


def test_import_contracts():
    exe = Path(sys.executable).with_name("lint-imports.exe")
    if not exe.exists():
        exe = Path(sys.executable).with_name("lint-imports")
    result = subprocess.run([str(exe)], cwd=API, capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stdout + result.stderr


def test_ingest_model_matches_schema():
    schema = json.loads((SPEC / "schemas" / "ingest-post.schema.json").read_text(encoding="utf-8"))
    fields = IngestPost.model_fields
    assert set(fields) == set(schema["properties"])
    assert set(schema["required"]) == {k for k, f in fields.items() if f.is_required()}
    assert set(schema["properties"]["source_type"]["enum"]) == {"facebook_group", "manual_paste", "import_file", "fixture"}


def test_check_fixtures_tool_passes():
    result = subprocess.run([sys.executable, str(SPEC / "tools" / "check_fixtures.py")], capture_output=True,
                            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                            text=True, encoding="utf-8")
    assert result.returncode == 0, result.stdout
