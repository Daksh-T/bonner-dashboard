"""CSV data source: reads the latest ``users-*.csv`` / ``impacts-*.csv`` exports.

Searches the upload directory first (files uploaded via Settings) then the bundled
``csv/`` directory, picking the most recently modified of each kind. This keeps the
original demo/offline workflow working with zero configuration.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ...config import CSV_DIR, UPLOAD_DIR


def _search_dirs() -> list[Path]:
    dirs = [d for d in (UPLOAD_DIR, CSV_DIR) if d.exists()]
    return dirs or [CSV_DIR]


def discover_latest_exports() -> tuple[Path, Path]:
    users_files: list[Path] = []
    impacts_files: list[Path] = []
    for base in _search_dirs():
        users_files += list(base.glob("users-*.csv"))
        impacts_files += list(base.glob("impacts-*.csv"))
    if not users_files or not impacts_files:
        missing = []
        if not users_files:
            missing.append("users-*.csv")
        if not impacts_files:
            missing.append("impacts-*.csv")
        searched = ", ".join(str(d) for d in _search_dirs())
        raise FileNotFoundError(f"Missing export files ({', '.join(missing)}). Searched: {searched}")

    def latest(paths: list[Path]) -> Path:
        return max(paths, key=lambda path: (path.stat().st_mtime, path.name))

    return latest(users_files), latest(impacts_files)


class CsvSource:
    name = "csv"

    def __init__(self, config=None):
        self.config = config
        self._users_path: Path | None = None
        self._impacts_path: Path | None = None

    def _resolve(self) -> tuple[Path, Path]:
        if self._users_path is None or self._impacts_path is None:
            self._users_path, self._impacts_path = discover_latest_exports()
        return self._users_path, self._impacts_path

    def describe(self) -> dict:
        users, impacts = self._resolve()
        return {"source": "csv", "users_file": users.name, "impacts_file": impacts.name}

    def fetch_users(self) -> pd.DataFrame:
        users, _ = self._resolve()
        return pd.read_csv(users)

    def fetch_impacts(self) -> pd.DataFrame:
        _, impacts = self._resolve()
        return pd.read_csv(impacts)
