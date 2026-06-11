from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from ..data.excel import banner_export, checkpoint_export, roster_match_status, values_for_clipboard
from ..data.loader import ensure_loaded

router = APIRouter(prefix="/api/excel", tags=["excel"])


@router.get("/roster-status")
def roster_status():
    ensure_loaded()
    return roster_match_status()


@router.get("/checkpoint-export")
def checkpoint_hours(cp: str):
    ensure_loaded()
    rows = checkpoint_export(cp)
    return {"rows": rows, "clipboard": values_for_clipboard(rows)}


@router.get("/banner-export")
def banner_hours(start: date, end: date):
    ensure_loaded()
    rows = banner_export(start, end)
    return {"rows": rows, "clipboard": values_for_clipboard(rows)}
