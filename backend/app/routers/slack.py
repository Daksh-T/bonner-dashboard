from __future__ import annotations

import csv

from fastapi import APIRouter

from ..config import ROSTER_PATH
from ..data.loader import STATE, ensure_loaded
from ..models import SlackMessageUpdateRequest

router = APIRouter(prefix="/api/slack", tags=["slack"])


def roster_map() -> dict[str, dict]:
    """Optional Slack-ID enrichment. Returns empty if no local roster file."""
    mapping: dict[str, dict] = {}
    if not ROSTER_PATH.exists():
        return mapping
    with ROSTER_PATH.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            email = str(row.get("email", "")).strip().lower()
            if email:
                mapping[email] = {"name": row.get("name", ""), "slack_id": row.get("slack_id", "")}
    return mapping


@router.get("/queue")
def build_queue(checkpoint: str | None = None, statuses: str = "Red,Yellow,Blue"):
    ensure_loaded()
    roster = roster_map()
    allowed = {item.strip() for item in statuses.split(",") if item.strip()}
    members = STATE.member_df[
        STATE.member_df["status"].isin(allowed)
        & ~STATE.member_df["status"].isin(["Exempt"])
    ].copy()
    items = []
    for _, row in members.iterrows():
        roster_entry = roster.get(row["email"], {})
        slack_id = roster_entry.get("slack_id", "")
        items.append(
            {
                **row.to_dict(),
                "checkpoint": checkpoint or STATE.active_checkpoint,
                "slack_id": slack_id,
                "queue_ready": bool(slack_id),
                "delivery_issue": "" if slack_id else "Missing Slack ID in local bonner_slack_roster.csv",
            }
        )
    return items


@router.put("/queue/{email}/message")
def update_queue_message(email: str, payload: SlackMessageUpdateRequest):
    ensure_loaded()
    STATE.member_df.loc[STATE.member_df["email"] == email.lower().strip(), "message"] = payload.message
    return {"ok": True}
