from __future__ import annotations

from fastapi import APIRouter
from fastapi import Query

from ..data.loader import ensure_loaded
from ..data.partners import get_partner_engagement, get_pending_partner_detail, get_pending_verification

router = APIRouter(prefix="/api/partners", tags=["partners"])


@router.get("/pending")
def pending_partners():
    ensure_loaded()
    return get_pending_verification()


@router.get("/engagement")
def partner_engagement():
    ensure_loaded()
    return get_partner_engagement()


@router.get("/pending-detail")
def pending_partner_detail(partner: str = Query(...)):
    ensure_loaded()
    return get_pending_partner_detail(partner)
