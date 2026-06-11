from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..data.loader import STATE
from ..data.processor import load_dashboard_data
from ..models import ExemptionCreateRequest

router = APIRouter(prefix="/api/exemptions", tags=["exemptions"])


@router.get("")
def list_exemptions():
    return list(db.get_exemptions().values())


@router.post("")
def create_exemption(payload: ExemptionCreateRequest):
    db.add_exemption(payload.email, payload.name, payload.reason)
    if STATE.member_df is not None:
        load_dashboard_data(checkpoint_name=STATE.active_checkpoint, force=True)
    return {"ok": True}


@router.delete("/{email}")
def remove_exemption(email: str):
    db.delete_exemption(email)
    if STATE.member_df is not None:
        load_dashboard_data(checkpoint_name=STATE.active_checkpoint, force=True)
    return {"ok": True}
