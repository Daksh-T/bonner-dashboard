from __future__ import annotations

from fastapi import APIRouter, Query

from ..data.loader import ensure_loaded
from ..data.processor import get_member_activity, get_member_impacts, get_member_profile, get_members_filtered

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("")
def list_members(
    class_name: str | None = Query(None, alias="class"),
    status: str | None = None,
    sort: str | None = None,
):
    ensure_loaded()
    return get_members_filtered(class_name, status, sort)


@router.get("/{email}/profile")
def member_profile(email: str):
    ensure_loaded()
    return get_member_profile(email)


@router.get("/{email}/activity")
def member_activity(email: str):
    ensure_loaded()
    return get_member_activity(email)


@router.get("/{email}/impacts")
def member_impacts(email: str):
    ensure_loaded()
    return get_member_impacts(email)
