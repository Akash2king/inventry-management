#!/usr/bin/env python
"""
Install dependencies, pick a database profile, migrate, and run Django.

Usage:
  python scripts/bootstrap_backend.py
  python scripts/bootstrap_backend.py local
  python scripts/bootstrap_backend.py cloud 0.0.0.0:8000
  python scripts/bootstrap_backend.py --db=sqlite --seed
  python scripts/bootstrap_backend.py --no-seed
  python scripts/bootstrap_backend.py --install-only
  python scripts/bootstrap_backend.py --run-only local

Wrappers:
  start-backend.bat / start-backend.sh   (recommended)
  run-server.bat / run-server.sh         (same script)
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
REQUIREMENTS = ROOT / "requirements" / "dev.txt"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"

PROFILE_ALIASES = {
    "1": "sqlite",
    "sqlite": "sqlite",
    "sql": "sqlite",
    "2": "local",
    "local": "local",
    "postgres": "local",
    "postgresql": "local",
    "pg": "local",
    "3": "cloud",
    "cloud": "cloud",
    "aiven": "cloud",
    "remote": "cloud",
    "4": "default",
    "default": "default",
    "env": "default",
}


def _is_venv_python(exe: Path) -> bool:
    try:
        return exe.resolve() == _venv_python().resolve()
    except Exception:
        return False


def _venv_dir() -> Path:
    return ROOT / ".venv"


def _venv_python() -> Path:
    if os.name == "nt":
        return _venv_dir() / "Scripts" / "python.exe"
    return _venv_dir() / "bin" / "python"


def _venv_pip() -> list[str]:
    return [str(_venv_python()), "-m", "pip"]


def _run(cmd: list[str], *, check: bool = True, env: dict | None = None) -> int:
    print(f"→ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(ROOT), env=env)
    if check and result.returncode != 0:
        raise SystemExit(result.returncode)
    return result.returncode


def _ensure_venv_and_reexec(argv: list[str]) -> None:
    """Create .venv if needed, then re-run this script inside it."""
    py = _venv_python()
    if not py.is_file():
        print("Creating virtual environment (.venv)...")
        _run([sys.executable, "-m", "venv", str(_venv_dir())])
        if not py.is_file():
            raise SystemExit(f"Failed to create venv python at {py}")

    if not _is_venv_python(Path(sys.executable)):
        print(f"Re-launching inside {_venv_dir().name}...")
        # Windows-safe: replace current process
        os.execv(str(py), [str(py), str(Path(__file__).resolve()), *argv])


def _ensure_pip_and_deps() -> None:
    print("Upgrading pip...")
    _run(_venv_pip() + ["install", "--upgrade", "pip"], check=False)
    if not REQUIREMENTS.is_file():
        raise SystemExit(f"Missing {REQUIREMENTS}")
    print(f"Installing {REQUIREMENTS.relative_to(ROOT)}...")
    _run(_venv_pip() + ["install", "-r", str(REQUIREMENTS)])


def _ensure_env_file() -> None:
    if ENV_FILE.is_file():
        return
    if ENV_EXAMPLE.is_file():
        shutil.copy(ENV_EXAMPLE, ENV_FILE)
        print(f"Created .env from .env.example — edit secrets before cloud/local Postgres.")
        return
    ENV_FILE.write_text(
        "SECRET_KEY=dev-insecure-change-me\nDEBUG=True\nDATABASE_URL=\n",
        encoding="utf-8",
    )
    print("Created minimal .env")


def _prompt_profile(default: str = "sqlite") -> str:
    print()
    print("Select database profile:")
    print("  1) sqlite  — file db.sqlite3 (no Postgres needed)")
    print("  2) local   — local Postgres (DATABASE_LOCAL_* or DATABASE_URL_LOCAL)")
    print("  3) cloud   — cloud/Aiven  (DATABASE_URL_CLOUD or DATABASE_URL)")
    print("  4) default — DATABASE_URL from .env as-is")
    print()
    raw = input(f"Choice [1=sqlite / default={default}]: ").strip().lower()
    if not raw:
        return default
    key = PROFILE_ALIASES.get(raw)
    if not key:
        print(f"Unknown choice '{raw}', using {default}")
        return default
    return key


def _prompt_hostport(default: str = "0.0.0.0:8000") -> str:
    raw = input(f"Bind address [{default}]: ").strip()
    return raw or default


def _prompt_seed(default: bool = False) -> bool:
    print()
    hint = "Y/n" if default else "y/N"
    raw = input(f"Seed demo data (seed_test_data)? [{hint}]: ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes", "1", "true")


def _redact(url: str) -> str:
    if not url:
        return "(empty → SQLite db.sqlite3)"
    u = urlparse(url)
    auth = f"{u.username}:***@" if u.username else ""
    host = u.hostname or ""
    port = f":{u.port}" if u.port else ""
    q = f"?{u.query}" if u.query else ""
    return f"{u.scheme}://{auth}{host}{port}{u.path or ''}{q}"


def _apply_database(profile: str) -> str:
    sys.path.insert(0, str(SCRIPTS))
    from resolve_database_url import resolve, _load_dotenv  # noqa: WPS433

    _load_dotenv()
    url = resolve(profile)
    if profile.strip().lower() in ("sqlite", "sql"):
        url = ""
    # dj-database-url treats an empty DATABASE_URL env as "configured but blank"
    # (dummy engine). Unset for SQLite so Django falls back to db.sqlite3.
    if url:
        os.environ["DATABASE_URL"] = url
    else:
        os.environ.pop("DATABASE_URL", None)
    return url

def _django_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    return env


def _migrate() -> None:
    print("Running migrations...")
    _run(
        [str(_venv_python()), "manage.py", "migrate", "--noinput"],
        env=_django_env(),
    )


def _seed() -> None:
    print("Seeding test data...")
    code = _run(
        [str(_venv_python()), "manage.py", "seed_test_data"],
        check=False,
        env=_django_env(),
    )
    if code != 0:
        # Fallback script if management command differs
        seed_py = SCRIPTS / "seed_test_data.py"
        if seed_py.is_file():
            _run([str(_venv_python()), str(seed_py)], env=_django_env())
        else:
            print("Seed skipped (seed_test_data not available).")
            return
    print()
    print("Demo logins (password Demo12345 unless you passed --password):")
    print("  storeman | treatment | waste_admin | manager | gm")
    print()

def _check() -> None:
    _run(
        [str(_venv_python()), "manage.py", "check"],
        env=_django_env(),
    )


def _runserver(hostport: str, extra: list[str]) -> None:
    print()
    print(f"Starting Django at http://{hostport}  (Ctrl+C to stop)")
    print()
    cmd = [str(_venv_python()), "manage.py", "runserver", hostport, *extra]
    raise SystemExit(subprocess.call(cmd, cwd=str(ROOT), env=_django_env()))


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Install and run the Waste Oil backend (venv, deps, DB profile, migrate, server)."
    )
    p.add_argument(
        "profile",
        nargs="?",
        default=None,
        help="sqlite | local | cloud | default (omit for interactive menu)",
    )
    p.add_argument(
        "hostport",
        nargs="?",
        default=None,
        help="Bind address, e.g. 0.0.0.0:8000",
    )
    p.add_argument("--db", dest="db_flag", default=None, help="Same as profile")
    p.add_argument(
        "--install-only",
        action="store_true",
        help="Only create venv and install requirements",
    )
    p.add_argument(
        "--run-only",
        action="store_true",
        help="Skip pip install (still uses venv); migrate + run",
    )
    p.add_argument(
        "--no-migrate",
        action="store_true",
        help="Skip migrations",
    )
    p.add_argument(
        "--seed",
        action="store_true",
        help="Run seed_test_data after migrate (skip prompt)",
    )
    p.add_argument(
        "--no-seed",
        action="store_true",
        help="Skip seeding without prompting",
    )
    p.add_argument(
        "--yes",
        "-y",
        action="store_true",
        help="Non-interactive: use sqlite if no profile given",
    )
    p.add_argument(
        "--no-menu",
        action="store_true",
        help="Do not prompt; require profile or --yes",
    )
    args, unknown = p.parse_known_args(argv)
    args.extra = unknown
    return args


def main(argv: list[str] | None = None) -> None:
    argv = list(argv if argv is not None else sys.argv[1:])
    os.chdir(ROOT)

    # Allow --help before venv re-exec
    if any(a in ("-h", "--help") for a in argv):
        _parse_args(["--help"])

    _ensure_venv_and_reexec(argv)
    args = _parse_args(argv)

    if not args.run_only:
        _ensure_pip_and_deps()
    _ensure_env_file()

    if args.install_only:
        print()
        print("Install complete.")
        print("Next:  start-backend.bat   or   ./start-backend.sh")
        return

    profile = args.db_flag or args.profile
    if profile:
        profile = PROFILE_ALIASES.get(profile.lower(), profile.lower())
        if profile not in ("sqlite", "local", "cloud", "default"):
            raise SystemExit(
                f"Unknown profile '{profile}'. Use: sqlite | local | cloud | default"
            )
    elif args.yes or args.no_menu:
        profile = "sqlite"
    else:
        # Interactive selection
        try:
            profile = _prompt_profile("sqlite")
        except EOFError:
            profile = "sqlite"
            print("No TTY — using sqlite")

    hostport = args.hostport or "0.0.0.0:8000"
    interactive = not args.yes and not args.no_menu and sys.stdin.isatty()
    if not args.hostport and interactive:
        try:
            hostport = _prompt_hostport(hostport)
        except EOFError:
            pass

    if args.seed and args.no_seed:
        raise SystemExit("Use only one of --seed or --no-seed")
    if args.seed:
        do_seed = True
    elif args.no_seed or args.yes or args.no_menu:
        do_seed = False
    elif interactive:
        try:
            do_seed = _prompt_seed(False)
        except EOFError:
            do_seed = False
    else:
        do_seed = False

    url = _apply_database(profile)
    print()
    print(f"Database profile: {profile}")
    print(f"  {_redact(url)}")
    print(f"Seed demo data: {'yes' if do_seed else 'no'}")

    if not args.no_migrate:
        _migrate()
    _check()

    if do_seed:
        _seed()

    _runserver(hostport, args.extra)


if __name__ == "__main__":
    main()
