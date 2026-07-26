from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .ai_matching import expected_embedding_model, matching_weights
from .database import database_url


def _masked_database_kind() -> str:
    url = database_url()
    if url.startswith("sqlite"):
        return "sqlite"
    if url.startswith("postgresql"):
        return "postgresql"
    return "configured"


def configured_frontend_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
        if origin.strip()
    ]


def supabase_is_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL", "").strip())


def alembic_head_revision() -> str | None:
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    heads = ScriptDirectory.from_config(config).get_heads()
    return heads[0] if len(heads) == 1 else None


def current_database_revision(db: Session) -> str | None:
    inspector = inspect(db.bind)
    if not inspector.has_table("alembic_version"):
        return None
    return db.execute(text("select version_num from alembic_version")).scalar_one_or_none()


def readiness_report(db: Session) -> dict[str, Any]:
    checks: dict[str, dict[str, Any]] = {
        "database": {
            "ok": False,
            "kind": _masked_database_kind(),
        },
        "migrations": {
            "ok": False,
            "current_revision": None,
            "head_revision": alembic_head_revision(),
        },
        "supabase_auth": {
            "ok": supabase_is_configured(),
            "audience": os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip()
            or "authenticated",
        },
        "cors": {
            "ok": bool(configured_frontend_origins()),
            "origin_count": len(configured_frontend_origins()),
        },
        "matching": {
            "ok": True,
            "embedding_model": expected_embedding_model(),
            "openai_configured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        },
    }

    try:
        db.execute(text("select 1")).scalar_one()
        checks["database"]["ok"] = True
        current_revision = current_database_revision(db)
        checks["migrations"]["current_revision"] = current_revision
        checks["migrations"]["ok"] = bool(
            current_revision
            and checks["migrations"]["head_revision"]
            and current_revision == checks["migrations"]["head_revision"]
        )
    except SQLAlchemyError as exc:
        checks["database"]["error"] = exc.__class__.__name__

    try:
        matching_weights()
    except ValueError as exc:
        checks["matching"]["ok"] = False
        checks["matching"]["error"] = str(exc)

    ready = all(check["ok"] for check in checks.values())
    return {"status": "ready" if ready else "not_ready", "checks": checks}
