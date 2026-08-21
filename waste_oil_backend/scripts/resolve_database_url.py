#!/usr/bin/env python
"""
Resolve DATABASE_URL from a start-script profile.

Usage (prints the URL to stdout; empty = SQLite default in Django):
  python scripts/resolve_database_url.py sqlite
  python scripts/resolve_database_url.py local
  python scripts/resolve_database_url.py cloud
  python scripts/resolve_database_url.py          # use DATABASE_URL as-is

Env keys (waste_oil_backend/.env):
  DATABASE_URL              default when no profile / profile=default
  DATABASE_URL_LOCAL        local Postgres (no SSL)
  DATABASE_URL_CLOUD        remote/Aiven Postgres (SSL)
  DATABASE_URL_SQLITE       unused (profile sqlite clears URL)

Optional local pieces (built into a URL if DATABASE_URL_LOCAL is empty):
  DATABASE_LOCAL_USER=postgres
  DATABASE_LOCAL_PASSWORD=root@123
  DATABASE_LOCAL_HOST=127.0.0.1
  DATABASE_LOCAL_PORT=5432
  DATABASE_LOCAL_NAME=defaultdb
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(env_path, override=False)
    except Exception:
        # Minimal fallback parser
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)


def _build_local_from_parts() -> str:
    user = os.environ.get("DATABASE_LOCAL_USER", "postgres").strip() or "postgres"
    password = os.environ.get("DATABASE_LOCAL_PASSWORD", "").strip()
    host = os.environ.get("DATABASE_LOCAL_HOST", "127.0.0.1").strip() or "127.0.0.1"
    port = os.environ.get("DATABASE_LOCAL_PORT", "5432").strip() or "5432"
    name = os.environ.get("DATABASE_LOCAL_NAME", "defaultdb").strip() or "defaultdb"
    user_q = quote_plus(user)
    pass_q = quote_plus(password) if password else ""
    auth = f"{user_q}:{pass_q}@" if password else f"{user_q}@"
    return f"postgres://{auth}{host}:{port}/{name}?sslmode=disable"


def resolve(profile: str) -> str:
    p = (profile or "default").strip().lower()
    aliases = {
        "": "default",
        "default": "default",
        "env": "default",
        "sqlite": "sqlite",
        "sql": "sqlite",
        "local": "local",
        "postgres": "local",
        "postgresql": "local",
        "pg": "local",
        "cloud": "cloud",
        "aiven": "cloud",
        "remote": "cloud",
        "prod-db": "cloud",
    }
    key = aliases.get(p)
    if key is None:
        raise SystemExit(
            f"Unknown DB profile '{profile}'. Use: sqlite | local | cloud | default"
        )

    if key == "sqlite":
        return ""

    if key == "local":
        url = os.environ.get("DATABASE_URL_LOCAL", "").strip()
        if not url:
            url = _build_local_from_parts()
        if "sslmode=" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=disable"
        return url

    if key == "cloud":
        url = (
            os.environ.get("DATABASE_URL_CLOUD", "").strip()
            or os.environ.get("DATABASE_URL", "").strip()
        )
        if not url:
            raise SystemExit(
                "cloud profile needs DATABASE_URL_CLOUD or DATABASE_URL in .env"
            )
        return url

    # default
    return os.environ.get("DATABASE_URL", "").strip()


def main() -> None:
    _load_dotenv()
    profile = "default"
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("-h", "--help"):
            print(__doc__)
            raise SystemExit(0)
        if a.startswith("--db="):
            profile = a.split("=", 1)[1]
        elif a in ("--db", "--database", "-d") and i + 1 < len(args):
            i += 1
            profile = args[i]
        elif a.startswith("--database-url="):
            print(a.split("=", 1)[1].strip())
            return
        elif not a.startswith("-"):
            profile = a
        else:
            raise SystemExit(f"Unknown argument: {a}")
        i += 1
    print(resolve(profile))


if __name__ == "__main__":
    main()
