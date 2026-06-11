from __future__ import annotations

from fastapi import APIRouter

from ..data.loader import STATE, ensure_loaded
from ..models import SlackMessageUpdateRequest

router = APIRouter(prefix="/api/slack", tags=["slack"])


@router.get("/queue")
def build_queue(checkpoint: str | None = None, statuses: str = "Red,Yellow,Blue"):
    ensure_loaded()
    allowed = {item.strip() for item in statuses.split(",") if item.strip()}
    members = STATE.member_df[
        STATE.member_df["status"].isin(allowed)
        & ~STATE.member_df["status"].isin(["Exempt"])
    ].copy()
    return [
        {**row.to_dict(), "checkpoint": checkpoint or STATE.active_checkpoint}
        for _, row in members.iterrows()
    ]


@router.put("/queue/{email}/message")
def update_queue_message(email: str, payload: SlackMessageUpdateRequest):
    ensure_loaded()
    STATE.member_df.loc[STATE.member_df["email"] == email.lower().strip(), "message"] = payload.message
    return {"ok": True}
