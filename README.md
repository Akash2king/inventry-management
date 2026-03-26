# Waste Oil Management System

Monorepo-style layout for the **Waste Oil Management System**:

- Django REST API backend (`waste_oil_backend`)
- Electron + React desktop client (`waste_oil_desktop`)
- Tauri + React desktop client (`waste_oil_desktop-TAURI`)

## Directory overview

```
inventry-management/
├── README.md                      # Project overview
├── .env.example                   # Root environment template
├── LICENSE
├── Docs/
│   ├── QUICKSTART.md
│   ├── DEVELOPMENT.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
├── waste_oil_backend/             # Django REST API
├── waste_oil_desktop/             # Electron + React (Vite)
└── waste_oil_desktop-TAURI/       # Tauri + React (Vite)
```

## Documentation map

- [Quick start](Docs/QUICKSTART.md)
- [Development guide](Docs/DEVELOPMENT.md)
- [Architecture](Docs/ARCHITECTURE.md)
- [Contributing](Docs/CONTRIBUTING.md)

### Backend (`waste_oil_backend/`)

```
waste_oil_backend/
├── manage.py
├── .env.example
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
├── config/
│   ├── __init__.py
│   ├── asgi.py
│   ├── urls.py
│   ├── wsgi.py
│   └── settings/
│       ├── __init__.py
│       ├── base.py
│       ├── dev.py
│       └── prod.py
└── apps/
    ├── accounts/
    ├── records/
    ├── workflow/
    ├── alerts/
    ├── audit/
    ├── notifications/
    └── admin_console/
```

### Frontend (`waste_oil_desktop/`)

```
waste_oil_desktop/
├── package.json
├── vite.config.js
├── electron-builder.config.js
├── .env.example
├── index.html
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── ipc/
│       └── index.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── pages/
    ├── components/
    ├── store/
    ├── api/
   ├── platform/
    └── utils/
```

### Tauri frontend (`waste_oil_desktop-TAURI/`)

```
waste_oil_desktop-TAURI/
├── package.json
├── vite.config.js
├── .env.example
├── src/
│   ├── pages/
│   ├── components/
│   ├── store/
│   ├── api/
│   ├── platform/
│   └── utils/
└── src-tauri/
   ├── Cargo.toml
   ├── tauri.conf.json
   └── src/main.rs
```

## Internal network setup

1. **Run the Django API on a machine that other PCs can reach** (e.g. a small server or an office PC with a static LAN IP). Bind to all interfaces in development if needed, for example:
   - `python manage.py runserver 0.0.0.0:8000`
   - In production, use a reverse proxy (nginx/IIS) and HTTPS as appropriate.

2. **Firewall**: Allow inbound TCP on the API port (e.g. `8000` in dev) from your LAN subnet only.

3. **CORS**: Set `CORS_ALLOWED_ORIGINS` in the backend `.env` to include origins the Electron app might use during dev (e.g. `http://localhost:5173`) if you call the API from the Vite dev server. Packaged Electron often loads `file://` or a custom protocol; adjust CORS and `ALLOWED_HOSTS` to match how you deploy.

4. **Database & Redis**: Keep Postgres and Redis on the same trusted network segment as the API server. Point `DATABASE_URL` and `REDIS_URL` at those hosts using LAN hostnames or IPs.

## Pointing desktop clients to LAN API server

Both desktop apps read the API base URL from **`VITE_API_BASE_URL`**:

- `waste_oil_desktop/.env`
- `waste_oil_desktop-TAURI/.env`

1. On the machine where the API runs, note its IPv4 address (e.g. **192.168.1.100**):
   - Windows: `ipconfig` → IPv4 Address under your active adapter.
   - Linux/macOS: `ip a` or System Settings → Network.

2. Copy `.env.example` to `.env` in each frontend:
   ```bash
   cd waste_oil_desktop
   cp .env.example .env

   cd ../waste_oil_desktop-TAURI
   cp .env.example .env
   ```

3. Edit `.env` and set:
   ```env
   VITE_API_BASE_URL=http://<LAN-IP>:8000/api/v1
   ```
   Example:
   ```env
   VITE_API_BASE_URL=http://192.168.1.100:8000/api/v1
   ```

4. **Restart the Vite dev server** after changing `.env` so `import.meta.env.VITE_*` is picked up.

5. If the API moves to another PC or IP, update `.env` and rebuild (`npm run build`) for production installers.

## Setup and run

### 1. Backend setup

Linux/macOS:

```bash
cd waste_oil_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_workflow_demo
python manage.py runserver 0.0.0.0:8000
```

Windows PowerShell:

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

### 2. Run Electron client

```bash
cd waste_oil_desktop
npm install
cp .env.example .env  # Windows: Copy-Item .env.example .env
npm run dev
```

### 3. Run Tauri client

```bash
cd waste_oil_desktop-TAURI
npm install
cp .env.example .env  # Windows: Copy-Item .env.example .env
npm run dev
```

## Build commands

- Electron production build:
   - `cd waste_oil_desktop && npm run build`
- Tauri production build:
   - `cd waste_oil_desktop-TAURI && npm run build`
- Frontend preview:
   - `npm run preview`

## Default local URLs

- Backend API: `http://127.0.0.1:8000`
- Electron Vite dev server: `http://127.0.0.1:5173`
- Tauri Vite dev server: `http://127.0.0.1:1420`
