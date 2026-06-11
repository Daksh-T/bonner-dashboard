from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import UPLOAD_DIR
from ..models import ActiveCheckpointRequest, LoadRequest
from ..settings import default_checkpoint_name, get_config, resolve_checkpoint, today_checkpoint
from ..data.processor import data_status, load_dashboard_data
from ..data.loader import STATE

router = APIRouter(prefix="/api", tags=["data"])


@router.post("/data/load")
def load_data(payload: LoadRequest | None = None):
    checkpoint = payload.checkpoint if payload else default_checkpoint_name()
    return load_dashboard_data(checkpoint_name=checkpoint, force=False)


@router.post("/data/reload")
def reload_data(payload: LoadRequest | None = None):
    checkpoint = payload.checkpoint if payload else STATE.active_checkpoint
    return load_dashboard_data(checkpoint_name=checkpoint, force=True, refetch=True)


@router.get("/data/status")
def get_data_status():
    return data_status()


@router.post("/data/upload")
async def upload_csv(kind: str, file: UploadFile = File(...)):
    """Upload a users-* or impacts-* CSV; stored in the upload dir and used by the
    CSV data source (newest of each kind wins)."""
    if kind not in {"users", "impacts"}:
        raise HTTPException(status_code=400, detail="kind must be 'users' or 'impacts'")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    target = UPLOAD_DIR / f"{kind}-upload-{stamp}.csv"
    target.write_bytes(await file.read())
    return {"saved": True, "filename": target.name, "kind": kind}


@router.get("/data/columns")
def data_columns():
    """Column names available in the uploaded users/impacts CSVs, so the UI can let
    admins pick reflection fields and the class/graduation field from real data."""
    def cols(df) -> list[str]:
        if df is None:
            return []
        return [str(c) for c in df.columns]

    return {
        "users": cols(STATE.raw_users_df),
        "impacts": cols(STATE.raw_impacts_df),
    }


@router.get("/checkpoints")
def get_checkpoints():
    config = get_config()
    today = today_checkpoint(config)
    return {
        "active": STATE.active_checkpoint or default_checkpoint_name(config),
        "cohorts": [{"id": c.id, "label": c.label, "is_default": c.is_default} for c in config.cohorts],
        "program_start": config.program_start.isoformat(),
        "program_end": config.program_end.isoformat(),
        "items": [
            {"name": cp.name, "date": cp.date.isoformat(), "requirements": cp.requirements}
            for cp in config.sorted_checkpoints()
        ],
        "today": {"name": "TODAY", "date": today.date.isoformat(), "requirements": today.requirements},
    }


@router.put("/checkpoints/active")
def set_active_checkpoint(payload: ActiveCheckpointRequest):
    STATE.active_checkpoint = resolve_checkpoint(payload.checkpoint).name
    return load_dashboard_data(checkpoint_name=payload.checkpoint, force=True)
