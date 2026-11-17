"""Remove NOTIFY, observe a failing cross-process test, restore and recheck hashes."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys

api = Path(__file__).resolve().parents[1]
target = api / "app/services/jobs.py"
logs = api.parents[1] / "_handoff"
original = target.read_bytes()
digest = hashlib.sha256(original).hexdigest()
source = original.decode("utf-8")
needle = "SELECT pg_notify(:channel, '')"
assert source.count(needle) == 1

def check(label):
    command = [sys.executable, "-B", "-m", "pytest", "tests/test_speed_worker.py",
               "-k", "wakes_worker_in_another_process", "--basetemp", str(logs / f"pytest-{label}")]
    result = subprocess.run(command, cwd=api, capture_output=True, text=True, encoding="utf-8",
                            env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"})
    (logs / f"{label}.log").write_text("COMMAND: " + repr(command) + "\n" + result.stdout + result.stderr, encoding="utf-8")
    print(f"{label}: exit={result.returncode}\n{result.stdout}", flush=True)
    return result.returncode

try:
    target.write_bytes(source.replace(needle, "SELECT :channel").encode("utf-8"))
    assert check("mutation-without-notify") == 1
finally:
    target.write_bytes(original)
assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
print(f"restored_sha256={digest}", flush=True)
assert check("mutation-restored") == 0
