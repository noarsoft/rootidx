-- sql/schema.sql
-- Root-ID Figma Prototype Backend
--
-- หลักการ:
-- - ทุก table เป็น Root-ID versioned object
-- - ไม่มี _is_active
-- - current/latest = ORDER BY _doc_version DESC, id DESC
-- - deleted = latest row มี _flag = 'd'
-- - restore = copy old version เป็น new version
--
-- Table หลัก:
-- 1. data_schema
-- 2. data
-- 3. form
-- 4. tableview
--
-- หมายเหตุ:
-- - _modify_datetime ใช้รูปแบบ YYYYMMDDHHMMSS เป็น BIGINT
--   เช่น 20260514083045
-- - ไม่ใช้ PostgreSQL VIEW latest_*
-- - ไม่ใช้ updated_at trigger
-- - data มี field สำหรับ warehouse transfer:
--   - _transfer_version
--   - _transfer_datetime

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =====================================================
-- data_schema
-- เก็บ schema/config ของข้อมูล
-- =====================================================

CREATE TABLE IF NOT EXISTS data_schema (
  id BIGSERIAL PRIMARY KEY,

  _rootid TEXT NOT NULL,
  _prev_id BIGINT NULL REFERENCES data_schema(id),
  _doc_version INTEGER NOT NULL DEFAULT 1,
  _flag TEXT NOT NULL DEFAULT '',

  name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  _modify_datetime BIGINT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYYMMDDHH24MISS')::BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT data_schema_doc_version_positive
    CHECK (_doc_version >= 1),

  CONSTRAINT data_schema_flag_allowed
    CHECK (_flag IN ('', 'd'))
);

CREATE INDEX IF NOT EXISTS idx_data_schema_rootid
  ON data_schema (_rootid);

CREATE INDEX IF NOT EXISTS idx_data_schema_latest
  ON data_schema (_rootid, _doc_version DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_data_schema_flag
  ON data_schema (_flag);

CREATE INDEX IF NOT EXISTS idx_data_schema_name
  ON data_schema (name);

CREATE INDEX IF NOT EXISTS idx_data_schema_payload_gin
  ON data_schema USING GIN (payload);


-- =====================================================
-- data
-- เก็บข้อมูลจริง
--
-- data_schema_id:
--   FK ไปยัง data_schema.id
--   หมายถึง data row นี้ถูกสร้างจาก schema version ไหน
--
-- _transfer_version:
--   version/batch ของการ transfer ไป warehouse
--   0 = ยังไม่ transfer
--
-- _transfer_datetime:
--   เวลา transfer สำเร็จ รูปแบบ YYYYMMDDHHMMSS
--   NULL = ยังไม่ transfer
-- =====================================================

CREATE TABLE IF NOT EXISTS data (
  id BIGSERIAL PRIMARY KEY,

  _rootid TEXT NOT NULL,
  _prev_id BIGINT NULL REFERENCES data(id),
  _doc_version INTEGER NOT NULL DEFAULT 1,
  _flag TEXT NOT NULL DEFAULT '',

  _transfer_version BIGINT NOT NULL DEFAULT 0,
  _transfer_datetime BIGINT NULL,

  data_schema_id BIGINT NOT NULL REFERENCES data_schema(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  _modify_datetime BIGINT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYYMMDDHH24MISS')::BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT data_doc_version_positive
    CHECK (_doc_version >= 1),

  CONSTRAINT data_flag_allowed
    CHECK (_flag IN ('', 'd')),

  CONSTRAINT data_transfer_version_non_negative
    CHECK (_transfer_version >= 0)
);

CREATE INDEX IF NOT EXISTS idx_data_rootid
  ON data (_rootid);

CREATE INDEX IF NOT EXISTS idx_data_latest
  ON data (_rootid, _doc_version DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_data_schema_id
  ON data (data_schema_id);

CREATE INDEX IF NOT EXISTS idx_data_flag
  ON data (_flag);

CREATE INDEX IF NOT EXISTS idx_data_transfer_version
  ON data (_transfer_version);

CREATE INDEX IF NOT EXISTS idx_data_transfer_datetime
  ON data (_transfer_datetime);

CREATE INDEX IF NOT EXISTS idx_data_transfer_pending
  ON data (_transfer_version, _transfer_datetime);

CREATE INDEX IF NOT EXISTS idx_data_payload_gin
  ON data USING GIN (payload);


-- =====================================================
-- form
-- เก็บ form config / form layout
--
-- data_schema_id:
--   fixed/edit/replay mode
--   form นี้ออกแบบจาก schema version ไหน
--
-- data_schema_rootid:
--   optional latest-root/migrate mode
--   ใช้ตอนต้องการผูกกับ schema family แล้ว resolve latest
-- =====================================================

CREATE TABLE IF NOT EXISTS form (
  id BIGSERIAL PRIMARY KEY,

  _rootid TEXT NOT NULL,
  _prev_id BIGINT NULL REFERENCES form(id),
  _doc_version INTEGER NOT NULL DEFAULT 1,
  _flag TEXT NOT NULL DEFAULT '',

  data_schema_id BIGINT NULL REFERENCES data_schema(id),
  data_schema_rootid TEXT NULL,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  _modify_datetime BIGINT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYYMMDDHH24MISS')::BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT form_doc_version_positive
    CHECK (_doc_version >= 1),

  CONSTRAINT form_flag_allowed
    CHECK (_flag IN ('', 'd')),

  CONSTRAINT form_schema_binding_required
    CHECK (
      data_schema_id IS NOT NULL
      OR data_schema_rootid IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_form_rootid
  ON form (_rootid);

CREATE INDEX IF NOT EXISTS idx_form_latest
  ON form (_rootid, _doc_version DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_form_data_schema_id
  ON form (data_schema_id);

CREATE INDEX IF NOT EXISTS idx_form_data_schema_rootid
  ON form (data_schema_rootid);

CREATE INDEX IF NOT EXISTS idx_form_flag
  ON form (_flag);

CREATE INDEX IF NOT EXISTS idx_form_payload_gin
  ON form USING GIN (payload);


-- =====================================================
-- tableview
-- เก็บ table view config / display config
--
-- data_schema_id:
--   fixed/edit/replay mode
--   tableview นี้ออกแบบจาก schema version ไหน
--
-- data_schema_rootid:
--   latest-root table view
--   ใช้แสดง data หลาย schema version โดยยึด schema ล่าสุด
-- =====================================================

CREATE TABLE IF NOT EXISTS tableview (
  id BIGSERIAL PRIMARY KEY,

  _rootid TEXT NOT NULL,
  _prev_id BIGINT NULL REFERENCES tableview(id),
  _doc_version INTEGER NOT NULL DEFAULT 1,
  _flag TEXT NOT NULL DEFAULT '',

  data_schema_id BIGINT NULL REFERENCES data_schema(id),
  data_schema_rootid TEXT NULL,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  _modify_datetime BIGINT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYYMMDDHH24MISS')::BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tableview_doc_version_positive
    CHECK (_doc_version >= 1),

  CONSTRAINT tableview_flag_allowed
    CHECK (_flag IN ('', 'd')),

  CONSTRAINT tableview_schema_binding_required
    CHECK (
      data_schema_id IS NOT NULL
      OR data_schema_rootid IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_tableview_rootid
  ON tableview (_rootid);

CREATE INDEX IF NOT EXISTS idx_tableview_latest
  ON tableview (_rootid, _doc_version DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tableview_data_schema_id
  ON tableview (data_schema_id);

CREATE INDEX IF NOT EXISTS idx_tableview_data_schema_rootid
  ON tableview (data_schema_rootid);

CREATE INDEX IF NOT EXISTS idx_tableview_flag
  ON tableview (_flag);

CREATE INDEX IF NOT EXISTS idx_tableview_payload_gin
  ON tableview USING GIN (payload);