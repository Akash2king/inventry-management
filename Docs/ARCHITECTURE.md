# System Architecture

Comprehensive documentation of the Waste Oil Management System architecture, design patterns, and data flow.

## System Overview

The Waste Oil Management System is a multi-tier, role-based application for tracking waste oil through a 5-stage processing pipeline. It consists of:

1. **Backend API** (Django REST Framework)
2. **Desktop Frontends** (React via Electron or Tauri)
3. **Database Layer** (PostgreSQL/SQLite with Redis caching)
4. **Async Tasks** (Celery)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  ┌──────────────────────┐    ┌────────────────────────┐    │
│  │ Electron + React     │    │ Tauri + React          │    │
│  │ (waste_oil_desktop)  │    │ (waste_oil_desktop-T)  │    │
│  └──────────────────────┘    └────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                       ↓ HTTPS/TCP
┌─────────────────────────────────────────────────────────────┐
│            REST API Server (Django)                          │
│  - Authentication (JWT)                                      │
│  - Role-based authorization                                  │
│  - Records CRUD                                              │
│  - Workflow management                                       │
│  - Alerts & notifications                                    │
└─────────────────────────────────────────────────────────────┘
        ↓                        ↓                    ↓
    ┌────────┐         ┌──────────────┐      ┌────────────┐
    │Database│         │Cache/Queue   │      │File Storage│
    │(PSQL)  │         │(Redis)       │      │(Local FS)  │
    └────────┘         └──────────────┘      └────────────┘
                              ↓
                       ┌──────────────┐
                       │Task Queue    │
                       │(Celery)      │
                       └──────────────┘
```

## Authentication & Authorization

### JWT Token Flow

```
Client Login
    ↓
POST /auth/login/
    ↓
Backend validates credentials
    ↓
Issue JWT tokens (access + refresh)
    ↓
Client stores tokens in memory/secure storage
    ↓
Client includes access token in all requests
    ↓ (if token expires)
POST /auth/refresh/
    ↓
Issue new access token
```

### Token Structure

```python
# Access Token (short-lived: ~60 minutes)
{
  "user_id": "uuid",
  "username": "storeman",
  "role": "storeman",
  "department_id": "uuid",
  "exp": 1700000000,  # Expiration timestamp
  "iat": 1699996400   # Issued at
}

# Refresh Token (long-lived: ~7 days)
{
  "user_id": "uuid",
  "type": "refresh",
  "exp": 1700600000
}
```

### Role-Based Access Control

Every API endpoint checks user's role before granting access.

```python
# Permission classes pattern
from accounts.permissions import IsStoreman

class VendorView(APIView):
    permission_classes = [IsAuthenticated, IsStoreman]
    
    def get(self, request):
        # Only users with role=STOREMAN can access
```

Available roles and their permissions:

| Role | Create Records | Forward Records | Approve | Lock Records |
|------|-----------------|-----------------|---------|--------------|
| Storeman | ✓ | ✓ (→S2) | ✗ | ✗ |
| Treatment | ✗ | ✓ (→S3) | ✗ | ✗ |
| Admin | ✗ | ✓ (→S4) | ✗ | ✗ |
| Manager | ✗ | ✓ (→S5) | ✓ | ✗ |
| GM | ✗ | ✗ | ✓ | ✓ (Lock) |
| Superadmin | ✓ | ✓ (→Any) | ✓ | ✓ |

## Business Logic: Workflow Pipeline

### Record Lifecycle

```
Created          Forwarded     Forwarded     Forwarded     Forwarded     Locked
(Stage 1)     → (Stage 2)  → (Stage 3)  → (Stage 4)  → (Stage 5)  → Completed
Storeman        Treatment      Admin        Manager        GM

┌─ Return ─ Return ─ Return ─ Return ─ Return ─┐
└─────────────────────────────────────────────┘
```

### Transition Rules

**Forward (→)**: Move record to next stage
- Record must be at current user's stage
- Optionally assign next holder (or auto-assign)
- Add note/comments

**Return (←)**: Send record back to previous stage
- Reason required
- Record moves to previous stage
- Previous department gets notification

**Lock**: Final action by GM
- Only GM can lock records
- Prevents further modifications
- Sets completion status

### Data Integrity

- **Audit Trail**: Every action logged in `stage_transitions` table
- **No Direct Updates**: Records only change via forward/return API
- **Timestamp Tracking**: entry_date, created_at, updated_at, locked_at
- **Sequence Tracking**: Transitions tracked in sequence order

## Database Schema

### Core Tables

**users** (Extended Django User)
```sql
id UUID PRIMARY KEY
username VARCHAR UNIQUE
email VARCHAR UNIQUE
password VARCHAR (hashed)
role ENUM (STOREMAN, TREATMENT, ADMIN, MANAGER, GM, SUPERADMIN)
department_id UUID FK → departments
is_active BOOL
is_staff BOOL
is_superuser BOOL
created_at TIMESTAMP
updated_at TIMESTAMP
```

**departments**
```sql
id UUID PRIMARY KEY
name VARCHAR
stage_number INT (1-5)
description TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

**waste_oil_records**
```sql
id UUID PRIMARY KEY
record_number VARCHAR UNIQUE
vendor_id UUID FK → vendors
current_stage INT (1-5)
current_department_id UUID FK → departments
current_holder_id UUID FK → users
created_by_id UUID FK → users
quantity DECIMAL
unit VARCHAR (litres, kg, etc)
product_type VARCHAR
product_description TEXT
entry_date DATE
collection_date DATE
alert_level ENUM (green, yellow, red, critical)
is_locked BOOL DEFAULT FALSE
completion_status ENUM (PENDING, COMPLETED, RETURNED)
remarks TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
locked_at TIMESTAMP (nullable)
```

**stage_transitions** (Audit)
```sql
id UUID PRIMARY KEY
record_id UUID FK → waste_oil_records
from_stage INT
to_stage INT
from_department_id UUID FK
to_department_id UUID FK
transitioned_by_id UUID FK → users
transition_type ENUM (FORWARD, RETURN)
note TEXT
reason TEXT (for return)
timestamp TIMESTAMP
sequence INT
```

**vendors**
```sql
id UUID PRIMARY KEY
name VARCHAR UNIQUE
contact_email VARCHAR
contact_phone VARCHAR
category VARCHAR
address TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

**alerts** (SLA Monitoring)
```sql
id UUID PRIMARY KEY
record_id UUID FK
stage INT
alert_type ENUM (yellow, red, critical)
threshold_days INT
triggered_at TIMESTAMP
resolved_at TIMESTAMP (nullable)
```

### Relationships

```
users
  ├─ department_id → departments (many-to-one)
  ├─ created_records → waste_oil_records (one-to-many)
  └─ transitions → stage_transitions (one-to-many)

departments
  └─ users → users (one-to-many)

waste_oil_records
  ├─ created_by_id → users
  ├─ current_holder_id → users
  ├─ vendor_id → vendors
  ├─ current_department_id → departments
  └─ transitions → stage_transitions (one-to-many)

vendors
  └─ records → waste_oil_records (one-to-many)

stage_transitions
  ├─ record_id → waste_oil_records
  ├─ from_department_id → departments
  ├─ to_department_id → departments
  └─ transitioned_by_id → users
```

## API Endpoints

### Authentication

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/login/` | User login |
| POST | `/api/v1/auth/refresh/` | Refresh access token |
| POST | `/api/v1/auth/logout/` | User logout |
| GET | `/api/v1/auth/me/` | Get current user |

### Records

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/records/` | List records (filtered by role) |
| POST | `/api/v1/records/` | Create record (Storeman only) |
| GET | `/api/v1/records/{id}/` | Get record details |
| PUT | `/api/v1/records/{id}/` | Update record |
| DELETE | `/api/v1/records/{id}/` | Delete record (Storeman only) |
| POST | `/api/v1/records/{id}/forward/` | Forward to next stage |
| POST | `/api/v1/records/{id}/return/` | Return to previous stage |
| POST | `/api/v1/records/{id}/lock/` | Lock record (GM only) |

### Workflow

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/workflow/queue/` | Get current user's queue |
| GET | `/api/v1/workflow/queue/{id}/` | Get record in queue |
| POST | `/api/v1/workflow/transitions/` | Get transitions for record |

### Vendors

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/vendors/` | List vendors |
| POST | `/api/v1/vendors/` | Create vendor |
| GET | `/api/v1/vendors/{id}/` | Get vendor details |

### Alerts

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/alerts/` | List alerts |
| GET | `/api/v1/alerts/statistics/` | Alert statistics by level |

### Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/notifications/` | List notifications |
| POST | `/api/v1/notifications/{id}/mark-read/` | Mark notification as read |

## Frontend Architecture

### Component Hierarchy

```
App
├─ Router
│  ├─ LoginPage
│  ├─ DashboardLayout
│  │  ├─ RecordsList
│  │  ├─ RecordDetail
│  │  ├─ CreateRecord
│  │  ├─ WorkflowQueue
│  │  └─ AlertsDashboard
│  └─ AdminLayout
│     ├─ UserManagement
│     ├─ VendorManagement
│     └─ SystemSettings
└─ NotificationCenter
```

### State Management (Zustand)

```javascript
// stores/authStore.js
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  login: async (username, password) => { /* ... */ },
  logout: () => { /* ... */ },
  refreshAccessToken: async () => { /* ... */ }
}));

// stores/recordsStore.js
export const useRecordsStore = create((set) => ({
  records: [],
  loading: false,
  fetchRecords: async () => { /* ... */ },
  forwardRecord: async (id, note) => { /* ... */ },
  returnRecord: async (id, reason) => { /* ... */ }
}));
```

### API Client Layer

```javascript
// api/client.js
class APIClient {
  constructor(baseURL) { /* ... */ }
  
  async request(endpoint, options) {
    // Handles JWT token refresh if needed
    // Adds auth header automatically
    // Handles errors uniformly
  }
  
  auth = {
    login: (username, password) => { /* ... */ },
    refresh: (refreshToken) => { /* ... */ }
  };
  
  records = {
    list: () => { /* ... */ },
    create: (data) => { /* ... */ },
    forward: (id, note) => { /* ... */ }
  };
}

export const apiClient = new APIClient(import.meta.env.VITE_API_BASE_URL);
```

### Error Handling

```javascript
// Unified error response from backend
{
  "error": "Unauthorized",
  "detail": "Token expired",
  "code": "TOKEN_EXPIRED"
}

// Frontend catches and responds:
// - 401: Trigger token refresh or redirect to login
// - 403: Show "Access Denied" to user
// - 404: Show "Not Found"
// - 500: Show error and log to monitoring
```

## Async Tasks (Celery)

### Task Queue

```
Backend
  ↓
Celery Worker
  ├─ send_email_notification
  ├─ generate_alert
  ├─ archive_completed_records
  └─ send_sla_reminder
  ↓
Email Service / Database
```

### Key Tasks

- **send_email_notification**: Email on record forward/return
- **generate_alerts**: Calculate SLA and create alerts
- **send_sla_reminder**: Periodic reminder for overdue records
- **archive_records**: Archive completed records (scheduled)

## Deployment Architecture

### Development

```
Workstation
├─ Django dev server (port 8000)
├─ SQLite database
└─ React dev server (port 5173)
```

### Production

```
┌─────────────────────────────────────────┐
│        Client Workstations              │
│  (Electron/Tauri installers)            │
└─────────────────────────────────────────┘
            ↓ HTTPS
┌─────────────────────────────────────────┐
│      Reverse Proxy (nginx)              │
│  - SSL/TLS termination                  │
│  - Load balancing                       │
│  - Static file serving                  │
└─────────────────────────────────────────┘
            ↓ HTTP (internal)
┌─────────────────────────────────────────┐
│   Application Servers (Gunicorn)        │
│  - Multiple processes                   │
│  - Process manager (supervisor)         │
└─────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────────────┐
│              PostgreSQL                         │
│  - Primary + Replicas (High Availability)       │
│  - Automated backups                            │
│  - Connection pooling (PgBouncer)               │
└──────────────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────────────┐
│              Redis Cluster                       │
│  - Session cache                                │
│  - Task queue (Celery)                          │
│  - Rate limiting                                │
└──────────────────────────────────────────────────┘
```

## Security Architecture

### Network

- **HTTPS/TLS**: All client-server communication encrypted
- **VPN/Internal Network**: Optional for deployment
- **Firewall Rules**: Restrict API access to known clients

### Authentication

- **JWT Tokens**: Self-contained, stateless authentication
- **Token Refresh**: Automatic refresh on expiration
- **Token Revocation**: Logout clears server-side session

### Authorization

- **Role-Based**: Every endpoint checks user role
- **Department-Based**: Some endpoints check department
- **Record-Ownership**: Some operations require record creation by user

### Data Protection

- **Password Hashing**: django.contrib.auth (PBKDF2)
- **Field Encryption**: Sensitive data encrypted at rest
- **Audit Logging**: All state transitions logged
- **Compliance**: Meets GDPR data retention policies

## Monitoring & Observability

### Logs

- **Application Logs**: Django logging to file/ELK
- **Access Logs**: nginx/reverse proxy
- **Error Logs**: Sentry integration for frontend crashes

### Metrics

- **Request Duration**: API response times
- **Database Queries**: Query count and performance
- **Task Queue**: Celery task success/failure rates
- **Alert Triggers**: SLA breaches monitored

### Health Checks

```
GET /api/v1/health/
Response:
{
  "status": "ok",
  "database": "connected",
  "cache": "connected",
  "timestamp": "2026-03-26T10:30:00Z"
}
```

## Performance Optimization

### Database

- **Indexing**: Indexes on frequently queried fields (role, stage, created_by)
- **Query Optimization**: Use select_related/prefetch_related
- **Connection Pooling**: PgBouncer reduces connection overhead
- **Pagination**: Lists return max 50 items per page

### Caching

- **Redis Cache**: Session data, frequently accessed records
- **TTL**: Cache expires after 1 hour (configurable)
- **Cache Invalidation**: On record update/forward

### Frontend

- **Code Splitting**: Route-based code splitting with React.lazy
- **Asset Optimization**: Minification, gzip compression
- **Lazy Loading**: Images and heavy components

## Disaster Recovery

### Backup Strategy

- **Database Backups**: Daily automated backups (PITR)
- **File Backups**: Nightly incremental backups
- **Retention**: 30 days retention for database, 90 days for files

### Recovery Plan

- **RTO** (Recovery Time Objective): < 1 hour
- **RPO** (Recovery Point Objective): < 15 minutes
- **Tested**: Monthly recovery drills
- **Documentation**: Runbooks for common failure scenarios

---

For implementation details, see [DEVELOPMENT.md](DEVELOPMENT.md).
For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).
