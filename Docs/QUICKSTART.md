# Quick Start Guide

Get the Waste Oil Management System running locally in 10 minutes.

Repository layout used in this guide:

```
inventry-management/
├── Docs/
├── waste_oil_backend/
├── waste_oil_desktop/
└── waste_oil_desktop-TAURI/
```

## Prerequisites Checklist

- [ ] Python 3.9 or higher (`python --version`)
- [ ] Node.js 18+ and npm 9+ (`node --version`, `npm --version`)
- [ ] Git (`git --version`)
- [ ] A code editor (VS Code recommended)

**For Tauri only**: Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 5-Minute Backend Setup

Linux/macOS:

```bash
# 1. Clone repo and navigate
git clone https://github.com/your-org/waste-oil-management.git
cd inventry-management/waste_oil_backend

# 2. Create Python environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements/dev.txt

# 4. Copy environment file
cp .env.example .env

# 5. Initialize database
python manage.py migrate

# 6. Create demo data
python manage.py seed_workflow_demo

# 7. Start server
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

✅ Backend running at `http://localhost:8000`

## 3-Minute Frontend Setup (Choose One)

### Option A: Electron (Recommended for Windows/Mac)

```bash
cd waste_oil_desktop
npm install
cp .env.example .env  # Windows: Copy-Item .env.example .env
npm run dev
```

✅ Electron app launches automatically

### Option B: Tauri (Best for Linux)

```bash
cd waste_oil_desktop-TAURI
npm install
cp .env.example .env  # Windows: Copy-Item .env.example .env
npm run dev
```

✅ Tauri app launches automatically

## First Login

**Demo Credentials** (created by `seed_workflow_demo`):

Choose any one:

| User | Password | Role | Stage |
|------|----------|------|-------|
| storeman | Demo12345 | Storeman | 1 |
| treatment | Demo12345 | Treatment | 2 |
| waste_admin | Demo12345 | Admin | 3 |
| manager | Demo12345 | Manager | 4 |
| gm | Demo12345 | GM | 5 |

## What Works Now?

✅ Create waste oil records (as Storeman)
✅ Forward records through stages
✅ Return records to previous stages  
✅ View workflow queue
✅ Lock completed records (as GM)

## Next Steps

### Explore the Application
1. Login as **storeman**
2. Create a new waste oil record
3. Logout and login as **treatment**
4. Accept the forwarded record
5. Forward to next stage
6. Continue through all stages to **gm**

### Read Documentation
- [Development guide](DEVELOPMENT.md) - Architecture & API details
- [Architecture](ARCHITECTURE.md) - System design & workflows
- [Contributing](CONTRIBUTING.md) - Code style & contribution guidelines
- [Project README](../README.md) - Directory overview and setup map

### Stop Services

**Backend**:
```bash
Ctrl+C  # in the backend terminal
```

**Frontend**:
```bash
Ctrl+C  # in the frontend terminal
```

## Troubleshooting

### Backend won't start

```bash
# Check if port 8000 is in use
lsof -i :8000

# If python process is using it:
kill -9 <PID>

# Try different port:
python manage.py runserver 0.0.0.0:8001
```

### Frontend can't connect to backend

1. Ensure backend is running: `http://localhost:8000`
2. Check `.env` file has: `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`
3. Restart frontend dev server

### "Module not found" errors

```bash
# Backend
source .venv/bin/activate
pip install -r requirements/dev.txt

# Frontend
rm -rf node_modules package-lock.json
npm install
```

### Database errors

```bash
cd waste_oil_backend
python manage.py migrate
python manage.py seed_workflow_demo --password Demo12345
```

## Common Commands

```bash
# Backend
cd waste_oil_backend
source .venv/bin/activate        # Activate venv
pip install -r requirements/dev.txt  # Install deps
python manage.py migrate          # Apply DB changes
python manage.py seed_workflow_demo  # Create demo data
python manage.py shell            # Django interactive shell
python manage.py runserver 0.0.0.0:8000  # Start server

# Frontend
cd waste_oil_desktop (or waste_oil_desktop-TAURI)
npm install                       # Install deps
npm run dev                       # Development mode
npm run build                     # Production build
npm run preview                   # Preview build
```

## Development Workflow

**Terminal 1** (Backend):
```bash
cd waste_oil_backend
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2** (Frontend):
```bash
cd waste_oil_desktop
npm run dev
```

Alternative Terminal 2 (Tauri):
```bash
cd waste_oil_desktop-TAURI
npm run dev
```

**Terminal 3** (your editor):
```bash
code .  # Open in VS Code
```

Both services automatically reload when you save files!

## Need Help?

1. Check [DEVELOPMENT.md](DEVELOPMENT.md) for detailed docs
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
4. Open an issue on GitHub

---

**Happy coding!** 🚀
