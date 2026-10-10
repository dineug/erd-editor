import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database, OrderType } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import {
  autoName,
  Name,
  orderByNameASC,
  ReferentialActionSupport,
  referentialActionSupport,
} from '@/utils/schema-sql/utils';

import {
  BINARY_TYPES,
  ColumnType as ClassifiedType,
  getColumnType as classifyColumnType,
  isMySQLFamily,
  isUnsigned,
  JSON_TYPES,
  MONEY_TYPES,
  POSTGRES_BIT_TYPES,
  POSTGRES_TIME_TZ_TYPES,
  TIMESTAMP_LTZ_TYPES,
  TIMESTAMP_TZ_TYPES,
  UUID_TYPES,
} from './columnTypes';
import {
  escapeTypeScriptDirective,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
  referentialActionEntries,
  splitLines,
} from './utils';

const LINE_LIMIT = 80;
const INDENT = '  ';
const CORE_MODULE = 'drizzle-orm';

type Dialect = 'pg' | 'mysql' | 'sqlite';

const RELATIONS = 'relations';
const SQL = 'sql';
const INDEX = 'index';
const UNIQUE_INDEX = 'uniqueIndex';
const PRIMARY_KEY = 'primaryKey';
const FOREIGN_KEY = 'foreignKey';
const PG_ENUM = 'pgEnum';
const MYSQL_ENUM = 'mysqlEnum';
const CUSTOM_TYPE = 'customType';

const ANY_COLUMN: Record<Dialect, string> = {
  pg: 'AnyPgColumn',
  mysql: 'AnyMySqlColumn',
  sqlite: 'AnySQLiteColumn',
};

const EXTRA_CONFIG_VALUE: Record<Dialect, string> = {
  pg: 'PgTableExtraConfigValue',
  mysql: 'MySqlTableExtraConfigValue',
  sqlite: 'SQLiteTableExtraConfigValue',
};

const SELF = 'table';

const FALLBACK_DIALECT: Dialect = 'pg';

const DIALECT_BY_DATABASE: Record<number, Dialect> = {
  [Database.PostgreSQL]: 'pg',
  [Database.MySQL]: 'mysql',
  [Database.MariaDB]: 'mysql',
  [Database.SQLite]: 'sqlite',
};

const TABLE_FUNCTION: Record<Dialect, string> = {
  pg: 'pgTable',
  mysql: 'mysqlTable',
  sqlite: 'sqliteTable',
};

const DIALECT_MODULE: Record<Dialect, string> = {
  pg: `${CORE_MODULE}/pg-core`,
  mysql: `${CORE_MODULE}/mysql-core`,
  sqlite: `${CORE_MODULE}/sqlite-core`,
};

const CORE_NAMES = [RELATIONS, SQL] as const;

const ONE = 'one';
const MANY = 'many';

const GLOBAL_NAMES = ['Buffer', 'Date', SELF, ONE, MANY] as const;

const DIALECT_NAMES: Record<Dialect, ReadonlyArray<string>> = {
  pg: [
    'bigint',
    'bigserial',
    'bit',
    'boolean',
    'char',
    'check',
    'cidr',
    'customType',
    'date',
    'decimal',
    'doublePrecision',
    'foreignKey',
    'geometry',
    'halfvec',
    'index',
    'inet',
    'integer',
    'interval',
    'json',
    'jsonb',
    'line',
    'macaddr',
    'macaddr8',
    'numeric',
    'pgEnum',
    'pgSchema',
    'pgTable',
    'pgView',
    'point',
    'primaryKey',
    'real',
    'serial',
    'smallint',
    'smallserial',
    'sparsevec',
    'text',
    'time',
    'timestamp',
    'unique',
    'uniqueIndex',
    'uuid',
    'varchar',
    'vector',
  ],
  mysql: [
    'bigint',
    'binary',
    'boolean',
    'char',
    'check',
    'customType',
    'date',
    'datetime',
    'decimal',
    'double',
    'float',
    'foreignKey',
    'index',
    'int',
    'json',
    'longtext',
    'mediumint',
    'mediumtext',
    'mysqlEnum',
    'mysqlSchema',
    'mysqlTable',
    'mysqlView',
    'primaryKey',
    'real',
    'serial',
    'smallint',
    'text',
    'time',
    'timestamp',
    'tinyint',
    'tinytext',
    'unique',
    'uniqueIndex',
    'varbinary',
    'varchar',
    'year',
  ],
  sqlite: [
    'blob',
    'check',
    'customType',
    'foreignKey',
    'index',
    'int',
    'integer',
    'numeric',
    'primaryKey',
    'real',
    'sqliteTable',
    'sqliteView',
    'text',
    'unique',
    'uniqueIndex',
  ],
};

type TsKind = 'number' | 'string' | 'boolean' | 'other';

type ArgumentKind =
  | 'none'
  | 'length'
  | 'lengthRequired'
  | 'precision'
  | 'floatPrecision'
  | 'precisionAndScale'
  | 'seconds'
  | 'members'
  | 'blobLength';

/** A column type a core has no builder for, declared once above the tables. */
type CustomType = {
  name: string;
  lines: ReadonlyArray<string>;
};

type Emission = {
  builder: string;
  ts: TsKind;
  args: ArgumentKind;
  options?: string[];
  autoInc?: boolean;
  /** A type that numbers its rows and holds a unique, NOT NULL value. */
  serial?: boolean;
  unsigned?: boolean;
  numericString?: boolean;
  degraded?: Emission;
  custom?: CustomType;
};

type ColumnType = {
  head: string;
  builder: string | null;
  custom: CustomType | null;
  ts: TsKind;
  members: string[] | null;
  autoInc: boolean;
  serial: boolean;
  numericString: boolean;
};

type ColumnFlags = {
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isNotNull: boolean;
};

type ResolvedRelationship = {
  relationship: Relationship;
  startTable: Table;
  endTable: Table;
  startColumns: Column[];
  endColumns: Column[];
};

const OWNING = 'owning';
const INVERSE = 'inverse';

type RelationshipSide = typeof OWNING | typeof INVERSE;

type EnumNaming = {
  constName: string;
  typeName: string;
};

type TableNaming = {
  constName: string;
  relationsName: string;
  columnIds: string[];
  carriers: Map<string, string>;
  columnNames: Map<string, string>;
  relationshipNames: Map<string, string>;
  enumNames: Map<string, EnumNaming>;
};

type SchemaContext = {
  database: number;
  dialect: Dialect;
  actionSupport: ReferentialActionSupport;
  indexNames: Map<string, string>;
  relationships: ResolvedRelationship[];
  namings: Map<string, TableNaming>;
  moduleNames: Set<string>;
  enumTypeNames: Set<string>;
  aliases: Map<string, string>;
  inlined: Set<string>;
  cyclic: Set<string>;
  annotated: Set<string>;
};

type ImportSet = {
  core: Set<string>;
  dialect: Set<string>;
  types: Set<string>;
  customs: Map<string, CustomType>;
};

const INTERVAL_FIELDS: ReadonlySet<string> = new Set([
  'day',
  'day to hour',
  'day to minute',
  'day to second',
  'hour',
  'hour to minute',
  'hour to second',
  'minute',
  'minute to second',
  'month',
  'second',
  'year',
  'year to month',
]);

const CHAR_NAMES = [
  'bpchar',
  'char',
  'character',
  'national char',
  'national character',
  'native character',
  'nchar',
];

const VARCHAR_NAMES = [
  'char varying',
  'character varying',
  'national char varying',
  'national character varying',
  'national varchar',
  'national varcharacter',
  'nchar varchar',
  'nchar varcharacter',
  'nchar varying',
  'nvarchar',
  'nvarchar2',
  'varchar',
  'varchar2',
  'varcharacter',
  'varying character',
];

// MySQL and MariaDB store each of these as a MEDIUMTEXT.
const LONG_TEXT_NAMES = [
  'long',
  'long char varying',
  'long character varying',
  'long varchar',
  'long varcharacter',
];

const PLAIN_TEXT_NAMES = ['clob', 'national text', 'nclob', 'ntext', 'text'];

const TEXT_NAMES = [...PLAIN_TEXT_NAMES, ...LONG_TEXT_NAMES];

const BINARY_NAMES = Array.from(BINARY_TYPES);

/** A custom type whose SQL is its name alone, on one line where it fits. */
function namedCustomType(name: string, data: string): CustomType {
  const head = `const ${name} = ${CUSTOM_TYPE}<{ data: ${data} }>({`;
  const line = `${head} dataType: () => "${name}" });`;

  return {
    name,
    lines:
      line.length <= LINE_LIMIT
        ? [line]
        : [head, `${INDENT}dataType: () => "${name}",`, '});'],
  };
}

// PostgreSQL and MySQL take a bare BIT as BIT(1) and store it so, which the
// declared type has to spell for drizzle-kit to find nothing to change.
function bitCustomType(data: string): CustomType {
  return {
    name: 'bit',
    lines: [
      `const bit = ${CUSTOM_TYPE}<{ data: ${data}; config: { length?: number } }>({`,
      `${INDENT}dataType: (config) => \`bit(\${config?.length ?? 1})\`,`,
      '});',
    ],
  };
}

// A table const may take the name undefined and shadow that global, so the
// declaration tests the type of the length and names no global at all.
const VARBIT_TYPE: CustomType = {
  name: 'varbit',
  lines: [
    `const varbit = ${CUSTOM_TYPE}<{ data: string; config: { length?: number } }>({`,
    `${INDENT}dataType: (config) =>`,
    `${INDENT}${INDENT}typeof config?.length === "number"`,
    `${INDENT}${INDENT}${INDENT}? \`bit varying(\${config.length})\``,
    `${INDENT}${INDENT}${INDENT}: "bit varying",`,
    '});',
  ],
};

// MySQL reads a backslash in a string literal as an escape, so a member keeps
// its own backslash and quote only written escaped.
const SET_TYPE: CustomType = {
  name: 'set',
  lines: [
    `const set = ${CUSTOM_TYPE}<{`,
    `${INDENT}data: string;`,
    `${INDENT}config: { values: string[] };`,
    `${INDENT}configRequired: true;`,
    '}>({',
    `${INDENT}dataType: (config) =>`,
    `${INDENT}${INDENT}\`set(\${config.values`,
    `${INDENT}${INDENT}${INDENT}.map((value) => \`'\${value.replace(/\\\\/g, "\\\\\\\\").replace(/'/g, "''")}'\`)`,
    `${INDENT}${INDENT}${INDENT}.join(",")})\`,`,
    '});',
  ],
};

function customEmission(
  custom: CustomType,
  ts: TsKind,
  args: ArgumentKind = 'none'
): Emission {
  return { builder: custom.name, ts, args, custom };
}

const PG_TEXT: Emission = { builder: 'text', ts: 'string', args: 'none' };
const PG_BYTEA = customEmission(namedCustomType('bytea', 'Buffer'), 'other');

const PG_SMALLINT: Emission = {
  builder: 'smallint',
  ts: 'number',
  args: 'none',
  autoInc: true,
};

const PG_INTEGER: Emission = {
  builder: 'integer',
  ts: 'number',
  args: 'none',
  autoInc: true,
};

const PG_BIGINT: Emission = {
  builder: 'bigint',
  ts: 'number',
  args: 'none',
  options: ['mode: "number"'],
  autoInc: true,
};

const PG_REAL: Emission = { builder: 'real', ts: 'number', args: 'none' };

const PG_DOUBLE: Emission = {
  builder: 'doublePrecision',
  ts: 'number',
  args: 'none',
};

const PG_DATE: Emission = { builder: 'date', ts: 'string', args: 'none' };

const PG_TIMESTAMP: Emission = {
  builder: 'timestamp',
  ts: 'other',
  args: 'seconds',
};

const PG_TIMESTAMP_TZ: Emission = {
  ...PG_TIMESTAMP,
  options: ['withTimezone: true'],
};

// The PostgreSQL types pg-core has no builder for, each declared under its own
// name; node-postgres hands every one of them over as text.
const POSTGRES_TEXT_TYPES = [
  'box',
  'datemultirange',
  'daterange',
  'int4multirange',
  'int4range',
  'int8multirange',
  'int8range',
  'lseg',
  'money',
  'nummultirange',
  'numrange',
  'path',
  'polygon',
  'tsmultirange',
  'tsquery',
  'tsrange',
  'tstzmultirange',
  'tstzrange',
  'tsvector',
  'xml',
];

const POSTGRES_TYPES: ReadonlyMap<string, Emission> = new Map([
  ...POSTGRES_TEXT_TYPES.map((name): [string, Emission] => [
    name,
    customEmission(namedCustomType(name, 'string'), 'string'),
  ]),
  ['bit', customEmission(bitCustomType('string'), 'string', 'length')],
  ['bit varying', customEmission(VARBIT_TYPE, 'string', 'length')],
  ['varbit', customEmission(VARBIT_TYPE, 'string', 'length')],
]);

const PG_TYPES: ReadonlyArray<[string[], Emission]> = [
  [CHAR_NAMES, { builder: 'char', ts: 'string', args: 'length' }],
  [VARCHAR_NAMES, { builder: 'varchar', ts: 'string', args: 'length' }],
  [[...TEXT_NAMES, 'longtext', 'mediumtext', 'tinytext'], PG_TEXT],
  [BINARY_NAMES, PG_BYTEA],
  [[...UUID_TYPES], { builder: 'uuid', ts: 'string', args: 'none' }],
  [['json'], { builder: 'json', ts: 'other', args: 'none' }],
  [['jsonb'], { builder: 'jsonb', ts: 'other', args: 'none' }],
  [['bool', 'boolean'], { builder: 'boolean', ts: 'boolean', args: 'none' }],
  [['byte', 'int1', 'int2', 'short', 'smallint', 'tinyint'], PG_SMALLINT],
  [['int', 'int3', 'int4', 'integer', 'mediumint', 'middleint'], PG_INTEGER],
  [['bigint', 'int8'], PG_BIGINT],
  [['serial', 'serial4'], { builder: 'serial', ts: 'number', args: 'none' }],
  [
    ['serial2', 'smallserial'],
    { builder: 'smallserial', ts: 'number', args: 'none' },
  ],
  [
    ['bigserial', 'serial8'],
    {
      builder: 'bigserial',
      ts: 'number',
      args: 'none',
      options: ['mode: "number"'],
    },
  ],
  [['binary_float', 'float4', 'real'], PG_REAL],
  [['binary_double', 'double', 'double precision', 'float8'], PG_DOUBLE],
  [
    ['dec', 'decimal', 'fixed', ...MONEY_TYPES, 'number', 'numeric'],
    {
      builder: 'numeric',
      ts: 'string',
      args: 'precision',
      numericString: true,
    },
  ],
  [['date'], PG_DATE],
  [
    ['time', 'time without time zone'],
    { builder: 'time', ts: 'string', args: 'seconds' },
  ],
  [
    [...POSTGRES_TIME_TZ_TYPES],
    {
      builder: 'time',
      ts: 'string',
      args: 'seconds',
      options: ['withTimezone: true'],
    },
  ],
  [
    [
      'datetime',
      'datetime2',
      'smalldatetime',
      'timestamp',
      'timestamp_ntz',
      'timestamp without time zone',
    ],
    PG_TIMESTAMP,
  ],
  [[...TIMESTAMP_TZ_TYPES, ...TIMESTAMP_LTZ_TYPES], PG_TIMESTAMP_TZ],
  [['cidr'], { builder: 'cidr', ts: 'string', args: 'none' }],
  [['inet', 'inet4', 'inet6'], { builder: 'inet', ts: 'string', args: 'none' }],
  [['macaddr'], { builder: 'macaddr', ts: 'string', args: 'none' }],
  [['macaddr8'], { builder: 'macaddr8', ts: 'string', args: 'none' }],
  [
    [...POSTGRES_BIT_TYPES],
    { builder: 'varchar', ts: 'string', args: 'length' },
  ],
  [['point'], { builder: 'point', ts: 'other', args: 'none' }],
  [['line'], { builder: 'line', ts: 'other', args: 'none' }],
];

const PG_FALLBACK: Record<PrimitiveType, Emission> = {
  int: PG_INTEGER,
  long: PG_BIGINT,
  float: PG_REAL,
  double: PG_DOUBLE,
  decimal: {
    builder: 'numeric',
    ts: 'string',
    args: 'precision',
    numericString: true,
  },
  boolean: { builder: 'boolean', ts: 'boolean', args: 'none' },
  string: { builder: 'varchar', ts: 'string', args: 'length' },
  lob: PG_TEXT,
  date: PG_DATE,
  dateTime: PG_TIMESTAMP,
  time: { builder: 'time', ts: 'string', args: 'seconds' },
};

const MYSQL_TEXT: Emission = { builder: 'text', ts: 'string', args: 'none' };

const MYSQL_DOUBLE: Emission = {
  builder: 'double',
  ts: 'number',
  args: 'precisionAndScale',
  autoInc: true,
  unsigned: true,
};

const MYSQL_FLOAT: Emission = {
  builder: 'float',
  ts: 'number',
  args: 'floatPrecision',
  autoInc: true,
  unsigned: true,
};

function mysqlBlob(name: string): Emission {
  return customEmission(namedCustomType(name, 'Buffer'), 'other');
}

const MYSQL_TINYBLOB = mysqlBlob('tinyblob');
const MYSQL_BLOB = mysqlBlob('blob');
const MYSQL_MEDIUMBLOB = mysqlBlob('mediumblob');
const MYSQL_LONGBLOB = mysqlBlob('longblob');

// MySQL and MariaDB store a BLOB(n) as the smallest blob that holds n bytes.
const MYSQL_BLOB_SIZES: ReadonlyArray<[number, Emission]> = [
  [255, MYSQL_TINYBLOB],
  [65_535, MYSQL_BLOB],
  [16_777_215, MYSQL_MEDIUMBLOB],
];

// mysql2 parses a spatial value into points and arrays of them and writes no
// such value back, so these types leave the value's shape unstated.
const MYSQL_SPATIAL_TYPES = [
  'geomcollection',
  'geometry',
  'geometrycollection',
  'linestring',
  'multilinestring',
  'multipoint',
  'multipolygon',
  'point',
  'polygon',
];

const MYSQL_SET = customEmission(SET_TYPE, 'string', 'members');

const MYSQL_TYPES: ReadonlyArray<[string[], Emission]> = [
  [BINARY_NAMES, MYSQL_BLOB],
  [['blob'], { ...MYSQL_BLOB, args: 'blobLength' }],
  [['tinyblob'], MYSQL_TINYBLOB],
  [['long varbinary', 'mediumblob'], MYSQL_MEDIUMBLOB],
  [['longblob'], MYSQL_LONGBLOB],
  ...MYSQL_SPATIAL_TYPES.map((name): [string[], Emission] => [
    [name],
    customEmission(namedCustomType(name, 'unknown'), 'other'),
  ]),
  [['bit'], customEmission(bitCustomType('Buffer'), 'other', 'length')],
  [
    ['byte', 'int1', 'tinyint'],
    {
      builder: 'tinyint',
      ts: 'number',
      args: 'none',
      autoInc: true,
      unsigned: true,
    },
  ],
  [
    ['int2', 'short', 'smallint'],
    {
      builder: 'smallint',
      ts: 'number',
      args: 'none',
      autoInc: true,
      unsigned: true,
    },
  ],
  [
    ['int3', 'mediumint', 'middleint'],
    {
      builder: 'mediumint',
      ts: 'number',
      args: 'none',
      autoInc: true,
      unsigned: true,
    },
  ],
  [
    ['int', 'int4', 'integer'],
    {
      builder: 'int',
      ts: 'number',
      args: 'none',
      autoInc: true,
      unsigned: true,
    },
  ],
  [
    ['bigint', 'int8'],
    {
      builder: 'bigint',
      ts: 'number',
      args: 'none',
      options: ['mode: "number"'],
      autoInc: true,
      unsigned: true,
    },
  ],
  [['serial'], { builder: 'serial', ts: 'number', args: 'none' }],
  [
    ['dec', 'decimal', 'fixed', 'number', 'numeric'],
    {
      builder: 'decimal',
      ts: 'string',
      args: 'precision',
      unsigned: true,
      numericString: true,
    },
  ],
  [['binary_float', 'float', 'float4'], MYSQL_FLOAT],
  [
    ['binary_double', 'double', 'double precision', 'float8', 'real'],
    MYSQL_DOUBLE,
  ],
  [['bool', 'boolean'], { builder: 'boolean', ts: 'boolean', args: 'none' }],
  [CHAR_NAMES, { builder: 'char', ts: 'string', args: 'length' }],
  [
    VARCHAR_NAMES,
    {
      builder: 'varchar',
      ts: 'string',
      args: 'lengthRequired',
      degraded: MYSQL_TEXT,
    },
  ],
  [PLAIN_TEXT_NAMES, MYSQL_TEXT],
  [['tinytext'], { builder: 'tinytext', ts: 'string', args: 'none' }],
  [
    ['mediumtext', ...LONG_TEXT_NAMES],
    { builder: 'mediumtext', ts: 'string', args: 'none' },
  ],
  [['longtext'], { builder: 'longtext', ts: 'string', args: 'none' }],
  [['json'], { builder: 'json', ts: 'other', args: 'none' }],
  [['date'], { builder: 'date', ts: 'other', args: 'none' }],
  [['datetime'], { builder: 'datetime', ts: 'other', args: 'seconds' }],
  [['timestamp'], { builder: 'timestamp', ts: 'other', args: 'seconds' }],
  [['time'], { builder: 'time', ts: 'string', args: 'seconds' }],
  [['sql_tsi_year', 'year'], { builder: 'year', ts: 'number', args: 'none' }],
  [['binary', 'char byte'], { builder: 'binary', ts: 'other', args: 'length' }],
  [
    ['binary varying', 'raw', 'varbinary'],
    {
      builder: 'varbinary',
      ts: 'other',
      args: 'lengthRequired',
      degraded: MYSQL_BLOB,
    },
  ],
];

// MariaDB refuses the AUTO_INCREMENT drizzle-kit writes after serial, so its
// SERIAL is spelt out as the BIGINT UNSIGNED it stands for; mysql-core has no
// builder for its UUID, INET4 and INET6; its Oracle mode's CLOB is a LONGTEXT.
const MARIADB_TYPES: ReadonlyMap<string, Emission> = new Map([
  [
    'serial',
    {
      builder: 'bigint',
      ts: 'number',
      args: 'none',
      options: ['mode: "number"'],
      unsigned: true,
      serial: true,
    },
  ],
  ...['inet4', 'inet6', 'uuid'].map((name): [string, Emission] => [
    name,
    customEmission(namedCustomType(name, 'string'), 'string'),
  ]),
  ['clob', { builder: 'longtext', ts: 'string', args: 'none' }],
]);

const MYSQL_FALLBACK: Record<PrimitiveType, Emission> = {
  int: {
    builder: 'int',
    ts: 'number',
    args: 'none',
    autoInc: true,
    unsigned: true,
  },
  long: {
    builder: 'bigint',
    ts: 'number',
    args: 'none',
    options: ['mode: "number"'],
    autoInc: true,
    unsigned: true,
  },
  float: MYSQL_FLOAT,
  double: MYSQL_DOUBLE,
  decimal: {
    builder: 'decimal',
    ts: 'string',
    args: 'precision',
    unsigned: true,
    numericString: true,
  },
  boolean: { builder: 'boolean', ts: 'boolean', args: 'none' },
  string: {
    builder: 'varchar',
    ts: 'string',
    args: 'lengthRequired',
    degraded: MYSQL_TEXT,
  },
  lob: MYSQL_TEXT,
  date: { builder: 'date', ts: 'other', args: 'none' },
  dateTime: { builder: 'datetime', ts: 'other', args: 'seconds' },
  time: { builder: 'time', ts: 'string', args: 'seconds' },
};

const SQLITE_INTEGER: Emission = {
  builder: 'integer',
  ts: 'number',
  args: 'none',
  autoInc: true,
};

const SQLITE_REAL: Emission = { builder: 'real', ts: 'number', args: 'none' };
const SQLITE_NUMERIC: Emission = {
  builder: 'numeric',
  ts: 'string',
  args: 'none',
  numericString: true,
};
const SQLITE_TEXT: Emission = { builder: 'text', ts: 'string', args: 'length' };
const SQLITE_LOB: Emission = { builder: 'text', ts: 'string', args: 'none' };
const SQLITE_BOOLEAN: Emission = {
  builder: 'integer',
  ts: 'boolean',
  args: 'none',
  options: ['mode: "boolean"'],
};

const SQLITE_TYPES: ReadonlyArray<[string[], Emission]> = [
  [['bool', 'boolean'], SQLITE_BOOLEAN],
  [
    [
      'bigint',
      'byte',
      'int',
      'int1',
      'int2',
      'int3',
      'int4',
      'int8',
      'integer',
      'mediumint',
      'middleint',
      'serial',
      'short',
      'smallint',
      'tinyint',
      'unsigned big int',
      'year',
    ],
    SQLITE_INTEGER,
  ],
  [
    [
      'binary_double',
      'binary_float',
      'double',
      'double precision',
      'float',
      'float4',
      'float8',
      'real',
    ],
    SQLITE_REAL,
  ],
  [
    ['dec', 'decimal', 'fixed', ...MONEY_TYPES, 'number', 'numeric'],
    SQLITE_NUMERIC,
  ],
  [
    BINARY_NAMES,
    {
      builder: 'blob',
      ts: 'other',
      args: 'none',
      options: ['mode: "buffer"'],
    },
  ],
  [CHAR_NAMES, SQLITE_TEXT],
  [VARCHAR_NAMES, SQLITE_TEXT],
  [
    [
      ...TEXT_NAMES,
      ...JSON_TYPES,
      ...UUID_TYPES,
      'longtext',
      'mediumtext',
      'tinytext',
      'xml',
    ],
    SQLITE_LOB,
  ],
];

const SQLITE_FALLBACK: Record<PrimitiveType, Emission> = {
  int: SQLITE_INTEGER,
  long: SQLITE_INTEGER,
  float: SQLITE_REAL,
  double: SQLITE_REAL,
  decimal: SQLITE_NUMERIC,
  boolean: SQLITE_BOOLEAN,
  string: SQLITE_TEXT,
  lob: SQLITE_LOB,
  date: SQLITE_LOB,
  dateTime: SQLITE_LOB,
  time: SQLITE_LOB,
};

function toVendorMap(
  rows: ReadonlyArray<[string[], Emission]>
): ReadonlyMap<string, Emission> {
  return new Map(
    rows.flatMap(([names, emission]) =>
      names.map((name): [string, Emission] => [name, emission])
    )
  );
}

const VENDOR_TYPES: Record<Dialect, ReadonlyMap<string, Emission>> = {
  pg: toVendorMap(PG_TYPES),
  mysql: toVendorMap(MYSQL_TYPES),
  sqlite: toVendorMap(SQLITE_TYPES),
};

const FALLBACK_TYPES: Record<Dialect, Record<PrimitiveType, Emission>> = {
  pg: PG_FALLBACK,
  mysql: MYSQL_FALLBACK,
  sqlite: SQLITE_FALLBACK,
};

/** The names one database reads apart from the other users of its core. */
const DATABASE_TYPES: Record<number, ReadonlyMap<string, Emission>> = {
  [Database.PostgreSQL]: POSTGRES_TYPES,
  [Database.MariaDB]: MARIADB_TYPES,
};

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

  const context = createSchemaContext(state);
  const imports = createImportSet();
  const bodyBuffer: string[] = [];

  tables.forEach((table, index) => {
    if (index !== 0) {
      bodyBuffer.push('');
    }
    formatDeclarations(state, { buffer: bodyBuffer, table }, context, imports);
  });

  const stringBuffer: string[] = [''];
  formatImports(stringBuffer, context, imports);
  stringBuffer.push('');
  formatCustomTypes(stringBuffer, imports);
  bodyBuffer.forEach(line => stringBuffer.push(line));
  stringBuffer.push('');

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const context = createSchemaContext(state);
  const imports = createImportSet();
  const bodyBuffer: string[] = [];

  formatDeclarations(state, { buffer: bodyBuffer, table }, context, imports);
  formatImports(buffer, context, imports);
  buffer.push('');
  formatCustomTypes(buffer, imports);
  bodyBuffer.forEach(line => buffer.push(line));
}

function createImportSet(): ImportSet {
  return {
    core: new Set<string>(),
    dialect: new Set<string>(),
    types: new Set<string>(),
    customs: new Map<string, CustomType>(),
  };
}

function formatImports(
  buffer: string[],
  { dialect }: SchemaContext,
  imports: ImportSet
) {
  if (imports.core.size !== 0) {
    formatImport(buffer, CORE_MODULE, imports.core);
  }
  formatImport(buffer, DIALECT_MODULE[dialect], imports.dialect);
  if (imports.types.size !== 0) {
    formatImport(buffer, DIALECT_MODULE[dialect], imports.types, 'import type');
  }
}

function formatCustomTypes(buffer: string[], { customs }: ImportSet) {
  if (customs.size === 0) {
    return;
  }

  Array.from(customs.values())
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .forEach(custom => custom.lines.forEach(line => buffer.push(line)));
  buffer.push('');
}

function formatImport(
  buffer: string[],
  module: string,
  names: ReadonlySet<string>,
  keyword = 'import'
) {
  const sorted = Array.from(names).sort();
  const line = `${keyword} { ${sorted.join(', ')} } from "${module}";`;

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  buffer.push(`${keyword} {`);
  sorted.forEach(name => buffer.push(`${INDENT}${name},`));
  buffer.push(`} from "${module}";`);
}

function formatDeclarations(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: SchemaContext,
  imports: ImportSet
) {
  const {
    settings: { database },
    collections,
  } = state;
  const naming = getNaming(state, context, table);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(naming.columnIds);

  const primaryKeyIds = new Set(
    columns
      .filter(column => bHas(column.options, ColumnOption.primaryKey))
      .map(column => column.id)
  );
  const isComposite = primaryKeyIds.size > 1;
  const references = createReferences(state, context, table, imports);
  const columnBuffer: string[] = [];
  const enumBuffer: string[] = [];

  columns.forEach(column => {
    const property = naming.columnNames.get(column.id) ?? column.name;
    const enumNaming = naming.enumNames.get(column.id) ?? null;
    const columnType = getColumnType(column, property, {
      database,
      dialect: context.dialect,
      enumNaming,
    });

    if (columnType.custom !== null) {
      imports.dialect.add(CUSTOM_TYPE);
      imports.customs.set(columnType.custom.name, columnType.custom);
    } else if (columnType.builder !== null) {
      imports.dialect.add(columnType.builder);
    }
    if (enumNaming !== null && columnType.members !== null) {
      const list = memberList(columnType.members);

      imports.dialect.add(PG_ENUM);
      enumBuffer.push(
        `export const ${enumNaming.constName} = ${PG_ENUM}("${escapeString(enumNaming.typeName)}", ${list});`
      );
      enumBuffer.push('');
    }

    formatColumn(
      { buffer: columnBuffer, column },
      {
        property,
        columnType,
        isComposite,
        reference: references.get(column.id) ?? null,
        dialect: context.dialect,
        imports,
      }
    );
  });

  const extras = createExtras(
    state,
    { table, naming, columns, primaryKeyIds, isComposite },
    context,
    imports
  );

  imports.dialect.add(TABLE_FUNCTION[context.dialect]);
  enumBuffer.forEach(line => buffer.push(line));

  formatComment(buffer, '', table.comment);

  const annotation = context.annotated.has(table.id)
    ? EXTRA_CONFIG_VALUE[context.dialect]
    : null;

  if (annotation !== null) {
    imports.types.add(annotation);
  }

  formatTableCall(
    buffer,
    table,
    naming,
    columnBuffer,
    extras,
    annotation,
    context
  );
  formatRelations(state, buffer, table, naming, context, imports);
}

function formatTableCall(
  buffer: string[],
  table: Table,
  naming: TableNaming,
  columnBuffer: string[],
  extras: Extra[],
  annotation: string | null,
  { dialect }: SchemaContext
) {
  const head = `export const ${naming.constName} = ${TABLE_FUNCTION[dialect]}(`;
  const name = `"${escapeString(table.name)}"`;

  if (extras.length === 0) {
    if (columnBuffer.length === 0) {
      buffer.push(`${head}${name}, {});`);
      return;
    }

    buffer.push(`${head}${name}, {`);
    columnBuffer.forEach(line => buffer.push(line));
    buffer.push('});');
    return;
  }

  buffer.push(head);
  buffer.push(`${INDENT}${name},`);
  if (columnBuffer.length === 0) {
    buffer.push(`${INDENT}{},`);
  } else {
    buffer.push(`${INDENT}{`);
    columnBuffer.forEach(line => buffer.push(`${INDENT}${line}`));
    buffer.push(`${INDENT}},`);
  }
  const arrow =
    annotation === null ? `${SELF} =>` : `(${SELF}): ${annotation}[] =>`;
  const inline = `${INDENT}${arrow} [${extras.map(inlineExtra).join(', ')}]`;

  if (inline.length <= LINE_LIMIT) {
    buffer.push(inline);
  } else {
    buffer.push(`${INDENT}${arrow} [`);
    extras.forEach(entry => formatExtra(buffer, `${INDENT}${INDENT}`, entry));
    buffer.push(`${INDENT}]`);
  }
  buffer.push(');');
}

type ColumnEmission = {
  property: string;
  columnType: ColumnType;
  isComposite: boolean;
  reference: string | null;
  dialect: Dialect;
  imports: ImportSet;
};

function formatColumn(
  { buffer, column }: { buffer: string[]; column: Column },
  {
    property,
    columnType,
    isComposite,
    reference,
    dialect,
    imports,
  }: ColumnEmission
) {
  const { isPrimaryKey, isAutoIncrement, isNotNull } = columnFlags(column);
  const autoInc = (isAutoIncrement && columnType.autoInc) || columnType.serial;
  const single = isPrimaryKey && !isComposite;
  const marked = autoInc && (dialect !== 'sqlite' || single);
  const chain: string[] = [];

  if (single && dialect === 'sqlite') {
    chain.push(
      autoInc ? '.primaryKey({ autoIncrement: true })' : '.primaryKey()'
    );
  } else {
    if (autoInc && dialect === 'mysql') {
      chain.push('.autoincrement()');
    }
    if (single) {
      chain.push('.primaryKey()');
    }
    if (autoInc && dialect === 'pg') {
      chain.push('.generatedAlwaysAsIdentity()');
    }
  }

  if ((isNotNull || columnType.serial) && !single) {
    chain.push('.notNull()');
  }
  if (
    (bHas(column.options, ColumnOption.unique) || columnType.serial) &&
    !single
  ) {
    chain.push('.unique()');
  }

  const value = column.default.trim();
  if (!marked && value !== '') {
    chain.push(defaultModifier(value, columnType, imports));
  }
  if (reference !== null) {
    chain.push(reference);
  }

  formatComment(buffer, INDENT, column.comment);

  const line = `${INDENT}${property}: ${columnType.head}${chain.join('')},`;
  if (line.length <= LINE_LIMIT || chain.length === 0) {
    buffer.push(line);
    return;
  }

  buffer.push(`${INDENT}${property}: ${columnType.head}`);
  chain.forEach((link, index) =>
    buffer.push(
      `${INDENT}${INDENT}${link}${index === chain.length - 1 ? ',' : ''}`
    )
  );
}

function formatComment(buffer: string[], indent: string, comment: string) {
  if (comment.trim() === '') {
    return;
  }

  splitLines(comment).forEach(line =>
    buffer.push(`${indent}// ${escapeTypeScriptDirective(line)}`)
  );
}

function columnFlags(column: Column): ColumnFlags {
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);

  return {
    isPrimaryKey,
    isAutoIncrement: bHas(column.options, ColumnOption.autoIncrement),
    isNotNull: isPrimaryKey || bHas(column.options, ColumnOption.notNull),
  };
}

const NUMERIC_LITERAL = /^[+-]?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const LEADING_PLUS = /^\+/;
const TRAILING_ZEROS = /\.?0+$/;
const QUOTED_LITERAL = /^'([^']|'')*'$/;
const ESCAPED_QUOTE = /''/g;

// PostgreSQL refuses an integer as a boolean's default, where SQL Server's bit
// takes 0 and 1; MySQL, MariaDB and SQLite read true and false as 1 and 0.
const BOOLEAN_DEFAULTS: ReadonlyMap<string, string> = new Map([
  ['0', 'false'],
  ['1', 'true'],
  ['false', 'false'],
  ['true', 'true'],
]);

function defaultModifier(
  value: string,
  { ts, members, numericString }: ColumnType,
  imports: ImportSet
): string {
  if (NUMERIC_LITERAL.test(value) && isExactNumber(value)) {
    if (ts === 'number') {
      return `.default(${value})`;
    }
    if (numericString) {
      return `.default("${value}")`;
    }
  }

  if (ts === 'string' && QUOTED_LITERAL.test(value)) {
    const unquoted = value.slice(1, -1).replace(ESCAPED_QUOTE, "'");

    if (members === null || members.includes(unquoted)) {
      return `.default("${escapeString(unquoted)}")`;
    }
  }

  const flag = BOOLEAN_DEFAULTS.get(value.toLocaleLowerCase());
  if (ts === 'boolean' && flag !== undefined) {
    return `.default(${flag})`;
  }

  imports.core.add(SQL);
  return `.default(${SQL}\`${escapeTemplate(value)}\`)`;
}

function isExactNumber(value: string): boolean {
  return normalizeNumber(value) === normalizeNumber(String(Number(value)));
}

function normalizeNumber(value: string): string {
  const signed = value.replace(LEADING_PLUS, '');
  return signed.includes('.') ? signed.replace(TRAILING_ZEROS, '') : signed;
}

function createReferences(
  state: RootState,
  context: SchemaContext,
  table: Table,
  imports: ImportSet
): Map<string, string> {
  const references = new Map<string, string>();

  context.relationships
    .filter(
      ({ relationship }) =>
        relationship.end.tableId === table.id &&
        context.inlined.has(relationship.id)
    )
    .forEach(({ relationship, startTable, startColumns, endColumns }) => {
      const parentNaming = getNaming(state, context, startTable);
      const referenced = parentNaming.columnNames.get(startColumns[0].id);

      if (referenced === undefined) {
        return;
      }

      const carrier = carrierOf(state, context, table, endColumns[0].id);
      const target = `${parentNaming.constName}.${referenced}`;
      const actions = referentialActionEntries(
        relationship,
        context.actionSupport
      ).map(({ key, sql }) => `${key}: "${sql.toLowerCase()}"`);
      const options = actions.length ? `, { ${actions.join(', ')} }` : '';

      if (!context.cyclic.has(relationship.id)) {
        references.set(carrier, `.references(() => ${target}${options})`);
        return;
      }

      const annotation = ANY_COLUMN[context.dialect];
      imports.types.add(annotation);
      references.set(
        carrier,
        `.references((): ${annotation} => ${target}${options})`
      );
    });

  return references;
}

function carrierOf(
  state: RootState,
  context: SchemaContext,
  table: Table,
  columnId: string
): string {
  return getNaming(state, context, table).carriers.get(columnId) ?? columnId;
}

function planReferences(state: RootState, context: SchemaContext) {
  const claimed = new Set<string>();

  context.relationships.forEach(({ relationship, endTable, endColumns }) => {
    if (endColumns.length !== 1) {
      return;
    }

    const carrier = carrierOf(state, context, endTable, endColumns[0].id);

    if (claimed.has(carrier)) {
      return;
    }

    claimed.add(carrier);
    context.inlined.add(relationship.id);
  });

  const edges = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    const targets = edges.get(from) ?? new Set<string>();
    targets.add(to);
    edges.set(from, targets);
  };

  context.relationships.forEach(({ relationship }) => {
    const { tableId: parent } = relationship.start;
    const { tableId: child } = relationship.end;

    if (context.inlined.has(relationship.id) || parent !== child) {
      add(child, parent);
    }
  });

  context.relationships.forEach(({ relationship }) => {
    const { tableId: parent } = relationship.start;
    const { tableId: child } = relationship.end;

    if (!context.inlined.has(relationship.id) && parent === child) {
      return;
    }
    if (!reaches(edges, parent, child)) {
      return;
    }

    if (context.inlined.has(relationship.id)) {
      context.cyclic.add(relationship.id);
    } else {
      context.annotated.add(child);
    }
  });
}

function reaches(
  edges: Map<string, Set<string>>,
  from: string,
  to: string
): boolean {
  const seen = new Set<string>();
  const stack = [from];

  while (stack.length !== 0) {
    const current = stack.pop() as string;

    if (current === to) {
      return true;
    }
    if (seen.has(current)) {
      continue;
    }

    seen.add(current);
    edges.get(current)?.forEach(next => stack.push(next));
  }

  return false;
}

type Extra =
  | { kind: 'object'; builder: string; entries: string[]; chain?: string[] }
  | { kind: 'call'; head: string; args: string[] };

type ExtrasOptions = {
  table: Table;
  naming: TableNaming;
  columns: Column[];
  primaryKeyIds: Set<string>;
  isComposite: boolean;
};

function createExtras(
  state: RootState,
  { table, naming, columns, primaryKeyIds, isComposite }: ExtrasOptions,
  context: SchemaContext,
  imports: ImportSet
): Extra[] {
  const entries: Extra[] = [];

  if (isComposite) {
    const members = columns
      .filter(column => primaryKeyIds.has(column.id))
      .map(column => `${SELF}.${naming.columnNames.get(column.id)}`);

    imports.dialect.add(PRIMARY_KEY);
    entries.push({
      kind: 'object',
      builder: PRIMARY_KEY,
      entries: [`columns: [${members.join(', ')}]`],
    });
  }

  createForeignKeys(state, table, naming, context).forEach(entry => {
    imports.dialect.add(FOREIGN_KEY);
    entries.push(entry);
  });

  createIndexEntries(state, table, naming, context).forEach(entry => {
    imports.dialect.add(entry.unique ? UNIQUE_INDEX : INDEX);
    entries.push(entry.value);
  });

  return entries;
}

function inlineExtra(extra: Extra): string {
  return extra.kind === 'object'
    ? `${extra.builder}({ ${extra.entries.join(', ')} })${chainOf(extra)}`
    : `${extra.head}(${extra.args.join(', ')})`;
}

function chainOf(extra: Extract<Extra, { kind: 'object' }>): string {
  return (extra.chain ?? []).join('');
}

function formatExtra(buffer: string[], indent: string, extra: Extra) {
  const line = `${indent}${inlineExtra(extra)},`;

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  if (extra.kind === 'object') {
    buffer.push(`${indent}${extra.builder}({`);
    extra.entries.forEach(entry => buffer.push(`${indent}${INDENT}${entry},`));
    buffer.push(`${indent}})${chainOf(extra)},`);
    return;
  }

  buffer.push(`${indent}${extra.head}(`);
  extra.args.forEach((arg, index) =>
    buffer.push(
      `${indent}${INDENT}${arg}${index === extra.args.length - 1 ? '' : ','}`
    )
  );
  buffer.push(`${indent}),`);
}

function createForeignKeys(
  state: RootState,
  table: Table,
  naming: TableNaming,
  context: SchemaContext
): Extra[] {
  return context.relationships
    .filter(
      ({ relationship }) =>
        relationship.end.tableId === table.id &&
        !context.inlined.has(relationship.id)
    )
    .flatMap(({ relationship, startTable, startColumns, endColumns }) => {
      const parentNaming = getNaming(state, context, startTable);
      const own = endColumns.map(column => naming.columnNames.get(column.id));
      const target = startColumns.map(column =>
        parentNaming.columnNames.get(column.id)
      );

      if (
        own.some(name => name === undefined) ||
        target.some(name => name === undefined)
      ) {
        return [];
      }

      const scope = startTable.id === table.id ? SELF : parentNaming.constName;
      const columns = own.map(name => `${SELF}.${name}`).join(', ');
      const foreignColumns = target.map(name => `${scope}.${name}`).join(', ');

      return [
        {
          kind: 'object' as const,
          builder: FOREIGN_KEY,
          entries: [
            `columns: [${columns}]`,
            `foreignColumns: [${foreignColumns}]`,
          ],
          chain: referentialActionEntries(
            relationship,
            context.actionSupport
          ).map(({ key, sql }) => `.${key}("${sql.toLowerCase()}")`),
        },
      ];
    });
}

function createIndexEntries(
  state: RootState,
  table: Table,
  naming: TableNaming,
  { indexNames, dialect }: SchemaContext
): Array<{ value: Extra; unique: boolean }> {
  const {
    doc: { indexIds },
    collections,
  } = state;
  const columnCollection = query(collections).collection('tableColumnEntities');
  const entries: Array<{ value: Extra; unique: boolean }> = [];

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .forEach(index => {
      const properties = Array.from(
        new Set(
          query(collections)
            .collection('indexColumnEntities')
            .selectByIds(index.indexColumnIds)
            .flatMap(indexColumn => {
              const property = naming.columnNames.get(indexColumn.columnId);

              if (
                property === undefined ||
                !columnCollection.selectById(indexColumn.columnId)
              ) {
                return [];
              }

              return dialect === 'pg' &&
                indexColumn.orderType === OrderType.DESC
                ? [`${SELF}.${property}.desc()`]
                : [`${SELF}.${property}`];
            })
        )
      );

      if (properties.length === 0) {
        return;
      }

      const builder = index.unique ? UNIQUE_INDEX : INDEX;
      const name = escapeString(indexNames.get(index.id) ?? index.name);

      entries.push({
        value: {
          kind: 'call',
          head: `${builder}("${name}").on`,
          args: properties,
        },
        unique: index.unique,
      });
    });

  return entries;
}

type RelationEntry = {
  property: string;
  helper: 'one' | 'many';
  target: string;
  options: string[];
};

function formatRelations(
  state: RootState,
  buffer: string[],
  table: Table,
  naming: TableNaming,
  context: SchemaContext,
  imports: ImportSet
) {
  const entries: RelationEntry[] = [];

  context.relationships
    .filter(({ relationship }) => relationship.end.tableId === table.id)
    .forEach(({ relationship, startTable, startColumns, endColumns }) => {
      const property = naming.relationshipNames.get(
        relationshipKey(relationship, OWNING)
      );

      if (!property || endColumns.length !== 1) {
        return;
      }

      const parentNaming = getNaming(state, context, startTable);
      const own = naming.columnNames.get(endColumns[0].id);
      const target = parentNaming.columnNames.get(startColumns[0].id);

      if (own === undefined || target === undefined) {
        return;
      }

      entries.push({
        property,
        helper: 'one',
        target: parentNaming.constName,
        options: [
          `fields: [${naming.constName}.${own}]`,
          `references: [${parentNaming.constName}.${target}]`,
          ...aliasOption(context, relationship),
        ],
      });
    });

  context.relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable, startColumns, endColumns }) => {
      const property = naming.relationshipNames.get(
        relationshipKey(relationship, INVERSE)
      );

      if (!property) {
        return;
      }

      const childNaming = getNaming(state, context, endTable);
      const many = hasNRelationship(relationship.relationshipType);
      const alias = aliasOption(context, relationship);
      const own = naming.columnNames.get(startColumns[0].id);
      const target = childNaming.columnNames.get(endColumns[0].id);
      const spelled =
        !many &&
        alias.length !== 0 &&
        own !== undefined &&
        target !== undefined;

      entries.push({
        property,
        helper: many ? 'many' : 'one',
        target: childNaming.constName,
        options: spelled
          ? [
              `fields: [${naming.constName}.${own}]`,
              `references: [${childNaming.constName}.${target}]`,
              ...alias,
            ]
          : alias,
      });
    });

  if (entries.length === 0) {
    return;
  }

  const helpers = [
    ...(entries.some(entry => entry.helper === 'one') ? ['one'] : []),
    ...(entries.some(entry => entry.helper === 'many') ? ['many'] : []),
  ];

  const callback = `({ ${helpers.join(', ')} }) => ({`;
  const head = `export const ${naming.relationsName} = ${RELATIONS}(`;
  const line = `${head}${naming.constName}, ${callback}`;

  imports.core.add(RELATIONS);
  buffer.push('');

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    entries.forEach(entry => formatRelationEntry(buffer, INDENT, entry));
    buffer.push('}));');
    return;
  }

  buffer.push(head);
  buffer.push(`${INDENT}${naming.constName},`);
  buffer.push(`${INDENT}${callback}`);
  entries.forEach(entry =>
    formatRelationEntry(buffer, `${INDENT}${INDENT}`, entry)
  );
  buffer.push(`${INDENT}})`);
  buffer.push(');');
}

function formatRelationEntry(
  buffer: string[],
  indent: string,
  { property, helper, target, options }: RelationEntry
) {
  const head = `${property}: ${helper}(${target}`;

  if (options.length === 0) {
    buffer.push(`${indent}${head}),`);
    return;
  }

  const inline = `${indent}${head}, { ${options.join(', ')} }),`;
  if (inline.length <= LINE_LIMIT) {
    buffer.push(inline);
    return;
  }

  buffer.push(`${indent}${head}, {`);
  options.forEach(option => buffer.push(`${indent}${INDENT}${option},`));
  buffer.push(`${indent}}),`);
}

function aliasOption(
  { aliases }: SchemaContext,
  relationship: Relationship
): string[] {
  const alias = aliases.get(relationship.id);
  return alias === undefined ? [] : [`relationName: "${escapeString(alias)}"`];
}

const WHITESPACE = /\s+/g;
const SIGN_WORDS =
  /(^|[^0-9a-z_])(?:signed|unsigned|zerofill)(?=[^0-9a-z_]|$)/g;
// MySQL and MariaDB read a character set, a collation, BINARY, ASCII or
// UNICODE written after a character type as the column's, not the type's.
const CHARACTER_ATTRIBUTES =
  /(?: (?:ascii|binary|unicode|(?:char set|character set|charset|collate) \S+))+$/;
const INTERVAL = 'interval';
// PostgreSQL reads a number as an interval's seconds precision only after
// SECOND or the INTERVAL keyword; Oracle's YEAR(2) or DAY(3) is the digits of
// the leading field.
const SECONDS_PRECISION = /\b(?:interval|second)\s*\(/i;
// MariaDB's Oracle mode, the one mode that takes NUMBER, stores a NUMBER of no
// precision as a DOUBLE.
const BARE_NUMBER = 'number';
// MySQL stores FLOAT(1) to FLOAT(24) as a FLOAT and any wider one as a DOUBLE.
const SINGLE_PRECISION_DIGITS = 24;

const AMBIGUOUS_NAMES: ReadonlySet<string> = new Set([
  'bit',
  'long',
  'timestamp',
]);

type TypeOptions = {
  database: number;
  dialect: Dialect;
  enumNaming: EnumNaming | null;
};

function getColumnType(
  column: Column,
  property: string,
  { database, dialect, enumNaming }: TypeOptions
): ColumnType {
  const { dataType, name } = column;
  const classified = classifyColumnType(dataType, database);
  const argument = name === property ? null : `"${escapeString(name)}"`;
  const members = classified.enumMembers;
  const element =
    members === null
      ? scalarType(classified, argument, { database, dialect })
      : enumType(members, dialect, property, argument, enumNaming);

  return arrayType(element, classified.arrayDepth);
}

function scalarType(
  classified: ClassifiedType,
  argument: string | null,
  { database, dialect }: Pick<TypeOptions, 'database' | 'dialect'>
): ColumnType {
  const resolved = resolveScalar(classified, database, dialect);
  const options = [...resolved.options];

  if (
    dialect === 'mysql' &&
    resolved.emission.unsigned === true &&
    isUnsigned(classified.element, database)
  ) {
    options.push('unsigned: true');
  }

  return {
    head: call(resolved.emission.builder, argument, options),
    builder: resolved.emission.custom ? null : resolved.emission.builder,
    custom: resolved.emission.custom ?? null,
    ts: resolved.emission.ts,
    members: null,
    autoInc: resolved.emission.autoInc === true,
    serial: resolved.emission.serial === true,
    numericString: resolved.emission.numericString === true,
  };
}

/** The emission a type comes to once its arguments are read, and its options. */
function resolveScalar(
  classified: ClassifiedType,
  database: number,
  dialect: Dialect
): { emission: Emission; options: string[] } {
  const emission = resolveEmission(classified, database, dialect);

  return emission.args === 'members'
    ? { emission, options: [memberOption(classified.setMembers ?? [])] }
    : applyArguments(emission, builderArguments(classified), dialect);
}

/** The emission a type resolves to, before its arguments are read. */
function resolveEmission(
  classified: ClassifiedType,
  database: number,
  dialect: Dialect
): Emission {
  const { base, element, setMembers } = classified;
  // The classifier sets MySQL's UNSIGNED, ZEROFILL and SIGNED apart only on
  // MySQL and MariaDB, and no other database's type name holds them.
  const lookup = isMySQLFamily(database)
    ? base.replace(CHARACTER_ATTRIBUTES, '')
    : base.replace(SIGN_WORDS, '$1').replace(WHITESPACE, ' ').trim();

  if (lookup === INTERVAL || lookup.startsWith(`${INTERVAL} `)) {
    return intervalEmission(lookup, element, dialect);
  }
  if (dialect === 'mysql' && setMembers !== null) {
    return MYSQL_SET;
  }
  if (
    database === Database.MariaDB &&
    lookup === BARE_NUMBER &&
    classified.scalar === 'f64'
  ) {
    return MYSQL_DOUBLE;
  }

  const own = DATABASE_TYPES[database]?.get(lookup);
  const borrowed = DIALECT_BY_DATABASE[database] === undefined;
  const vendor =
    borrowed && AMBIGUOUS_NAMES.has(lookup)
      ? undefined
      : VENDOR_TYPES[dialect].get(lookup);
  const emission =
    own ??
    vendor ??
    FALLBACK_TYPES[dialect][getPrimitiveType(element, database)];

  return borrowed ? widenBorrowed(emission, classified) : emission;
}

// A database pg-core is borrowed for stores some names wider than PostgreSQL:
// Oracle's DATE holds a time, Databricks' TIMESTAMP an instant, Oracle's REAL
// and Snowflake's FLOAT4 a double, and both their integers 38 digits.
function widenBorrowed(
  emission: Emission,
  { bits, scalar }: ClassifiedType
): Emission {
  if (bits === 64 && (emission === PG_SMALLINT || emission === PG_INTEGER)) {
    return PG_BIGINT;
  }
  if (scalar === 'f64' && emission === PG_REAL) {
    return PG_DOUBLE;
  }
  if (scalar === 'dateTime' && emission === PG_DATE) {
    return PG_TIMESTAMP;
  }
  if (scalar === 'dateTimeUtc' && emission === PG_TIMESTAMP) {
    return PG_TIMESTAMP_TZ;
  }
  return emission;
}

/** A PostgreSQL array: the element's builder once per dimension. */
function arrayType(element: ColumnType, depth: number): ColumnType {
  if (depth === 0) {
    return element;
  }

  return {
    ...element,
    head: `${element.head}${'.array()'.repeat(depth)}`,
    ts: 'other',
    autoInc: false,
    serial: false,
    numericString: false,
  };
}

function memberOption(members: string[]): string {
  return `values: ${memberList(members)}`;
}

function intervalEmission(
  base: string,
  element: string,
  dialect: Dialect
): Emission {
  if (dialect === 'mysql') {
    return MYSQL_TEXT;
  }
  if (dialect === 'sqlite') {
    return SQLITE_LOB;
  }

  const fields = base.slice(INTERVAL.length).trim();
  const args = SECONDS_PRECISION.test(element) ? 'seconds' : 'none';

  return INTERVAL_FIELDS.has(fields)
    ? {
        builder: INTERVAL,
        ts: 'string',
        args,
        options: [`fields: "${fields}"`],
      }
    : { builder: INTERVAL, ts: 'string', args };
}

function enumType(
  members: string[],
  dialect: Dialect,
  property: string,
  argument: string | null,
  enumNaming: EnumNaming | null
): ColumnType {
  if (dialect === 'mysql') {
    // drizzle-kit writes a member into its DDL with only its quotes doubled,
    // so a member keeps its backslash in MySQL's string literal only doubled.
    const written = members.map(member => member.replace(BACKSLASH, '\\\\'));

    return {
      head: call(
        MYSQL_ENUM,
        argument ?? `"${escapeString(property)}"`,
        [],
        memberList(written)
      ),
      builder: MYSQL_ENUM,
      custom: null,
      ts: 'string',
      members: written,
      autoInc: false,
      serial: false,
      numericString: false,
    };
  }

  if (dialect === 'sqlite') {
    return {
      head: call('text', argument, [`enum: ${memberList(members)}`]),
      builder: 'text',
      custom: null,
      ts: 'string',
      members,
      autoInc: false,
      serial: false,
      numericString: false,
    };
  }

  return {
    head: call(enumNaming?.constName ?? property, argument, []),
    builder: null,
    custom: null,
    ts: 'string',
    members,
    autoInc: false,
    serial: false,
    numericString: false,
  };
}

function memberList(members: string[]): string {
  return `[${members.map(member => `"${escapeString(member)}"`).join(', ')}]`;
}

function call(
  builder: string,
  argument: string | null,
  options: string[],
  extra?: string
): string {
  const config = options.length === 0 ? null : `{ ${options.join(', ')} }`;
  const args = [argument, extra ?? null, config].filter(
    value => value !== null && value !== undefined
  );

  return `${builder}(${args.join(', ')})`;
}

function applyArguments(
  emission: Emission,
  args: number[],
  dialect: Dialect
): { emission: Emission; options: string[] } {
  const options = [...(emission.options ?? [])];
  // MySQL and MariaDB keep a CHAR(0) or a VARBINARY(0); the others refuse one.
  const shortest = dialect === 'mysql' ? 0 : 1;

  if (
    (emission.args === 'length' || emission.args === 'lengthRequired') &&
    args.length === 1 &&
    args[0] >= shortest
  ) {
    return { emission, options: [...options, `length: ${args[0]}`] };
  }

  if (emission.args === 'lengthRequired') {
    const degraded = emission.degraded ?? emission;
    return { emission: degraded, options: [...(degraded.options ?? [])] };
  }

  if (emission.args === 'blobLength' && args.length === 1 && args[0] > 0) {
    const sized = MYSQL_BLOB_SIZES.find(([bytes]) => args[0] <= bytes);
    return { emission: sized?.[1] ?? MYSQL_LONGBLOB, options };
  }

  if (
    emission.args === 'seconds' &&
    args.length === 1 &&
    args[0] >= 0 &&
    args[0] <= 6
  ) {
    const key = dialect === 'mysql' ? 'fsp' : 'precision';
    return { emission, options: [...options, `${key}: ${args[0]}`] };
  }

  // MySQL keeps only whether a FLOAT(p) is a FLOAT or a DOUBLE, never p.
  if (emission.args === 'floatPrecision' && args.length === 1) {
    return {
      emission: args[0] > SINGLE_PRECISION_DIGITS ? MYSQL_DOUBLE : emission,
      options,
    };
  }

  if (emission.args === 'precision' && args.length === 1) {
    return { emission, options: [...options, `precision: ${args[0]}`] };
  }

  if (
    (emission.args === 'precision' ||
      emission.args === 'floatPrecision' ||
      emission.args === 'precisionAndScale') &&
    args.length === 2
  ) {
    return {
      emission,
      options: [...options, `precision: ${args[0]}`, `scale: ${args[1]}`],
    };
  }

  return { emission, options };
}

// A second argument list belongs to a later word, as in Oracle's INTERVAL
// DAY(2) TO SECOND(6), and a number past 2^53 would print rounded or as
// Infinity, so either leaves the builder with no argument.
function builderArguments({ element, args }: ClassifiedType): number[] {
  return element.indexOf('(') === element.lastIndexOf('(') &&
    args.every(Number.isSafeInteger)
    ? args
    : [];
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

function createSchemaContext(state: RootState): SchemaContext {
  const {
    settings: { database },
  } = state;
  const dialect = DIALECT_BY_DATABASE[database] ?? FALLBACK_DIALECT;
  const relationships = resolveRelationships(state);
  const tables = query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds)
    .sort(orderByNameASC);
  const context: SchemaContext = {
    database,
    dialect,
    // The code is pg-core for a database Drizzle has no dialect of, and the
    // DDL drizzle-kit writes from it is PostgreSQL's, which takes every action.
    actionSupport: referentialActionSupport(
      DIALECT_BY_DATABASE[database] === undefined
        ? Database.PostgreSQL
        : database
    ),
    indexNames: createIndexNames(state),
    relationships,
    namings: new Map<string, TableNaming>(),
    moduleNames: new Set<string>([
      ...CORE_NAMES,
      ...DIALECT_NAMES[dialect],
      ...GLOBAL_NAMES,
      ANY_COLUMN[dialect],
      EXTRA_CONFIG_VALUE[dialect],
    ]),
    // PostgreSQL gives each table a row type of the table's name, which no
    // enum type may take.
    enumTypeNames: new Set<string>(tables.map(table => table.name)),
    aliases: new Map<string, string>(),
    inlined: new Set<string>(),
    cyclic: new Set<string>(),
    annotated: new Set<string>(),
  };

  reserveCustomTypeNames(state, tables, context);
  tables.forEach(table => getNaming(state, context, table));
  planReferences(state, context);
  createAliases(state, context);

  return context;
}

// A custom type is a const of the module, so no table or enum const may take
// its name; only the names the document's columns declare are held back.
function reserveCustomTypeNames(
  { collections }: RootState,
  tables: Table[],
  { database, dialect, moduleNames }: SchemaContext
) {
  const columnCollection = query(collections).collection('tableColumnEntities');

  tables.forEach(table =>
    columnCollection.selectByIds(table.columnIds).forEach(column => {
      const classified = classifyColumnType(column.dataType, database);
      const custom =
        classified.enumMembers === null
          ? resolveScalar(classified, database, dialect).emission.custom
          : undefined;

      if (custom !== undefined) {
        moduleNames.add(custom.name);
      }
    })
  );
}

function createAliases(state: RootState, context: SchemaContext) {
  const counts = new Map<string, number>();

  context.relationships.forEach(({ relationship }) => {
    const key = pairKey(relationship);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const used = new Set<string>();

  context.relationships.forEach(({ relationship, endTable }) => {
    if (
      !isSelfReferential(relationship) &&
      (counts.get(pairKey(relationship)) ?? 0) < 2
    ) {
      return;
    }

    const naming = getNaming(state, context, endTable);
    const property = naming.relationshipNames.get(
      relationshipKey(relationship, OWNING)
    );

    if (property === undefined) {
      return;
    }

    context.aliases.set(
      relationship.id,
      uniqueName(used, `${naming.constName}_${property}`)
    );
  });
}

function pairKey({ start, end }: Relationship): string {
  return [start.tableId, end.tableId].sort().join(':');
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
  context: SchemaContext,
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

// An object literal reads a __proto__ key as its prototype, not a property.
const PROTOTYPE_KEY = '__proto__';

const TABLE_MEMBER_NAMES: ReadonlyArray<string> = [
  '$inferInsert',
  '$inferSelect',
  '_',
  PROTOTYPE_KEY,
  'enableRLS',
  'getSQL',
];

const RELATIONS_SUFFIX = 'Relations';

function createTableNaming(
  state: RootState,
  table: Table,
  context: SchemaContext
): TableNaming {
  const {
    settings: { tableNameCase, columnNameCase },
    collections,
  } = state;
  const { relationships, moduleNames, enumTypeNames, dialect, database } =
    context;
  const used = new Set<string>(TABLE_MEMBER_NAMES);
  const relationUsed = new Set<string>([PROTOTYPE_KEY]);
  const declared: Column[] = [];
  const columnRefs = new Map<string, string>();
  const columnNames = new Map<string, string>();
  const relationshipNames = new Map<string, string>();
  const enumNames = new Map<string, EnumNaming>();
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

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

  const constName = uniqueName(
    moduleNames,
    tsIdentifier(getNameCase(table.name, tableNameCase))
  );

  if (dialect === 'pg') {
    declared.forEach(column => {
      if (classifyColumnType(column.dataType, database).enumMembers === null) {
        return;
      }

      enumNames.set(column.id, {
        constName: uniqueName(
          moduleNames,
          tsIdentifier(
            `${getNameCase(`${table.name}_${column.name}_enum`, tableNameCase)}`
          )
        ),
        typeName: uniqueName(enumTypeNames, `${table.name}_${column.name}`),
      });
    });
  }

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
        uniqueName(
          relationUsed,
          tsIdentifier(getNameCase(name, columnNameCase))
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
        uniqueName(relationUsed, tsIdentifier(name))
      );
    });

  return {
    constName,
    relationsName: uniqueName(moduleNames, `${constName}${RELATIONS_SUFFIX}`),
    columnIds: declared.map(column => column.id),
    carriers: columnRefs,
    columnNames,
    relationshipNames,
    enumNames,
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

function uniqueName(used: Set<string>, name: string): string {
  let result = name;
  let index = 2;

  while (used.has(result)) {
    result = `${name}${index}`;
    index += 1;
  }

  used.add(result);
  return result;
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

const BACKSLASH = /\\/g;
const DOUBLE_QUOTE = /"/g;
const LINE_BREAK = /[\n\r\u2028\u2029]/g;
const BACKTICK = /`/g;
const INTERPOLATION = /\$\{/g;

// Each line terminator keeps its own escape, so a string holds the value the
// document has; a template literal would also read a raw CR back as LF.
const LINE_BREAK_ESCAPES: Record<string, string> = {
  '\n': '\\n',
  '\r': '\\r',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

function escapeLineBreak(value: string): string {
  return value.replace(LINE_BREAK, char => LINE_BREAK_ESCAPES[char]);
}

function escapeString(value: string): string {
  return escapeLineBreak(
    value.replace(BACKSLASH, '\\\\').replace(DOUBLE_QUOTE, '\\"')
  );
}

function escapeTemplate(value: string): string {
  return escapeLineBreak(
    value
      .replace(BACKSLASH, '\\\\')
      .replace(BACKTICK, '\\`')
      .replace(INTERPOLATION, '\\$&')
  );
}
