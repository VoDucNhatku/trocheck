"""Execute the real entrypoint; the real health endpoint stays up during a slow backfill."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

import pytest


def test_health_answers_while_start_script_reprocesses(api, tmp_path):
    shell = shutil.which("sh")
    if not shell:
        pytest.skip("POSIX shell required for container entrypoint")
    started, release = tmp_path / "started", tmp_path / "release"
    server = tmp_path / "server.py"
    server.write_text('''
import os, threading, time
from pathlib import Path
import uvicorn
server = uvicorn.Server(uvicorn.Config("app.main:app", host="127.0.0.1", port=int(os.environ["PORT"]), log_level="error"))
def stop():
    end = time.monotonic() + 40
    while not Path(os.environ["SPEED_RELEASE"]).exists() and time.monotonic() < end:
        time.sleep(0.05)
    time.sleep(0.3)
    server.should_exit = True
threading.Thread(target=stop, daemon=True).start()
server.run()
''', encoding="utf-8")
    executable = tmp_path / "uvicorn"
    executable.write_text('#!/bin/sh\nexec "$SPEED_PYTHON" -B "$SPEED_SERVER"\n', encoding="utf-8")
    executable.chmod(0o755)
    harness = '''
python() {
    if [ "$1" = "-c" ]; then "$SPEED_PYTHON" -B "$@"; return $?; fi
    if [ "$3" = "app.worker.run" ] || [ "$2" = "app.worker.run" ]; then exit 0; fi
    if [ "$3" = "reprocess-real" ]; then
        "$SPEED_PYTHON" -B -c 'import os,time; from pathlib import Path; Path(os.environ["SPEED_STARTED"]).touch(); end=time.monotonic()+10; exec("while not Path(os.environ[\\"SPEED_RELEASE\\"]).exists() and time.monotonic()<end: time.sleep(0.05)")'
        return 1
    fi
    return 0
}
export PATH="$SPEED_BIN:$PATH"
sleep() {
    if [ -f "$SPEED_RELEASE" ]; then exit 0; fi
    command sleep "$@"
}
. "$1"
'''
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    binary_path = tmp_path.as_posix()
    if os.name == "nt":
        binary_path = "/" + binary_path[0].lower() + binary_path[2:]
    env = {**os.environ, "DATABASE_URL": api.settings.database_url, "DEMO_MODE": "false", "PORT": str(port),
           "PYTHONPATH": str(Path.cwd()), "SPEED_PYTHON": Path(sys.executable).as_posix(),
           "SPEED_SERVER": server.as_posix(), "SPEED_BIN": binary_path,
           "SPEED_STARTED": str(started), "SPEED_RELEASE": str(release)}
    log_path = tmp_path / "startup.log"
    output = log_path.open("w", encoding="utf-8")
    process = subprocess.Popen([shell, "-c", harness, "startup-probe", str(Path("deploy/start.sh").resolve())],
        env=env, stdout=output, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic() + 25
        while not started.exists() and time.monotonic() < deadline and process.poll() is None:
            time.sleep(0.05)
        assert started.exists(), log_path.read_text(encoding="utf-8")
        assert not release.exists() and process.poll() is None
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=2) as response:
            assert response.status == 200 and b'"status":"ok"' in response.read()
    finally:
        release.touch()
        try:
            process.wait(timeout=20)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)
            output.close()
    stdout = log_path.read_text(encoding="utf-8")
    assert process.returncode == 0, stdout
    assert "reprocess-real: lỗi khi đọc lại bài cũ; tiếp tục khởi động" in stdout
