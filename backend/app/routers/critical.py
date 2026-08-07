from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from .. import db
from ..data.loader import STATE, ensure_loaded
from ..models import FollowUpSnoozeRequest, SupportResetRequest, SupportUpdateRequest

router = APIRouter(prefix="/api", tags=["critical"])


def _with_follow_up_state(members):
    tracking = db.list_support_tracking()
    rows = []
    today = date.today().isoformat()
    public_fields = [
        "email",
        "display_name",
        "class_label",
        "status",
        "hours",
        "approved_hours",
        "required",
        "progress_pct",
        "avg_week",
        "recent_avg",
        "recent_weeks",
        "recent_service_weeks",
        "rhythm_flag",
        "rhythm_reason",
        "post_break_reentry_flag",
        "post_break_reentry_reason",
        "requires_follow_up",
        "follow_up_reasons",
        "conversation_prompts",
        "pace_needed",
        "pace_gap",
        "pace_label",
        "pending_hours",
        "final_required",
        "final_still_needed",
        "weeks_remaining_to_cp4",
        "projected_final_hours",
        "projected_final_gap",
    ]
    for _, row in members.iterrows():
        email = row["email"]
        support = tracking.get(
            email,
            {
                "outreach_sent": False,
                "notes": "",
                "sent_date": None,
                "checkpoint": None,
                "snoozed_until": None,
                "snooze_reason": "",
                "updated_at": None,
            },
        )
        snoozed_until = support.get("snoozed_until")
        rows.append(
            {
                **{field: row.get(field) for field in public_fields},
                "pct": row.get("progress_pct", 0.0),
                "outreach_sent": support["outreach_sent"],
                "sent_date": support["sent_date"],
                "notes": support["notes"],
                "support_checkpoint": support.get("checkpoint"),
                "support_updated_at": support.get("updated_at"),
                "snoozed_until": snoozed_until,
                "snooze_reason": support.get("snooze_reason", ""),
                "snooze_active": bool(snoozed_until and snoozed_until > today),
            }
        )
    return rows


@router.get("/follow-up")
def follow_up_members():
    """One lightweight payload for the default queue and its context filters."""
    ensure_loaded()
    members = (
        STATE.member_df[STATE.member_df["status"] != "Exempt"]
        .copy()
        .sort_values(
            ["requires_follow_up", "post_break_reentry_flag", "rhythm_flag", "projected_final_gap", "still_needed", "progress_pct"],
            ascending=[False, False, False, False, False, True],
        )
    )
    return _with_follow_up_state(members)


@router.get("/critical")
def critical_members():
    ensure_loaded()
    members = (
        STATE.member_df[STATE.member_df["status"].isin(["Red", "Blue"])]
        .copy()
        .sort_values(
            ["post_break_reentry_flag", "rhythm_flag", "projected_final_gap", "still_needed", "progress_pct"],
            ascending=[False, False, False, False, True],
        )
    )
    return _with_follow_up_state(members)


@router.put("/critical/{email}/support")
def update_critical_member(email: str, payload: SupportUpdateRequest):
    ensure_loaded()
    member = STATE.member_df[STATE.member_df["email"] == email].iloc[0]
    db.update_support_tracking(email, member["display_name"], payload.sent, payload.notes, STATE.active_checkpoint)
    return {"ok": True}


@router.put("/follow-up/{email}/snooze")
def update_follow_up_snooze(email: str, payload: FollowUpSnoozeRequest):
    ensure_loaded()
    cleaned = email.lower().strip()
    member = STATE.member_df[STATE.member_df["email"] == cleaned].iloc[0]
    db.update_follow_up_snooze(
        cleaned,
        member["display_name"],
        payload.until.isoformat() if payload.until else None,
        payload.reason,
        STATE.active_checkpoint,
    )
    return {"ok": True}


@router.post("/critical/reset")
def reset_critical_tracking(payload: SupportResetRequest):
    ensure_loaded()
    db.reset_support_tracking(payload.emails)
    return {"ok": True}
