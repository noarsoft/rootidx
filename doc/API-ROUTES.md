# API Routes

เอกสารนี้สรุป API routes ของ Root-ID Backend

Base path:

```txt
/api
```

Main resources:

```txt
/api/schema
/api/data
/api/form
/api/view
```

หมายเหตุ:

```txt
/api/view = API ภายนอก
tableview = DB table จริง
```

---

# 1. Health

```txt
GET /api/health
```

---

# 2. Schema API

## List / Create

```txt
GET  /api/schema
POST /api/schema
```

## Root-ID operations

```txt
GET    /api/schema/root/:rootid/latest
GET    /api/schema/root/:rootid/history
PATCH  /api/schema/root/:rootid
DELETE /api/schema/root/:rootid
```

## Version row operations

```txt
GET  /api/schema/:id
POST /api/schema/:id/validate
GET  /api/schema/:id/compare-latest
POST /api/schema/:id/restore
```

---

# 3. Data API

## List / Create

```txt
GET  /api/data
POST /api/data
```

## List by schema

```txt
GET /api/data/schema/:schemaId
GET /api/data/schema-root/:schemaRootId
```

## Root-ID operations

```txt
GET    /api/data/root/:rootid/latest
GET    /api/data/root/:rootid/history
PATCH  /api/data/root/:rootid
DELETE /api/data/root/:rootid
```

## Migration

```txt
POST /api/data/root/:rootid/migrate-latest-schema
```

## Version row operations

```txt
GET  /api/data/:id
GET  /api/data/:id/compare-latest-schema
POST /api/data/:id/restore
```

---

# 4. Form API

## List / Create

```txt
GET  /api/form
POST /api/form
```

## List by schema

```txt
GET /api/form/schema/:schemaId
GET /api/form/schema-root/:schemaRootId
```

## Root-ID operations

```txt
GET    /api/form/root/:rootid/latest
GET    /api/form/root/:rootid/history
PATCH  /api/form/root/:rootid
DELETE /api/form/root/:rootid
```

## Migration

```txt
POST /api/form/root/:rootid/migrate-latest-schema
```

## Version row operations

```txt
GET  /api/form/:id
GET  /api/form/:id/editor-context
POST /api/form/:id/restore
```

---

# 5. View API

API ใช้ชื่อ `view` แต่ DB table จริงชื่อ `tableview`

## List / Create

```txt
GET  /api/view
POST /api/view
```

## List by schema

```txt
GET /api/view/schema/:schemaId
GET /api/view/schema-root/:schemaRootId
```

## Root-ID operations

```txt
GET    /api/view/root/:rootid/latest
GET    /api/view/root/:rootid/history
PATCH  /api/view/root/:rootid
DELETE /api/view/root/:rootid
```

## Migration

```txt
POST /api/view/root/:rootid/migrate-latest-schema
```

## Version row operations

```txt
GET  /api/view/:id
GET  /api/view/:id/editor-context
GET  /api/view/:id/render-fixed
GET  /api/view/:id/render-latest-root
POST /api/view/:id/restore
```

---

# 6. Query Parameters

ใช้ได้ใน list endpoints หลายตัว

```txt
includeDeleted=true
limit=100
offset=0
data_schema_id=1
data_schema_rootid=<schema-rootid>
```

ตัวอย่าง:

```txt
GET /api/data?limit=20&offset=0
GET /api/data?includeDeleted=true
GET /api/form?data_schema_id=1
GET /api/view?data_schema_rootid=abc
```

---

# 7. Route Design Notes

## Root-ID route

ใช้กับ object family ล่าสุด/history/update/delete

```txt
/root/:rootid/latest
/root/:rootid/history
PATCH /root/:rootid
DELETE /root/:rootid
```

## Version row route

ใช้กับ row version เฉพาะเจาะจง

```txt
/:id
/:id/restore
```

## Migration route

ใช้สร้าง version ใหม่โดย map ไป latest schema

```txt
/root/:rootid/migrate-latest-schema
```

---

# 8. Summary

```txt
/api/schema
= จัดการ data_schema

/api/data
= จัดการข้อมูลจริง

/api/form
= จัดการ form layout

/api/view
= จัดการ tableview/display config
```