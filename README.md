# Chem-Solv Inventory

Internal **waste oil inventory and workflow** application: a **Django REST API** with two first-party clients—a **Tauri + React** desktop app and an **Expo (React Native)** mobile app—plus an optional **Vite** bundle in `waste_oil_expo_app` for browser-style testing. Records move through a five-stage pipeline (storeman → treatment → admin → manager → GM) with SLA-based alerts, audit logging, and optional email notifications.

**Current stage:** Backend and Tauri desktop are the primary, feature-complete surfaces used in production-style flows (Windows installer via GitHub Actions). The **Expo** client targets iOS and Android with the same REST API, React Navigation on device, and **EAS / CI** paths for Android APK or app bundle builds; native development assumes the API is reachable on the LAN (or tunneled) with cleartext HTTP allowed for local dev in app config.

This repository contains:

| Component | Path | Stack |
|-----------|------|-------|
| API | `waste_oil_backend/` | Django 5, DRF, SimpleJWT, Celery (optional Redis) |
| Desktop | `waste_oil_desktop-TAURI/` | React 18, Vite 6, Tauri 2, Zustand, React Router (hash) |
| Mobile (+ optional web) | `waste_oil_expo_app/` | Expo ~54, React Native 0.81, React 19, Zustand, React Navigation; Vite 6 for optional `src/` web build |

Default database for local development is **SQLite** (`waste_oil_backend/db.sqlite3`). Set `DATABASE_URL` for **PostgreSQL** in production.

> **Note:** The desktop shell in this repo is **Tauri only**. Older docs may mention an Electron app; day-to-day development uses `waste_oil_desktop-TAURI/`. Mobile is **Expo**, not embedded inside Tauri’s WebView (the native app entry is `App.js` → `native/NativeRoot.jsx`).

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
- **Audit**: Immutable-style **audit log** API (`/api/v1/audit/logs/`) and **Audit log** UI on desktop (`#/audit-logs`) and in the Expo app for managers and GM.
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
├── waste_oil_desktop-TAURI/  # Desktop UI
│   ├── .env.example
│   ├── package.json
│   ├── src/                   # React app (hash router, fetch-based API in platform/)
│   ├── dist/                  # Vite production output (referenced by Tauri)
│   └── src-tauri/             # Rust / Tauri shell, Windows icons/bundle (NSIS)
└── waste_oil_expo_app/        # Mobile (Expo) + optional Vite web (`src/`)
    ├── .env.example
    ├── app.json               # Expo config (Android package, iOS bundle id, cleartext for LAN dev)
    ├── eas.json               # EAS Build profiles (preview APK, production AAB)
    ├── native/                # React Navigation screens (primary native shell)
    └── src/                   # Shared logic + Vite entry for browser builds
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

### Mobile (Expo)

- **Node.js 20+** and **npm**
- **Expo CLI** via `npx expo` (no global install required)
- **iOS**: Xcode (simulator or device)
- **Android**: Android Studio / SDK for `expo run:android` and emulator (`10.0.2.2` maps to the host machine)
- Optional **EAS** account for cloud builds (`eas build`); `eas.json` is already present

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

### 3. Mobile (Expo)

```bash
cd waste_oil_expo_app
npm install
cp .env.example .env   # Windows: Copy-Item .env.example .env
```

Set **`EXPO_PUBLIC_API_BASE_URL`** to a URL the phone or emulator can reach (same `/api/v1` prefix as desktop). Examples are in `waste_oil_expo_app/.env.example` (LAN IP, Android emulator `http://10.0.2.2:8000/api/v1`). Ensure Django is listening on `0.0.0.0:8000` when testing from a device. Users can also set the API base URL from **Login → API Settings** on the device (persisted locally).

Start the Metro bundler and pick a target:

```bash
npm run expo:start
# or concurrently with optional Vite dev (see package.json "dev")
npm run dev
```

Run on a simulator or device:

```bash
npm run expo:android
npm run expo:ios
```

**EAS (cloud):** `npm run android:apk:eas` uses the `preview` profile in `eas.json` (APK, internal distribution). Adjust `EXPO_PUBLIC_API_BASE_URL` in EAS env or in the profile before shipping.

For **browser-only** builds of the `src/` UI, set `VITE_API_BASE_URL` and use `npm run frontend:dev` / `npm run frontend:build` (native shell does not use that Vite server).

---

## Desktop client architecture (short)

| Topic | Detail |
|-------|--------|
| Routing | `createHashRouter` — URLs look like `index.html#/login`, `index.html#/records`, etc. |
| API | Browser-style **`window.api`** object implemented in `src/platform/installBrowserApi.js` using **`fetch`** and `VITE_API_BASE_URL` (no Rust IPC for REST in the default setup). |
| Auth | Tokens in **`localStorage`** (`wom_access_token`, `wom_refresh_token`), profile cache `wom_user_profile` — see `src/store/authStore.js`. |
| Plugins | `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` available for native file flows where used. |

### Expo (mobile) — short

| Topic | Detail |
|-------|--------|
| Shell | `App.js` loads **`native/NativeRoot.jsx`** — React Navigation stacks/tabs, not a WebView. |
| API | Same v1 REST as desktop; base URL from **`EXPO_PUBLIC_*`** at build time or **Login → API Settings** (AsyncStorage). |
| Auth | Tokens and optional API base URL in **AsyncStorage** (`native/nativeApi.js`, `native/apiConfig.js`, `native/AuthContext.jsx`). |
| Features | Parity-oriented screens: dashboard, records, queue, workflow timeline, vendors, GM console, audit logs, change password — aligned with backend capabilities. |

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

### Mobile / optional web (`waste_oil_expo_app/.env`)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | API v1 prefix for **native** Expo builds and Metro; must be reachable from the device (rebuild or restart after change). |
| `VITE_API_BASE_URL` | Same shape, for **`npm run frontend:*`** Vite browser builds only. |

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

The **desktop** home route combines authenticated **records** and **workflow queue** data with **admin-console analytics** endpoints. Peer roles see a reduced dashboard surface; oversight roles see the full executive view. The **Expo** app consumes the same analytics endpoints on its dashboard screens, scoped by role.

Exports (Excel) are generated in the desktop or **Expo** UI from the current filtered dataset where the screen exposes them.

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
| Expo Metro (dev) | `cd waste_oil_expo_app && npm run expo:start` |
| Expo Android / iOS (local compile) | `cd waste_oil_expo_app && npm run expo:android` / `npm run expo:ios` |
| EAS Android APK (preview profile) | `cd waste_oil_expo_app && npm run android:apk:eas` |
| Expo app Vite web assets only | `cd waste_oil_expo_app && npm run frontend:build` |

---

## Troubleshooting (desktop)

- **Blank / white window in the installed `.exe`:** Ensure **`VITE_API_BASE_URL`** was set **before** `npm run build`. Confirm `vite.config.js` keeps **`base: "./"`** so assets load under `file://`.
- **`API setup required` in the Login screen:** Missing or empty `VITE_API_BASE_URL` at build/run time — copy `.env.example` to `.env` and restart dev server or rebuild.
- **Wrong or missing taskbar icon after an update:** Windows may cache pinned shortcuts — unpin the old shortcut, reinstall from the latest NSIS installer, launch once, pin again.

## Troubleshooting (Expo)

- **Cannot reach API from a physical device:** Use your PC’s LAN IP in `EXPO_PUBLIC_API_BASE_URL` (or **API Settings** on device), run Django with `runserver 0.0.0.0:8000`, and allow the host/port in the OS firewall. `127.0.0.1` on the device points to the device itself, not your PC.
- **Android emulator:** Use `http://10.0.2.2:8000/api/v1` to reach the host machine’s Django port.

---

## Default local URLs

| Service | URL |
|---------|-----|
| Django API | `http://127.0.0.1:8000` |
| Tauri Vite dev (embedded WebView) | `http://127.0.0.1:1420` |

---

## GitHub Actions

### Windows desktop (NSIS)

On push to **`main`** or **`master`** (when files under `waste_oil_desktop-TAURI/` change), [`.github/workflows/release-desktop.yml`](.github/workflows/release-desktop.yml) builds the **NSIS Windows installer** on **`windows-latest`** and publishes a **GitHub Release** (tag `desktop-build-<run_number>`). A Linux runner cannot produce this Windows installer with the current Tauri/NSIS setup without extra cross-compilation.

- **Workflow permissions:** Repository **Settings → Actions → General → Workflow permissions** must allow **Read and write** so releases can be created.
- **API URL in the installer:** Optional repository variable **`VITE_API_BASE_URL`** (Actions → Variables). If unset, builds use `http://127.0.0.1:8000/api/v1`.
- **Manual run:** Actions → **Release desktop (Windows)** → **Run workflow**.

### Android APK (Expo / prebuild)

On push of a **`v*`** tag (when `waste_oil_expo_app/` or the workflow file changes), [`.github/workflows/build-expo-android-apk-release.yml`](.github/workflows/build-expo-android-apk-release.yml) runs **`expo prebuild`** for Android and produces a **signed release APK** (requires Android signing secrets configured for that workflow). **`workflow_dispatch`** is also enabled.

- **API URL baked into the APK:** Repository variable **`EXPO_PUBLIC_API_BASE_URL`**; if unset, the workflow falls back to a placeholder LAN URL—set this in GitHub **Settings → Secrets and variables → Actions → Variables** for real devices.

---

## License

See [LICENSE](LICENSE) in the repository root.
