# Backend setup & run (Windows + Linux)

One script installs the virtualenv, dependencies, lets you **select the database**, runs migrations, and starts Django.

| OS | Command |
|----|---------|
| **Windows** | `start-backend.bat` |
| **Linux / macOS** | `./start-backend.sh` |

(`run-server.bat` / `run-server.sh` call the same installer.)

---

## Prerequisites

### Windows

- [Python 3.10+](https://www.python.org/downloads/) — check **Add python.exe to PATH**
- Optional: [PostgreSQL](https://www.postgresql.org/download/windows/) if you use the **local** DB profile
- Optional: Redis only if you set `USE_REDIS_CELERY=1` (dev uses in-memory Celery by default)

Verify:

```powershell
python --version
# or
py -3 --version
```

### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip
# Optional local Postgres:
sudo apt install -y postgresql postgresql-contrib
```

### Linux (Fedora)

```bash
sudo dnf install -y python3 python3-pip
# Optional: postgresql-server
```

---

## Quick start

### 1. Open a terminal in `waste_oil_backend`

```text
inventry-management/waste_oil_backend/
```

### 2. Run the starter

**Windows (cmd or PowerShell):**

```bat
start-backend.bat
```

**Linux / macOS:**

```bash
chmod +x start-backend.sh   # once
./start-backend.sh
```

### 3. Select the database when prompted

```text
Select database profile:
  1) sqlite  — file db.sqlite3 (no Postgres needed)
  2) local   — local Postgres (DATABASE_LOCAL_* or DATABASE_URL_LOCAL)
  3) cloud   — cloud/Aiven  (DATABASE_URL_CLOUD or DATABASE_URL)
  4) default — DATABASE_URL from .env as-is

Choice [1=sqlite / default=sqlite]:
Bind address [0.0.0.0:8000]:
```

Press Enter to accept defaults (**sqlite** + `0.0.0.0:8000`).

### 4. Open the API

- App / API: http://127.0.0.1:8000/
- Admin: http://127.0.0.1:8000/admin/

Stop with `Ctrl+C`.

---

## Skip the menu (pass a profile)

| Profile | Meaning |
|---------|---------|
| `sqlite` | File database `db.sqlite3` |
| `local` | Local Postgres from `.env` |
| `cloud` | Cloud/Aiven Postgres from `.env` |
| `default` | Raw `DATABASE_URL` from `.env` |

**Windows:**

```bat
start-backend.bat sqlite
start-backend.bat local
start-backend.bat cloud
start-backend.bat local 0.0.0.0:8000
start-backend.bat --seed
start-backend.bat --install-only
```

**Linux:**

```bash
./start-backend.sh sqlite
./start-backend.sh local
./start-backend.sh cloud
./start-backend.sh local 0.0.0.0:8000
./start-backend.sh --seed
./start-backend.sh --install-only
```

### Useful flags

| Flag | Effect |
|------|--------|
| *(no profile)* | Interactive DB menu |
| `--yes` / `-y` | Non-interactive; defaults to **sqlite** if no profile |
| `--install-only` | Create `.venv` + install packages, then exit |
| `--run-only` | Skip `pip install`; still migrate + run |
| `--no-migrate` | Skip migrations |
| `--seed` | Run `seed_test_data` after migrate |

CI / automation example:

```bash
./start-backend.sh sqlite --yes --install-only
./start-backend.sh sqlite --yes --run-only
```

---

## Configure `.env`

On first run, if `.env` is missing, it is copied from `.env.example`.

### Local Postgres (`local` profile)

Prefer separate fields so passwords with `@` work:

```env
DATABASE_LOCAL_USER=postgres
DATABASE_LOCAL_PASSWORD=root@123
DATABASE_LOCAL_HOST=127.0.0.1
DATABASE_LOCAL_PORT=5432
DATABASE_LOCAL_NAME=defaultdb
```

Or a full URL (encode `@` in the password as `%40`):

```env
DATABASE_URL_LOCAL=postgres://postgres:root%40123@127.0.0.1:5432/defaultdb?sslmode=disable
```

### Cloud / Aiven (`cloud` profile)

```env
DATABASE_URL_CLOUD=postgres://USER:PASSWORD@HOST:PORT/defaultdb?sslmode=require
```

### Default profile

```env
DATABASE_URL=postgres://...
```

Leave `DATABASE_URL` empty to use SQLite when you choose **default** / **sqlite**.

Other common keys: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `REDIS_URL`, email, OneSignal — see `.env.example`.

---

## What the script does

1. Creates `.venv` if missing  
2. Installs `requirements/dev.txt`  
3. Ensures `.env` exists  
4. Lets you **select** sqlite / local / cloud / default (or uses a CLI profile)  
5. Sets `DATABASE_URL` for that profile  
6. Runs `manage.py migrate`  
7. Runs `manage.py check`  
8. Starts `manage.py runserver` on `0.0.0.0:8000` (or your bind address)

Dev Celery runs **eager / in-memory** unless you set `USE_REDIS_CELERY=1` and run Redis + a worker.

---

## Manual steps (if you prefer)

**Windows:**

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements\dev.txt
copy .env.example .env
REM edit .env
python scripts\resolve_database_url.py local
set DATABASE_URL=...   REM or use start-backend.bat local
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

**Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env
# edit .env
export DATABASE_URL="$(python scripts/resolve_database_url.py local)"
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Or use the thin resolver + run helper:

```bash
python scripts/run_server.py local
```

---

## Phone / LAN access

1. Bind `0.0.0.0:8000` (default).  
2. Add your PC LAN IP to `ALLOWED_HOSTS` in `.env` (e.g. `192.168.29.105`).  
3. Point the mobile/desktop client at `http://YOUR_LAN_IP:8000`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `python` / `py` not found (Windows) | Reinstall Python with PATH enabled; reopen terminal |
| `ensurepip` / venv errors (Linux) | `sudo apt install python3-venv` |
| SSL error on local Postgres | Use `local` profile or `?sslmode=disable`; password `@` → use `DATABASE_LOCAL_PASSWORD` |
| Cloud needs SSL | Use `cloud` profile and `sslmode=require` in `DATABASE_URL_CLOUD` |
| Port 8000 in use | `start-backend.bat local 0.0.0.0:8001` |
| Migrate fails (local) | Start PostgreSQL and create the database name in `.env` |

---

## Related scripts

| Path | Role |
|------|------|
| `start-backend.bat` / `.sh` | **Recommended** install + menu + run |
| `run-server.bat` / `.sh` | Same as start-backend |
| `scripts/bootstrap_backend.py` | Implementation |
| `scripts/resolve_database_url.py` | Profile → `DATABASE_URL` |
| `scripts/run_server.py` | Run only (no install/migrate) |
| `scripts/setup-venv.sh` | Linux venv-only helper |
