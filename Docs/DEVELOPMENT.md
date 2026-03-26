# Development Guide

Detailed developer documentation for the Waste Oil Management System.

## Installation, Setup, and Running

Use this section for a clean first-time local setup.

### Prerequisites

- Python 3.9+
- Node.js 18+ and npm 9+
- Git
- Rust toolchain (only required for Tauri)

Install Rust (if using Tauri):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Step 1: Clone repository

```bash
git clone https://github.com/your-org/waste-oil-management.git
cd inventry-management
```

### Step 2: Install and run backend

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

### Step 3: Install and run Electron desktop app

```bash
cd waste_oil_desktop
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell copy command:

```powershell
Copy-Item .env.example .env
```

### Step 4: Install and run Tauri desktop app (optional)

```bash
cd waste_oil_desktop-TAURI
npm install
cp .env.example .env
npm run dev
```

### Local endpoints

- Backend API: `http://127.0.0.1:8000`
- Electron Vite: `http://127.0.0.1:5173`
- Tauri Vite: `http://127.0.0.1:1420`

### Build commands

- Electron build: `cd waste_oil_desktop && npm run build`
- Tauri build: `cd waste_oil_desktop-TAURI && npm run build`
- Preview frontend build: `npm run preview`

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│          Desktop Clients (React)             │
├─────────────────────────────────────────────┤
│  waste_oil_desktop (Electron)               │
│  waste_oil_desktop-TAURI (Tauri/Rust)       │
├─────────────────────────────────────────────┤
│            REST API (Django)                 │
│     waste_oil_backend (port 8000)            │
├─────────────────────────────────────────────┤
│      Database & Cache Layer                  │
│  PostgreSQL & Redis                          │
└─────────────────────────────────────────────┘
```

## Backend Architecture

### Apps Structure

- **accounts**: User authentication, roles, departments, permissions
- **records**: Waste oil records CRUD, attachments
- **workflow**: Record state transitions, approvals, queue management
- **alerts**: Date-based SLA monitoring and alerts
- **audit**: Audit logging for compliance
- **notifications**: Email/in-app notifications via Celery
- **admin_console**: Admin dashboard and reporting

### Role-Based Access Control

Users have roles that determine permissions:

| Role | Stage | Capabilities |
|------|-------|------|
| Storeman | 1 | Create records, manage vendors |
| Treatment | 2 | Process/verify treatment |
| Admin | 3 | Admin validation |
| Manager | 4 | Approve forwarding |
| GM | 5 | Final approval (locks record) |
| Superadmin | All | Full system access |

### Workflow Pipeline

Records flow through 5 stages:

```
Stage 1 (Storeman)
    ↓ [Forward/Return]
Stage 2 (Treatment)
    ↓ [Forward/Return]
Stage 3 (Admin)
    ↓ [Forward/Return]
Stage 4 (Manager)
    ↓ [Forward/Return]
Stage 5 (GM)
    ↓ [Forward] → Record Locked & Completed
```

## Frontend Architecture

### Electron (waste_oil_desktop/)

- Uses `electron-builder` for packaging
- Separate main process (Electron) and renderer (React)
- Direct file system access via IPC
- Platform-specific installers (exe, dmg, AppImage)

### Tauri (waste_oil_desktop-TAURI/)

- Rust-based electron alternative
- Smaller bundle size (~40MB vs 150MB)
- Rust backend (`src-tauri/`) for OS integration
- Same React frontend as Electron version
- Built-in localhost server for frontend

### Shared Code

Both frontends share:
- React components (pages, UI components)
- API client layer
- State management (Zustand)
- Styles and utilities

## API Documentation

### Authentication

**Login**
```bash
POST /api/v1/auth/login/
Content-Type: application/json

{
  "username": "storeman",
  "password": "Demo12345"
}

Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "username": "storeman",
    "role": "storeman",
    "department_id": "uuid"
  }
}
```

**Refresh Token**
```bash
POST /api/v1/auth/refresh/
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}

Response:
{
  "access_token": "eyJ..."
}
```

### Records API

**Create Record**
```bash
POST /api/v1/records/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "vendor_id": "uuid",
  "quantity": 1250.50,
  "unit": "litres",
  "product_type": "Used hydraulic oil",
  "product_description": "ISO 46 industrial hydraulic oil",
  "entry_date": "2026-03-26",
  "collection_date": "2026-03-26",
  "remarks": "Demo record"
}
```

**Forward Record**
```bash
POST /api/v1/records/<record_id>/forward/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "note": "Passed verification",
  "next_holder_id": "uuid" (optional - auto-assign if omitted)
}
```

**Return Record**
```bash
POST /api/v1/records/<record_id>/return/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Needs documentation review"
}
```

### Workflow Queue

**Get My Queue**
```bash
GET /api/v1/workflow/queue/
Authorization: Bearer <access_token>

Response:
[
  {
    "id": "uuid",
    "record_number": "REC-2026-001",
    "vendor_name": "Vendor Name",
    "quantity": 1250.50,
    "unit": "litres",
    "current_stage": 2,
    "alert_level": "yellow",
    "days_elapsed": 5,
    "entry_date": "2026-03-26"
  }
]
```

## Database Schema

### Key Tables

**users**
- id (UUID)
- username (unique)
- email (unique)
- role (enum)
- department_id (FK to departments)
- is_active, is_staff, is_superuser

**waste_oil_records**
- id (UUID)
- record_number (unique)
- vendor_id (FK)
- quantity, unit
- product_type, product_description
- current_stage (1-5)
- current_holder_id (FK to users)
- current_department_id (FK)
- is_locked (bool)
- alert_level (enum)
- created_by_id, created_at, updated_at

**stage_transitions**
- id (UUID)
- record_id (FK)
- from_stage, to_stage
- from_department_id, to_department_id
- transitioned_by_id (FK)
- transition_type (FORWARD/RETURN)
- note, timestamp, sequence

## Development Workflow

### Local Development Loop

1. **Start Backend**:
   ```bash
   cd waste_oil_backend
   source .venv/bin/activate
   python manage.py runserver 0.0.0.0:8000
   ```
   Backend ready at `http://localhost:8000`

2. **Start Frontend** (Electron):
   ```bash
   cd waste_oil_desktop
   npm run dev
   ```
   Vite dev server at `http://localhost:5173`
   Electron window opens automatically

3. **OR Start Frontend** (Tauri):
   ```bash
   cd waste_oil_desktop-TAURI
   npm run dev
   ```
   Tauri dev server at `http://127.0.0.1:1420`

### Hot Reload

- **Backend**: Django dev server auto-reloads on file changes
- **Frontend**: Vite provides instant refresh for React components
- **Tauri**: Auto-compiles Rust changes and reloads frontend

### Database Migration

Add a new field to a model:

```bash
cd waste_oil_backend
python manage.py makemigrations
python manage.py migrate
```

### Seeding Demo Data

```bash
python manage.py seed_workflow_demo [--password YOUR_PASSWORD]
```

Creates:
- 5 departments (stages 1-5)
- 5 users (one per stage)
- All with default password "Demo12345"

## Testing

### Backend Unit Tests

```bash
cd waste_oil_backend
python manage.py test apps.records.tests
python manage.py test apps.workflow.tests
```

### Manual API Testing

Use curl or Postman:

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"storeman","password":"Demo12345"}'

# Get user profile
curl http://localhost:8000/api/v1/auth/me/ \
  -H "Authorization: Bearer <access_token>"
```

## Debugging

### Backend Debugging

**Django Shell**:
```bash
python manage.py shell
```

**Print statements/logging**:
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Debug message")
```

**Django Debug Toolbar** (if installed):
Accessible at `http://localhost:8000/__debug__/` in dev mode

### Frontend Debugging

**Chrome DevTools** (Electron):
- Right-click → Inspect
- DevTools opens for React debugging

**React DevTools Browser Extension**:
Install for better component tree inspection

**Console logging**:
```javascript
console.log('Debug:', data);
console.error('Error:', error);
```

## Performance Optimization

### Backend

- Use `select_related()` for FK joins
- Use `prefetch_related()` for reverse relations
- Implement pagination for large querysets
- Cache expensive queries with Redis

### Frontend

- Code-split route components (lazy loading)
- Memoize expensive computations with `useMemo`
- Use `React.memo` for expensive renders
- Optimize images and assets

## Security Considerations

- **JWT tokens**: Short-lived access tokens (~60 min), refresh tokens (~7 days)
- **CORS**: Whitelist frontend origins in backend `.env`
- **Database**: Use environment variables for credentials
- **API**: Always validate/sanitize input on backend
- **HTTPS**: Required in production

## Deployment Checklist

### Backend

- [ ] Set `DEBUG=False` in production `.env`
- [ ] Use strong `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Set up `DATABASE_URL` pointing to production DB
- [ ] Configure `REDIS_URL`
- [ ] Use WSGI server (Gunicorn)
- [ ] Set up reverse proxy (nginx)
- [ ] Configure HTTPS/SSL
- [ ] Set up log aggregation

### Frontend

- [ ] Build: `npm run build` (Electron) or `npm run build` (Tauri)
- [ ] Test installers on target platforms
- [ ] Sign installers (Windows/macOS)
- [ ] Update version number
- [ ] Create release notes
- [ ] Upload to distribution channel

## Useful Commands

```bash
# Backend
python manage.py makemigrations          # Create migrations
python manage.py migrate                 # Apply migrations
python manage.py createsuperuser         # Create admin user
python manage.py seed_workflow_demo      # Seed demo data
python manage.py shell                   # Django shell
python manage.py runserver 0.0.0.0:8000  # Start dev server

# Frontend (both)
npm install                  # Install dependencies
npm run dev                  # Development mode
npm run build                # Production build
npm run preview              # Preview build

# Tauri-specific
npm run tauri dev           # Develop with Tauri
npm run tauri build         # Build Tauri app
```

## Troubleshooting

### "Port 8000 already in use"

```bash
# Find and kill process
lsof -i :8000
kill -9 <PID>

# Or use different port
python manage.py runserver 0.0.0.0:8001
```

### "Module not found" in backend

```bash
cd waste_oil_backend
source .venv/bin/activate
pip install -r requirements/dev.txt
```

### Frontend can't reach backend

- Check backend is running: `http://localhost:8000/api/v1/health/`
- Check `.env` has correct `VITE_API_BASE_URL`
- Check firewall allows port 8000
- Check browser console for CORS errors

### Database migrations conflict

```bash
# Squash migrations
python manage.py squashmigrations apps.records 0001 0010
```

---

For more information, see [README](../README.md) and [Contributing](CONTRIBUTING.md).
