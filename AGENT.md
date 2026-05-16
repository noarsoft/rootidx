# rootidx — Agent Instructions

## Quick Context

Express 4 + PostgreSQL backend with Root-ID append-only versioning.
4 resources: schema, data, form, view. Read `CLAUDE.md` for full architecture.

## Critical Rules

1. **Never modify** files from the initial commit — client-provided baseline
2. **Never UPDATE/DELETE** business data rows — always INSERT new version
3. **Always use** `_flag` when querying latest: exclude `'d'` (deleted) and `'u'` (migrated)
4. **Always use** `rootid-engine.js` for version operations — never hand-roll versioning
5. **Always use** `base-versioned.repository.js` for DB access — never write raw queries in services
6. **Table allowlist**: `data_schema`, `data`, `form`, `tableview` only
7. **API vs DB naming**: API = `/api/view`, DB = `tableview`, Service = `ViewService`

## File Conventions

| Type | Location | Pattern |
|------|----------|---------|
| Route | `src/routes/` | `xxx.route.js` |
| Controller | `src/controllers/` | `xxx.controller.js` |
| Service | `src/services/` | `xxx.service.js` |
| Repository | `src/repositories/` | `base-versioned.repository.js` |
| Core | `src/core/` | `rootid-engine.js`, `sql-builder.js` |
| Middleware | `src/middlewares/` | `xxx.js` |
| SQL | `sql/` | `schema.sql`, `drop-all.sql` |
| Docs | `doc/` | `*.md` |

## Versioning Pattern

```
CREATE:  _rootid = new UUID, _doc_version = 1, _flag = ''
UPDATE:  _rootid = same, _doc_version + 1, _flag = ''
DELETE:  _rootid = same, _doc_version + 1, _flag = 'd'
RESTORE: copy old payload, _doc_version + 1, _flag = ''
MIGRATE: map payload to latest schema, _doc_version + 1, old row _flag = 'u'
```

Latest = `ORDER BY _doc_version DESC, id DESC LIMIT 1`

## Adding a New Route

1. Create `src/routes/xxx.route.js` with Express Router
2. Create `src/controllers/xxx.controller.js` — parse request, call service
3. Create `src/services/xxx.service.js` — business logic
4. Use `base-versioned.repository.js` for DB operations
5. Register route in `src/routes/index.js`
6. Update `doc/API-ROUTES.md`

## Service Pattern

```js
const BaseVersionedRepository = require('../repositories/base-versioned.repository');

class XxxService {
    constructor(pool) {
        this.repo = new BaseVersionedRepository(pool, 'table_name');
    }

    async create(payload) {
        return this.repo.create(payload);
    }

    async getLatest(rootid) {
        return this.repo.getLatest(rootid);
    }

    async update(rootid, payload) {
        return this.repo.update(rootid, payload);
    }

    async delete(rootid) {
        return this.repo.delete(rootid);
    }
}
```

## Controller Pattern

```js
const asyncHandler = require('../utils/async-handler');
const { ok, created } = require('../utils/response');

const create = asyncHandler(async (req, res) => {
    const result = await service.create(req.body);
    return created(res, result);
});

const getLatest = asyncHandler(async (req, res) => {
    const result = await service.getLatest(req.params.rootid);
    return ok(res, result);
});
```

## Flag Values

| Flag | Meaning | When |
|------|---------|------|
| `''` | Normal/active | Default state |
| `'d'` | Deleted | Soft delete — latest version with this flag = deleted |
| `'u'` | Updated/migrated | Old data row migrated to newer schema |

## Query Parameters

```
includeDeleted=true     # Include soft-deleted records
limit=100 & offset=0    # Pagination
data_schema_id=1        # Filter by specific schema version
data_schema_rootid=abc  # Filter by schema family
business_id=xyz         # Filter by business (schema only)
```

## Schema Payload Types

```
string, number, integer, boolean, date, datetime,
yyyymmddhhmmss, yyyymmdd, hhmmss, object, array, json
```

## Verification

Test API changes with curl or HTTP client before finalizing.
Group logical changes into descriptive commits. Never force push unless explicitly directed.
