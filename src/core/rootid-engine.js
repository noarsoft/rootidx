// src/core/rootid-engine.js
// -----------------------------------------------------------------------------
// Root-ID versioned object engine
//
// หลักการ:
// - ทุก table เป็น versioned object
// - ไม่มี _is_active
// - latest/current = ORDER BY _doc_version DESC, id DESC
// - deleted = latest row มี _flag = 'd'
// - delete = insert version ใหม่ _flag='d'
// - restore = copy old version เป็น new version
//
// ใช้ได้กับ table:
// - data_schema
// - data
// - form
// - tableview
//
// หมายเหตุ:
// - _modify_datetime ใช้รูปแบบ YYYYMMDDHHMMSS เป็น BIGINT
//   เช่น 20260514083045
// -----------------------------------------------------------------------------

const crypto = require("node:crypto");

const ALLOWED_TABLES = new Set([
  "business",
  "data_schema",
  "data",
  "form",
  "tableview",
]);

const SYSTEM_FIELDS = new Set([
  "id",
  "_rootid",
  "_prev_id",
  "_doc_version",
  "_flag",
  "_transfer_version",
  "_modify_datetime",
  "created_at",
  "updated_at",
]);

const FLAG_NORMAL = "";
const FLAG_DELETED = "d";
const FLAG_UPDATED = "u";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function nowYmdHmsNumber() {
  const d = new Date();

  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  return Number(`${yyyy}${mm}${dd}${hh}${mi}${ss}`);
}

function newRootId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString("hex");
}

function assertAllowedTable(table) {
  if (!ALLOWED_TABLES.has(table)) {
    const err = new Error(`Table is not allowed: ${table}`);
    err.code = "TABLE_NOT_ALLOWED";
    throw err;
  }
}

function quoteIdent(identifier) {
  const s = String(identifier);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    const err = new Error(`Unsafe SQL identifier: ${identifier}`);
    err.code = "UNSAFE_SQL_IDENTIFIER";
    throw err;
  }

  return `"${s.replace(/"/g, '""')}"`;
}

function tableIdent(table) {
  assertAllowedTable(table);
  return quoteIdent(table);
}

function normalizeFlag(flag) {
  if (flag == null) return FLAG_NORMAL;

  if (flag !== FLAG_NORMAL && flag !== FLAG_UPDATED && flag !== FLAG_DELETED) {
    const err = new Error(`Invalid _flag: ${flag}`);
    err.code = "INVALID_FLAG";
    throw err;
  }

  return flag;
}

function assertPlainObject(value, label = "value") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error(`${label} must be a plain object`);
    err.code = "INVALID_OBJECT";
    throw err;
  }
}

function assertCreateFlagAllowed(input) {
  if (!input || !Object.prototype.hasOwnProperty.call(input, "_flag")) {
    return;
  }

  if (input._flag !== FLAG_NORMAL) {
    const err = new Error("Create does not allow _flag except empty string");
    err.code = "CREATE_FLAG_NOT_ALLOWED";
    throw err;
  }
}

function stripSystemFields(input) {
  const out = {};

  for (const [key, value] of Object.entries(input || {})) {
    if (SYSTEM_FIELDS.has(key)) continue;
    out[key] = value;
  }

  return out;
}

function buildInsert(table, row) {
  const keys = Object.keys(row);

  if (keys.length === 0) {
    const err = new Error("Cannot insert empty row");
    err.code = "EMPTY_INSERT";
    throw err;
  }

  const cols = keys.map(quoteIdent).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((key) => row[key]);

  const sql = `
    INSERT INTO ${tableIdent(table)} (${cols})
    VALUES (${placeholders})
    RETURNING *
  `;

  return { sql, values };
}

async function queryOne(db, sql, values = []) {
  const result = await db.query(sql, values);
  return result.rows[0] || null;
}

async function queryMany(db, sql, values = []) {
  const result = await db.query(sql, values);
  return result.rows;
}

async function getById(db, table, id) {
  assertAllowedTable(table);

  return queryOne(
    db,
    `
      SELECT *
      FROM ${tableIdent(table)}
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
}

async function getLatestByRootId(db, table, rootid, options = {}) {
  assertAllowedTable(table);

  const includeDeleted = Boolean(options.includeDeleted);

  const latest = await queryOne(
    db,
    `
      SELECT *
      FROM ${tableIdent(table)}
      WHERE _rootid = $1
      ORDER BY _doc_version DESC, id DESC
      LIMIT 1
    `,
    [rootid]
  );

  if (!latest) return null;

  if (!includeDeleted && latest._flag === FLAG_DELETED) {
    return null;
  }

  return latest;
}

async function getHistory(db, table, rootid) {
  assertAllowedTable(table);

  return queryMany(
    db,
    `
      SELECT *
      FROM ${tableIdent(table)}
      WHERE _rootid = $1
      ORDER BY _doc_version ASC, id ASC
    `,
    [rootid]
  );
}

async function listLatest(db, table, options = {}) {
  assertAllowedTable(table);

  const includeDeleted = Boolean(options.includeDeleted);

  const limit = Number.isInteger(Number(options.limit))
    ? Math.max(1, Math.min(Number(options.limit), 1000))
    : 100;

  const offset = Number.isInteger(Number(options.offset))
    ? Math.max(0, Number(options.offset))
    : 0;

  const whereDeleted = includeDeleted ? "TRUE" : `_flag <> '${FLAG_DELETED}'`;

  return queryMany(
    db,
    `
      WITH latest AS (
        SELECT DISTINCT ON (_rootid) *
        FROM ${tableIdent(table)}
        ORDER BY _rootid, _doc_version DESC, id DESC
      )
      SELECT *
      FROM latest
      WHERE ${whereDeleted}
      ORDER BY updated_at DESC, id DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
}

async function createRoot(db, table, input = {}) {
  assertAllowedTable(table);
  assertPlainObject(input, "input");
  assertCreateFlagAllowed(input);

  const clean = stripSystemFields(input);

  const row = {
    _rootid: input.rootid || newRootId(),
    _prev_id: null,
    _doc_version: 1,
    _flag: FLAG_NORMAL,
    ...clean,
    _modify_datetime: nowYmdHmsNumber(),
  };

  // ไม่ให้ rootid กลายเป็น column แปลก ๆ
  delete row.rootid;

  const { sql, values } = buildInsert(table, row);
  return queryOne(db, sql, values);
}

async function createNextVersion(db, table, rootid, patch = {}, options = {}) {
  assertAllowedTable(table);
  assertPlainObject(patch, "patch");

  const latest = await getLatestByRootId(db, table, rootid, {
    includeDeleted: Boolean(options.allowFromDeleted),
  });

  if (!latest) {
    const err = new Error(`Latest object not found: ${rootid}`);
    err.code = "LATEST_NOT_FOUND";
    throw err;
  }

  if (latest._flag === FLAG_DELETED && !options.allowFromDeleted) {
    const err = new Error(`Cannot update deleted object: ${rootid}`);
    err.code = "CANNOT_UPDATE_DELETED_OBJECT";
    throw err;
  }

  const cleanPatch = stripSystemFields(patch);

  const nextFlag = normalizeFlag(
    Object.prototype.hasOwnProperty.call(options, "flag")
      ? options.flag
      : FLAG_NORMAL
  );

  const base = stripSystemFields(latest);

  const row = {
    ...base,
    ...cleanPatch,

    _rootid: latest._rootid,
    _prev_id: latest.id,
    _doc_version: Number(latest._doc_version) + 1,
    _flag: nextFlag,
    _modify_datetime: nowYmdHmsNumber(),
  };

  const { sql, values } = buildInsert(table, row);
  return queryOne(db, sql, values);
}

async function softDeleteByRootId(db, table, rootid) {
  assertAllowedTable(table);

  const latest = await getLatestByRootId(db, table, rootid, {
    includeDeleted: true,
  });

  if (!latest) {
    const err = new Error(`Object not found: ${rootid}`);
    err.code = "OBJECT_NOT_FOUND";
    throw err;
  }

  if (latest._flag === FLAG_DELETED) {
    const err = new Error(`Object already deleted: ${rootid}`);
    err.code = "OBJECT_ALREADY_DELETED";
    throw err;
  }

  const base = stripSystemFields(latest);

  const row = {
    ...base,

    _rootid: latest._rootid,
    _prev_id: latest.id,
    _doc_version: Number(latest._doc_version) + 1,
    _flag: FLAG_DELETED,
    _modify_datetime: nowYmdHmsNumber(),
  };

  const { sql, values } = buildInsert(table, row);
  return queryOne(db, sql, values);
}

async function restoreVersion(db, table, restoreId) {
  assertAllowedTable(table);

  const source = await getById(db, table, restoreId);

  if (!source) {
    const err = new Error(`Restore source not found: ${restoreId}`);
    err.code = "RESTORE_SOURCE_NOT_FOUND";
    throw err;
  }

  if (source._flag === FLAG_DELETED) {
    const err = new Error("Cannot restore from deleted version");
    err.code = "CANNOT_RESTORE_FROM_DELETED_VERSION";
    throw err;
  }

  const latest = await getLatestByRootId(db, table, source._rootid, {
    includeDeleted: true,
  });

  if (!latest) {
    const err = new Error(`Latest object not found: ${source._rootid}`);
    err.code = "LATEST_NOT_FOUND";
    throw err;
  }

  const base = stripSystemFields(source);

  const row = {
    ...base,

    _rootid: source._rootid,
    _prev_id: latest.id,
    _doc_version: Number(latest._doc_version) + 1,
    _flag: FLAG_NORMAL,
    _modify_datetime: nowYmdHmsNumber(),
  };

  const { sql, values } = buildInsert(table, row);
  return queryOne(db, sql, values);
}

async function isDeleted(db, table, rootid) {
  const latest = await getLatestByRootId(db, table, rootid, {
    includeDeleted: true,
  });

  if (!latest) return false;
  return latest._flag === FLAG_DELETED;
}

async function getLatestSchemaByRootId(db, schemaRootId, options = {}) {
  return getLatestByRootId(db, "data_schema", schemaRootId, options);
}

async function getSchemaRootIdBySchemaId(db, dataSchemaId) {
  const schema = await getById(db, "data_schema", dataSchemaId);

  if (!schema) {
    const err = new Error(`Schema not found: ${dataSchemaId}`);
    err.code = "SCHEMA_NOT_FOUND";
    throw err;
  }

  return schema._rootid;
}

async function getLatestSchemaFromSchemaId(db, dataSchemaId, options = {}) {
  const schemaRootId = await getSchemaRootIdBySchemaId(db, dataSchemaId);
  return getLatestSchemaByRootId(db, schemaRootId, options);
}

module.exports = {
  FLAG_NORMAL,
  FLAG_DELETED,
  FLAG_UPDATED,

  SYSTEM_FIELDS,
  ALLOWED_TABLES,

  nowYmdHmsNumber,
  newRootId,
  quoteIdent,
  tableIdent,

  getById,
  getLatestByRootId,
  getHistory,
  listLatest,

  createRoot,
  createNextVersion,
  softDeleteByRootId,
  restoreVersion,
  isDeleted,

  getLatestSchemaByRootId,
  getSchemaRootIdBySchemaId,
  getLatestSchemaFromSchemaId,
};