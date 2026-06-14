#!/usr/bin/env node
// Parse a Prisma schema → emit erd-editor v3.0.0 JSON.
// Usage: node prisma-to-erd.mjs <schema.prisma> <out.erd.json>

import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const [, , schemaPath, outPath] = process.argv;
if (!schemaPath || !outPath) {
  console.error("usage: prisma-to-erd.mjs <schema.prisma> <out.erd.json>");
  process.exit(1);
}

const src = readFileSync(schemaPath, "utf8");
const now = Date.now();

// ---- Parse Prisma ----
const enums = new Set();
const models = []; // { name, fields: [], blockAttrs: [] }

const lines = src.split("\n");
let block = null;
let blockType = null;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("///")) continue;

  if (!block) {
    let m = trimmed.match(/^model\s+(\w+)\s*\{/);
    if (m) {
      block = { name: m[1], fields: [], blockAttrs: [] };
      blockType = "model";
      continue;
    }
    m = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (m) {
      enums.add(m[1]);
      block = { name: m[1] };
      blockType = "enum";
      continue;
    }
    continue;
  }

  if (trimmed === "}") {
    if (blockType === "model") models.push(block);
    block = null;
    blockType = null;
    continue;
  }

  if (blockType === "enum") continue;

  if (trimmed.startsWith("@@")) {
    block.blockAttrs.push(trimmed);
    continue;
  }

  // Field line: name<sp>type[?|[]]<sp>@attrs...
  // Examples:
  //   id   Int   @id @default(autoincrement())
  //   email String? @unique @db.VarChar(320)
  //   user  Users @relation(fields:[userId], references:[id], onDelete:Cascade)
  //   commercialSegmentIds Int[] @default([])
  const fm = trimmed.match(/^(\w+)\s+([\w\[\]\?]+)(\s+(.*))?$/);
  if (!fm) continue;
  const name = fm[1];
  let typeRaw = fm[2];
  let attrsRaw = fm[4] || "";
  const optional = typeRaw.endsWith("?");
  let arr = false;
  if (typeRaw.endsWith("[]")) { arr = true; typeRaw = typeRaw.slice(0, -2); }
  if (optional) typeRaw = typeRaw.slice(0, -1);

  const field = {
    name,
    type: typeRaw,
    optional,
    isArray: arr,
    attrsRaw,
    isId: /@id\b/.test(attrsRaw),
    isUnique: /@unique\b/.test(attrsRaw),
    defaultMatch: attrsRaw.match(/@default\(([^)]*)\)/),
    relationMatch: attrsRaw.match(/@relation\(([^)]*)\)/),
    dbMatch: attrsRaw.match(/@db\.(\w+)(?:\(([^)]*)\))?/),
    isAutoIncrement: /@default\(autoincrement\(\)\)/.test(attrsRaw),
  };
  block.fields.push(field);
}

// Build model lookup
const modelByName = new Map(models.map(m => [m.name, m]));

// Find PK of each model (single-field @id or @@id)
const pkOf = (model) => {
  const ids = model.fields.filter(f => f.isId);
  if (ids.length) return ids.map(f => f.name);
  const compId = model.blockAttrs.find(a => a.startsWith("@@id"));
  if (compId) {
    const inside = compId.match(/@@id\(\[([^\]]+)\]/);
    if (inside) return inside[1].split(",").map(s => s.trim());
  }
  return [];
};

// Map Prisma type → SQL data type
const sqlType = (f) => {
  if (f.dbMatch) {
    const native = f.dbMatch[1];
    const args = f.dbMatch[2];
    const map = {
      VarChar: args ? `VARCHAR(${args})` : "VARCHAR",
      Text: "TEXT",
      Timestamp: args ? `TIMESTAMP(${args})` : "TIMESTAMP",
      Decimal: args ? `DECIMAL(${args})` : "DECIMAL",
      Date: "DATE",
      Char: args ? `CHAR(${args})` : "CHAR",
      Uuid: "UUID",
      Json: "JSONB",
      JsonB: "JSONB",
      Boolean: "BOOLEAN",
      Integer: "INTEGER",
      BigInt: "BIGINT",
      SmallInt: "SMALLINT",
      Real: "REAL",
      DoublePrecision: "DOUBLE PRECISION",
    };
    let base = map[native] ?? native.toUpperCase();
    if (f.isArray) base += "[]";
    return base;
  }
  const t = f.type;
  const baseMap = {
    Int: "INTEGER",
    BigInt: "BIGINT",
    Float: "DOUBLE PRECISION",
    Decimal: "DECIMAL",
    Boolean: "BOOLEAN",
    DateTime: "TIMESTAMP",
    Json: "JSONB",
    Bytes: "BYTEA",
    String: "TEXT",
  };
  let base;
  if (enums.has(t)) base = `ENUM(${t})`;
  else if (modelByName.has(t)) return null; // relation field, not a column
  else base = baseMap[t] || t.toUpperCase();
  if (f.isArray) base += "[]";
  return base;
};

// Default literal
const defaultLit = (f) => {
  if (!f.defaultMatch) return "";
  const raw = f.defaultMatch[1].trim();
  if (raw === "autoincrement()") return "";
  if (raw === "now()") return "now()";
  if (raw === "cuid()") return "cuid()";
  if (raw === "uuid()") return "uuid()";
  return raw.replace(/^"|"$/g, "");
};

// ---- Generate erd-editor entities ----
const tableEntities = {};
const tableColumnEntities = {};
const relationshipEntities = {};
const indexEntities = {};
const indexColumnEntities = {};
const tableIds = [];
const relationshipIds = [];
const indexIds = [];

// column lookup: tableName.columnName → columnId
const columnIdByPath = new Map();

// Layout: 6 columns × N rows
const COLS = 6;
const COL_W = 320;
const ROW_H = 420;
const PAD_X = 80;
const PAD_Y = 80;

// Bit values
const OPT_AUTO_INC = 1;
const OPT_PK = 2;
const OPT_UNIQUE = 4;
const OPT_NOT_NULL = 8;
const UI_KEY_PK = 1;
const UI_KEY_FK = 2;
const REL_ZERO_ONE = 2;
const REL_ZERO_N = 4;
const REL_ONE_ONE = 8;
const REL_ONE_N = 16;
const DIR_LEFT = 1;
const DIR_RIGHT = 2;
const DIR_TOP = 4;
const DIR_BOTTOM = 8;

models.forEach((model, idx) => {
  const tableId = randomUUID();
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const x = PAD_X + col * COL_W;
  const y = PAD_Y + row * ROW_H;

  const pk = new Set(pkOf(model));
  const columnIds = [];

  // Filter out pure relation fields (no scalar storage)
  const scalarFields = model.fields.filter(f => sqlType(f) !== null);

  for (const f of scalarFields) {
    const colId = randomUUID();
    const isPK = pk.has(f.name);
    let options = 0;
    if (f.isAutoIncrement) options |= OPT_AUTO_INC;
    if (isPK) options |= OPT_PK;
    if (f.isUnique) options |= OPT_UNIQUE;
    if (!f.optional || isPK) options |= OPT_NOT_NULL;

    const colEntity = {
      id: colId,
      tableId,
      name: f.name,
      comment: "",
      dataType: sqlType(f),
      default: defaultLit(f),
      options,
      ui: {
        keys: isPK ? UI_KEY_PK : 0, // FK marking set later
        widthName: Math.max(60, f.name.length * 8),
        widthComment: 60,
        widthDataType: 80,
        widthDefault: 60,
      },
      meta: { updateAt: now, createAt: now },
    };
    tableColumnEntities[colId] = colEntity;
    columnIds.push(colId);
    columnIdByPath.set(`${model.name}.${f.name}`, colId);
  }

  // Build indexes from @@index, @@unique
  for (const attr of model.blockAttrs) {
    let m = attr.match(/^@@index\(\[([^\]]+)\](?:.*?)\)/);
    let unique = false;
    if (!m) {
      m = attr.match(/^@@unique\(\[([^\]]+)\](?:.*?)\)/);
      unique = !!m;
    }
    if (!m) continue;
    const cols = m[1].split(",").map(s => s.trim());
    // skip indexes referencing PK only
    if (cols.length === 1 && pk.has(cols[0])) continue;
    const indexId = randomUUID();
    const indexColumnIdList = [];
    for (const c of cols) {
      const cid = columnIdByPath.get(`${model.name}.${c}`);
      if (!cid) continue;
      const icid = randomUUID();
      indexColumnEntities[icid] = {
        id: icid,
        indexId,
        columnId: cid,
        orderType: 1, // ASC
        meta: { updateAt: now, createAt: now },
      };
      indexColumnIdList.push(icid);
    }
    if (!indexColumnIdList.length) continue;
    indexEntities[indexId] = {
      id: indexId,
      name: `${unique ? "uq" : "ix"}_${model.name}_${cols.join("_")}`.slice(0, 60),
      tableId,
      indexColumnIds: indexColumnIdList,
      seqIndexColumnIds: [...indexColumnIdList],
      unique,
      meta: { updateAt: now, createAt: now },
    };
    indexIds.push(indexId);
  }

  tableEntities[tableId] = {
    id: tableId,
    name: model.name,
    comment: "",
    columnIds,
    seqColumnIds: [...columnIds],
    ui: {
      x, y,
      zIndex: 2,
      widthName: Math.max(80, model.name.length * 9),
      widthComment: 60,
      color: "",
    },
    meta: { updateAt: now, createAt: now },
  };
  tableIds.push(tableId);
  model._tableId = tableId;
});

// ---- Relationships ----
// For each @relation in a model with `fields:`, link local FK columns → referenced table's columns
for (const model of models) {
  for (const f of model.fields) {
    if (!f.relationMatch) continue;
    const rel = f.relationMatch[1];
    // fields:[a,b], references:[x,y]
    const fm = rel.match(/fields:\s*\[([^\]]+)\]/);
    const rm = rel.match(/references:\s*\[([^\]]+)\]/);
    if (!fm || !rm) continue;
    const localCols = fm[1].split(",").map(s => s.trim());
    const remoteCols = rm[1].split(",").map(s => s.trim());
    const remoteModelName = f.type;
    const remoteModel = modelByName.get(remoteModelName);
    if (!remoteModel) continue;

    const startTableId = remoteModel._tableId; // parent (PK side)
    const endTableId = model._tableId; // child (FK side)
    const startColumnIds = remoteCols
      .map(c => columnIdByPath.get(`${remoteModelName}.${c}`))
      .filter(Boolean);
    const endColumnIds = localCols
      .map(c => columnIdByPath.get(`${model.name}.${c}`))
      .filter(Boolean);
    if (!startColumnIds.length || !endColumnIds.length) continue;

    // Mark FK columns visually
    for (const cid of endColumnIds) {
      if (tableColumnEntities[cid]) {
        const curKeys = tableColumnEntities[cid].ui.keys || 0;
        tableColumnEntities[cid].ui.keys = curKeys | UI_KEY_FK;
      }
    }

    // Determine cardinality
    const localPk = new Set(pkOf(model));
    const allLocalArePk = localCols.every(c => localPk.has(c));
    const localOptional = localCols.every(c => {
      const lf = model.fields.find(x => x.name === c);
      return lf && lf.optional;
    });
    // Parent → Child: 1 to (N or 1)
    // If child FK is unique or composite PK on FK only → 1:1
    const childFkUnique = model.fields.some(x =>
      localCols.length === 1 && x.name === localCols[0] && x.isUnique
    ) || allLocalArePk;
    const relType = childFkUnique
      ? (localOptional ? REL_ZERO_ONE : REL_ONE_ONE)
      : (localOptional ? REL_ZERO_N : REL_ONE_N);

    const relId = randomUUID();
    relationshipEntities[relId] = {
      id: relId,
      identification: allLocalArePk,
      relationshipType: relType,
      startRelationshipType: 2, // dash by default
      start: {
        tableId: startTableId,
        columnIds: startColumnIds,
        x: 0, y: 0,
        direction: DIR_RIGHT,
      },
      end: {
        tableId: endTableId,
        columnIds: endColumnIds,
        x: 0, y: 0,
        direction: DIR_LEFT,
      },
      meta: { updateAt: now, createAt: now },
    };
    relationshipIds.push(relId);
  }
}

// ---- Settings ----
// show bits: tableComment(1) | columnComment(2) | columnDataType(4) | columnDefault(8) |
//            columnAutoIncrement(16) | columnPrimaryKey(32) | columnUnique(64) | columnNotNull(128) | relationship(256)
const SHOW = 4 | 32 | 64 | 128 | 256;
// database: PostgreSQL = 16
const DB_PG = 16;

const out = {
  $schema: "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",
  version: "3.0.0",
  settings: {
    width: 4000,
    height: 4000,
    scrollTop: 0,
    scrollLeft: 0,
    zoomLevel: 1,
    show: SHOW,
    database: DB_PG,
    databaseName: "mygrowthplus",
    canvasType: "ERD",
    language: 16, // TypeScript
    tableNameCase: 4, // pascalCase
    columnNameCase: 2, // camelCase
    bracketType: 2, // doubleQuote
    relationshipDataTypeSync: true,
    relationshipOptimization: true,
    columnOrder: [1, 2, 4, 8, 16, 32, 64],
    maxWidthComment: -1,
  },
  doc: {
    tableIds,
    relationshipIds,
    indexIds,
    memoIds: [],
  },
  collections: {
    tableEntities,
    tableColumnEntities,
    relationshipEntities,
    indexEntities,
    indexColumnEntities,
    memoEntities: {},
  },
};

writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${models.length} tables, ${Object.keys(tableColumnEntities).length} columns, ${relationshipIds.length} relationships, ${indexIds.length} indexes to ${outPath}`);
