from __future__ import annotations

from datetime import date

import pandas as pd

from ..settings import get_config
from .loader import STATE
from .processor import reflection_text


def _clean_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def _is_blank_reflection(value: object) -> bool:
    empty_values = {v.lower() for v in get_config().reflection.empty_values}
    text = _clean_text(value)
    return text == "" or text.lower() in empty_values


def _active_member_emails() -> set[str]:
    return set(STATE.member_df[STATE.member_df["status"] != "Exempt"]["email"].tolist())


def get_pending_verification() -> list[dict]:
    active_emails = _active_member_emails()
    impacts = STATE.impacts_df[STATE.impacts_df["email"].isin(active_emails)].copy()
    members = (
        STATE.member_df[STATE.member_df["email"].isin(active_emails)]
        .set_index("email")["display_name"]
        .to_dict()
    )
    pending = impacts[impacts["Verified"].str.lower() == "pending"].copy()
    if pending.empty:
        return []
    pending["member_name"] = pending["email"].map(members).fillna(pending["email"])
    grouped = (
        pending.groupby("Group")
        .apply(
            lambda grp: pd.Series(
                {
                    "pending_impacts": len(grp),
                    "pending_hours": round(float(grp["Hours Served"].sum()), 2),
                    "member_count": int(grp["email"].nunique()),
                    "members": sorted(set(grp["member_name"])),
                    "oldest_pending": grp["Start Date"].min().date().isoformat() if grp["Start Date"].notna().any() else "",
                    "days_waiting": int((pd.Timestamp(date.today()) - grp["Start Date"].min()).days) if grp["Start Date"].notna().any() else 0,
                }
            ),
            include_groups=False,
        )
        .reset_index()
        .rename(columns={"Group": "partner"})
        .sort_values("pending_hours", ascending=False)
    )
    return grouped.fillna("").to_dict(orient="records")


def get_partner_engagement() -> list[dict]:
    active_emails = _active_member_emails()
    impacts = STATE.impacts_df[STATE.impacts_df["email"].isin(active_emails)].copy()
    grouped = (
        impacts.groupby("Group")
        .agg(
            total_hours=("Hours Served", "sum"),
            total_impacts=("Impact ID", "count"),
            member_count=("email", "nunique"),
        )
        .reset_index()
        .rename(columns={"Group": "partner"})
        .sort_values("total_hours", ascending=False)
    )
    return grouped.fillna("").to_dict(orient="records")


def get_pending_partner_detail(partner: str) -> dict:
    active_emails = _active_member_emails()
    impacts = STATE.impacts_df[STATE.impacts_df["email"].isin(active_emails)].copy()
    members = (
        STATE.member_df[STATE.member_df["email"].isin(active_emails)]
        .set_index("email")["display_name"]
        .to_dict()
    )
    subset = impacts[
        (impacts["Verified"].str.lower() == "pending")
        & (impacts["Group"].fillna("") == partner)
    ].copy()
    if subset.empty:
        return {"partner": partner, "summary": {}, "weekly": [], "impacts": []}

    subset["member_name"] = subset["email"].map(members).fillna(subset["email"])
    config = get_config()
    subset["reflection_text"] = subset.apply(lambda row: reflection_text(row, config), axis=1)
    subset["is_blank_reflection"] = subset["reflection_text"].map(_is_blank_reflection)
    subset["week_start"] = subset["Start Date"].dt.to_period("W").dt.start_time

    weekly = (
        subset.groupby("week_start")
        .agg(
            pending_hours=("Hours Served", "sum"),
            pending_impacts=("Impact ID", "count"),
            blank_impacts=("is_blank_reflection", "sum"),
        )
        .reset_index()
        .sort_values("week_start")
    )

    impacts_payload = [
        {
            "impact_id": _clean_text(row.get("Impact ID")),
            "member_name": _clean_text(row.get("member_name")),
            "email": _clean_text(row.get("email")),
            "start_date": row["Start Date"].date().isoformat() if pd.notna(row.get("Start Date")) else "",
            "week_label": row["week_start"].strftime("%-m/%-d") if pd.notna(row.get("week_start")) else "",
            "group": _clean_text(row.get("Group")) or "(No Group Listed)",
            "event_name": _clean_text(row.get("Event Name")),
            "hours": round(float(row.get("Hours Served", 0) or 0), 2),
            "verified": _clean_text(row.get("Verified")),
            "organizer": _clean_text(row.get("Organizer")),
            "reflection": _clean_text(row.get("reflection_text")),
            "is_blank_reflection": bool(row.get("is_blank_reflection")),
        }
        for _, row in subset.sort_values(["Start Date", "member_name"], ascending=[False, True]).iterrows()
    ]

    return {
        "partner": partner,
        "summary": {
            "pending_impacts": int(len(subset)),
            "pending_hours": round(float(subset["Hours Served"].sum()), 2),
            "blank_pending_impacts": int(subset["is_blank_reflection"].sum()),
            "member_count": int(subset["email"].nunique()),
            "oldest_pending": subset["Start Date"].min().date().isoformat() if subset["Start Date"].notna().any() else "",
            "days_waiting": int((pd.Timestamp(date.today()) - subset["Start Date"].min()).days) if subset["Start Date"].notna().any() else 0,
        },
        "weekly": [
            {
                "week": row["week_start"].strftime("%Y-%m-%d"),
                "week_label": row["week_start"].strftime("%-m/%-d"),
                "pending_hours": round(float(row["pending_hours"]), 2),
                "pending_impacts": int(row["pending_impacts"]),
                "blank_impacts": int(row["blank_impacts"]),
            }
            for _, row in weekly.iterrows()
        ],
        "impacts": impacts_payload,
    }
