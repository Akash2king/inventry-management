# Chem-Solv Inventory

Internal **waste oil inventory and workflow** application: a **Django REST API** plus a **Tauri + React** desktop client. Records move through a five-stage pipeline (storeman → treatment → admin → manager → GM) with SLA-based alerts, audit logging, and optional email notifications.

This repository contains:

| Component | Path | Stack |
|-----------|------|-------|
| API | `waste_oil_backend/` | Django 5, DRF, SimpleJWT, Celery (optional Redis) |
| Desktop | `waste_oil_desktop-TAURI/` | React 18, Vite 6, Tauri 2, Zustand, React Router (hash) |

Default database for local development is **SQLite** (`waste_oil_backend/db.sqlite3`). Set `DATABASE_URL` for **PostgreSQL** in production.

> **Note:** The desktop shell in this repo is **Tauri only**. Older docs may mention an Electron app; day-to-day development uses `waste_oil_desktop-TAURI/`.

---

## Features (current)

- **Authentication**: JWT access/refresh; login, logout, `/auth/me/`, password change.
- **First-time users (GM-created accounts)**: `must_change_password` flag; welcome email with username and initial password when SMTP is configured; users can browse the **dashboard** and **records** (read-only) until they change password; **writes and workflow actions** blocked by API middleware until password is updated.
- **Roles**: `storeman`, `treatment`, `admin`, `manager`, `gm`, `superadmin` with department/stage alignment. Use **Django admin** or `createsuperuser` for `superadmin` accounts—they are **not** created by `seed_workflow_demo`.
- **Departments**: Pipeline departments have `stage_order` and a **`workflow_layer`** (`peer` | `oversight`). GM-managed via `/api/v1/gm/departments/`. Demo seed aligns stages **1–3** with peer and **4–5** with oversight.
- **Records**: List/detail with filters; **entry photo** upload where enabled; **searchable configurable options** for form fields (GM-managed categories); attachments (holder workflows); Excel export where the UI exposes it.
- **Visibility**: Storeman, manager, GM, and superadmin see the **full record catalog** for reporting and browsing; treatment/admin use stage-scoped visibility. Editing and forwarding still require being the **current holder** (and correct stage rules).
- **Workflow**: Forward (optional explicit next holder), return, transitions history, per-role **My Queue**.
- **Dashboard**: **Peer** dashboard (compact) for `storeman`, `treatment`, and `admin`; **Executive** dashboard (analytics-heavy) for `manager`, `gm`, and `superadmin`—selected in `src/pages/Dashboard.jsx`.
- **GM console**: Departments, pipeline employees CRUD; optional welcome email on create; monthly GM report (API + PDF) via admin-console routes.
- **Vendors**: Master list; create/update restricted by role.
- **Audit**: Immutable-style **audit log** API (`/api/v1/audit/logs/`) and desktop **Audit log** page (`#/audit-logs`) for managers and GM.
- **Admin console**: Analytics summaries; GM monthly report (JSON + PDF); Celery-assisted email/PDF where configured.
- **Notifications**: Email for workflow events, SLA alerts, monthly reports—gated by `EMAIL_*` and `EMAIL_NOTIFICATIONS_ENABLED`.

Further detail: [Docs/QUICKSTART.md](Docs/QUICKSTART.md), [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md), [Docs/DEVELOPMENT.md](Docs/DEVELOPMENT.md).

---

## Repository layout

```
inventry-management/
├── README.md                 # This file
├── .env.example              # High-level env sketch (component .env.example files are authoritative)
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
│       ├── accounts/         # Users, JWT, GM APIs, password-change middleware, departments
│       ├── records/          # Records, vendors, photos, searchable options
│       ├── workflow/         # Forward, return, queue, transitions
│       ├── alerts/
│       ├── audit/            # Audit log REST API
│       ├── notifications/
│       └── admin_console/    # Analytics & GM reports
└── waste_oil_desktop-TAURI/  # Desktop UI
    ├── .env.example
    ├── package.json
    ├── src/                   # React app (hash router, fetch-based API in platform/)
    ├── dist/                  # Vite production output (referenced by Tauri)
    └── src-tauri/             # Rust / Tauri shell, Windows icons/bundle (NSIS)
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

**Windows**: MSVC C++ build tools (Visual Studio Build Tools with Desktop/C++ workload), WebView2 runtime. Dev/build runs `scripts/build-with-msvc.ps1` via `scripts/run-tauri.js`. If Build Tools lacks C++, run `npm run add-msvc` from `waste_oil_desktop-TAURI` as Administrator, or add the C++ workload in Visual Studio Installer.

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
# Edit .env: DATABASE_URL (optional), EMAIL_*, CORS_ALLOWED_ORIGINS, etc.
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

**Create a superuser** (Django admin, `superadmin`-style emergencies):

```bash
python manage.py createsuperuser
```

**Demo users** (after `seed_workflow_demo`, default password `Demo12345` unless you pass `--password`):

| Username      | Role      | Stage |
|---------------|-----------|-------|
| `storeman`    | storeman  | 1     |
| `treatment`   | treatment | 2     |
| `waste_admin` | admin     | 3     |
| `manager`     | manager   | 4     |
| `gm`          | gm        | 5     |

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

Without this variable, **`window.api` is never installed** and the UI cannot talk to the backend (see `src/platform/installBrowserApi.js`).

Start the app (opens a native window; Vite serves at `127.0.0.1:1420` and Tauri loads it):

```bash
npm run dev
```

**Production installer / bundle** (runs `vite build`, then Cargo release; outputs NSIS installer on Windows):

```bash
npm run build
```

Typical artifact:  
`waste_oil_desktop-TAURI/src-tauri/target/release/bundle/nsis/Chem-Solv Inventory_0.1.0_x64-setup.exe`

The Vite config sets **`base: "./"`** so JavaScript/CSS paths resolve when the packaged app loads `index.html` from the filesystem (`file://`). If you fork the project, keep that setting for desktop releases.

---

## Desktop client architecture (short)

| Topic | Detail |
|-------|--------|
| Routing | `createHashRouter` — URLs look like `index.html#/login`, `index.html#/records`, etc. |
| API | Browser-style **`window.api`** object implemented in `src/platform/installBrowserApi.js` using **`fetch`** and `VITE_API_BASE_URL` (no Rust IPC for REST in the default setup). |
| Auth | Tokens in **`localStorage`** (`wom_access_token`, `wom_refresh_token`), profile cache `wom_user_profile` — see `src/store/authStore.js`. |
| Plugins | `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` available for native file flows where used. |

---

## Environment configuration

### Backend (`waste_oil_backend/.env`)

Copy from `waste_oil_backend/.env.example`. Important variables:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` | Django core |
| `DATABASE_URL` | Omit or use SQLite for dev; Postgres URL in production |
| `REDIS_URL`, `USE_REDIS_CELERY` | Real Celery worker vs in-process eager (dev default) |
| `CORS_ALLOWED_ORIGINS` | Browser/Tauri dev origins (`http://127.0.0.1:1420`, etc.) |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL` | SMTP; required for sending mail |
| `EMAIL_NOTIFICATIONS_ENABLED` | Set `false` to disable outbound email without breaking the app |
| `FRONTEND_URL`, `WELCOME_EMAIL_APP_HINT` | Optional copy in welcome emails for GM-created users |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | Token lifetimes |
| `SLA_DAYS`, `YELLOW_THRESHOLD`, `RED_THRESHOLD` | SLA day count and alert day thresholds |

### Desktop (`waste_oil_desktop-TAURI/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Must be the API **v1 prefix**, e.g. `http://127.0.0.1:8000/api/v1` (no trailing slash after `v1`) |

For a **LAN server**, set `VITE_API_BASE_URL=http://<server-ip>:8000/api/v1` and ensure `ALLOWED_HOSTS` / CORS / firewall allow clients. **Rebuild** the desktop app after changing any `VITE_*` variable so Vite injects the new values.

---

## API authentication (quick reference)

- `POST /api/v1/auth/login/` — body: `username`, `password` → `access_token`, `refresh_token`, `user` (includes `must_change_password`).
- `POST /api/v1/auth/refresh/` — refresh token rotation.
- `POST /api/v1/auth/logout/` — blacklist refresh token.
- `GET /api/v1/auth/me/` — current profile (Bearer access token).
- `POST /api/v1/auth/change-password/` — `old_password`, `new_password`; clears `must_change_password`.

Clients should send `Authorization: Bearer <access_token>` on protected routes.

**Other notable prefixes:** `records/`, `workflow/queue/`, `gm/` (departments & employees), `audit/logs/`, `admin-console/` (analytics & GM reports).

---

## Dashboard and analytics

The desktop home route combines authenticated **records** and **workflow queue** data with **admin-console analytics** endpoints. Peer roles see a reduced dashboard surface; oversight roles see the full executive view.

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
| Tauri production build + Windows NSIS | `cd waste_oil_desktop-TAURI && npm run build` |
| Frontend production assets only | `cd waste_oil_desktop-TAURI && npm run frontend:build` |
| Vite preview (browser) | `cd waste_oil_desktop-TAURI && npm run preview` |

---

## Troubleshooting (desktop)

- **Blank / white window in the installed `.exe`:** Ensure **`VITE_API_BASE_URL`** was set **before** `npm run build`. Confirm `vite.config.js` keeps **`base: "./"`** so assets load under `file://`.
- **`API setup required` in the Login screen:** Missing or empty `VITE_API_BASE_URL` at build/run time — copy `.env.example` to `.env` and restart dev server or rebuild.
- **Wrong or missing taskbar icon after an update:** Windows may cache pinned shortcuts — unpin the old shortcut, reinstall from the latest NSIS installer, launch once, pin again.

---

## Default local URLs

| Service | URL |
|---------|-----|
| Django API | `http://127.0.0.1:8000` |
| Tauri Vite dev (embedded WebView) | `http://127.0.0.1:1420` |

---

## GitHub Actions (Windows installer)

On push to **`main`** or **`master`** (when files under `waste_oil_desktop-TAURI/` change), the workflow [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml) builds the **NSIS Windows installer** on **`windows-latest`** and publishes a **GitHub Release** (tag `desktop-build-<run_number>`). A Linux runner cannot produce this Windows installer with the current Tauri/NSIS setup without extra cross-compilation.

- **Workflow permissions:** Repository **Settings → Actions → General → Workflow permissions** must allow **Read and write** so releases can be created.
- **API URL in the installer:** Optional repository variable **`VITE_API_BASE_URL`** (Actions → Variables). If unset, builds use `http://127.0.0.1:8000/api/v1`.
- **Manual run:** Actions → **Release desktop (Windows)** → **Run workflow**.

---

## License

See [LICENSE](LICENSE) in the repository root.
