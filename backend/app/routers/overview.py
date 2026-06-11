from __future__ import annotations

from fastapi import APIRouter, Query

from ..data.loader import ensure_loaded
from ..data.insights import get_class_distribution, get_insights, get_overview, get_overview_drilldown

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/overview")
def overview():
    ensure_loaded()
    return get_overview()


@router.get("/overview/class-distribution")
def class_distribution():
    ensure_loaded()
    return get_class_distribution()


@router.get("/insights")
def insights():
    ensure_loaded()
    return get_insights()


@router.get("/overview/drilldown")
def overview_drilldown(kind: str = Query(...), class_name: str | None = Query(None)):
    ensure_loaded()
    return get_overview_drilldown(kind, class_name)
