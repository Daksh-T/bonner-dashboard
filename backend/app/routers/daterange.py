from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from ..data.loader import ensure_loaded
from ..data.processor import get_date_range_hours

router = APIRouter(prefix="/api", tags=["daterange"])


@router.get("/daterange")
def date_range(start: date, end: date):
    ensure_loaded()
    return get_date_range_hours(start, end)
