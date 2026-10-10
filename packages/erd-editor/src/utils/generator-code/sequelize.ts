import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import {
  autoName,
  Name,
  orderByNameASC,
  referentialActionSupport,
} from '@/utils/schema-sql/utils';

import {
  ColumnScalar,
  ColumnType as ColumnFacts,
  getColumnType as getColumnFacts,
  isMySQLFamily,
} from './columnTypes';
import {
  FormatColumnOptions,
  FormatRelationOptions,
  FormatTableOptions,
  getDataTypeHints,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
  referentialActionEntries,
} from './utils';

const SEQUELIZE_NAMES = [
  'CreationOptional',
  'DataTypes',
  'InferAttributes',
  'InferCreationAttributes',
  'Model',
  'NonAttribute',
  'Range',
  'Sequelize',
  'sequelize',
] as const;

const GLOBAL_NAMES = [
  'Buffer',
  'Date',
  'Float32Array',
  'Float64Array',
  'Int8Array',
  'Uint8Array',
] as const;

/**
 * Names a property may not take: what Model and its Hooks declare, the fields
 * Sequelize sets on an instance or a model's prototype, what every object
 * inherits, and prototype, a key lodash leaves out of the copies it makes.
 */
const MODEL_MEMBER_NAMES: ReadonlyArray<string> = [
  '_attributes',
  '_changed',
  '_creationAttributes',
  '_customGetters',
  '_customSetters',
  '_hasCustomGetters',
  '_hasCustomSetters',
  '_initValues',
  '_isAttribute',
  '_model',
  '_options',
  '_previousDataValues',
  '_setInclude',
  '_setupHooks',
  'addHook',
  'changed',
  'dataValues',
  'decrement',
  'destroy',
  'equals',
  'equalsOneOf',
  'get',
  'getDataValue',
  'hasHook',
  'hasHooks',
  'increment',
  'isNewRecord',
  'isSoftDeleted',
  'previous',
  'prototype',
  'rawAttributes',
  'reload',
  'removeHook',
  'restore',
  'runHooks',
  'save',
  'sequelize',
  'set',
  'setAttributes',
  'setDataValue',
  'setValidators',
  'toJSON',
  'uniqno',
  'update',
  'validate',
  'validators',
  'where',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  '__proto__',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
];

type SequelizeName = (typeof SEQUELIZE_NAMES)[number];

const MODULE_SCOPE_NAMES: ReadonlySet<string> = new Set<string>([
  ...SEQUELIZE_NAMES,
  ...GLOBAL_NAMES,
]);

const TYPES: SequelizeName = 'DataTypes';
const MODEL: SequelizeName = 'Model';
const NAMESPACE: SequelizeName = 'Sequelize';
const INSTANCE: SequelizeName = 'sequelize';

function wrap(name: SequelizeName, inner: string): string {
  return `${name}<${inner}>`;
}

const LINE_LIMIT = 80;
const INDENT = '  ';
const OWNING = 'owning';
const INVERSE = 'inverse';

type RelationshipSide = typeof OWNING | typeof INVERSE;

type Entry = string | { prefix: string; group: Group; suffix: string };

type Group = {
  open: '[' | '{';
  entries: Entry[];
};

type Emission = {
  expr: string;
  ts: string;
  args: 'none' | 'length' | 'precision';
};

type SequelizeType = {
  expr: string;
  ts: string;
};

type ColumnFlags = {
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isWrittenByDatabase: boolean;
};

type ResolvedRelationship = {
  relationship: Relationship;
  startTable: Table;
  endTable: Table;
  startColumns: Column[];
  endColumns: Column[];
};

type TableNaming = {
  className: string;
  columnIds: string[];
  columnNames: Map<string, string>;
  relationshipNames: Map<string, string>;
};

type ModelContext = {
  indexNames: Map<string, string>;
  relationships: ResolvedRelationship[];
  namings: Map<string, TableNaming>;
  classNames: Set<string>;
};

type ColumnContext = {
  property: string;
  type: SequelizeType;
  flags: ColumnFlags;
};

const CHAR = `${TYPES}.CHAR`;
const STRING = `${TYPES}.STRING`;
const BIGINT = `${TYPES}.BIGINT`;
const DECIMAL = `${TYPES}.DECIMAL`;
const DATE_TIME = `${TYPES}.DATE`;
const FLOAT = `${TYPES}.FLOAT`;
const DOUBLE = `${TYPES}.DOUBLE`;

const VENDOR_TYPES: ReadonlyArray<[string[], Emission]> = [
  [
    [
      'bpchar',
      'char',
      'character',
      'national char',
      'national character',
      'native character',
      'nchar',
    ],
    { expr: CHAR, ts: 'string', args: 'length' },
  ],
  [['text'], { expr: `${TYPES}.TEXT`, ts: 'string', args: 'none' }],
  [['tinytext'], { expr: `${TYPES}.TEXT("tiny")`, ts: 'string', args: 'none' }],
  [
    ['mediumtext'],
    { expr: `${TYPES}.TEXT("medium")`, ts: 'string', args: 'none' },
  ],
  [['longtext'], { expr: `${TYPES}.TEXT("long")`, ts: 'string', args: 'none' }],
  [['tinyblob'], { expr: `${TYPES}.BLOB("tiny")`, ts: 'Buffer', args: 'none' }],
  [
    ['mediumblob'],
    { expr: `${TYPES}.BLOB("medium")`, ts: 'Buffer', args: 'none' },
  ],
  [['longblob'], { expr: `${TYPES}.BLOB("long")`, ts: 'Buffer', args: 'none' }],
  [
    ['byte', 'int1', 'tinyint'],
    { expr: `${TYPES}.TINYINT`, ts: 'number', args: 'none' },
  ],
  [
    ['int2', 'serial2', 'short', 'smallint', 'smallserial'],
    { expr: `${TYPES}.SMALLINT`, ts: 'number', args: 'none' },
  ],
  [
    ['int3', 'mediumint', 'middleint'],
    { expr: `${TYPES}.MEDIUMINT`, ts: 'number', args: 'none' },
  ],
  [
    ['dec', 'decimal', 'fixed', 'number', 'numeric'],
    { expr: DECIMAL, ts: 'string', args: 'precision' },
  ],
  [
    ['uniqueidentifier', 'uuid'],
    { expr: `${TYPES}.UUID`, ts: 'string', args: 'none' },
  ],
  [['json'], { expr: `${TYPES}.JSON`, ts: 'unknown', args: 'none' }],
  [['jsonb'], { expr: `${TYPES}.JSONB`, ts: 'unknown', args: 'none' }],
  [['cidr'], { expr: `${TYPES}.CIDR`, ts: 'string', args: 'none' }],
  [['inet'], { expr: `${TYPES}.INET`, ts: 'string', args: 'none' }],
  [['macaddr'], { expr: `${TYPES}.MACADDR`, ts: 'string', args: 'none' }],
  [['tsvector'], { expr: `${TYPES}.TSVECTOR`, ts: 'string', args: 'none' }],
];

const BLOB: Emission = { expr: `${TYPES}.BLOB`, ts: 'Buffer', args: 'none' };

const NUMERIC_EXPRESSIONS: ReadonlySet<string> = new Set([
  BIGINT,
  DECIMAL,
  DOUBLE,
  FLOAT,
  `${TYPES}.INTEGER`,
  `${TYPES}.MEDIUMINT`,
  `${TYPES}.SMALLINT`,
  `${TYPES}.TINYINT`,
]);

const vendorTypeMap: ReadonlyMap<string, Emission> = new Map(
  VENDOR_TYPES.flatMap(([names, emission]) =>
    names.map((name): [string, Emission] => [name, emission])
  )
);

const fallbackTypeMap: Record<PrimitiveType, Emission> = {
  int: { expr: `${TYPES}.INTEGER`, ts: 'number', args: 'none' },
  long: { expr: BIGINT, ts: 'string', args: 'none' },
  float: { expr: FLOAT, ts: 'number', args: 'none' },
  double: { expr: DOUBLE, ts: 'number', args: 'none' },
  decimal: { expr: DECIMAL, ts: 'string', args: 'precision' },
  boolean: { expr: `${TYPES}.BOOLEAN`, ts: 'boolean', args: 'none' },
  string: { expr: STRING, ts: 'string', args: 'length' },
  lob: { expr: `${TYPES}.TEXT`, ts: 'string', args: 'none' },
  date: { expr: `${TYPES}.DATEONLY`, ts: 'string', args: 'none' },
  dateTime: { expr: DATE_TIME, ts: 'Date', args: 'none' },
  time: { expr: `${TYPES}.TIME`, ts: 'string', args: 'none' },
};

// What each driver hands a value of the scalar over as, under Sequelize.
const SCALAR_ANNOTATIONS: Readonly<Record<ColumnScalar, string>> = {
  bool: 'boolean',
  i8: 'number',
  i16: 'number',
  i32: 'number',
  i64: 'string',
  u8: 'number',
  u16: 'number',
  u32: 'number',
  u64: 'string',
  f32: 'number',
  f64: 'number',
  decimal: 'string',
  string: 'string',
  bytes: 'Buffer',
  uuid: 'string',
  json: 'unknown',
  date: 'string',
  time: 'string',
  timeTz: 'string',
  dateTime: 'Date',
  dateTimeUtc: 'Date',
  dateTimeOffset: 'Date',
  interval: 'string',
};

// mysql2 and the mariadb connector hand a BIGINT over as a number while it is
// a safe integer and as a string past that; sqlite3 always as a number.
const BIGINT_ANNOTATIONS: ReadonlyMap<number, string> = new Map([
  [Database.MariaDB, 'number | string'],
  [Database.MySQL, 'number | string'],
  [Database.SQLite, 'number'],
]);

// tedious and sqlite3 hand a decimal over as a number, the mariadb connector
// as one while it is safe; pg and mysql2 as text.
const DECIMAL_ANNOTATIONS: ReadonlyMap<number, string> = new Map([
  [Database.MariaDB, 'number | string'],
  [Database.MSSQL, 'number'],
  [Database.SQLite, 'number'],
]);

// The listed names a DataTypes member creates unchanged on each dialect. Any
// other listed name goes in as a string, which Sequelize puts in its DDL as
// is, since the nearest member would create another type.
const POSTGRES_MEMBER_TYPES: ReadonlySet<string> = new Set([
  'bigint',
  'bigserial',
  'bool',
  'boolean',
  'bpchar',
  'bytea',
  'char',
  'character',
  'character varying',
  'cidr',
  'date',
  'dec',
  'decimal',
  'double precision',
  'float',
  'float4',
  'float8',
  'inet',
  'int',
  'int2',
  'int4',
  'int8',
  'integer',
  'json',
  'jsonb',
  'macaddr',
  'numeric',
  'real',
  'serial',
  'serial2',
  'serial4',
  'serial8',
  'smallint',
  'smallserial',
  'text',
  'time',
  'time without time zone',
  'timestamp with time zone',
  'timestamptz',
  'tsvector',
  'uuid',
  'varchar',
]);

const MYSQL_MEMBER_TYPES: ReadonlySet<string> = new Set([
  'bigint',
  'blob',
  'bool',
  'boolean',
  'char',
  'char varying',
  'character',
  'character varying',
  'date',
  'datetime',
  'dec',
  'decimal',
  'double',
  'double precision',
  'enum',
  'fixed',
  'float',
  'float4',
  'float8',
  'int',
  'int1',
  'int2',
  'int3',
  'int4',
  'int8',
  'integer',
  'json',
  'longblob',
  'longtext',
  'mediumblob',
  'mediumint',
  'mediumtext',
  'middleint',
  'national char',
  'national char varying',
  'national character',
  'national character varying',
  'national varchar',
  'national varcharacter',
  'nchar',
  'nchar varchar',
  'nchar varcharacter',
  'nchar varying',
  'numeric',
  'nvarchar',
  'real',
  'serial',
  'smallint',
  'text',
  'time',
  'tinyblob',
  'tinyint',
  'tinytext',
  'varchar',
  'varcharacter',
]);

const MSSQL_MEMBER_TYPES: ReadonlySet<string> = new Set([
  'bigint',
  'bit',
  'char',
  'character',
  'date',
  'dec',
  'decimal',
  'double precision',
  'float',
  'int',
  'integer',
  'national char varying',
  'national character varying',
  'numeric',
  'nvarchar',
  'real',
  'smallint',
  'tinyint',
  'varbinary',
]);

const MEMBER_TYPES: ReadonlyMap<number, ReadonlySet<string>> = new Map([
  [Database.MariaDB, MYSQL_MEMBER_TYPES],
  [Database.MSSQL, MSSQL_MEMBER_TYPES],
  [Database.MySQL, MYSQL_MEMBER_TYPES],
  [Database.PostgreSQL, POSTGRES_MEMBER_TYPES],
]);

// Sequelize's RANGE takes these subtypes; pg hands an int8range's or a
// numrange's bounds over as text and a tsrange's as a Date.
const POSTGRES_RANGE_TYPES: ReadonlyMap<string, [string | null, string]> =
  new Map([
    ['daterange', [`${TYPES}.DATEONLY`, 'string']],
    ['int4range', [`${TYPES}.INTEGER`, 'number']],
    ['int8range', [BIGINT, 'string']],
    ['numrange', [DECIMAL, 'string']],
    ['tsrange', [null, 'Date']],
    ['tstzrange', [DATE_TIME, 'Date']],
  ]);

// pg parses a point and a circle into objects, an interval into its fields.
const POSTGRES_OBJECT_TYPES: ReadonlySet<string> = new Set(['circle', 'point']);

// pg hands an array of these over as one string, which it parses no further.
const POSTGRES_TEXT_ARRAY_TYPES: ReadonlySet<string> = new Set([
  'bit',
  'bit varying',
  'box',
  'cid',
  'circle',
  'datemultirange',
  'int4multirange',
  'int8multirange',
  'jsonpath',
  'line',
  'lseg',
  'macaddr8',
  'name',
  'nummultirange',
  'path',
  'pg_lsn',
  'pg_snapshot',
  'polygon',
  'regclass',
  'regcollation',
  'regconfig',
  'regdictionary',
  'regnamespace',
  'regoper',
  'regoperator',
  'regprocedure',
  'regrole',
  'regtype',
  'tid',
  'tsmultirange',
  'tsquery',
  'tstzmultirange',
  'tsvector',
  'txid_snapshot',
  'varbit',
  'xid',
  'xid8',
  'xml',
]);

// The member of these writes the type bare, losing a time's precision, and a
// MySQL BLOB's or TEXT's length, by which MySQL picks the TINY to LONG type.
const ARGUMENT_DROPPING_TYPES: ReadonlySet<string> = new Set([
  'blob',
  'text',
  'time',
  'time without time zone',
  'timestamp with time zone',
  'timestamptz',
]);

// Sequelize's GEOMETRY member on MySQL takes these subtypes alone; the
// driver hands every spatial value over parsed into GeoJSON.
const MYSQL_GEOMETRY_MEMBERS: ReadonlyMap<string, string> = new Map([
  ['geometry', `${TYPES}.GEOMETRY`],
  ['linestring', `${TYPES}.GEOMETRY("LINESTRING")`],
  ['point', `${TYPES}.GEOMETRY("POINT")`],
  ['polygon', `${TYPES}.GEOMETRY("POLYGON")`],
]);

const MYSQL_GEOMETRY_TYPES: ReadonlySet<string> = new Set([
  'geomcollection',
  'geometry',
  'geometrycollection',
  'linestring',
  'multilinestring',
  'multipoint',
  'multipolygon',
  'point',
  'polygon',
]);

// tedious hands the CLR types over as their bytes, a sql_variant as whatever
// it holds and a json as its text.
const SQLSERVER_ANNOTATIONS: ReadonlyMap<string, string> = new Map([
  ['geography', 'Buffer'],
  ['geometry', 'Buffer'],
  ['hierarchyid', 'Buffer'],
  ['json', 'string'],
  ['sql_variant', 'unknown'],
]);

// oracledb hands a vector over as the typed array of the format it is stored
// in, which a column of no fixed format leaves to each row.
const ORACLE_VECTOR_ARRAYS: ReadonlyMap<string, string> = new Map([
  ['binary', 'Uint8Array'],
  ['float32', 'Float32Array'],
  ['float64', 'Float64Array'],
  ['int8', 'Int8Array'],
]);

const ORACLE_ANY_VECTOR = Array.from(ORACLE_VECTOR_ARRAYS.values())
  .sort()
  .join(' | ');

const TYPE_ARGUMENTS = /\(([^)]*)\)/;

const SQLSERVER_MAX_TYPES: ReadonlySet<string> = new Set([
  'national char varying',
  'national character varying',
  'nvarchar',
]);

// The SQL Server types that take DATE's text with its offset, which sync
// creates as a datetimeoffset. A datetime or smalldatetime refuses that text.
const SQLSERVER_DATE_TYPES: ReadonlySet<string> = new Set([
  'datetime2',
  'datetimeoffset',
  'time',
]);

const listedNames = new Map<number, ReadonlySet<string>>();

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);

  if (tables.length === 0) {
    return '';
  }

  const stringBuffer: string[] = [''];
  const context = createModelContext(state);

  tables.forEach((table, index) => {
    if (index !== 0) {
      stringBuffer.push('');
    }
    formatModel(state, { buffer: stringBuffer, table }, context);
  });

  formatAssociations(state, stringBuffer, context, context.relationships);
  stringBuffer.push('');

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const context = createModelContext(state);

  formatModel(state, { buffer, table }, context);
  formatAssociations(
    state,
    buffer,
    context,
    context.relationships.filter(
      ({ relationship }) =>
        relationship.start.tableId === table.id ||
        relationship.end.tableId === table.id
    )
  );
}

function formatModel(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: ModelContext
) {
  const {
    settings: { database },
    collections,
  } = state;
  const naming = getNaming(state, context, table);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(naming.columnIds);

  const columnBuffer: string[] = [];
  const attributes: Group = { open: '{', entries: [] };

  let hasAutoIncrement = columns.some(column =>
    bHas(column.options, ColumnOption.autoIncrement)
  );

  columns.forEach(column => {
    const facts = getColumnFacts(column.dataType, database);
    const columnContext: ColumnContext = {
      property: naming.columnNames.get(column.id) ?? column.name,
      type: getColumnType(column.dataType, facts, database),
      flags: columnFlags(column, facts, database, hasAutoIncrement),
    };

    hasAutoIncrement ||= columnContext.flags.isAutoIncrement;

    formatColumnProperty({ buffer: columnBuffer, column }, columnContext);
    attributes.entries.push(createAttribute(column, columnContext));
  });

  const relationBuffer: string[] = [];
  formatRelationProperty(state, { buffer: relationBuffer, table }, context);

  buffer.push(`export class ${naming.className} extends ${MODEL}<`);
  buffer.push(`${INDENT}${wrap('InferAttributes', naming.className)},`);
  buffer.push(`${INDENT}${wrap('InferCreationAttributes', naming.className)}`);

  if (columnBuffer.length === 0 && relationBuffer.length === 0) {
    buffer.push('> {}');
  } else {
    buffer.push('> {');
    columnBuffer.forEach(line => buffer.push(line));
    if (columnBuffer.length !== 0 && relationBuffer.length !== 0) {
      buffer.push('');
    }
    relationBuffer.forEach(line => buffer.push(line));
    buffer.push('}');
  }

  buffer.push('');
  buffer.push(`${naming.className}.init(`);
  formatGroup(buffer, INDENT, '', attributes, ',');
  formatGroup(
    buffer,
    INDENT,
    '',
    createOptions(state, table, naming, context),
    ''
  );
  buffer.push(');');
}

function formatColumnProperty(
  { buffer, column }: FormatColumnOptions,
  {
    property,
    type,
    flags: { isAutoIncrement, isNullable, isWrittenByDatabase },
  }: ColumnContext
) {
  const annotation = isNullable
    ? `${type.ts} | null`
    : isAutoIncrement || isWrittenByDatabase || column.default.trim() !== ''
      ? wrap('CreationOptional', type.ts)
      : type.ts;

  buffer.push(`${INDENT}declare ${property}: ${annotation};`);
}

function formatRelationProperty(
  state: RootState,
  { buffer, table }: FormatRelationOptions,
  context: ModelContext
) {
  const naming = getNaming(state, context, table);

  context.relationships
    .filter(({ relationship }) => relationship.end.tableId === table.id)
    .forEach(({ relationship, startTable }) => {
      const property = naming.relationshipNames.get(
        relationshipKey(relationship, OWNING)
      );

      if (!property) {
        return;
      }

      const parentNaming = getNaming(state, context, startTable);

      buffer.push(
        `${INDENT}declare ${property}?: ${wrap('NonAttribute', parentNaming.className)};`
      );
    });

  context.relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable }) => {
      const property = naming.relationshipNames.get(
        relationshipKey(relationship, INVERSE)
      );

      if (!property) {
        return;
      }

      const childNaming = getNaming(state, context, endTable);
      const target = hasNRelationship(relationship.relationshipType)
        ? `${childNaming.className}[]`
        : childNaming.className;

      buffer.push(
        `${INDENT}declare ${property}?: ${wrap('NonAttribute', target)};`
      );
    });
}

function formatAssociations(
  state: RootState,
  buffer: string[],
  context: ModelContext,
  relationships: ResolvedRelationship[]
) {
  const lines: string[] = [];

  relationships.forEach(
    ({ relationship, startTable, endTable, startColumns, endColumns }) => {
      const parentNaming = getNaming(state, context, startTable);
      const childNaming = getNaming(state, context, endTable);
      const inverse = parentNaming.relationshipNames.get(
        relationshipKey(relationship, INVERSE)
      );
      const owning = childNaming.relationshipNames.get(
        relationshipKey(relationship, OWNING)
      );

      if (!inverse || !owning) {
        return;
      }

      const foreignKey = childNaming.columnNames.get(endColumns[0].id);
      const referenced = parentNaming.columnNames.get(startColumns[0].id);

      if (!foreignKey || !referenced) {
        return;
      }

      const method = hasNRelationship(relationship.relationshipType)
        ? 'hasMany'
        : 'hasOne';
      // Both sides write the one foreign key attribute, whichever runs last
      // winning, so each carries the actions.
      const actions = referentialActionEntries(
        relationship,
        referentialActionSupport(state.settings.database)
      ).map(({ key, sql }) => `${key}: "${sql}"`);

      formatGroup(
        lines,
        '',
        `${parentNaming.className}.${method}(${childNaming.className}, `,
        {
          open: '{',
          entries: [
            `foreignKey: "${escapeString(foreignKey)}"`,
            `sourceKey: "${escapeString(referenced)}"`,
            `as: "${escapeString(inverse)}"`,
            ...actions,
          ],
        },
        ');'
      );
      formatGroup(
        lines,
        '',
        `${childNaming.className}.belongsTo(${parentNaming.className}, `,
        {
          open: '{',
          entries: [
            `foreignKey: "${escapeString(foreignKey)}"`,
            `targetKey: "${escapeString(referenced)}"`,
            `as: "${escapeString(owning)}"`,
            ...actions,
          ],
        },
        ');'
      );
    }
  );

  if (lines.length === 0) {
    return;
  }

  buffer.push('');
  lines.forEach(line => buffer.push(line));
}

/**
 * A serial numbers its rows as the one auto-increment column of a model does,
 * NOT NULL on PostgreSQL whatever the flags say; MySQL's SERIAL is UNIQUE, the
 * key AUTO_INCREMENT needs, and nullable where the DDL writes NULL after it.
 */
function columnFlags(
  column: Column,
  { isSerial, isRowVersion }: ColumnFacts,
  database: number,
  hasAutoIncrement: boolean
): ColumnFlags {
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
  const isAutoIncrement =
    bHas(column.options, ColumnOption.autoIncrement) ||
    (isSerial && !hasAutoIncrement);

  return {
    isPrimaryKey,
    isAutoIncrement,
    isNullable:
      !isPrimaryKey &&
      !(isSerial && database === Database.PostgreSQL) &&
      !bHas(column.options, ColumnOption.notNull),
    isUnique:
      !isPrimaryKey &&
      (bHas(column.options, ColumnOption.unique) ||
        (isSerial && isMySQLFamily(database))),
    isWrittenByDatabase: isRowVersion || (isSerial && !isAutoIncrement),
  };
}

// A rowversion, which SQL Server writes and takes no value for but DEFAULT,
// or a second serial: Sequelize's NOT NULL check refuses an insert leaving it
// out. A function default never reaches the DDL sync writes.
const DATABASE_DEFAULT = `defaultValue: () => ${NAMESPACE}.literal("DEFAULT")`;

function createAttribute(
  column: Column,
  {
    property,
    type,
    flags: {
      isPrimaryKey,
      isAutoIncrement,
      isNullable,
      isUnique,
      isWrittenByDatabase,
    },
  }: ColumnContext
): Entry {
  const value = column.default.trim();

  return {
    prefix: `${property}: `,
    group: {
      open: '{',
      entries: [
        `type: ${type.expr}`,
        ...(property === column.name
          ? []
          : [`field: "${escapeString(column.name)}"`]),
        ...(isPrimaryKey ? ['primaryKey: true'] : []),
        ...(isAutoIncrement ? ['autoIncrement: true'] : []),
        `allowNull: ${isNullable}`,
        ...(isUnique ? ['unique: true'] : []),
        ...(isWrittenByDatabase
          ? [DATABASE_DEFAULT]
          : !isAutoIncrement && value !== ''
            ? [defaultValue(value)]
            : []),
        ...(column.comment.trim() === ''
          ? []
          : [`comment: "${escapeComment(column.comment)}"`]),
      ],
    },
    suffix: '',
  };
}

const NUMERIC_LITERAL = /^[+-]?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const LEADING_PLUS = /^\+/;
const TRAILING_ZEROS = /\.?0+$/;
const QUOTED_LITERAL = /^'([^']|'')*'$/;
const ESCAPED_QUOTE = /''/g;

function defaultValue(value: string): string {
  if (NUMERIC_LITERAL.test(value) && isExactNumber(value)) {
    return `defaultValue: ${value}`;
  }

  if (QUOTED_LITERAL.test(value)) {
    return `defaultValue: "${escapeString(value.slice(1, -1).replace(ESCAPED_QUOTE, "'"))}"`;
  }

  const lowered = value.toLocaleLowerCase();
  if (lowered === 'true' || lowered === 'false') {
    return `defaultValue: ${lowered}`;
  }

  return `defaultValue: ${NAMESPACE}.literal("${escapeString(value)}")`;
}

function isExactNumber(value: string): boolean {
  return normalizeNumber(value) === normalizeNumber(String(Number(value)));
}

function normalizeNumber(value: string): string {
  const signed = value.replace(LEADING_PLUS, '');
  return signed.includes('.') ? signed.replace(TRAILING_ZEROS, '') : signed;
}

function createOptions(
  state: RootState,
  table: Table,
  naming: TableNaming,
  context: ModelContext
): Group {
  const indexes = createIndexEntries(state, table, naming, context);

  return {
    open: '{',
    entries: [
      INSTANCE,
      `tableName: "${escapeString(table.name)}"`,
      'timestamps: false',
      ...(table.comment.trim() === ''
        ? []
        : [`comment: "${escapeComment(table.comment)}"`]),
      ...(indexes.length === 0
        ? []
        : [
            {
              prefix: 'indexes: ',
              group: { open: '[' as const, entries: indexes },
              suffix: '',
            },
          ]),
    ],
  };
}

function createIndexEntries(
  state: RootState,
  table: Table,
  naming: TableNaming,
  { indexNames }: ModelContext
): Entry[] {
  const {
    doc: { indexIds },
    collections,
  } = state;
  const columnCollection = query(collections).collection('tableColumnEntities');
  const entries: Entry[] = [];

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .forEach(index => {
      const fields = Array.from(
        new Set(
          query(collections)
            .collection('indexColumnEntities')
            .selectByIds(index.indexColumnIds)
            .flatMap(indexColumn => {
              const column = columnCollection.selectById(indexColumn.columnId);
              return column && naming.columnNames.has(column.id)
                ? [column.name]
                : [];
            })
        )
      );

      if (fields.length === 0) {
        return;
      }

      entries.push({
        prefix: '',
        group: {
          open: '{',
          entries: [
            `name: "${escapeString(indexNames.get(index.id) ?? index.name)}"`,
            {
              prefix: 'fields: ',
              group: {
                open: '[',
                entries: fields.map(field => `"${escapeString(field)}"`),
              },
              suffix: '',
            },
            ...(index.unique ? ['unique: true'] : []),
          ],
        },
        suffix: '',
      });
    });

  return entries;
}

function inlineEntry(entry: Entry): string {
  return typeof entry === 'string'
    ? entry
    : `${entry.prefix}${inlineGroup(entry.group)}${entry.suffix}`;
}

function inlineGroup(group: Group): string {
  if (group.entries.length === 0) {
    return group.open === '[' ? '[]' : '{}';
  }

  const body = group.entries.map(inlineEntry).join(', ');
  return group.open === '[' ? `[${body}]` : `{ ${body} }`;
}

function formatGroup(
  buffer: string[],
  indent: string,
  prefix: string,
  group: Group,
  suffix: string
) {
  const line = `${indent}${prefix}${inlineGroup(group)}${suffix}`;

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  buffer.push(`${indent}${prefix}${group.open}`);
  group.entries.forEach(entry => {
    if (typeof entry === 'string') {
      buffer.push(`${indent}${INDENT}${entry},`);
      return;
    }
    formatGroup(
      buffer,
      `${indent}${INDENT}`,
      entry.prefix,
      entry.group,
      `${entry.suffix},`
    );
  });
  buffer.push(`${indent}${group.open === '[' ? ']' : '}'}${suffix}`);
}

const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/i;
const MAX_LENGTH = /^[^(]*\(\s*max\s*\)/i;

function getColumnType(
  dataType: string,
  facts: ColumnFacts,
  database: number
): SequelizeType {
  if (facts.base === '') {
    return { expr: STRING, ts: 'string' };
  }

  const element = elementType(facts, database);

  if (facts.arrayDepth === 0) {
    return element;
  }

  const isText = POSTGRES_TEXT_ARRAY_TYPES.has(facts.base);
  const ts = isText
    ? 'string'
    : `${element.ts.includes(' ') ? `(${element.ts})` : element.ts}${'[]'.repeat(facts.arrayDepth)}`;
  // DataTypes.ARRAY takes a member and writes an array value, never the one
  // string pg reads, and a nested one writes its element in generic SQL
  // (DATETIME for DATE), so these keep the type as written.
  const expr =
    facts.arrayDepth === 1 && !isText && !isWrittenAsIs(element.expr)
      ? `${TYPES}.ARRAY(${element.expr})`
      : writeAsIs(dataType);

  return { expr, ts };
}

function elementType(facts: ColumnFacts, database: number): SequelizeType {
  if (facts.base === 'enum' && facts.enumMembers) {
    const quoted = facts.enumMembers.map(member => `"${escapeString(member)}"`);

    return {
      expr: `${TYPES}.ENUM(${quoted.join(', ')})`,
      ts: quoted.join(' | '),
    };
  }

  return dialectType(facts, database) ?? memberType(facts, database);
}

function dialectType(
  facts: ColumnFacts,
  database: number
): SequelizeType | null {
  const { base, args, scalar } = facts;

  if (database === Database.PostgreSQL) {
    const range = POSTGRES_RANGE_TYPES.get(base);

    if (range) {
      const [subtype, bound] = range;

      return {
        expr: subtype ? `${TYPES}.RANGE(${subtype})` : writeAsIs(facts.element),
        ts: `Range<${bound}>`,
      };
    }
  }
  if (
    (database === Database.PostgreSQL || database === Database.MSSQL) &&
    scalar === 'f32'
  ) {
    return { expr: `${TYPES}.REAL`, ts: 'number' };
  }
  if (isMySQLFamily(database)) {
    const geometry = MYSQL_GEOMETRY_MEMBERS.get(base);

    if (geometry) {
      return { expr: geometry, ts: 'object' };
    }
    if (base === 'datetime' && args.length === 1) {
      return { expr: `${TYPES}.DATE(${args[0]})`, ts: 'Date' };
    }
  }
  if (database === Database.MSSQL) {
    const isMax = MAX_LENGTH.test(facts.element);

    if (SQLSERVER_MAX_TYPES.has(base) && isMax) {
      return { expr: `${TYPES}.TEXT`, ts: 'string' };
    }
    if (base === 'varbinary' && !isMax) {
      return { expr: writeAsIs(facts.element), ts: 'Buffer' };
    }
    // tedious takes a Date only as the text DATE writes, which carries an
    // offset, and hands a time of day back as a Date on 1970-01-01.
    if (SQLSERVER_DATE_TYPES.has(base)) {
      return { expr: DATE_TIME, ts: 'Date' };
    }
  }
  // A vector's arguments are its dimensions and format, never a length, and
  // oracledb hands a BFILE over as a Lob.
  if (database === Database.Oracle && base === 'vector') {
    return { expr: STRING, ts: oracleVectorAnnotation(facts.element) };
  }
  if (database === Database.Oracle && base === 'bfile') {
    return { expr: BLOB.expr, ts: 'object' };
  }
  // Sequelize reads a SQLite value into a Date only where the column is
  // declared DATETIME.
  if (database === Database.SQLite && base === 'timestamp') {
    return { expr: writeAsIs(facts.element), ts: 'string' };
  }
  // Sequelize has no interval member and TIME makes a type Oracle lacks. On
  // Oracle a type as written fails every create, and oracledb hands an
  // interval over as an IntervalDS or IntervalYM object.
  if (scalar === 'interval' && database !== Database.PostgreSQL) {
    return {
      expr: STRING,
      ts: database === Database.Oracle ? 'object' : 'string',
    };
  }

  return asWritten(facts, database);
}

/** A sparse vector is a SparseVector object; any other the format's array. */
function oracleVectorAnnotation(element: string): string {
  const [, format = '*', storage = ''] = (
    TYPE_ARGUMENTS.exec(element)?.[1] ?? ''
  )
    .split(',')
    .map(part => part.trim().toLowerCase());

  if (storage === 'sparse') {
    return 'object';
  }

  return ORACLE_VECTOR_ARRAYS.get(format) ?? ORACLE_ANY_VECTOR;
}

function asWritten(facts: ColumnFacts, database: number): SequelizeType | null {
  const members = MEMBER_TYPES.get(database);

  if (
    !members ||
    !isListedName(facts.base, database) ||
    (members.has(facts.base) &&
      !(facts.args.length !== 0 && ARGUMENT_DROPPING_TYPES.has(facts.base)))
  ) {
    return null;
  }

  return {
    expr: writeAsIs(facts.element),
    ts: writtenAnnotation(facts, database),
  };
}

function writtenAnnotation(facts: ColumnFacts, database: number): string {
  const { base, scalar } = facts;

  if (
    database === Database.PostgreSQL &&
    (POSTGRES_OBJECT_TYPES.has(base) || scalar === 'interval')
  ) {
    return 'object';
  }
  // The mariadb connector reads a BIT(1) as a boolean and a SET as an array of
  // its members; mysql2 reads every BIT as bytes and a SET as one string.
  if (isMySQLFamily(database) && base === 'bit') {
    return database === Database.MariaDB && scalar === 'bool'
      ? 'boolean'
      : 'Buffer';
  }
  if (database === Database.MariaDB && base === 'set') {
    const members = facts.setMembers?.map(
      member => `"${escapeString(member)}"`
    );

    return members ? `(${members.join(' | ')})[]` : 'string[]';
  }
  // The mariadb connector hands a vector over as its packed float32 bytes.
  if (database === Database.MariaDB && base === 'vector') {
    return 'Buffer';
  }
  if (isMySQLFamily(database) && MYSQL_GEOMETRY_TYPES.has(base)) {
    return 'object';
  }
  if (database === Database.MSSQL) {
    const annotation = SQLSERVER_ANNOTATIONS.get(base);

    if (annotation) {
      return annotation;
    }
  }
  if (facts.isTextInteger) {
    return 'string';
  }
  if (scalar === 'decimal') {
    return DECIMAL_ANNOTATIONS.get(database) ?? SCALAR_ANNOTATIONS[scalar];
  }

  return SCALAR_ANNOTATIONS[scalar];
}

function memberType(facts: ColumnFacts, database: number): SequelizeType {
  const emission =
    vendorTypeMap.get(facts.base) ??
    (facts.scalar === 'bytes'
      ? BLOB
      : fallbackTypeMap[getPrimitiveType(facts.element, database)]);
  // MySQL keeps a float's precision and scale, which FLOAT and DOUBLE write
  // after the name; a lone argument there picks FLOAT or DOUBLE alone.
  const expr =
    isMySQLFamily(database) &&
    facts.args.length === 2 &&
    (emission.expr === FLOAT || emission.expr === DOUBLE)
      ? `${emission.expr}(${facts.args[0]}, ${facts.args[1]})`
      : applyArguments(emission, facts.args);
  const isNumeric =
    isMySQLFamily(database) && NUMERIC_EXPRESSIONS.has(emission.expr);
  const unsigned = isNumeric && facts.isUnsigned ? '.UNSIGNED' : '';
  const zerofill = isNumeric && ZEROFILL.test(facts.element) ? '.ZEROFILL' : '';
  const ts =
    emission.expr === BIGINT
      ? BIGINT_ANNOTATIONS.get(database)
      : emission.expr === DECIMAL
        ? DECIMAL_ANNOTATIONS.get(database)
        : undefined;

  return { expr: `${expr}${unsigned}${zerofill}`, ts: ts ?? emission.ts };
}

function applyArguments(emission: Emission, args: number[]): string {
  if (emission.args === 'length' && args.length === 1 && args[0] > 0) {
    return `${emission.expr}(${args[0]})`;
  }
  if (emission.args === 'precision' && args.length === 1) {
    return `${emission.expr}(${args[0]})`;
  }
  if (emission.args === 'precision' && args.length === 2) {
    return `${emission.expr}(${args[0]}, ${args[1]})`;
  }

  return emission.expr === CHAR ? STRING : emission.expr;
}

function isListedName(base: string, database: number): boolean {
  let names = listedNames.get(database);

  if (!names) {
    names = new Set(
      getDataTypeHints(database).map(hint => hint.name.toLowerCase())
    );
    listedNames.set(database, names);
  }

  return names.has(base);
}

function writeAsIs(dataType: string): string {
  return `"${escapeString(dataType.trim())}"`;
}

function isWrittenAsIs(expr: string): boolean {
  return expr.startsWith('"');
}

function createIndexNames(state: RootState): Map<string, string> {
  const {
    doc: { indexIds, tableIds },
    collections,
  } = state;
  const tableCollection = query(collections).collection('tableEntities');
  const indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds);
  const names = new Map<string, string>();
  const used: Name[] = [];
  const rank = new Map<string, number>();

  tableCollection
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .forEach((table, index) => rank.set(table.id, index));

  indexes.forEach(index => {
    if (index.name.trim() !== '') {
      names.set(index.id, index.name);
      used.push({ id: index.id, name: index.name });
    }
  });

  indexes
    .map((index, order) => ({ index, order }))
    .filter(({ index }) => index.name.trim() === '')
    .sort(
      (a, b) =>
        (rank.get(a.index.tableId) ?? rank.size) -
          (rank.get(b.index.tableId) ?? rank.size) || a.order - b.order
    )
    .forEach(({ index }) => {
      const table = tableCollection.selectById(index.tableId);
      const name = autoName(used, '', `IDX_${table?.name ?? ''}`);

      used.push({ id: index.id, name });
      names.set(index.id, name);
    });

  return names;
}

function createModelContext(state: RootState): ModelContext {
  const context: ModelContext = {
    indexNames: createIndexNames(state),
    relationships: resolveRelationships(state),
    namings: new Map<string, TableNaming>(),
    classNames: new Set<string>(MODULE_SCOPE_NAMES),
  };

  query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds)
    .sort(orderByNameASC)
    .forEach(table => getNaming(state, context, table));

  return context;
}

function resolveRelationships(state: RootState): ResolvedRelationship[] {
  const {
    doc: { relationshipIds, tableIds },
    collections,
  } = state;
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const documentTableIds = new Set(tableIds);

  return query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .map(relationship => {
      const startTable = tableCollection.selectById(relationship.start.tableId);
      const endTable = tableCollection.selectById(relationship.end.tableId);
      const startColumns = columnCollection.selectByIds(
        relationship.start.columnIds
      );
      const endColumns = columnCollection.selectByIds(
        relationship.end.columnIds
      );

      return !startTable ||
        !endTable ||
        !documentTableIds.has(startTable.id) ||
        !documentTableIds.has(endTable.id) ||
        endColumns.length === 0 ||
        startColumns.length !== relationship.start.columnIds.length ||
        endColumns.length !== relationship.end.columnIds.length ||
        startColumns.length !== endColumns.length ||
        !startColumns.every(column =>
          startTable.columnIds.includes(column.id)
        ) ||
        !endColumns.every(column => endTable.columnIds.includes(column.id))
        ? null
        : { relationship, startTable, endTable, startColumns, endColumns };
    })
    .filter(resolved => resolved !== null) as ResolvedRelationship[];
}

function getNaming(
  state: RootState,
  context: ModelContext,
  table: Table
): TableNaming {
  const cached = context.namings.get(table.id);
  if (cached) {
    return cached;
  }

  const naming = createTableNaming(state, table, context);
  context.namings.set(table.id, naming);
  return naming;
}

function createTableNaming(
  state: RootState,
  table: Table,
  { relationships, classNames }: ModelContext
): TableNaming {
  const {
    settings: { tableNameCase, columnNameCase },
    collections,
  } = state;
  const used = new Set<string>(MODEL_MEMBER_NAMES);
  const declared: Column[] = [];
  const columnRefs = new Map<string, string>();
  const columnNames = new Map<string, string>();
  const relationshipNames = new Map<string, string>();
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const className = uniqueName(
    classNames,
    classIdentifier(tsIdentifier(getNameCase(table.name, tableNameCase)))
  );

  const carriers = new Map<string, string>();

  columns.forEach(column => {
    const carrier = carriers.get(column.name);

    if (carrier !== undefined) {
      columnRefs.set(column.id, carrier);
      return;
    }

    carriers.set(column.name, column.id);
    columnRefs.set(column.id, column.id);
    declared.push(column);
    columnNames.set(
      column.id,
      uniqueName(used, tsIdentifier(getNameCase(column.name, columnNameCase)))
    );
  });

  columns.forEach(column => {
    const carrier = columnRefs.get(column.id);

    if (carrier === undefined || carrier === column.id) {
      return;
    }

    const name = columnNames.get(carrier);
    if (name !== undefined) {
      columnNames.set(column.id, name);
    }
  });

  relationships
    .filter(({ relationship }) => relationship.end.tableId === table.id)
    .forEach(({ relationship, startTable, endColumns }) => {
      if (
        endColumns.length !== 1 ||
        (!hasOneRelationship(relationship.relationshipType) &&
          !hasNRelationship(relationship.relationshipType))
      ) {
        return;
      }

      const name = isSelfReferential(relationship)
        ? `parent_${startTable.name}`
        : startTable.name;

      relationshipNames.set(
        relationshipKey(relationship, OWNING),
        uniqueAlias(
          used,
          tsIdentifier(getNameCase(name, columnNameCase)),
          ONE_ACCESSORS,
          className
        )
      );
    });

  relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable, endColumns }) => {
      const name =
        endColumns.length !== 1
          ? null
          : hasNRelationship(relationship.relationshipType)
            ? getNameCase(`${endTable.name}List`, columnNameCase)
            : hasOneRelationship(relationship.relationshipType)
              ? getNameCase(endTable.name, columnNameCase)
              : null;

      if (name === null) {
        return;
      }

      relationshipNames.set(
        relationshipKey(relationship, INVERSE),
        uniqueAlias(
          used,
          tsIdentifier(name),
          hasNRelationship(relationship.relationshipType)
            ? MANY_ACCESSORS
            : ONE_ACCESSORS,
          className
        )
      );
    });

  return {
    className,
    columnIds: declared.map(column => column.id),
    columnNames,
    relationshipNames,
  };
}

function relationshipKey(
  relationship: Relationship,
  side: RelationshipSide
): string {
  return `${relationship.id}:${side}`;
}

function isSelfReferential(relationship: Relationship): boolean {
  return relationship.start.tableId === relationship.end.tableId;
}

// Sequelize puts an alias's methods on the model's prototype, each a verb and
// the alias with its first letter upper case (getTeam), where one would hide
// a Model method or an attribute of that name.
const ONE_ACCESSORS: ReadonlyArray<string> = ['create', 'get', 'set'];
const MANY_ACCESSORS: ReadonlyArray<string> = [
  'add',
  'count',
  'create',
  'get',
  'has',
  'remove',
  'set',
];

function numberName(
  name: string,
  isTaken: (candidate: string) => boolean
): string {
  let result = name;
  let index = 2;

  while (isTaken(result)) {
    result = `${name}${index}`;
    index += 1;
  }

  return result;
}

function uniqueName(used: Set<string>, name: string): string {
  const result = numberName(name, candidate => used.has(candidate));

  used.add(result);
  return result;
}

/**
 * An alias is numbered where it or one of its accessors is taken, or where it
 * equals its class name ignoring case, the name Sequelize gives the model's own
 * table in a query including the alias. Its accessors are then taken.
 */
function uniqueAlias(
  used: Set<string>,
  name: string,
  accessors: ReadonlyArray<string>,
  className: string
): string {
  const tableAlias = className.toLowerCase();
  const accessorsOf = (alias: string) =>
    accessors.map(verb => `${verb}${upperFirst(alias)}`);
  const result = numberName(
    name,
    candidate =>
      used.has(candidate) ||
      candidate.toLowerCase() === tableAlias ||
      accessorsOf(candidate).some(accessor => used.has(accessor))
  );

  used.add(result);
  accessorsOf(result).forEach(accessor => used.add(accessor));
  return result;
}

function upperFirst(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

const NON_IDENTIFIER = /[^$0-9A-Za-z_]/g;
const IDENTIFIER_START = /^[$A-Za-z_]/;

const RESERVED = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const SAFE_PREFIX = 'x';

function tsIdentifier(name: string): string {
  const value = name.replace(NON_IDENTIFIER, '_');
  const identifier = IDENTIFIER_START.test(value)
    ? value
    : `${SAFE_PREFIX}${value}`;
  return RESERVED.has(identifier) ? `${identifier}_` : identifier;
}

/**
 * Names a class may not take: TypeScript's predefined types, Object, the type
 * operators its InferAttributes reads, what a CommonJS module binds, and
 * __proto__, which would replace the prototype of Sequelize's model registry.
 */
const RESERVED_CLASS_NAMES: ReadonlySet<string> = new Set([
  'Object',
  '__dirname',
  '__filename',
  '__proto__',
  'any',
  'bigint',
  'boolean',
  'exports',
  'infer',
  'keyof',
  'module',
  'never',
  'number',
  'object',
  'readonly',
  'require',
  'string',
  'symbol',
  'undefined',
  'unique',
  'unknown',
]);

function classIdentifier(identifier: string): string {
  return RESERVED_CLASS_NAMES.has(identifier) ? `${identifier}_` : identifier;
}

const BACKSLASH = /\\/g;
const DOUBLE_QUOTE = /"/g;
const NEWLINE = /\r\n|\r|\n/g;
const CARRIAGE_RETURN = /\r/g;
const LINE_FEED = /\n/g;

/**
 * A string Sequelize hands the database (a name, a type, a member, a default)
 * keeps each line break as it is, since the database compares it.
 */
function escapeString(value: string): string {
  return value
    .replace(BACKSLASH, '\\\\')
    .replace(DOUBLE_QUOTE, '\\"')
    .replace(CARRIAGE_RETURN, '\\r')
    .replace(LINE_FEED, '\\n');
}

/** A comment writes each CR, LF or CRLF as one line feed. */
function escapeComment(value: string): string {
  return escapeString(value.replace(NEWLINE, '\n'));
}
