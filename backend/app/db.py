from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime

from .config import DB_PATH, EXEMPTIONS_SEED_PATH, SUPPORT_SEED_PATH, UPLOAD_DIR


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS support_tracking (
                email TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                outreach_sent BOOLEAN NOT NULL DEFAULT 0,
                sent_date TEXT,
                notes TEXT DEFAULT '',
                checkpoint TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS exemptions (
                email TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                reason TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS app_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
    # Demo seeds only apply to a fresh install; once the user has uploaded their
    # own CSVs the demo rows must not come back on restart.
    if _has_user_uploads():
        clear_demo_seed_data()
    else:
        migrate_legacy_exemptions()
        migrate_demo_support_tracking()


def _has_user_uploads() -> bool:
    return UPLOAD_DIR.exists() and any(UPLOAD_DIR.glob("*.csv"))


def _seed_emails(path, key: str) -> list[str]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text())
    except Exception:
        return []
    return [
        email
        for entry in payload.get(key, [])
        if (email := str(entry.get("email", "")).strip().lower())
    ]


def clear_demo_seed_data() -> None:
    """Remove the demo-seeded exemptions and support-tracking rows (by the exact
    emails listed in the bundled seed files). User-created rows are untouched."""
    exemption_emails = _seed_emails(EXEMPTIONS_SEED_PATH, "exemptions")
    support_emails = _seed_emails(SUPPORT_SEED_PATH, "support_tracking")
    if not exemption_emails and not support_emails:
        return
    with connect() as conn:
        if exemption_emails:
            placeholders = ",".join("?" for _ in exemption_emails)
            conn.execute(f"DELETE FROM exemptions WHERE email IN ({placeholders})", exemption_emails)
        if support_emails:
            placeholders = ",".join("?" for _ in support_emails)
            conn.execute(f"DELETE FROM support_tracking WHERE email IN ({placeholders})", support_emails)


# --------------------------------------------------------------------------- #
# App config (single JSON row)
# --------------------------------------------------------------------------- #
def get_config_json() -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT payload FROM app_config WHERE id = 1").fetchone()
    if not row:
        return None
    try:
        return json.loads(row["payload"])
    except Exception:
        return None


def set_config_json(payload: dict) -> None:
    text = json.dumps(payload)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO app_config (id, payload, updated_at)
            VALUES (1, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=datetime('now')
            """,
            (text,),
        )


def migrate_legacy_exemptions() -> None:
    if not EXEMPTIONS_SEED_PATH.exists():
        return
    try:
        payload = json.loads(EXEMPTIONS_SEED_PATH.read_text())
    except Exception:
        return
    exemptions = payload.get("exemptions", [])
    with connect() as conn:
        existing = {
            row["email"] for row in conn.execute("SELECT email FROM exemptions").fetchall()
        }
        for entry in exemptions:
            email = str(entry.get("email", "")).strip().lower()
            if not email or email in existing:
                continue
            conn.execute(
                "INSERT INTO exemptions (email, name, reason) VALUES (?, ?, ?)",
                (email, str(entry.get("name", "")).strip(), str(entry.get("reason", "")).strip()),
            )


def migrate_demo_support_tracking() -> None:
    if not SUPPORT_SEED_PATH.exists():
        return
    try:
        payload = json.loads(SUPPORT_SEED_PATH.read_text())
    except Exception:
        return
    entries = payload.get("support_tracking", [])
    with connect() as conn:
        existing = {
            row["email"] for row in conn.execute("SELECT email FROM support_tracking").fetchall()
        }
        for entry in entries:
            email = str(entry.get("email", "")).strip().lower()
            if not email or email in existing:
                continue
            conn.execute(
                """
                INSERT INTO support_tracking
                    (email, display_name, outreach_sent, sent_date, notes, checkpoint)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    email,
                    str(entry.get("display_name", "")).strip(),
                    int(bool(entry.get("outreach_sent", False))),
                    entry.get("sent_date"),
                    str(entry.get("notes", "")).strip(),
                    str(entry.get("checkpoint", "")).strip(),
                ),
            )


def get_exemptions() -> dict[str, dict[str, str]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT email, name, reason, created_at FROM exemptions ORDER BY email"
        ).fetchall()
    return {
        row["email"]: {
            "email": row["email"],
            "name": row["name"],
            "reason": row["reason"],
            "created_at": row["created_at"],
        }
        for row in rows
    }


def add_exemption(email: str, name: str, reason: str) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO exemptions (email, name, reason)
            VALUES (?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET name=excluded.name, reason=excluded.reason
            """,
            (email.strip().lower(), name.strip(), reason.strip()),
        )


def delete_exemption(email: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM exemptions WHERE email = ?", (email.strip().lower(),))


def list_support_tracking() -> dict[str, dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM support_tracking").fetchall()
    return {
        row["email"]: {
            "email": row["email"],
            "display_name": row["display_name"],
            "outreach_sent": bool(row["outreach_sent"]),
            "sent_date": row["sent_date"],
            "notes": row["notes"],
            "checkpoint": row["checkpoint"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    }


def update_support_tracking(email: str, display_name: str, sent: bool, notes: str, checkpoint: str) -> None:
    sent_date = datetime.utcnow().isoformat() if sent else None
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO support_tracking (email, display_name, outreach_sent, sent_date, notes, checkpoint, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(email) DO UPDATE SET
                display_name=excluded.display_name,
                outreach_sent=excluded.outreach_sent,
                sent_date=excluded.sent_date,
                notes=excluded.notes,
                checkpoint=excluded.checkpoint,
                updated_at=datetime('now')
            """,
            (email.strip().lower(), display_name, int(sent), sent_date, notes.strip(), checkpoint),
        )


def reset_support_tracking(emails: list[str]) -> None:
    cleaned = [email.strip().lower() for email in emails if email.strip()]
    if not cleaned:
        return
    placeholders = ",".join("?" for _ in cleaned)
    with connect() as conn:
        conn.execute(f"DELETE FROM support_tracking WHERE email IN ({placeholders})", cleaned)
