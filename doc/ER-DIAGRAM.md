# ER Diagram and Table Relationships

เอกสารนี้สรุป table, field สำคัญ และความสัมพันธ์ของระบบ Root-ID Backend

---

# 1. Main Tables

```txt
data_schema
data
form
tableview
```

| Table | หน้าที่ |
|---|---|
| `data_schema` | เก็บ schema/config ของข้อมูล |
| `data` | เก็บข้อมูลจริง |
| `form` | เก็บ form layout/config |
| `tableview` | เก็บ table view/display config |

---

# 2. ER Diagram

```txt
┌──────────────────────────┐
│       data_schema         │
│──────────────────────────│
│ id PK                    │◄────────────┐
│ _rootid                  │             │
│ _prev_id FK self         │─────────────┘
│ _doc_version             │
│ _flag                    │
│ name                     │
│ payload JSONB            │
│ _modify_datetime         │
│ created_at / updated_at  │
└────────────┬─────────────┘
             │
             │ data.data_schema_id
             ▼
┌──────────────────────────┐
│          data             │
│──────────────────────────│
│ id PK                    │◄────────────┐
│ _rootid                  │             │
│ _prev_id FK self         │─────────────┘
│ _doc_version             │
│ _flag                    │
│ _transfer_version        │
│ _transfer_datetime       │
│ data_schema_id FK        │
│ payload JSONB            │
│ _modify_datetime         │
│ created_at / updated_at  │
└──────────────────────────┘


┌──────────────────────────┐
│          form             │
│──────────────────────────│
│ id PK                    │◄────────────┐
│ _rootid                  │             │
│ _prev_id FK self         │─────────────┘
│ _doc_version             │
│ _flag                    │
│ data_schema_id FK        │─────────────► data_schema.id
│ data_schema_rootid       │─────────────► data_schema._rootid
│ payload JSONB            │
│ _modify_datetime         │
│ created_at / updated_at  │
└──────────────────────────┘


┌──────────────────────────┐
│        tableview          │
│──────────────────────────│
│ id PK                    │◄────────────┐
│ _rootid                  │             │
│ _prev_id FK self         │─────────────┘
│ _doc_version             │
│ _flag                    │
│ data_schema_id FK        │─────────────► data_schema.id
│ data_schema_rootid       │─────────────► data_schema._rootid
│ payload JSONB            │
│ _modify_datetime         │
│ created_at / updated_at  │
└──────────────────────────┘
```

---

# 3. Common Fields

ทุก table มี field versioning กลุ่มนี้

| Field | Type | ความหมาย |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | id ของ row/version |
| `_rootid` | `TEXT NOT NULL` | object family id |
| `_prev_id` | `BIGINT NULL` | version ก่อนหน้า |
| `_doc_version` | `INTEGER NOT NULL DEFAULT 1` | version number |
| `_flag` | `TEXT NOT NULL DEFAULT ''` | `''` ปกติ, `'d'` deleted |
| `payload` | `JSONB NOT NULL DEFAULT '{}'` | เนื้อหาหลัก |
| `_modify_datetime` | `BIGINT` | เวลาแก้ไขแบบ `YYYYMMDDHHMMSS` |
| `created_at` | `TIMESTAMPTZ` | เวลาสร้าง |
| `updated_at` | `TIMESTAMPTZ` | เวลา update |

---

# 4. Transfer Fields

มีเฉพาะ table `data`

| Field | Type | ความหมาย |
|---|---|---|
| `_transfer_version` | `BIGINT NOT NULL DEFAULT 0` | batch/version ของ warehouse transfer |
| `_transfer_datetime` | `BIGINT NULL` | เวลา transfer สำเร็จแบบ `YYYYMMDDHHMMSS` |

ความหมาย:

```txt
_transfer_version = 0
_transfer_datetime = NULL
= ยังไม่ transfer

_transfer_version > 0
_transfer_datetime != NULL
= transfer แล้ว
```

---

# 5. Relationships

## 5.1 Self-version relationships

```txt
data_schema._prev_id -> data_schema.id
data._prev_id        -> data.id
form._prev_id        -> form.id
tableview._prev_id   -> tableview.id
```

## 5.2 Schema relationships

```txt
data.data_schema_id -> data_schema.id
```

```txt
form.data_schema_id -> data_schema.id
form.data_schema_rootid -> data_schema._rootid
```

```txt
tableview.data_schema_id -> data_schema.id
tableview.data_schema_rootid -> data_schema._rootid
```

---

# 6. Binding Modes

## Fixed Schema Mode

ใช้ `data_schema_id`

```txt
form.data_schema_id -> data_schema.id
tableview.data_schema_id -> data_schema.id
```

เหมาะกับ:

```txt
edit/replay ตาม schema version เดิม
```

## Latest-root Mode

ใช้ `data_schema_rootid`

```txt
form.data_schema_rootid -> data_schema._rootid
tableview.data_schema_rootid -> data_schema._rootid
```

เหมาะกับ:

```txt
follow schema ล่าสุด
render/project data เก่าไป schema ล่าสุด
```

---

# 7. Summary

```txt
data_schema
= นิยาม field/type

data
= ข้อมูลจริง ผูกกับ data_schema_id เสมอ

form
= form layout ผูกได้ทั้ง data_schema_id หรือ data_schema_rootid

tableview
= table display config ผูกได้ทั้ง data_schema_id หรือ data_schema_rootid
```