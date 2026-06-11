"""Desktop launcher for the Bonner Hour Dashboard.

Runs the FastAPI backend (which also serves the built React app) on a private
localhost port and opens it in a native OS window. If ``pywebview`` is not
installed it falls back to the default web browser.

State (settings, onboarding flag, uploaded CSVs, the SQLite DB) is written to a
per-user application-data directory so it survives every relaunch and upgrade.

Run from source:   uv run python desktop.py
Packaged binary:   ./BonnerDashboard            (see packaging/build.sh)
"""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

APP_TITLE = "Bonner Hour Dashboard"


def _ensure_data_dir() -> None:
    """Pin state to the per-user app-data dir before the app reads config.

    Done before importing :mod:`app.config` because the data directory is
    resolved at import time. A user-set ``BONNER_DATA_DIR`` still wins.
    """
    if os.getenv("BONNER_DATA_DIR"):
        return
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "BonnerDashboard"
    elif os.name == "nt":
        base = Path(os.getenv("APPDATA") or Path.home() / "AppData" / "Roaming") / "BonnerDashboard"
    else:
        base = Path(os.getenv("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "BonnerDashboard"
    base.mkdir(parents=True, exist_ok=True)
    os.environ["BONNER_DATA_DIR"] = str(base)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_until_up(url: str, timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1) as resp:  # noqa: S310 - localhost only
                if resp.status == 200:
                    return True
        except (URLError, ConnectionError, OSError):
            time.sleep(0.15)
    return False


def main() -> int:
    _ensure_data_dir()
    # Lets the backend (and frontend, via /api/config/export-file) know it runs
    # inside the desktop app rather than a hosted browser deployment.
    os.environ["BONNER_DESKTOP"] = "1"

    # Imported after the data dir is pinned so paths resolve correctly.
    import uvicorn

    from app.config import FRONTEND_DIST_PATH
    from app.main import app

    if not (FRONTEND_DIST_PATH / "index.html").exists():
        sys.stderr.write(
            f"Frontend build not found at {FRONTEND_DIST_PATH}.\n"
            "Build it first:  cd frontend && bun install && bun run build\n"
        )
        return 1

    host, port = "127.0.0.1", _free_port()
    url = f"http://{host}:{port}/"

    server = uvicorn.Server(uvicorn.Config(app, host=host, port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    if not _wait_until_up(f"{url}health"):
        sys.stderr.write("Backend did not start in time.\n")
        server.should_exit = True
        return 1

    try:
        import webview  # pywebview: native OS webview window

        # Without this, clicking an <a download> link renders the blob as
        # plaintext in the window; with it, the OS shows a save dialog.
        webview.settings["ALLOW_DOWNLOADS"] = True
        webview.create_window(APP_TITLE, url, width=1280, height=820, min_size=(900, 600))
        webview.start()  # blocks on the main thread until the window is closed
    except ImportError:
        import webbrowser

        print(f"{APP_TITLE} running at {url}")
        print("Install 'pywebview' for a native window. Opening your browser; press Ctrl+C to quit.")
        webbrowser.open(url)
        try:
            while thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass

    server.should_exit = True
    thread.join(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
