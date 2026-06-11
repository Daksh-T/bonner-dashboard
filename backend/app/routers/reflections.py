from __future__ import annotations

from fastapi import APIRouter

from ..data.loader import ensure_loaded
from ..data.reflections import get_reflection_analysis

router = APIRouter(prefix="/api", tags=["reflections"])


@router.get("/reflections")
def reflections():
    ensure_loaded()
    return get_reflection_analysis()
