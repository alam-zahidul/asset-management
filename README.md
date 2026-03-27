# Asset Management System

A comprehensive enterprise asset management application with LDAP Active Directory authentication, role-based access control (RBAC), dynamic field management, and Excel/CSV/PDF import/export capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Ingress (Nginx)                         │
│  assets.company.com              assets-admin.company.com       │
├──────────────────┬──────────────────┬──────────────┬────────────┤
│    Frontend      │    Backend API   │  Admin Panel │  Admin API │
│   (React SPA)    │  (Express/TS)    │  (React SPA) │ (Express)  │
│   Port 3000      │   Port 3001      │  Port 3003   │ Port 3002  │
├──────────────────┴──────────────────┴──────────────┴────────────┤
│                     PostgreSQL 16  │  Redis 7                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │  auth    │ │  admin   │ │inventory │   Session/Field Cache   │
│  │  schema  │ │  schema  │ │  schema  │                         │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Applications

| Application    | Technology          | Port | Description                                    |
|---------------|---------------------|------|------------------------------------------------|
| Frontend      | React + Vite + TS   | 3000 | User-facing inventory management SPA           |
| Backend API   | Express + TypeScript| 3001 | Main API for auth, assets, import/export       |
| Admin Panel   | React + Vite + TS   | 3003 | Admin interface for field/user/role management |
| Admin API     | Express + TypeScript| 3002 | Admin operations API                           |

### Database Schemas

- **auth** — Users, roles, permissions, refresh tokens, audit logs
- **admin** — Field definitions, field groups, export templates
- **inventory** — Assets (with JSONB dynamic data), asset history, import logs

## Features

### Inventory Management
- View, create, update, delete server assets
- Dynamic fields driven by admin-managed field definitions
- Full change history tracking per asset
- Search, filter, and sort with pagination

### Import / Export
- **Import**: Upload Excel (.xlsx) or CSV files to bulk create/update assets
- **Export**: Download inventory in Excel, CSV, or PDF formats
- Column selection and data filtering during export
- Row-by-row validation with detailed error reporting

### Admin Portal
- Add, remove, or customize any inventory field
- Toggle fields as required/optional, active/inactive
- Manage field types: text, number, email, IP, URL, date, select, multiselect, boolean
- Group fields into categories (General, Hardware, Network, OS, Location, Custom)
- User role assignment and status management
- Role and permission CRUD (admin, manager, operator, viewer)
- Audit log viewer with filters

### Security
- LDAP Active Directory authentication
- JWT access tokens + refresh tokens (httpOnly cookies)
- Role-based access control with granular permissions
- Helmet security headers
- CORS configuration
- Rate limiting (100 req/15min general, 20 req/15min auth)
- DOMPurify input sanitization on frontend and backend
- Zod schema validation
- Parameterized SQL queries (no SQL injection)
- Network Policies in Kubernetes
- Non-root container execution
- Read-only root filesystem in production containers

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Active Directory / LDAP server
- Kubernetes cluster (for production)
- GitLab CI runner (for CI/CD)

## Quick Start (Local Development)

### 1. Clone and configure

```bash
git clone <repository-url>
cd asset-management
cp .env.example .env
# Edit .env with your LDAP and database configuration
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432 (with schema initialization)
- Redis on port 6379
- Backend API on port 3001
- Admin API on port 3002
- Frontend on port 3000
- Admin Panel on port 3003

### 3. Access the applications

- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3003
- Login with your Active Directory credentials

## Development (Without Docker)

### Backend API

```bash
cd backend
npm install
npm run dev
```

### Admin API

```bash
cd admin-api
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

## Environment Variables

See [.env.example](.env.example) for all configuration options.

| Variable              | Description                         | Default               |
|----------------------|-------------------------------------|-----------------------|
| DB_HOST              | PostgreSQL host                     | localhost             |
| DB_PORT              | PostgreSQL port                     | 5432                  |
| DB_NAME              | Database name                       | asset_management      |
| DB_USER              | Database user                       | postgres              |
| DB_PASSWORD          | Database password                   | —                     |
| REDIS_HOST           | Redis host                          | localhost             |
| REDIS_PORT           | Redis port                          | 6379                  |
| REDIS_PASSWORD       | Redis password                      | —                     |
| JWT_SECRET           | JWT signing secret                  | —                     |
| JWT_REFRESH_SECRET   | Refresh token signing secret        | —                     |
| JWT_EXPIRY           | Access token expiry                 | 15m                   |
| JWT_REFRESH_EXPIRY   | Refresh token expiry                | 7d                    |
| LDAP_URL             | LDAP server URL                     | ldap://dc.company.com |
| LDAP_BASE_DN         | LDAP base DN                        | dc=company,dc=com     |
| LDAP_BIND_DN         | LDAP service account DN             | —                     |
| LDAP_BIND_PASSWORD   | LDAP service account password       | —                     |

## Kubernetes Deployment

### 1. Create namespace and configs

```bash
kubectl apply -f k8s/namespace.yaml
# Edit k8s/config.yaml with actual base64-encoded secrets
kubectl apply -f k8s/config.yaml
```

### 2. Deploy database and cache

```bash
kubectl apply -f k8s/database.yaml
```

### 3. Deploy applications

```bash
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/admin-api.yaml
kubectl apply -f k8s/frontends.yaml
```

### 4. Configure ingress

```bash
# Edit k8s/ingress.yaml with your domain names
kubectl apply -f k8s/ingress.yaml
```

## GitLab CI/CD

The pipeline ([.gitlab-ci.yml](.gitlab-ci.yml)) runs:

1. **Lint** — TypeScript compilation check per app (on changes only)
2. **Test** — Unit tests with PostgreSQL/Redis service containers
3. **Build** — Multi-stage Docker image builds
4. **Push** — Push images to GitLab Container Registry
5. **Deploy** — Rolling updates to Kubernetes
   - `develop` branch → staging (automatic)
   - `main` branch → production (manual approval)

### Required CI/CD Variables

Set these in GitLab → Settings → CI/CD → Variables:

- `KUBE_CONTEXT_STAGING` — Kubernetes context for staging
- `KUBE_CONTEXT_PRODUCTION` — Kubernetes context for production

## API Endpoints

### Backend API (Port 3001)

| Method | Path                          | Auth    | Description                |
|--------|-------------------------------|---------|----------------------------|
| POST   | /api/auth/login               | Public  | Login with AD credentials  |
| POST   | /api/auth/logout              | Token   | Logout and revoke token    |
| POST   | /api/auth/refresh             | Cookie  | Refresh access token       |
| GET    | /api/auth/me                  | Token   | Get current user profile   |
| GET    | /api/assets                   | Token   | List assets (paginated)    |
| GET    | /api/assets/:id               | Token   | Get asset details          |
| POST   | /api/assets                   | Token   | Create asset               |
| PUT    | /api/assets/:id               | Token   | Update asset               |
| DELETE | /api/assets/:id               | Token   | Delete asset               |
| GET    | /api/assets/:id/history       | Token   | Get asset change history   |
| POST   | /api/import                   | Token   | Import from Excel/CSV      |
| GET    | /api/export                   | Token   | Export with filters/format  |
| GET    | /api/fields                   | Token   | Get field definitions      |
| GET    | /api/fields/groups            | Token   | Get field groups           |

### Admin API (Port 3002)

| Method | Path                          | Auth    | Description                |
|--------|-------------------------------|---------|----------------------------|
| GET    | /api/admin/fields             | Admin   | List field definitions     |
| POST   | /api/admin/fields             | Admin   | Create field definition    |
| PUT    | /api/admin/fields/:id         | Admin   | Update field definition    |
| DELETE | /api/admin/fields/:id         | Admin   | Delete field definition    |
| GET    | /api/admin/users              | Admin   | List users                 |
| PUT    | /api/admin/users/:id/roles    | Admin   | Assign roles to user       |
| PUT    | /api/admin/users/:id/status   | Admin   | Toggle user status         |
| GET    | /api/admin/roles              | Admin   | List roles                 |
| POST   | /api/admin/roles              | Admin   | Create role                |
| PUT    | /api/admin/roles/:id          | Admin   | Update role                |
| DELETE | /api/admin/roles/:id          | Admin   | Delete role                |
| GET    | /api/admin/audit              | Admin   | View audit logs            |

## Default Roles & Permissions

| Role     | Permissions                                              |
|----------|----------------------------------------------------------|
| Admin    | All permissions                                          |
| Manager  | View, create, update, delete assets; import/export       |
| Operator | View, create, update assets; import                      |
| Viewer   | View assets; export                                      |

## Project Structure

```
asset-management/
├── backend/                  # Backend API (Express + TypeScript)
│   ├── src/
│   │   ├── config/          # Database, Redis, app configuration
│   │   ├── middleware/      # Auth, validation, sanitization, errors
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic (LDAP, auth, assets, etc.)
│   │   └── app.ts           # Express application entry point
│   ├── Dockerfile
│   └── package.json
├── admin-api/                # Admin API (Express + TypeScript)
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── app.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/                 # User Frontend (React + Vite)
│   ├── src/
│   │   ├── context/         # Auth context provider
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client, auth, asset services
│   │   ├── utils/           # Sanitization, validation helpers
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── admin-panel/              # Admin Panel (React + Vite)
│   ├── src/
│   │   ├── pages/           # Admin pages (Fields, Users, Roles, Audit)
│   │   ├── services/        # Admin API client
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── database/
│   └── init/
│       └── 01-init.sql      # Database schema initialization
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml
│   ├── config.yaml          # Secrets + ConfigMap
│   ├── database.yaml        # PostgreSQL StatefulSet + Redis
│   ├── backend.yaml         # Backend Deployment + HPA
│   ├── admin-api.yaml       # Admin API Deployment
│   ├── frontends.yaml       # Frontend + Admin Panel Deployments
│   └── ingress.yaml         # Ingress + Network Policies
├── docker-compose.yml        # Local development setup
├── .gitlab-ci.yml            # CI/CD pipeline
├── .env.example              # Environment variable template
└── .gitignore
```

## License

Proprietary — Internal use only.
