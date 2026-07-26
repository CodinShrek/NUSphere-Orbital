from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

REQUIRED_BACKEND_ENV = (
    "DATABASE_URL",
    "FRONTEND_ORIGINS",
    "SUPABASE_URL",
    "SUPABASE_JWT_AUDIENCE",
)


def _missing_required() -> list[str]:
    return [name for name in REQUIRED_BACKEND_ENV if not os.getenv(name, "").strip()]


def _unsafe_values() -> list[str]:
    issues: list[str] = []
    origins = [
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
        if origin.strip()
    ]
    if "*" in origins:
        issues.append("FRONTEND_ORIGINS must not contain '*' in production.")
    if any(origin.endswith("/") for origin in origins):
        issues.append("FRONTEND_ORIGINS entries should not end with a trailing slash.")
    if os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip():
        issues.append("Do not configure SUPABASE_SERVICE_ROLE_KEY for this backend.")
    if os.getenv("DATABASE_URL", "").startswith("sqlite"):
        issues.append("DATABASE_URL should be PostgreSQL for production deployment.")
    return issues


def main() -> int:
    missing = _missing_required()
    unsafe = _unsafe_values()
    if missing or unsafe:
        print("Production readiness check failed.")
        if missing:
            print("Missing required environment variables:")
            for name in missing:
                print(f"- {name}")
        if unsafe:
            print("Unsafe production settings:")
            for issue in unsafe:
                print(f"- {issue}")
        return 1

    print("Production readiness check passed.")
    print("- Required backend environment variables are present.")
    print("- CORS origins are explicit.")
    print("- Supabase auth is configured without service-role exposure.")
    print("- DATABASE_URL is configured for PostgreSQL.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
