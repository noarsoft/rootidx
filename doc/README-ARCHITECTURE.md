# Root-ID Backend Architecture

เอกสารนี้สรุปภาพรวมและแกนคิดหลักของระบบ Root-ID Figma Prototype Backend เพื่อใช้อ้างอิงเวลาแก้ code หรือย้ายไปคุยต่อใน thread ใหม่

---

# 1. Related Documents

เอกสารแยกเพิ่มเติม:

```txt
docs/ER-DIAGRAM.md
docs/API-ROUTES.md
```

ความหมาย:

| File | ใช้ทำอะไร |
|---|---|
| `README-ARCHITECTURE.md` | ภาพรวมระบบและแกนคิดหลัก |
| `ER-DIAGRAM.md` | table, field, relationship, ER diagram |
| `API-ROUTES.md` | รายการ API endpoints ทั้งหมด |

---

# 2. Overview

ระบบนี้เป็น backend สำหรับจัดการข้อมูลแบบมี version โดยใช้แนวคิด Root-ID

เป้าหมายหลัก:

- เก็บข้อมูลแบบมีประวัติ
- รองรับ schema ที่เปลี่ยนแปลงได้
- รองรับ form layout ที่อ้าง schema
- รองรับ table view/display config ที่อ้าง schema
- สามารถดู latest version, history, delete, restore ได้
- รองรับข้อมูลเก่าที่สร้างจาก schema version เดิม
- รองรับการ render ข้อมูลเก่ากับ schema ล่าสุด
- รองรับ metadata สำหรับ warehouse transfer เฉพาะ table `data`

Main APIs:

```txt
/api/schema
/api/data
/api/form
/api/view
```

Main tables:

```txt
data_schema
data
form
tableview
```

หมายเหตุสำคัญ:

```txt
DB table จริงคือ tableview
API ยังใช้ /api/view เหมือนเดิม
```

---

# 3. Core Concept

## 3.1 Root-ID

`_rootid` คือ id หลักของ object family เดียวกัน

ตัวอย่าง:

```txt
data row version 1: _rootid = abc, _doc_version = 1
data row version 2: _rootid = abc, _doc_version = 2
data row version 3: _rootid = abc, _doc_version = 3
```

ทั้ง 3 row คือ object เดียวกัน แต่คนละ version

---

## 3.2 Versioning

ระบบนี้ไม่ update row เดิมเพื่อเปลี่ยน business data

ทุกครั้งที่แก้ไข จะ insert row ใหม่แทน

```txt
create  -> INSERT row แรก
update  -> INSERT row version ใหม่
delete  -> INSERT row version ใหม่ที่ _flag = 'd'
restore -> INSERT row ใหม่จาก version เก่า
```

latest version คือ:

```sql
ORDER BY _doc_version DESC, id DESC
LIMIT 1
```

---

## 3.3 Delete

ระบบไม่ลบข้อมูลจริง

การ delete คือ insert version ใหม่ที่:

```txt
_flag = 'd'
```

ถ้า latest row ของ `_rootid` มี `_flag = 'd'` แปลว่า object นั้นถูกลบแล้ว

---

## 3.4 Restore

การ restore คือ copy version เก่าที่ไม่ใช่ deleted version กลับมาเป็น version ใหม่

ตัวอย่าง:

```txt
v1 = normal
v2 = normal
v3 = deleted
restore v1 -> create v4 normal
```

---

# 4. Project Structure

โครงสร้าง project หลัก:

```txt
rootidx/
├─ sql/
│  ├─ schema.sql
│  └─ drop-all.sql
│
├─ src/
│  ├─ app.js
│  ├─ server.js
│  │
│  ├─ config/
│  │  └─ config.js
│  │
│  ├─ db/
│  │  ├─ pool.js
│  │  ├─ migrate.js
│  │  └─ drop.js
│  │
│  ├─ core/
│  │  ├─ rootid-engine.js
│  │  └─ sql-builder.js
│  │
│  ├─ repositories/
│  │  └─ base-versioned.repository.js
│  │
│  ├─ services/
│  │  ├─ schema.service.js
│  │  ├─ data.service.js
│  │  ├─ form.service.js
│  │  └─ view.service.js
│  │
│  ├─ controllers/
│  │  ├─ schema.controller.js
│  │  ├─ data.controller.js
│  │  ├─ form.controller.js
│  │  └─ view.controller.js
│  │
│  ├─ routes/
│  │  ├─ index.js
│  │  ├─ schema.route.js
│  │  ├─ data.route.js
│  │  ├─ form.route.js
│  │  └─ view.route.js
│  │
│  ├─ middlewares/
│  │  ├─ error-handler.js
│  │  └─ not-found.js
│  │
│  └─ utils/
│     ├─ async-handler.js
│     └─ response.js
│
├─ docs/
│  ├─ README-ARCHITECTURE.md
│  ├─ ER-DIAGRAM.md
│  └─ API-ROUTES.md
│
├─ package.json
└─ .env
```

---

# 5. Main Tables

ระบบมี 4 table หลัก

```txt
data_schema
data
form
tableview
```

ความหมายโดยรวม:

| Table | หน้าที่ |
|---|---|
| `data_schema` | เก็บ schema/config ของข้อมูล |
| `data` | เก็บข้อมูลจริง |
| `form` | เก็บ form layout/config |
| `tableview` | เก็บ table view/display config |

ดูรายละเอียด field และ relationship ที่:

```txt
docs/ER-DIAGRAM.md
```

---

# 6. Common Version Fields

ทุก table มี field กลุ่ม versioning เหมือนกัน

| Field | ความหมาย |
|---|---|
| `id` | id ของ row/version |
| `_rootid` | object family id |
| `_prev_id` | version ก่อนหน้า |
| `_doc_version` | version number |
| `_flag` | `''` ปกติ, `'d'` deleted |
| `payload` | เนื้อหาหลักของ table |
| `_modify_datetime` | เวลาแก้ไขแบบ `YYYYMMDDHHMMSS` |
| `created_at` | เวลาสร้าง |
| `updated_at` | เวลา update |

หมายเหตุ:

```txt
_modify_datetime ใช้รูปแบบ YYYYMMDDHHMMSS
เช่น 20260514083045
```

---

# 7. Data Transfer Metadata

เฉพาะ table `data` มี field เพิ่มสำหรับ warehouse transfer

```txt
_transfer_version
_transfer_datetime
```

ความหมาย:

| Field | ความหมาย |
|---|---|
| `_transfer_version` | batch/version ของการ transfer ไป warehouse |
| `_transfer_datetime` | เวลา transfer สำเร็จแบบ `YYYYMMDDHHMMSS` |

ค่าเริ่มต้น:

```txt
_transfer_version = 0
_transfer_datetime = NULL
```

แปลว่า:

```txt
ยังไม่ transfer
```

ตัวอย่างหลัง transfer:

```txt
_transfer_version = 202605140001
_transfer_datetime = 20260514153045
```

เหตุผลที่แยก field นี้:

```txt
_modify_datetime
= เวลาเกิด version/lineage ใหม่ในระบบหลัก

_transfer_datetime
= เวลาที่ row/version นี้ถูกส่งไป warehouse

_transfer_version
= batch/version ของ warehouse sync
```

ไม่ควรเอา transfer metadata ไปปนกับ lineage metadata

---

# 8. Schema Payload Types

`data_schema.payload` ใช้กำหนด field definition ของข้อมูล

Supported types:

```txt
string
number
integer
boolean
date
datetime
yyyymmddhhmmss
yyyymmdd
hhmmss
object
array
json
```

Supported rules:

| Key | ใช้ทำอะไร |
|---|---|
| `type` | validate ชนิดข้อมูล |
| `required` | บังคับว่าต้องมี field |
| `enum` | จำกัดค่าที่อนุญาต |
| `default` | ใช้ตอน migrate/map payload ไป latest schema |
| `label` | ใช้แสดงผลใน form/tableview |

ตัวอย่าง:

```json
{
  "student_id": {
    "type": "string",
    "label": "Student ID",
    "required": true
  },
  "fname": {
    "type": "string",
    "label": "First name",
    "required": true
  },
  "age": {
    "type": "integer",
    "label": "Age",
    "default": 18
  },
  "gender": {
    "type": "string",
    "label": "Gender",
    "enum": ["male", "female", "other"]
  },
  "birth_date": {
    "type": "yyyymmdd",
    "label": "Birth Date"
  },
  "checkin_time": {
    "type": "hhmmss",
    "label": "Check-in Time"
  },
  "created_code": {
    "type": "yyyymmddhhmmss",
    "label": "Created Code"
  }
}
```

หมายเหตุ:

```txt
hhmmss แนะนำส่งเป็น string เช่น "083000"
เพราะถ้าส่งเป็น number จะเสียเลข 0 ด้านหน้า
```

---

# 9. Binding Modes

`form` และ `tableview` ผูก schema ได้ 2 แบบ

---

## 9.1 Fixed Schema Mode

ใช้ `data_schema_id`

```txt
form.data_schema_id -> data_schema.id
tableview.data_schema_id -> data_schema.id
```

ใช้กับ:

```txt
edit/replay ตาม schema version เดิม
แสดงข้อมูลตามโครงเดิม
```

---

## 9.2 Latest-root Mode

ใช้ `data_schema_rootid`

```txt
form.data_schema_rootid -> data_schema._rootid
tableview.data_schema_rootid -> data_schema._rootid
```

ใช้กับ:

```txt
follow schema ล่าสุด
render data เก่ากับ latest schema
project ข้อมูลหลาย schema version ไป schema ล่าสุด
```

---

# 10. Versioning Flow

## 10.1 Create

สร้าง version แรก

```txt
_rootid = generated UUID หรือ input.rootid
_prev_id = null
_doc_version = 1
_flag = ''
_modify_datetime = current YYYYMMDDHHMMSS
```

---

## 10.2 Update

สร้าง row ใหม่

```txt
_rootid = latest._rootid
_prev_id = latest.id
_doc_version = latest._doc_version + 1
_flag = ''
_modify_datetime = current YYYYMMDDHHMMSS
```

---

## 10.3 Delete

สร้าง row ใหม่ที่เป็น deleted version

```txt
_rootid = latest._rootid
_prev_id = latest.id
_doc_version = latest._doc_version + 1
_flag = 'd'
_modify_datetime = current YYYYMMDDHHMMSS
```

---

## 10.4 Restore

copy version เก่ากลับมาเป็น version ใหม่

```txt
_rootid = source._rootid
_prev_id = latest.id
_doc_version = latest._doc_version + 1
_flag = ''
_modify_datetime = current YYYYMMDDHHMMSS
```

---

# 11. Render Modes

## 11.1 Fixed Schema Render

ใช้กับ `tableview.data_schema_id`

```txt
renderFixedSchemaView()
```

แนวคิด:

```txt
tableview ผูก schema version เดิม
data ที่แสดงจะอิง schema version นั้น
```

---

## 11.2 Latest-root Schema Render

ใช้กับ `tableview.data_schema_rootid`

```txt
renderLatestRootSchemaView()
```

แนวคิด:

```txt
tableview ผูก schema family
ระบบ resolve latest schema
data ที่สร้างจาก schema version เก่าจะถูก project ไป latest schema
```

---

# 12. API Overview

Main API resources:

```txt
/api/schema
/api/data
/api/form
/api/view
```

รายละเอียด route ทั้งหมดอยู่ที่:

```txt
docs/API-ROUTES.md
```

หมายเหตุ:

```txt
/api/view
= external API name

ViewService
= service/controller naming

tableview
= real PostgreSQL table
```

---

# 13. Important Implementation Notes

## 13.1 Table allowlist

Core/repository allow tables:

```txt
data_schema
data
form
tableview
```

ไม่มี table ชื่อ `view`

---

## 13.2 API view vs DB tableview

```txt
/api/view
= external API name

ViewService
= service/controller naming

tableview
= real PostgreSQL table
```

---

## 13.3 ไม่ใช้ _is_active

ระบบไม่ใช้ `_is_active`

latest หาโดย:

```sql
ORDER BY _doc_version DESC, id DESC
```

deleted ตรวจจาก latest row:

```txt
_flag = 'd'
```

---

## 13.4 ไม่ใช้ PostgreSQL VIEW latest_*

ไม่สร้าง:

```txt
latest_data_schema
latest_data
latest_form
latest_tableview
```

เพราะ application/repository query latest เองด้วย CTE

---

## 13.5 ไม่ใช้ updated_at trigger

ไม่มี trigger:

```sql
CREATE TRIGGER trg_data_updated_at ...
```

ถ้าต้อง update transfer metadata ให้ update field transfer โดยตรง เช่น:

```sql
UPDATE data
SET
  _transfer_version = $1,
  _transfer_datetime = TO_CHAR(NOW(), 'YYYYMMDDHH24MISS')::BIGINT
WHERE id = ANY($2::bigint[]);
```

ไม่ต้องแก้ `_modify_datetime` เพราะ transfer metadata ไม่ใช่ lineage update

---

# 14. Dev Commands

## 14.1 Install

```bash
npm install
```

## 14.2 Start dev server with migration

```bash
npm run dev
```

## 14.3 Start dev server without migration

```bash
npm run dev:no-migrate
```

## 14.4 Run migration

```bash
npm run migrate
```

## 14.5 Drop DB objects

```bash
npm run drop
```

## 14.6 Reset DB

```bash
npm run reset-db
```

---

# 15. Suggested package.json scripts

```json
{
  "scripts": {
    "migrate": "node src/db/migrate.js",
    "drop": "node src/db/drop.js",
    "reset-db": "npm run drop && npm run migrate",
    "start": "npm run migrate && node src/server.js",
    "dev": "npm run migrate && nodemon src/server.js",
    "dev:no-migrate": "nodemon src/server.js",
    "start:no-migrate": "node src/server.js",
    "test": "echo \"No test specified\" && exit 0"
  }
}
```

---

# 16. Summary

ระบบนี้มีแกนคิดหลักดังนี้:

```txt
data_schema
= นิยาม field/type ของข้อมูล

data
= ข้อมูลจริง ผูกกับ data_schema_id เสมอ

form
= form layout ผูกได้ทั้ง schema version หรือ schema root

tableview
= table display config ผูกได้ทั้ง schema version หรือ schema root

_rootid
= object family id

_prev_id
= previous version id

_doc_version
= version number

_flag = 'd'
= deleted version

_modify_datetime
= lineage modify datetime

_transfer_version
= warehouse transfer batch/version เฉพาะ data

_transfer_datetime
= warehouse transfer datetime เฉพาะ data
```
