#!/usr/bin/env python
"""
Start Django with a DB profile. Avoids Windows cmd mangling '%' in passwords.

  python scripts/run_server.py local
  python scripts/run_server.py cloud
  python scripts/run_server.py sqlite
  python scripts/run_server.py local 0.0.0.0:8000
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from resolve_database_url import resolve, _load_dotenv  # noqa: E402


def _redact(url: str) -> str:
    if not url:
        return "(empty → SQLite)"
    u = urlparse(url)
    auth = f"{u.username}:***@" if u.username else ""
    host = u.hostname or ""
    port = f":{u.port}" if u.port else ""
    q = f"?{u.query}" if u.query else ""
    return f"{u.scheme}://{auth}{host}{port}{u.path or ''}{q}"


def main() -> None:
    os.chdir(ROOT)
    _load_dotenv()

    profile = "default"
    hostport = "0.0.0.0:8000"
    extra: list[str] = []

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
        elif a.lower() in (
            "sqlite",
            "sql",
            "local",
            "postgres",
            "postgresql",
            "pg",
            "cloud",
            "aiven",
            "remote",
            "default",
            "env",
        ):
            profile = a
        elif a.count(":") == 1 and a.rsplit(":", 1)[-1].isdigit():
            hostport = a
        else:
            extra.append(a)
        i += 1

    url = resolve(profile)
    if profile.strip().lower() in ("sqlite", "sql"):
        url = ""
    os.environ["DATABASE_URL"] = url

    if not url:
        print("Database: SQLite (db.sqlite3)")
    else:
        print(f"Database profile: {profile}")
        print(f"  {_redact(url)}")

    print()
    print(f"Starting Django at http://{hostport}  (Ctrl+C to stop)")
    print()

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    from django.core.management import execute_from_command_line

    execute_from_command_line(["manage.py", "runserver", hostport, *extra])


if __name__ == "__main__":
    main()
