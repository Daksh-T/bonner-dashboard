from __future__ import annotations

from collections import Counter, defaultdict

import pandas as pd

from ..settings import get_config
from .loader import STATE


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value or "").strip()


def _reflection_text(row: pd.Series, fields: list[str]) -> str:
    """First non-empty value among the configured reflection fields."""
    for field in fields:
        value = clean(row.get(field))
        if value:
            return value
    return ""


def _is_blank(row: pd.Series, fields: list[str], empty_values: set[str], rule: str) -> bool:
    def blank(field: str) -> bool:
        text = clean(row.get(field))
        return text == "" or text.lower() in empty_values

    flags = [blank(field) for field in fields]
    if not flags:
        return False
    return all(flags) if rule == "all" else any(flags)


def severity(blank_count: int, total_count: int) -> str:
    if blank_count == 0:
        return "None"
    ratio = blank_count / total_count if total_count else 0
    if total_count >= 2 and blank_count == total_count:
        return "Critical"
    if blank_count >= 3 and ratio >= 0.75:
        return "High"
    if blank_count >= 2 and ratio >= 0.4:
        return "Moderate"
    return "Low"


def get_reflection_analysis() -> dict:
    config = get_config()
    fields = config.reflection.fields
    empty_values = {v.lower() for v in config.reflection.empty_values}
    rule = config.reflection.blank_rule

    empty_summary = {"users_with_any_blank": 0, "critical": 0, "high": 0, "moderate": 0, "low": 0}
    if not fields:
        # Reflection tracking disabled.
        return {"summary": empty_summary, "members": [], "enabled": False, "fields": []}

    users = STATE.users_df.set_index("email")[["display_name"]].to_dict("index")
    active_emails = set(STATE.member_df[STATE.member_df["status"] != "Exempt"]["email"].tolist())
    per_user = defaultdict(
        lambda: {"impacts": [], "blank": [], "filled": [], "blank_groups": Counter(), "all_groups": Counter()}
    )
    for _, row in STATE.impacts_df.iterrows():
        email = row["email"]
        if email not in active_emails:
            continue
        record = {
            "impact_id": clean(row.get("Impact ID")),
            "date_created": row["Date Created"].date().isoformat() if pd.notna(row.get("Date Created")) else "",
            "date": row["Start Date"].date().isoformat() if pd.notna(row.get("Start Date")) else "",
            "group": clean(row.get("Group")) or "(No Group Listed)",
            "organizer": clean(row.get("Organizer")) or "(No Organizer Listed)",
            "event_name": clean(row.get("Event Name")),
            "reflection": _reflection_text(row, fields),
            "hours": float(row.get("Hours Served", 0) or 0),
        }
        bucket = per_user[email]
        bucket["impacts"].append(record)
        bucket["all_groups"][record["group"]] += 1
        if _is_blank(row, fields, empty_values, rule):
            bucket["blank"].append(record)
            bucket["blank_groups"][record["group"]] += 1
        else:
            bucket["filled"].append(record)
    rows = []
    for email, bucket in per_user.items():
        total = len(bucket["impacts"])
        blank = len(bucket["blank"])
        if blank == 0:
            continue
        ratio = blank / total if total else 0
        rows.append(
            {
                "email": email,
                "name": users.get(email, {}).get("display_name", email),
                "blank_reflections": blank,
                "filled_reflections": total - blank,
                "total_impacts": total,
                "blank_percent": round(ratio * 100, 1),
                "severity": severity(blank, total),
                "pattern": "All blank" if blank == total else "Mixed",
                "partners": [f"{group} ({count})" for group, count in bucket["blank_groups"].most_common()],
                "blank_examples": bucket["blank"],
                "filled_examples": bucket["filled"],
            }
        )
    order = {"Critical": 0, "High": 1, "Moderate": 2, "Low": 3, "None": 4}
    rows.sort(key=lambda row: (order[row["severity"]], -row["blank_percent"], row["name"]))
    summary = {
        "users_with_any_blank": len(rows),
        "critical": sum(1 for row in rows if row["severity"] == "Critical"),
        "high": sum(1 for row in rows if row["severity"] == "High"),
        "moderate": sum(1 for row in rows if row["severity"] == "Moderate"),
        "low": sum(1 for row in rows if row["severity"] == "Low"),
    }
    return {"summary": summary, "members": rows, "enabled": True, "fields": fields}
