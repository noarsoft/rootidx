# rootidx — Backend Guide

## Overview

Express 4 + PostgreSQL backend with Root-ID versioned data architecture.
Every mutation is an INSERT (append-only versioning) — no UPDATE/DELETE on business data.

- 4 main tables: `data_schema`, `data`, `form`, `tableview`
- Root-ID versioning: `_rootid` groups object versions, `_doc_version` tracks sequence
- Soft delete via `_flag = 'd'`, migration flag `_flag = 'u'`
- Schema-aware data: form/view configs bind to schema by ID or root
- Warehouse transfer metadata on `data` table

### Tech Stack

- Node.js (CommonJS), Express 4, PostgreSQL (pg)
- UUID v4 for root IDs
- sanitize-html for input sanitization
- nodemon for development
- No ORM — raw SQL with CTE-based latest-version queries

---

## Quick Start

```bash
# Requires PostgreSQL running with .env configured
npm install
npm run dev          # migrate + start on port 3000
npm run dev:no-migrate  # start without migration
```

### Other Commands

```bash
npm run migrate      # Run SQL migration
npm run drop         # Drop all tables
npm run reset-db     # Drop + migrate
npm start            # migrate + production start
```

---

## Project Structure

```
rootidx/
├── sql/
│   ├── schema.sql          # Table definitions + constraints
│   └── drop-all.sql        # Drop all tables
├── src/
│   ├── app.js              # Express app setup (CORS, routes, middleware)
│   ├── server.js           # HTTP server entry point
│   ├── config/config.js    # Environment config (.env)
│   ├── db/
│   │   ├── pool.js         # PostgreSQL connection pool
│   │   ├── migrate.js      # Run schema.sql
│   │   └── drop.js         # Run drop-all.sql
│   ├── core/
│   │   ├── rootid-engine.js  # Root-ID versioning logic (create/update/delete/restore)
│   │   └── sql-builder.js    # Dynamic SQL query builder
│   ├── repositories/
│   │   └── base-versioned.repository.js  # Generic CRUD for versioned tables
│   ├── services/
│   │   ├── schema.service.js   # data_schema business logic
│   │   ├── data.service.js     # data business logic + migration
│   │   ├── form.service.js     # form business logic
│   │   └── view.service.js     # tableview business logic
│   ├── controllers/
│   │   ├── schema.controller.js
│   │   ├── data.controller.js
│   │   ├── form.controller.js
│   │   └── view.controller.js
│   ├── routes/
│   │   ├── index.js            # Route aggregator
│   │   ├── schema.route.js
│   │   ├── data.route.js
│   │   ├── form.route.js
│   │   └── view.route.js
│   ├── middlewares/
│   │   ├── error-handler.js    # Global error handler
│   │   └── not-found.js        # 404 handler
│   └── utils/
│       ├── async-handler.js    # Async route wrapper
│       └── response.js         # Standardized response helper
└── doc/
    ├── README-ARCHITECTURE.md  # Full architecture guide
    ├── ER-DIAGRAM.md           # Table/field/relationship docs
    └── API-ROUTES.md           # All API endpoints
```

---

## Core Concept — Root-ID Versioning

Every table uses append-only versioning:

```
CREATE  → INSERT first row (_rootid = new UUID, _doc_version = 1)
UPDATE  → INSERT new row (_rootid = same, _doc_version + 1, _flag = '')
DELETE  → INSERT new row (_rootid = same, _doc_version + 1, _flag = 'd')
RESTORE → INSERT new row (copy old payload, _doc_version + 1, _flag = '')
MIGRATE → INSERT new row (mapped payload, _doc_version + 1, old row _flag = 'u')
```

Latest version = `ORDER BY _doc_version DESC, id DESC LIMIT 1`

### Flags

| `_flag` | Meaning |
|---------|---------|
| `''` | Normal (active) |
| `'d'` | Deleted (soft delete) |
| `'u'` | Updated/migrated to newer schema version |

---

## Main Tables

| Table | Purpose | Special Fields |
|-------|---------|----------------|
| `data_schema` | Field definitions (JSON payload) | `name`, `business_id` |
| `data` | Actual records | `data_schema_id`, `_transfer_version`, `_transfer_datetime` |
| `form` | Form layout config | `data_schema_id`, `data_schema_rootid` |
| `tableview` | Table display config | `data_schema_id`, `data_schema_rootid` |

### Common Version Fields

All tables share: `id`, `_rootid`, `_prev_id`, `_doc_version`, `_flag`, `payload`, `_modify_datetime`, `created_at`, `updated_at`

### Binding Modes (form/tableview)

- **Fixed**: `data_schema_id` → specific schema version
- **Latest-root**: `data_schema_rootid` → always follows latest schema

---

## API Routes

Base: `/api`

| Resource | Path | DB Table |
|----------|------|----------|
| Health | `GET /api/health` | — |
| Schema | `/api/schema/*` | `data_schema` |
| Data | `/api/data/*` | `data` |
| Form | `/api/form/*` | `form` |
| View | `/api/view/*` | `tableview` |

**Note**: API uses `/api/view` but the DB table is `tableview`.

### Common Route Patterns (all 4 resources)

```
GET  /api/{resource}                          # List all
POST /api/{resource}                          # Create
GET  /api/{resource}/root/:rootid/latest      # Get latest version
GET  /api/{resource}/root/:rootid/history     # Get version history
PATCH  /api/{resource}/root/:rootid           # Update (new version)
DELETE /api/{resource}/root/:rootid           # Soft delete (new version)
GET  /api/{resource}/:id                      # Get specific version
POST /api/{resource}/:id/restore              # Restore from version
```

### Resource-Specific Routes

```
# Schema
POST /api/schema/:id/validate
GET  /api/schema/:id/compare-latest
GET  /api/schema?business_id=:bizId

# Data
GET  /api/data/schema/:schemaId
GET  /api/data/schema-root/:schemaRootId
POST /api/data/root/:rootid/migrate-latest-schema
GET  /api/data/:id/compare-latest-schema

# Form
GET  /api/form/schema/:schemaId
GET  /api/form/schema-root/:schemaRootId
POST /api/form/root/:rootid/migrate-latest-schema
GET  /api/form/:id/editor-context

# View
GET  /api/view/schema/:schemaId
GET  /api/view/schema-root/:schemaRootId
POST /api/view/root/:rootid/migrate-latest-schema
GET  /api/view/:id/editor-context
GET  /api/view/:id/render-fixed
GET  /api/view/:id/render-latest-root
```

### Query Parameters

```
includeDeleted=true    # Include soft-deleted records
limit=100              # Pagination limit
offset=0               # Pagination offset
data_schema_id=1       # Filter by schema version
data_schema_rootid=abc # Filter by schema root
business_id=xyz        # Filter by business (schema only)
```

---

## Architecture Layers

```
Route → Controller → Service → Repository → PostgreSQL
                                    ↓
                              rootid-engine.js (versioning logic)
                              sql-builder.js (dynamic queries)
```

- **Routes**: Express route definitions, HTTP method mapping
- **Controllers**: Parse request, call service, format response
- **Services**: Business logic, validation, cross-table operations
- **Repository**: `base-versioned.repository.js` — generic CRUD for any versioned table
- **Core**: `rootid-engine.js` (version management), `sql-builder.js` (query construction)

---

## Schema Payload Types

Supported types in `data_schema.payload`:

```
string, number, integer, boolean, date, datetime,
yyyymmddhhmmss, yyyymmdd, hhmmss, object, array, json
```

Field rules: `type`, `required`, `enum`, `default`, `label`

---

## Implementation Notes

- **No ORM** — raw SQL with CTEs for latest-version queries
- **No `_is_active` column** — latest determined by `ORDER BY _doc_version DESC, id DESC`
- **No PostgreSQL VIEWs** — application queries latest via CTE
- **No `updated_at` triggers** — transfer metadata updated directly
- **Table allowlist**: `data_schema`, `data`, `form`, `tableview` only
- **`_modify_datetime`** uses `YYYYMMDDHHMMSS` format (BIGINT)

---

## Constraints

- **Never modify** initial commit files — client-provided baseline
- **Always use** Root-ID versioning pattern — never UPDATE/DELETE business data rows
- **Always include** `_flag` checks when querying latest versions
- **API naming**: external = `/api/view`, internal = `tableview`
