from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

# Re-exported for backwards compatibility with existing imports.
from .sources.csv_source import discover_latest_exports  # noqa: F401


@dataclass
class DataState:
    # Raw, source-fetched frames (cached so config edits don't re-hit the API).
    raw_users_df: pd.DataFrame | None = None
    raw_impacts_df: pd.DataFrame | None = None
    raw_source_key: str | None = None
    # Processed frames for the active config/checkpoint.
    users_df: pd.DataFrame | None = None
    impacts_df: pd.DataFrame | None = None
    member_df: pd.DataFrame | None = None
    users_file: str | None = None
    impacts_file: str | None = None
    source_name: str | None = None
    active_checkpoint: str = ""
    last_loaded_at: str | None = None
    last_fetched_at: str | None = None


STATE = DataState()


def ensure_loaded() -> DataState:
    if STATE.users_df is None or STATE.impacts_df is None or STATE.member_df is None:
        raise RuntimeError("Data not loaded yet. Use POST /api/data/load first.")
    return STATE
