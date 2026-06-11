from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..data.loader import STATE, ensure_loaded
from ..models import SupportResetRequest, SupportUpdateRequest

router = APIRouter(prefix="/api", tags=["critical"])


@router.get("/critical")
def critical_members():
    ensure_loaded()
    tracking = db.list_support_tracking()
    members = (
        STATE.member_df[STATE.member_df["status"].isin(["Red", "Blue"])]
        .copy()
        .sort_values(["risk_score", "pace_gap", "recent_hours", "progress_pct"], ascending=[False, False, True, True])
    )
    rows = []
    for _, row in members.iterrows():
        email = row["email"]
        support = tracking.get(
            email,
            {"outreach_sent": False, "notes": "", "sent_date": None, "checkpoint": None, "updated_at": None},
        )
        rows.append(
            {
                **row.to_dict(),
                "pct": row.get("progress_pct", 0.0),
                "outreach_sent": support["outreach_sent"],
                "sent_date": support["sent_date"],
                "notes": support["notes"],
                "support_checkpoint": support.get("checkpoint"),
                "support_updated_at": support.get("updated_at"),
            }
        )
    return rows


@router.put("/critical/{email}/support")
def update_critical_member(email: str, payload: SupportUpdateRequest):
    ensure_loaded()
    member = STATE.member_df[STATE.member_df["email"] == email].iloc[0]
    db.update_support_tracking(email, member["display_name"], payload.sent, payload.notes, STATE.active_checkpoint)
    return {"ok": True}


@router.post("/critical/reset")
def reset_critical_tracking(payload: SupportResetRequest):
    ensure_loaded()
    db.reset_support_tracking(payload.emails)
    return {"ok": True}
