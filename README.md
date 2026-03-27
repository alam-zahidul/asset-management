# Asset Management System

A full-stack asset/server inventory management application with LDAP Active Directory authentication, role-based access control, dynamic field management, and bulk import/export capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Frontend    │  │  Admin      │  │  Backend    │            │
│  │  (React)     │  │  (React)    │  │  (Node.js)  │            │
│  │  Port 80     │  │  Port 80    │  │  Port 3001  │            │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                │                    │
│         └─────────────────┼────────────────┘                    │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              │            │            │                        │
│        ┌─────┴─────┐ ┌───┴───┐  ┌─────┴─────┐                 │
│        │ PostgreSQL │ │ Redis │  │ LDAP/AD   │                 │
│        │ (3 schemas)│ │ Cache │  │ Server    │                 │
│        └───────────┘  └───────┘  └───────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Three Separate Applications

| Application | Purpose | Port | Tech Stack |
|---|---|---|---|
| **Frontend** | User-facing asset inventory UI | 3000 (dev) / 80 (prod) | React, TypeScript, Ant Design, Vite |
| **Admin Panel** | Administrative configuration | 3003 (dev) / 80 (prod) | React, TypeScript, Ant Design, Vite |
| **Backend API** | REST API for all operations | 3001 | Node.js, Express, TypeScript, Knex |

### Three Separate Database Schemas

| Schema | Purpose | Tables |
|---|---|---|
| **auth** | Authentication & authorization | users, roles, permissions, user_roles, role_permissions, refresh_tokens |
| **app** | Application data | assets, import_logs |
| **admin** | Admin configuration | field_definitions, export_templates, audit_logs |

## Features

### Authentication & Authorization
- **LDAP/Active Directory** authentication
- **JWT tokens** with refresh token rotation
- **Role-Based Access Control** (Admin, Editor, Viewer)
- **Granular permissions** (18 permission types across 6 resources)
- Account activation/deactivation

### Asset Inventory Management
- Dynamic fields — add, remove, or customize any column
- Field types: text, number, date, select, boolean, email, URL, IP address, textarea
- Set fields as mandatory or optional
- Field validation with regex patterns, min/max, type checking
- Full-text search and field-level filtering
- Sorting by any field

### Import/Export
- **Import**: Upload Excel (.xlsx/.xls) or CSV files
- Smart column mapping (matches by field key or display name)
- Bulk upsert (insert new, update existing by asset tag)
- Import logs with error tracking
- **Export**: Download in Excel, CSV, or PDF format
- Customizable columns — select which fields to include
- Export with current filters applied
- Save export templates for reuse

### Admin Portal
- **Field Management**: Add, edit, delete inventory fields
- Configure field type, required/optional, filterable, exportable
- Set validation rules (regex, min/max values)
- Manage select/dropdown options
- Group fields by category
- **User Management**: View users, assign/remove roles, enable/disable accounts
- **Audit Logs**: Full audit trail of all actions

### Security
- XSS sanitization (frontend and backend)
- Input validation with Joi schemas
- Rate limiting (general + strict for login)
- Helmet security headers (CSP, HSTS, X-Frame-Options)
- CORS configuration
- SQL injection prevention via parameterized queries (Knex.js)
- File upload validation (type, size)
- JWT with short-lived access tokens + refresh rotation
- Non-root Docker containers
- Kubernetes NetworkPolicies, PodDisruptionBudgets

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Access to an LDAP/AD server (or mock for development)

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Infrastructure

```bash
docker compose up -d postgresql redis
```

### 3. Run Backend

```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

### 4. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Run Admin Panel

```bash
cd admin
npm install
npm run dev
```

### Access Points
- Frontend: http://localhost:3000
- Admin Panel: http://localhost:3003
- Backend API: http://localhost:3001

## Docker Compose (Full Stack)

```bash
# Copy and configure environment
cp .env.example .env

# Build and start all services
docker compose up --build -d

# Run database migrations
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster with nginx ingress controller
- kubectl configured
- Container registry access (GitLab Container Registry)

### Manual Deployment

```bash
# Create namespace and resources
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# Update secrets with real values first!
kubectl apply -f k8s/secrets.yaml

# Deploy services
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/admin.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/policies.yaml
```

### GitLab CI/CD

The `.gitlab-ci.yml` pipeline handles:

1. **Lint** — ESLint on all three applications
2. **Test** — Backend unit tests with coverage
3. **Build** — Docker image build and push to registry
4. **Scan** — Trivy container vulnerability scanning
5. **Deploy** — Manual deployment to staging/production
6. **Migrate** — Database migration as a separate manual step

## API Reference

### Authentication
| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Login with LDAP credentials |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Revoke refresh tokens |
| `/api/auth/me` | GET | Get current user info |

### Assets
| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/assets` | GET | assets:read | List assets with filtering/pagination |
| `/api/assets/:id` | GET | assets:read | Get single asset |
| `/api/assets` | POST | assets:create | Create asset |
| `/api/assets/:id` | PUT | assets:update | Update asset |
| `/api/assets/:id` | DELETE | assets:delete | Soft delete asset |
| `/api/assets/import` | POST | assets:import | Upload CSV/Excel file |
| `/api/assets/export` | POST | assets:export | Export filtered data |
| `/api/assets/import-logs` | GET | assets:import | View import history |

### Fields
| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/fields` | GET | fields:read | List all fields |
| `/api/fields/active` | GET | fields:read | List active fields only |
| `/api/fields/:id` | GET | fields:read | Get field details |
| `/api/fields` | POST | fields:create | Create new field |
| `/api/fields/:id` | PUT | fields:update | Update field |
| `/api/fields/:id` | DELETE | fields:delete | Delete field |

### Admin
| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/admin/users` | GET | users:read | List users with roles |
| `/api/admin/roles` | GET | roles:manage | List roles |
| `/api/admin/users/roles/assign` | POST | roles:manage | Assign role to user |
| `/api/admin/users/roles/remove` | POST | roles:manage | Remove role from user |
| `/api/admin/users/:id/toggle-active` | PATCH | users:manage | Enable/disable user |
| `/api/admin/audit-logs` | GET | audit:read | View audit logs |
| `/api/admin/templates` | GET/POST | templates:read/create | Export templates |

## Default Roles

| Role | Permissions |
|---|---|
| **admin** | Full access to all resources |
| **editor** | Create, read, update assets; import/export; read fields; manage templates |
| **viewer** | Read assets, export, read fields and templates |

## Project Structure

```
asset-management/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── config/             # Database, Redis, app configuration
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/          # Auth, sanitization, error handling
│   │   ├── migrations/         # Database schema migrations
│   │   ├── routes/             # Express route definitions
│   │   ├── seeds/              # Default data (roles, permissions, fields)
│   │   ├── services/           # Business logic layer
│   │   ├── utils/              # Logger, sanitizer, error classes
│   │   ├── validators/         # Joi validation schemas
│   │   └── app.ts              # Express app entry point
│   └── Dockerfile
├── frontend/                   # User-facing React app
│   ├── src/
│   │   ├── pages/              # Login, AssetList, ImportLogs
│   │   ├── services/           # Axios API client
│   │   ├── store/              # Zustand state management
│   │   ├── utils/              # Client-side sanitization
│   │   └── App.tsx
│   ├── nginx.conf
│   └── Dockerfile
├── admin/                      # Admin React app
│   ├── src/
│   │   ├── pages/              # FieldManagement, UserManagement, AuditLogs
│   │   ├── services/           # Axios API client
│   │   ├── store/              # Auth state
│   │   └── App.tsx
│   ├── nginx.conf
│   └── Dockerfile
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend.yaml
│   ├── frontend.yaml
│   ├── admin.yaml
│   ├── ingress.yaml
│   └── policies.yaml           # HPA, PDB, NetworkPolicy
├── .gitlab-ci.yml              # CI/CD pipeline
├── docker-compose.yml          # Local development
├── .env.example                # Environment template
└── README.md
```
