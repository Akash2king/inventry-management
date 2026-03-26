# Waste Oil Management System

Monorepo-style layout for the **Waste Oil Management System**: a Django API (`waste_oil_backend`) and desktop clients (`waste_oil_desktop` for Electron, `waste_oil_desktop-TAURI` for Tauri).

## Directory overview

```
inventry-management/
├── README.md                 # This file
├── waste_oil_backend/        # Django REST API
├── waste_oil_desktop/        # Electron + React (Vite) desktop app
└── waste_oil_desktop-TAURI/  # Tauri + React (Vite) desktop app
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

### Frontend – Electron (`waste_oil_desktop/`)

Electron + React (Vite) desktop client.

```
waste_oil_desktop/
├── package.json
├── vite.config.js
├── electron-builder.config.js
├── .env.example
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── pages/
    ├── components/
    ├── store/
    ├── api/
    └── utils/
```

### Frontend – Tauri (`waste_oil_desktop-TAURI/`)

Cross-platform desktop client built with React, Vite, and Tauri (Rust-based).

```
waste_oil_desktop-TAURI/
├── package.json
├── vite.config.js
├── .env.example
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── pages/
│   ├── components/
│   ├── store/
│   ├── api/
│   └── utils/
└── src-tauri/
    ├── src/
    │   └── main.rs
    ├── build.rs
    └── Cargo.toml
```

## Internal network setup

1. **Run the Django API on a machine that other PCs can reach** (e.g. a small server or an office PC with a static LAN IP). Bind to all interfaces in development if needed.
   - `python manage.py runserver 0.0.0.0:8000`
   - In production, use a reverse proxy (nginx/IIS) and HTTPS as appropriate.

2. **Firewall**: Allow inbound TCP on the API port (e.g. `8000` in dev) from your LAN subnet only.

3. **CORS**: Set `CORS_ALLOWED_ORIGINS` in the backend `.env` to include origins the desktop app might use during dev (e.g. `http://localhost:5173`). Adjust `ALLOWED_HOSTS` to match your deployment.

4. **Database & Redis**: Keep Postgres and Redis on the same trusted network segment as the API server. Point `DATABASE_URL` and `REDIS_URL` at those hosts using LAN hostnames or IPs.

## Pointing Desktop Apps at the correct LAN server IP

Both Electron and Tauri apps read the API base URL from **`VITE_API_BASE_URL`** (see `.env.example` files).

1. On the machine where the API runs, note its IPv4 address (e.g. **192.168.1.100**):
   - **Windows**: Open Command Prompt and run `ipconfig` → IPv4 Address
   - **Linux**: Run `ip a` and find your active adapter's inet address
   - **macOS**: System Settings → Network → Wi-Fi/Ethernet → Details → IPv4 Address

2. Copy `.env.example` to `.env` in the frontend directory:
   
   **Windows**:
   ```cmd
   copy .env.example .env
   ```
   
   **Linux/macOS**:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set:
   ```env
   VITE_API_BASE_URL=http://192.168.1.100:8000/api/v1
   ```

4. **Restart the dev server** after changing `.env` so `import.meta.env.VITE_*` is picked up.

5. If the API moves to another PC or IP, update `.env` and rebuild.

---

## Quick start

### Prerequisites (all platforms)

- **Node.js 18+** and **npm 9+**: https://nodejs.org/
- **Python 3.9+**: https://www.python.org/downloads/

### Backend Setup

#### Windows

```cmd
cd waste_oil_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements/dev.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

#### Linux/macOS

```bash
cd waste_oil_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

The API will run on `http://localhost:8000`. For other machines to reach it, use the machine's LAN IP (e.g., `http://192.168.1.100:8000`).

---

### Frontend – Electron

#### Windows

```cmd
cd waste_oil_desktop
npm install
copy .env.example .env
npm run dev
```

**Build for production**:
```cmd
npm run build
```

Output: `dist/` (Vite build) and packaged installer per `electron-builder.config.js`.

#### Linux/macOS

```bash
cd waste_oil_desktop
npm install
cp .env.example .env
npm run dev
```

**Build for production**:
```bash
npm run build
```

- **macOS**: Creates `.dmg` and `.app` in `dist/`.
- **Linux**: Creates AppImage and/or deb package in `dist/`.

---

### Frontend – Tauri

#### Prerequisites

**Windows**
- Visual Studio Build Tools 2022 or Microsoft Visual C++ Build Tools 14.0+
  - Download: https://visualstudio.microsoft.com/downloads/ → Desktop development with C++

**Linux**
- Ubuntu/Debian:
  ```bash
  sudo apt-get update
  sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```
- Fedora:
  ```bash
  sudo dnf install webkit2gtk4.1-devel gcc curl wget file openssl-devel libgtk-3-devel libappindicator-gtk3-devel librsvg2-devel
  ```
- Arch:
  ```bash
  sudo pacman -S webkit2gtk libappindicator-gtk3 openssl
  ```

**macOS**
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```
- Apple Silicon (M1/M2/M3) is natively supported.

**All platforms**: Install Rust

**Windows**:
```cmd
curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Linux/macOS**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### Setup & Run

**Windows**

```cmd
cd waste_oil_desktop-TAURI
npm install
copy .env.example .env
npm run dev
```

**Linux/macOS**

```bash
cd waste_oil_desktop-TAURI
npm install
cp .env.example .env
npm run dev
```

Edit `.env` and set `VITE_API_BASE_URL` to your backend (e.g., `http://192.168.1.100:8000/api/v1`).

#### Build for Production

**Windows**

```cmd
npm run build
```

Output: `src-tauri\target\release\bundle\msi\` (MSI installer)

**macOS**

```bash
npm run build
```

- **Intel**: `src-tauri/target/release/bundle/dmg/` (DMG)
- **Apple Silicon**: Creates native ARM64 build; output in same location

**Linux**

```bash
npm run build
```

Output: `src-tauri/target/release/bundle/` with AppImage, deb, or rpm depending on your distro.

#### Preview Frontend Only (Vite without Tauri)

**Windows/Linux/macOS**:
```bash
npm run preview
```

Runs on `http://127.0.0.1:4173`.

---

## Development Tips

### Switching between Electron and Tauri

Both use the same React frontend source but different build systems:
- **Electron** (`waste_oil_desktop/`): Easier to set up, broader plugin ecosystem
- **Tauri** (`waste_oil_desktop-TAURI/`): Lighter footprint, native Rust integration, smaller bundle size

### Hot Reload

- **Electron & Tauri dev**: Both support hot reload. Edit React files and see changes instantly in the dev window.

### Environment Variables

Both frontend apps load from `.env`:
```env
VITE_API_BASE_URL=http://192.168.1.100:8000/api/v1
```

Changes require a dev server restart.

### Backend API Testing

Use **curl**, **Postman**, or the browser:

```bash
# Login and get tokens
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"storeman","password":"Demo12345"}'

# Response includes access_token and refresh_token for authenticated requests
```

---

## Production Deployment

### Backend

- Use a WSGI server: **Gunicorn**, **uWSGI**, or **Waitress**
- Reverse proxy: **nginx** or **IIS**
- Database: **PostgreSQL** (not SQLite)
- Redis: For Celery task queue and caching
- Set `DEBUG=False`, use strong `SECRET_KEY`, configure HTTPS

### Frontend (Electron or Tauri)

- Build and sign the installer for your platform
- Distribute via your website or app store
- Users run the installer; app connects to backend via `VITE_API_BASE_URL`

---

## Troubleshooting

### Backend won't start

- Ensure Python 3.9+ is installed: `python --version`
- Check PostgreSQL/Redis connectivity if using those
- Run `python manage.py migrate` to set up database

### Frontend can't reach backend

- Verify backend is running: `http://192.168.1.100:8000/api/v1/health/`
- Check `VITE_API_BASE_URL` in `.env`
- Restart dev server after changing `.env`
- Check firewall: ensure TCP port 8000 is open from client machine

### Tauri build fails on Linux

- Ensure WebKit2GTK headers are installed (see Prerequisites)
- Check Rust is up to date: `rustup update`

### Tauri build fails on macOS

- Install Xcode Command Line Tools: `xcode-select --install`
- Apple Silicon: Ensure Rust supports `aarch64-apple-darwin`: `rustup target add aarch64-apple-darwin`
