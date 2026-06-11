"""Roster-ordered exports (formerly Excel-workbook driven).

Instead of reading a fixed ``.xlsx`` with hardcoded sheet names / column letters /
row ranges, the export now follows a user-pasted roster (``config.roster_order``):
one name per line, blank lines preserved as blank output rows. Each name is matched
to a member (display name, case-insensitive, plus explicit ``config.name_mappings``
overrides) and its hours are emitted in that exact order, ready to paste into any
spreadsheet column.
"""

from __future__ import annotations

from datetime import date

import pandas as pd

from ..settings import get_config
from .loader import STATE


def _display_name_map() -> dict[str, str]:
    return {
        str(row["display_name"]).strip(): str(row["email"]).strip().lower()
        for _, row in STATE.users_df.iterrows()
    }


def _name_to_email(name: str, display_map: dict[str, str], name_mappings: dict[str, str]) -> str | None:
    cleaned = name.strip()
    if not cleaned:
        return None
    if cleaned in name_mappings:
        return str(name_mappings[cleaned]).strip().lower()
    if cleaned in display_map:
        return display_map[cleaned]
    lower_map = {k.lower(): v for k, v in display_map.items()}
    if cleaned.lower() in lower_map:
        return lower_map[cleaned.lower()]
    lower_mappings = {k.lower(): v for k, v in name_mappings.items()}
    if cleaned.lower() in lower_mappings:
        return str(lower_mappings[cleaned.lower()]).strip().lower()
    return None


def _roster_lines() -> list[str]:
    return list(get_config().roster_order)


def roster_match_status() -> dict:
    """Per-line matched/unmatched preview for the Settings roster editor."""
    config = get_config()
    display_map = _display_name_map() if STATE.users_df is not None else {}
    rows = []
    matched = 0
    for idx, raw in enumerate(_roster_lines()):
        name = raw.strip()
        if not name:
            rows.append({"row": idx + 1, "name": "", "is_blank": True, "matched": False, "email": None})
            continue
        email = _name_to_email(name, display_map, config.name_mappings)
        rows.append({"row": idx + 1, "name": name, "is_blank": False, "matched": bool(email), "email": email})
        if email:
            matched += 1
    total = sum(1 for r in rows if not r["is_blank"])
    return {"rows": rows, "matched": matched, "unmatched": total - matched, "total": total}


def _hours_rows(hours_by_email: dict[str, float]) -> list[dict]:
    config = get_config()
    display_map = _display_name_map()
    rows = []
    for idx, raw in enumerate(_roster_lines()):
        name = raw.strip()
        if not name:
            rows.append({"row": idx + 1, "name": "", "hours": "", "is_blank": True})
            continue
        email = _name_to_email(name, display_map, config.name_mappings)
        hours = round(float(hours_by_email.get(email, 0.0)), 2) if email else ""
        rows.append({"row": idx + 1, "name": name, "hours": hours, "is_blank": False, "email": email})
    return rows


def checkpoint_export(cp: str) -> list[dict]:
    member_df = STATE.member_df.set_index("email")
    hours_by_email = member_df["hours"].to_dict()
    return _hours_rows(hours_by_email)


def banner_export(start: date, end: date) -> list[dict]:
    subset = STATE.impacts_df[
        (STATE.impacts_df["Start Date"] >= pd.Timestamp(start))
        & (STATE.impacts_df["Start Date"] <= pd.Timestamp(end))
    ]
    hours_by_email = subset.groupby("email")["Hours Served"].sum().to_dict()
    return _hours_rows(hours_by_email)


def values_for_clipboard(rows: list[dict]) -> str:
    return "\n".join("" if row["hours"] == "" else str(row["hours"]) for row in rows)
