# Waste Oil Management System

Monorepo-style layout for the **Waste Oil Management System**: a Django API (`waste_oil_backend`) and an Electron + React desktop client (`waste_oil_desktop`).

## Directory overview

```
inventry-management/
├── README.md                 # This file
├── waste_oil_backend/        # Django REST API
└── waste_oil_desktop/        # Electron + React (Vite) desktop app
```

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
    ├── hooks/
    └── utils/
```

## Internal network setup

1. **Run the Django API on a machine that other PCs can reach** (e.g. a small server or an office PC with a static LAN IP). Bind to all interfaces in development if needed, for example:
   - `python manage.py runserver 0.0.0.0:8000`
   - In production, use a reverse proxy (nginx/IIS) and HTTPS as appropriate.

2. **Firewall**: Allow inbound TCP on the API port (e.g. `8000` in dev) from your LAN subnet only.

3. **CORS**: Set `CORS_ALLOWED_ORIGINS` in the backend `.env` to include origins the Electron app might use during dev (e.g. `http://localhost:5173`) if you call the API from the Vite dev server. Packaged Electron often loads `file://` or a custom protocol; adjust CORS and `ALLOWED_HOSTS` to match how you deploy.

4. **Database & Redis**: Keep Postgres and Redis on the same trusted network segment as the API server. Point `DATABASE_URL` and `REDIS_URL` at those hosts using LAN hostnames or IPs.

## Pointing Electron (Vite) at the correct LAN server IP

The desktop app reads the API base URL from **`VITE_API_BASE_URL`** (see `waste_oil_desktop/.env.example`).

1. On the machine where the API runs, note its IPv4 address (e.g. **192.168.1.100**):
   - Windows: `ipconfig` → IPv4 Address under your active adapter.
   - Linux/macOS: `ip a` or System Settings → Network.

2. Copy `.env.example` to `.env` in `waste_oil_desktop/`:
   ```bash
   cd waste_oil_desktop
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

## Quick start (after dependencies are installed)

**Backend**

```bash
cd waste_oil_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements/dev.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

**Frontend**

```bash
cd waste_oil_desktop
npm install
copy .env.example .env
npm run dev
```

Use `npm run build` to produce a production renderer bundle and packaged app per `electron-builder.config.js`, and `npm run preview` to preview the Vite build locally.
