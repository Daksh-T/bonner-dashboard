"""Static paths and presentation constants.

Program logic (checkpoints, requirements, cohorts, reflection rules, status
thresholds, Slack templates, the active data source) is now runtime-editable and
lives in :mod:`app.settings`. Only filesystem paths and fixed UI colors remain
here.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

DEFAULT_TIMEZONE = "America/Chicago"
APP_DIR_NAME = "BonnerDashboard"

# Hosted-demo mode (set in render.yaml): the UI swaps the setup wizard for a
# "this is a demo" call-to-action pointing at the project repo.
DEMO_MODE = os.getenv("BONNER_DEMO_MODE", "") == "1"

BASE_DIR = Path(__file__).resolve().parents[2]
IS_FROZEN = bool(getattr(sys, "frozen", False))

# When packaged with PyInstaller, bundled read-only assets (the built frontend,
# demo CSVs, JSON seeds) are extracted to ``sys._MEIPASS``. From source they live
# in the repo root.
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", BASE_DIR))


def _path_from_env(env_name: str, default: Path) -> Path:
    raw = os.getenv(env_name)
    return Path(raw).expanduser().resolve() if raw else default


def _user_data_dir() -> Path:
    """Per-user, writable application-data directory (survives relaunches and
    upgrades). Platform-native location, no third-party dependency."""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_DIR_NAME
    if os.name == "nt":
        base = os.getenv("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(base) / APP_DIR_NAME
    base = os.getenv("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / APP_DIR_NAME


def _resolve_data_dir() -> Path:
    """Where mutable state (SQLite DB, uploaded CSVs) is stored.

    - ``BONNER_DATA_DIR`` always wins (used by the desktop launcher and tests).
    - A packaged/frozen build writes to the per-user app-data dir.
    - Running from a source checkout keeps the repo-local ``backend/`` dir so the
      existing demo database and dev workflow are unchanged.
    """
    raw = os.getenv("BONNER_DATA_DIR")
    if raw:
        return Path(raw).expanduser().resolve()
    if IS_FROZEN:
        return _user_data_dir()
    return BASE_DIR / "backend"


DATA_DIR = _resolve_data_dir()
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Read-only bundled assets (demo data + seeds) come from the bundle dir.
CSV_DIR = _path_from_env("BONNER_CSV_DIR", BUNDLE_DIR / "csv")
EXEMPTIONS_SEED_PATH = _path_from_env("BONNER_EXEMPTIONS_PATH", BUNDLE_DIR / "exemptions.json")
SUPPORT_SEED_PATH = _path_from_env("BONNER_SUPPORT_SEED_PATH", BUNDLE_DIR / "support_tracking.json")
FRONTEND_DIST_PATH = _path_from_env("BONNER_FRONTEND_DIST_PATH", BUNDLE_DIR / "frontend" / "dist")

# Mutable state lives in the (writable) data dir.
UPLOAD_DIR = _path_from_env("BONNER_UPLOAD_DIR", DATA_DIR / "uploads")
DB_PATH = _path_from_env("BONNER_DB_PATH", DATA_DIR / "bonner.db")

# Optional local roster mapping name/email/slack_id -> used only to enrich the
# Slack queue with Slack IDs. The app works fine without it.
ROSTER_PATH = _path_from_env("BONNER_ROSTER_PATH", BASE_DIR / "bonner_slack_roster.csv")

STATUS_COLORS = {
    "Red": "#e74c3c",
    "Yellow": "#f39c12",
    "Blue": "#3498db",
    "Green": "#27ae60",
    "Exempt": "#6b7280",
}
