# Waste Management System

Internal **waste oil inventory and workflow** application: a **Django REST API** plus a **Tauri + React** desktop client. Records move through a five-stage pipeline (storeman → treatment → admin → manager → GM) with SLA-based alerts, audit logging, and optional email notifications.

This repository contains:

| Component | Path | Stack |
|-----------|------|--------|
| API | `waste_oil_backend/` | Django 5, DRF, SimpleJWT, Celery (optional Redis) |
| Desktop | `waste_oil_desktop-TAURI/` | React 18, Vite 6, Tauri 2, Zustand |

Default database for local development is **SQLite** (`waste_oil_backend/db.sqlite3`). Set `DATABASE_URL` for **PostgreSQL** in production.

---

## Features (current)

- **Authentication**: JWT access/refresh; login, logout, `/auth/me/`, password change.
- **First-time users (GM-created accounts)**: `must_change_password` flag; welcome email with username and initial password when SMTP is configured; users can browse the **dashboard** and **records** (read-only) until they change password; **writes and workflow actions** blocked by API middleware until password is updated.
- **Roles**: `storeman`, `treatment`, `admin`, `manager`, `gm`, `superadmin` with department/stage alignment.
- **Records**: List/detail with filters, attachments (holder-only upload), Excel export from the UI where enabled.
- **Visibility**: Storeman, manager, GM, and superadmin see the **full record catalog** for reporting and browsing; treatment/admin use stage-scoped visibility. Editing and forwarding still require being the **current holder** (and correct stage rules).
- **Workflow**: Forward, return, transitions history, per-role **My Queue**.
- **GM console**: Create/update pipeline employees; optional welcome email on create.
- **Vendors**: Master list; create/update restricted by role.
- **Dashboard**: KPIs, charts, scoped tables, links into records (uses live list + queue + public analytics endpoints).
- **Admin console**: Analytics summaries; GM monthly report (API + optional PDF/email via Celery).
- **Notifications**: Email for workflow events, SLA alerts, monthly reports—gated by `EMAIL_*` and `EMAIL_NOTIFICATIONS_ENABLED`.

Further detail: [Docs/QUICKSTART.md](Docs/QUICKSTART.md), [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md), [Docs/DEVELOPMENT.md](Docs/DEVELOPMENT.md).

---

## Repository layout

```
inventry-management/
├── README.md                 # This file
├── .env.example              # High-level env reference (per-app .env files are authoritative)
├── Docs/                     # Quick start, architecture, development, contributing
├── waste_oil_backend/        # Django API
│   ├── manage.py
│   ├── .env.example
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── dev.txt
│   │   └── prod.txt
│   ├── config/settings/      # base, dev, prod
│   └── apps/
│       ├── accounts/         # Users, JWT, GM employee API, password-change middleware
│       ├── records/          # Records, vendors
│       ├── workflow/         # Forward, return, queue
│       ├── alerts/
│       ├── audit/
│       ├── notifications/
│       └── admin_console/    # Analytics & GM reports
└── waste_oil_desktop-TAURI/  # Desktop UI
    ├── .env.example
    ├── package.json
    ├── src/                  # React app (hash router, API shim in platform/)
    └── src-tauri/            # Rust / Tauri shell
```

---

## Prerequisites

### Backend

- **Python 3.11+** (3.12 recommended)
- **pip** and a virtual environment
- **PostgreSQL** only if you set `DATABASE_URL` (otherwise SQLite is used)
- **Redis** only if you run Celery with `USE_REDIS_CELERY=1` (dev defaults to eager/in-memory)

### Desktop (Tauri)

- **Node.js 20+** and **npm**
- **Rust** (`rustup`) and platform WebView/build dependencies

**Windows**: MSVC C++ build tools (Visual Studio Build Tools with Desktop/C++ workload), WebView2 runtime. The Tauri package runs `scripts/build-with-msvc.ps1` on build/dev to locate `link.exe`. If Build Tools lacks C++, run `npm run add-msvc` from `waste_oil_desktop-TAURI` as Administrator, or add the C++ workload in Visual Studio Installer.

**Linux**: `webkit2gtk`, build tools, etc. (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

**macOS**: Xcode Command Line Tools.

---

## Installation and local run

### 1. Backend

**Linux / macOS**

```bash
cd waste_oil_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env
# Edit .env: optional DATABASE_URL, EMAIL_*, CORS_ALLOWED_ORIGINS, etc.
python manage.py migrate
python manage.py seed_workflow_demo
python manage.py runserver 0.0.0.0:8000
```

**Windows (PowerShell)**

```powershell
cd waste_oil_backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements\dev.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py seed_workflow_demo
python manage.py runserver 0.0.0.0:8000
```

- API root: `http://127.0.0.1:8000`
- REST prefix: **`/api/v1/`** (e.g. `POST /api/v1/auth/login/`)
- Health: `GET /api/v1/health/`

**Create a superuser** (Django admin, emergencies):

```bash
python manage.py createsuperuser
```

**Demo users** (after `seed_workflow_demo`, default password `Demo12345` unless you pass `--password`):

| Username    | Role      | Stage |
|-------------|-----------|-------|
| `storeman`  | storeman  | 1     |
| `treatment` | treatment | 2     |
| `waste_admin` | admin   | 3     |
| `manager`   | manager   | 4     |
| `gm`        | gm        | 5     |

Demo accounts are seeded with **`must_change_password=False`** so you are not forced through the first-login password flow.

### 2. Desktop (Tauri)

```bash
cd waste_oil_desktop-TAURI
npm install
cp .env.example .env   # Windows: Copy-Item .env.example .env
```

Set in `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Start the app (opens a native window):

```bash
npm run dev
```

Production installer / bundle:

```bash
npm run build
```

---

## Environment configuration

### Backend (`waste_oil_backend/.env`)

Copy from `waste_oil_backend/.env.example`. Important variables:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` | Django core |
| `DATABASE_URL` | Omit or use `sqlite:///...` for dev SQLite; use Postgres URL in production |
| `REDIS_URL`, `USE_REDIS_CELERY` | Real Celery worker vs in-process eager (dev default) |
| `CORS_ALLOWED_ORIGINS` | Browser/Tauri dev origins; `CORS_ALLOW_ALL_ORIGINS` defaults permissive for desktop |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL` | SMTP; required for sending mail |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` to disable outbound email without breaking the app |
| `FRONTEND_URL`, `WELCOME_EMAIL_APP_HINT` | Optional text in welcome emails for GM-created users |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | Token lifetimes |
| `SLA_DAYS`, `ALERT_*_PERCENT` | SLA and alert bands |

### Desktop (`waste_oil_desktop-TAURI/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Must end with `/api/v1` (no trailing slash after `v1`) |

For a **LAN server**, set `VITE_API_BASE_URL=http://<server-ip>:8000/api/v1` and ensure `ALLOWED_HOSTS` / CORS / firewall allow clients.

---

## API authentication (quick reference)

- `POST /api/v1/auth/login/` — body: `username`, `password` → `access_token`, `refresh_token`, `user` (includes `must_change_password`).
- `POST /api/v1/auth/refresh/` — refresh token rotation.
- `POST /api/v1/auth/logout/` — blacklist refresh token.
- `GET /api/v1/auth/me/` — current profile (Bearer access token).
- `POST /api/v1/auth/change-password/` — `old_password`, `new_password`; clears `must_change_password`.

Clients should send `Authorization: Bearer <access_token>` on protected routes.

---

## Dashboard and analytics

The desktop dashboard combines:

- Paginated **records** and **workflow queue** (authenticated).
- **Analytics** endpoints under `/api/v1/admin-console/analytics/` (currently unauthenticated in code—suitable only on trusted networks; lock down in production if needed).

Exports (Excel) are generated in the browser from the current filtered dataset where the UI exposes them.

---

## Celery (optional)

With `USE_REDIS_CELERY=1` in `waste_oil_backend/.env`, install Redis, then:

```bash
celery -A config worker -l info
celery -A config beat -l info   # if using beat schedule
```

Without Redis, **dev** runs tasks eagerly (no separate worker).

---

## Build commands (summary)

| Target | Command |
|--------|---------|
| Tauri production build | `cd waste_oil_desktop-TAURI && npm run build` |
| Vite preview | `cd waste_oil_desktop-TAURI && npm run preview` |

---

## Default local URLs

| Service | URL |
|---------|-----|
| Django API | `http://127.0.0.1:8000` |
| Tauri Vite dev (embedded) | Typically `http://127.0.0.1:1420` (Tauri opens the window for you) |

---

## License

See [LICENSE](LICENSE) in the repository root.
