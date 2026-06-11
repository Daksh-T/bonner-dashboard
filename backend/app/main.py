from __future__ import annotations

import json
import math
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from starlette.responses import JSONResponse

from .config import FRONTEND_DIST_PATH
from .db import init_db
from .routers import (
    config as config_router,
    critical,
    data,
    daterange,
    excel,
    exemptions,
    members,
    overview,
    partners,
    reflections,
    slack,
)


def _sanitize(obj: Any) -> Any:
    """Recursively replace NaN/inf floats with None so they serialise as JSON null."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


class SafeJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(_sanitize(content), separators=(",", ":")).encode("utf-8")


app = FastAPI(title="Bonner Dashboard API", default_response_class=SafeJSONResponse)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


for router in [
    data.router,
    overview.router,
    members.router,
    partners.router,
    reflections.router,
    daterange.router,
    critical.router,
    excel.router,
    slack.router,
    exemptions.router,
    config_router.router,
]:
    app.include_router(router)


@app.get("/health")
def health():
    return {"ok": True}


if FRONTEND_DIST_PATH.exists():
    assets_path = FRONTEND_DIST_PATH / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def serve_frontend(path: str):
        target = FRONTEND_DIST_PATH / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST_PATH / "index.html")
