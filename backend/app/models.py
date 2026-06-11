from __future__ import annotations

from pydantic import BaseModel


class LoadRequest(BaseModel):
    checkpoint: str | None = None


class ActiveCheckpointRequest(BaseModel):
    checkpoint: str


class ExemptionCreateRequest(BaseModel):
    email: str
    name: str = ""
    reason: str = ""


class SupportUpdateRequest(BaseModel):
    sent: bool
    notes: str = ""


class SupportResetRequest(BaseModel):
    emails: list[str]


class SlackMessageUpdateRequest(BaseModel):
    message: str
