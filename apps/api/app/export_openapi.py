"""Export without connecting to a DB or a running API: python -m app.export_openapi FILE."""
import json
import sys
from pathlib import Path

from app.main import create_app

if __name__ == "__main__":
    Path(sys.argv[1]).write_text(json.dumps(create_app().openapi(), ensure_ascii=False, indent=2) + "\n",
                               encoding="utf-8")
