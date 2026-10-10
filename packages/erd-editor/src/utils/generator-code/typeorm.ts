import { query } from '@dineug/erd-editor-schema';

import {
  ColumnOption,
  Database,
  NameCase,
  ReferentialAction,
} from '@/constants/schema';
import { PrimitiveType, PrimitiveTypeMap } from '@/constants/sql/dataType';
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
  BINARY_TYPES,
  ColumnType as ColumnFacts,
  getColumnType as getColumnFacts,
  isMySQLFamily,
  JSON_TYPES,
  POSTGRES_BIT_TYPES,
  UUID_TYPES,
} from './columnTypes';
import {
  FormatColumnOptions,
  FormatRelationOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
  referentialActionEntries,
} from './utils';

const TYPEORM_NAMES = [
  'Column',
  'Entity',
  'Index',
  'JoinColumn',
  'ManyToOne',
  'OneToMany',
  'OneToOne',
  'PrimaryColumn',
  'PrimaryGeneratedColumn',
  'Relation',
] as const;

// The globals the module reads, in its annotations and in the decorator
// metadata and helpers tsc emits for them, those helpers' own names, and the
// names CommonJS declares or tsc's CommonJS output cannot assign on exports.
const GLOBAL_NAMES = [
  'Array',
  'Boolean',
  'Buffer',
  'Date',
  'Number',
  'Object',
  'Reflect',
  'String',
  '__decorate',
  '__metadata',
  '__dirname',
  '__esModule',
  '__filename',
  '__proto__',
  'exports',
  'module',
  'require',
] as const;

// A module that exports then is a thenable, which import() calls as one, so a
// class of that name fails the module's load as an ES module.
const THENABLE_NAMES = ['then'] as const;

type TypeormName = (typeof TYPEORM_NAMES)[number];

// A property of these names would clash with the method of every object, which
// the target each decorator is handed must keep, or with __proto__, which an
// assignment such as TypeORM's own reads as the object's prototype.
const OBJECT_MEMBERS: ReadonlySet<string> = new Set([
  '__proto__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
]);

// TypeORM keys plain objects by class name, its dependency graph and the rows
// it saves grouped by entity among them, so a class named after any member
// every object inherits fails to initialize or to save.
const PROTOTYPE_NAMES = [
  ...OBJECT_MEMBERS,
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
];

const MODULE_SCOPE_NAMES: ReadonlySet<string> = new Set<string>([
  ...TYPEORM_NAMES,
  ...GLOBAL_NAMES,
  ...THENABLE_NAMES,
  ...PROTOTYPE_NAMES,
]);

const convertTypeMap: PrimitiveTypeMap = {
  int: 'number',
  long: 'number',
  float: 'number',
  double: 'number',
  decimal: 'string',
  boolean: 'boolean',
  string: 'string',
  lob: 'string',
  date: 'string',
  dateTime: 'Date',
  time: 'string',
};

const bigintTypes = new Set([
  'bigint',
  'bigserial',
  'int8',
  'long',
  'serial',
  'serial8',
  'unsigned big int',
]);

// tedious, node-oracledb and better-sqlite3 hand a decimal over as a JS
// number, where pg and mysql2 hand over a string.
const NUMBER_DECIMAL_DATABASES = new Set<number>([
  Database.MSSQL,
  Database.Oracle,
  Database.SQLite,
]);

// The types whose values reach the entity as objects: node-postgres parses a
// point, a circle and an interval into their fields, node-oracledb an interval
// into an IntervalDS or an IntervalYM and a BFILE into a Lob, all handed over.
const objectTypes = new Map<number, ReadonlySet<string>>([
  [
    Database.Oracle,
    new Set(['bfile', 'interval day to second', 'interval year to month']),
  ],
  [Database.PostgreSQL, new Set(['circle', 'interval', 'point'])],
]);

// What a vector reaches the entity as: TypeORM parses pgvector's text and SQL
// Server's JSON, and mysql2 MySQL's VECTOR, into numbers; MariaDB's comes over
// as its bytes.
const vectorAnnotations = new Map<number, string>([
  [Database.MariaDB, 'Buffer'],
  [Database.MSSQL, 'number[]'],
  [Database.MySQL, 'number[]'],
  [Database.PostgreSQL, 'number[]'],
]);

// TypeORM reads the precision of a date, time or interval column back from the
// column alone, so an array of one that states it is altered on every sync.
const postgresTemporalTypes = new Set([
  'interval',
  'time',
  'time with time zone',
  'time without time zone',
  'timestamp',
  'timestamp with time zone',
  'timestamp without time zone',
]);

// PostgreSQL stores a time, timestamp or interval of a greater precision at
// this one, with a warning, and TypeORM compares the precision it reads back.
const POSTGRES_MAX_TIME_PRECISION = 6;

// A serial is an integer with a sequence, which TypeORM spells as the integer
// and the increment strategy.
const postgresSerialTypes = new Map([
  ['bigserial', 'bigint'],
  ['serial', 'int'],
  ['serial2', 'smallint'],
  ['serial4', 'int'],
  ['serial8', 'bigint'],
  ['smallserial', 'smallint'],
]);

// The element types whose arrays node-postgres parses, as pg-types registers
// them; it hands any other array over as its text, such as {1010,0101}.
const postgresParsedArrayTypes = new Set([
  'bigint',
  'bool',
  'boolean',
  'bpchar',
  'bytea',
  'char',
  'character',
  'character varying',
  'cidr',
  'date',
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
  'money',
  'numeric',
  'numrange',
  'oid',
  'point',
  'real',
  'regproc',
  'smallint',
  'text',
  'time',
  'time with time zone',
  'time without time zone',
  'timestamp',
  'timestamp with time zone',
  'timestamp without time zone',
  'timestamptz',
  'timetz',
  'uuid',
  'varchar',
]);

const postgresZonedTypes = new Map([
  ['timestamptz', 'timestamp with time zone'],
  ['timetz', 'time with time zone'],
]);

const integerTypes = new Set([
  'bigint',
  'int',
  'integer',
  'mediumint',
  'smallint',
  'tinyint',
]);

// The typed overloads of these types take no unsigned option, so the column
// states its type in the options object.
const unsignedFractionalTypes = new Set([
  'dec',
  'decimal',
  'double',
  'double precision',
  'fixed',
  'float',
  'numeric',
  'real',
]);

// The typed overloads of these PostgreSQL types take no length or precision.
const sizedObjectTypes = new Set(['bit', 'bit varying', 'interval', 'varbit']);

// The names SQL Server takes a max length on, which no number states.
const MAX_LENGTH_TYPES = new Set(['nvarchar', 'varbinary', 'varchar']);

const MAX_ARGUMENT = /^[^(]*\(\s*max\s*\)/i;

const INTERVAL = /^interval\b/;

// MySQL's sign words, which may follow an argument list with no space between.
const SIGN_WORDS =
  /(^|[^0-9A-Za-z_])(?:unsigned|zerofill|signed)(?![0-9A-Za-z_])/gi;

// An interval's seconds' precision: interval(3), or interval second(3) and the
// other field lists that end on seconds.
const SECONDS_PRECISION =
  /^\s*interval\s*\(\s*(\d+)\s*\)\s*$|\bsecond\s*\(\s*(\d+)\s*\)\s*$/i;

// MySQL and MariaDB store these synonyms as the type each names, which
// TypeORM's driver either refuses or would create as another type or width.
const mysqlSynonymTypes = new Map([
  ['char varying', 'varchar'],
  ['character', 'char'],
  ['character varying', 'varchar'],
  ['float4', 'float'],
  ['float8', 'double'],
  ['geomcollection', 'geometrycollection'],
  ['int1', 'tinyint'],
  ['int2', 'smallint'],
  ['int3', 'mediumint'],
  ['int4', 'int'],
  ['int8', 'bigint'],
  ['long', 'mediumtext'],
  ['long char varying', 'mediumtext'],
  ['long character varying', 'mediumtext'],
  ['long varbinary', 'mediumblob'],
  ['long varchar', 'mediumtext'],
  ['long varcharacter', 'mediumtext'],
  ['middleint', 'mediumint'],
  ['national character', 'national char'],
  ['sql_tsi_year', 'year'],
]);

// SQL Server stores the standard's spellings as these types, which TypeORM's
// driver refuses or would create as another type.
const mssqlSynonymTypes = new Map([
  ['char varying', 'varchar'],
  ['character', 'char'],
  ['character varying', 'varchar'],
  ['national char', 'nchar'],
  ['national char varying', 'nvarchar'],
  ['national character', 'nchar'],
  ['national character varying', 'nvarchar'],
  ['national text', 'ntext'],
]);

// Oracle stores the standard's spellings as these types, likewise.
const oracleSynonymTypes = new Map([
  ['char varying', 'varchar2'],
  ['character', 'char'],
  ['character varying', 'varchar2'],
  ['long varchar', 'long'],
  ['national char', 'nchar'],
  ['national char varying', 'nvarchar2'],
  ['national character', 'nchar'],
  ['national character varying', 'nvarchar2'],
  ['nchar varying', 'nvarchar2'],
]);

// TypeORM's PostgreSQL driver refuses DEC, which PostgreSQL stores as numeric.
const postgresSynonymTypes = new Map([['dec', 'decimal']]);

// TypeORM's SQLite driver refuses these names; its own for the same affinity
// create the column and read it back as a number, a Date and a boolean.
const sqliteTypes = new Map([
  ['bool', 'boolean'],
  ['dec', 'decimal'],
  ['timestamp', 'datetime'],
]);

const synonymTypes = new Map<number, ReadonlyMap<string, string>>([
  [Database.MariaDB, mysqlSynonymTypes],
  [Database.MSSQL, mssqlSynonymTypes],
  [Database.MySQL, mysqlSynonymTypes],
  [Database.Oracle, oracleSynonymTypes],
  [Database.PostgreSQL, postgresSynonymTypes],
  [Database.SQLite, sqliteTypes],
]);

const generatedNumericTypes = new Set([
  'bigint',
  'dec',
  'decimal',
  'fixed',
  'int',
  'int2',
  'int4',
  'int8',
  'integer',
  'mediumint',
  'number',
  'numeric',
  'smalldecimal',
  'smallint',
  'tinyint',
]);

const withLengthTypes = new Set([
  'alphanum',
  'binary',
  'char',
  'char varying',
  'character',
  'character varying',
  'half_vector',
  'halfvec',
  'national char',
  'national varchar',
  'native character',
  'nchar',
  'nvarchar',
  'nvarchar2',
  'raw',
  'real_vector',
  'shorttext',
  'string',
  'varbinary',
  'varchar',
  'varchar2',
  'varying character',
  'vector',
]);

const withPrecisionTypes = new Set([
  'datetime',
  'datetime2',
  'datetimeoffset',
  'dec',
  'decimal',
  'double',
  'double precision',
  'fixed',
  'float',
  'number',
  'numeric',
  'real',
  'smalldecimal',
  'time',
  'time with time zone',
  'time without time zone',
  'timestamp',
  'timestamp with local time zone',
  'timestamp with time zone',
  'timestamp without time zone',
]);

const columnTypes: ReadonlySet<string> = new Set<string>([
  ...withLengthTypes,
  ...withPrecisionTypes,
  'array',
  'bfile',
  'bigint',
  'bit',
  'bit varying',
  'blob',
  'bool',
  'boolean',
  'box',
  'bytea',
  'bytes',
  'cidr',
  'circle',
  'citext',
  'clob',
  'cube',
  'date',
  'datemultirange',
  'daterange',
  'enum',
  'float4',
  'float64',
  'float8',
  'geography',
  'geometry',
  'geometrycollection',
  'hierarchyid',
  'hstore',
  'image',
  'inet',
  'inet4',
  'inet6',
  'int',
  'int2',
  'int4',
  'int4multirange',
  'int4range',
  'int64',
  'int8',
  'int8multirange',
  'int8range',
  'integer',
  'interval',
  'interval day to second',
  'interval year to month',
  'json',
  'jsonb',
  'jsonpath',
  'line',
  'linestring',
  'long',
  'long raw',
  'longblob',
  'longtext',
  'lseg',
  'ltree',
  'macaddr',
  'macaddr8',
  'mediumblob',
  'mediumint',
  'mediumtext',
  'money',
  'multilinestring',
  'multipoint',
  'multipolygon',
  'nclob',
  'ntext',
  'nummultirange',
  'numrange',
  'path',
  'point',
  'polygon',
  'rowid',
  'rowversion',
  'seconddate',
  'set',
  'simple-array',
  'simple-enum',
  'simple-json',
  'smalldatetime',
  'smallint',
  'smallmoney',
  'sql_variant',
  'st_geometry',
  'st_point',
  'text',
  'timestamptz',
  'timetz',
  'tinyblob',
  'tinyint',
  'tinytext',
  'tsmultirange',
  'tsquery',
  'tsrange',
  'tstzmultirange',
  'tstzrange',
  'tsvector',
  'uniqueidentifier',
  'unsigned big int',
  'urowid',
  'uuid',
  'varbit',
  'xml',
  'year',
]);

const fallbackTypeMap: PrimitiveTypeMap = {
  int: 'int',
  long: 'bigint',
  float: 'float',
  double: 'double precision',
  decimal: 'decimal',
  boolean: 'boolean',
  string: 'varchar',
  lob: 'text',
  date: 'date',
  dateTime: 'timestamp',
  time: 'time',
};

const LINE_LIMIT = 80;
const INDENT = '  ';
const OWNING = 'owning';
const INVERSE = 'inverse';

type RelationshipSide = typeof OWNING | typeof INVERSE;

type Group = {
  open: '[' | '{';
  entries: string[];
};

type TypeormColumn = {
  type: string;
  annotation: string;
  args: string[];
  /**
   * The typed overload refuses an option the column needs, so the options
   * object names the type.
   */
  typeInOptions: boolean;
  /** The arguments state a length, a precision or a scale. */
  isSized: boolean;
  isArray: boolean;
  isUnsigned: boolean;
  /** A type that numbers its rows itself: PostgreSQL's serials, MySQL's SERIAL. */
  isSerial: boolean;
};

type IndexEntry = {
  name: string;
  columns: string[];
  options: string[];
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
  columnRefs: Map<string, string>;
  columnNames: Map<string, string>;
  relationshipNames: Map<string, string>;
};

type ClassContext = {
  indexNames: Map<string, string>;
  relationships: ResolvedRelationship[];
  namings: Map<string, TableNaming>;
  classNames: Set<string>;
};

type ColumnContext = {
  attribute: string;
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

  const stringBuffer: string[] = [''];
  const context = createClassContext(state);

  tables.forEach((table, index) => {
    if (index !== 0) {
      stringBuffer.push('');
    }
    formatClass(state, { buffer: stringBuffer, table }, context);
  });

  stringBuffer.push('');

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  formatClass(state, { buffer, table }, createClassContext(state));
}

function formatClass(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: ClassContext
) {
  const { collections } = state;
  const naming = getNaming(state, context, table);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(naming.columnIds);

  createIndexEntries(state, table, naming, context).forEach(entry =>
    formatIndex(buffer, entry)
  );

  formatDecorator(buffer, '', 'Entity', [`"${escapeString(table.name)}"`], {
    open: '{',
    entries:
      table.comment.trim() === ''
        ? []
        : [`comment: "${escapeString(table.comment)}"`],
  });

  const bodyBuffer: string[] = [];

  columns.forEach(column => {
    formatColumn(
      state,
      { buffer: bodyBuffer, column },
      { attribute: naming.columnNames.get(column.id) ?? column.name }
    );
  });
  formatRelation(state, { buffer: bodyBuffer, table }, context);

  if (bodyBuffer.length === 0) {
    buffer.push(`export class ${naming.className} {}`);
    return;
  }

  buffer.push(`export class ${naming.className} {`);
  bodyBuffer.forEach(line => buffer.push(line));
  buffer.push('}');
}

function formatColumn(
  { settings: { database } }: RootState,
  { buffer, column }: FormatColumnOptions,
  { attribute }: ColumnContext
) {
  const columnType = getColumnType(column.dataType, database);
  const { type, annotation, args, typeInOptions, isUnsigned, isSerial } =
    columnType;
  const typed = `"${escapeString(type)}"`;
  const typeArg = typeInOptions ? [] : [typed];
  const typeEntry = typeInOptions ? [`type: ${typed}`] : [];
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
  const isAutoIncrement =
    isSerial || bHas(column.options, ColumnOption.autoIncrement);
  // An identity or AUTO_INCREMENT column is NOT NULL whatever the NN flag says;
  // SQLite numbers its key alone, so the flag on another column changes nothing.
  const isNumbered = isAutoIncrement && database !== Database.SQLite;
  const isNullable =
    !isPrimaryKey && !isNumbered && !bHas(column.options, ColumnOption.notNull);
  const isGeneratedKey =
    isPrimaryKey && isAutoIncrement && takesGeneratedKey(columnType, database);
  const memberBuffer: string[] = [];
  let generatedAnnotation = annotation;
  const named =
    attribute === column.name ? [] : [`name: "${escapeString(column.name)}"`];
  const comment =
    column.comment.trim() === ''
      ? []
      : [`comment: "${escapeString(column.comment)}"`];
  const defaulted =
    isAutoIncrement || column.default.trim() === ''
      ? []
      : [`default: () => "${escapeString(column.default)}"`];

  if (isGeneratedKey) {
    const isUuid = UUID_TYPES.has(type);
    const numeric =
      !isUuid && generatedNumericTypes.has(type) ? [`type: ${typed}`] : [];
    const unsigned =
      numeric.length !== 0 && isUnsigned ? ['unsigned: true'] : [];

    generatedAnnotation = isUuid
      ? 'string'
      : numeric.length === 0
        ? 'number'
        : annotation;

    formatDecorator(
      memberBuffer,
      INDENT,
      'PrimaryGeneratedColumn',
      isUuid ? ['"uuid"'] : [],
      { open: '{', entries: [...numeric, ...unsigned, ...named, ...comment] }
    );
  } else {
    const decorator: TypeormName = isPrimaryKey ? 'PrimaryColumn' : 'Column';
    const generated = isAutoIncrement ? ['generated: "increment"'] : [];
    const constraints = isPrimaryKey
      ? []
      : [
          ...(isNullable ? ['nullable: true'] : []),
          // MySQL's SERIAL is UNIQUE, the key an AUTO_INCREMENT column needs.
          ...(bHas(column.options, ColumnOption.unique) ||
          (isSerial && isMySQLFamily(database))
            ? ['unique: true']
            : []),
        ];

    formatDecorator(memberBuffer, INDENT, decorator, typeArg, {
      open: '{',
      entries: [
        ...typeEntry,
        ...named,
        ...args,
        ...generated,
        ...constraints,
        ...defaulted,
        ...comment,
      ],
    });
  }

  memberBuffer.push(
    `${INDENT}${attribute}: ${generatedAnnotation}${isNullable ? ' | null' : ''};`
  );
  pushMember(buffer, memberBuffer);
}

/**
 * Whether PrimaryGeneratedColumn holds a generated key: not a numeric key that
 * states a size, nor on PostgreSQL an array or any type but an integer, a
 * decimal or a uuid, which TypeORM's sync would drop and re-add as a serial.
 */
function takesGeneratedKey(
  { type, isSized, isArray }: TypeormColumn,
  database: number
): boolean {
  const isNumeric = generatedNumericTypes.has(type);

  // PrimaryGeneratedColumn has no option for a precision or a scale.
  if (isSized && isNumeric) {
    return false;
  }
  return (
    database !== Database.PostgreSQL ||
    (!isArray && (isNumeric || UUID_TYPES.has(type)))
  );
}

function formatRelation(
  state: RootState,
  { buffer, table }: FormatRelationOptions,
  context: ClassContext
) {
  const naming = getNaming(state, context, table);

  context.relationships
    .filter(({ relationship }) => relationship.end.tableId === table.id)
    .forEach(({ relationship, startTable, startColumns, endColumns }) => {
      const attribute = naming.relationshipNames.get(
        relationshipKey(relationship, OWNING)
      );

      if (!attribute) {
        return;
      }

      const parentNaming = getNaming(state, context, startTable);
      const decorator: TypeormName = hasNRelationship(
        relationship.relationshipType
      )
        ? 'ManyToOne'
        : 'OneToOne';
      const isRequired = carriedColumns(state, naming, endColumns).every(
        column =>
          bHas(column.options, ColumnOption.primaryKey) ||
          bHas(column.options, ColumnOption.notNull)
      );
      const memberBuffer: string[] = [];

      formatDecorator(
        memberBuffer,
        INDENT,
        decorator,
        relationArguments(parentNaming, startTable, relationship, INVERSE),
        { open: '{', entries: relationOptions(state, relationship) }
      );

      formatDecorator(memberBuffer, INDENT, 'JoinColumn', [], {
        open: '[',
        entries: endColumns.map((column, index) => {
          const referenced =
            parentNaming.columnNames.get(startColumns[index].id) ??
            startColumns[index].name;
          return `{ name: "${escapeString(column.name)}", referencedColumnName: "${escapeString(referenced)}" }`;
        }),
      });

      memberBuffer.push(
        `${INDENT}${attribute}: Relation<${parentNaming.className}>${
          isRequired ? '' : ' | null'
        };`
      );
      pushMember(buffer, memberBuffer);
    });

  context.relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable }) => {
      const attribute = naming.relationshipNames.get(
        relationshipKey(relationship, INVERSE)
      );

      if (!attribute) {
        return;
      }

      const childNaming = getNaming(state, context, endTable);
      const isMany = hasNRelationship(relationship.relationshipType);
      const decorator: TypeormName = isMany ? 'OneToMany' : 'OneToOne';
      const memberBuffer: string[] = [];

      formatDecorator(
        memberBuffer,
        INDENT,
        decorator,
        relationArguments(childNaming, endTable, relationship, OWNING)
      );

      memberBuffer.push(
        `${INDENT}${attribute}: ${
          isMany
            ? `${childNaming.className}[]`
            : `Relation<${childNaming.className}> | null`
        };`
      );
      pushMember(buffer, memberBuffer);
    });
}

/**
 * The owning side's onDelete and onUpdate the database takes. TypeORM spells
 * SET DEFAULT as DEFAULT and writes that word into its DDL, which no database
 * takes, so it is left to the default.
 */
function relationOptions(
  state: RootState,
  relationship: Relationship
): string[] {
  return referentialActionEntries(
    relationship,
    referentialActionSupport(state.settings.database)
  )
    .filter(({ action }) => action !== ReferentialAction.setDefault)
    .map(({ key, sql }) => `${key}: "${sql}"`);
}

function relationArguments(
  targetNaming: TableNaming,
  targetTable: Table,
  relationship: Relationship,
  side: RelationshipSide
): string[] {
  const args = [`() => ${targetNaming.className}`];
  const inverse = targetNaming.relationshipNames.get(
    relationshipKey(relationship, side)
  );

  if (inverse) {
    const parameter = tsIdentifier(
      getNameCase(targetTable.name, NameCase.camelCase)
    );
    args.push(`(${parameter}) => ${parameter}.${inverse}`);
  }

  return args;
}

function createIndexEntries(
  state: RootState,
  table: Table,
  naming: TableNaming,
  { indexNames }: ClassContext
): IndexEntry[] {
  const {
    doc: { indexIds },
    collections,
  } = state;
  const entries: IndexEntry[] = [];

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .forEach(index => {
      const names = Array.from(
        new Set(
          query(collections)
            .collection('indexColumnEntities')
            .selectByIds(index.indexColumnIds)
            .map(indexColumn => naming.columnNames.get(indexColumn.columnId))
            .filter(name => name !== undefined) as string[]
        )
      );

      if (names.length === 0) {
        return;
      }

      entries.push({
        name: `"${escapeString(indexNames.get(index.id) ?? index.name)}"`,
        columns: names.map(name => `"${escapeString(name)}"`),
        options: index.unique ? ['unique: true'] : [],
      });
    });

  return entries;
}

function formatIndex(buffer: string[], { name, columns, options }: IndexEntry) {
  if (options.length === 0) {
    formatDecorator(buffer, '', 'Index', [name], {
      open: '[',
      entries: columns,
    });
    return;
  }

  formatDecorator(buffer, '', 'Index', [name, `[${columns.join(', ')}]`], {
    open: '{',
    entries: options,
  });
}

function pushMember(buffer: string[], lines: string[]) {
  if (buffer.length !== 0) {
    buffer.push('');
  }
  lines.forEach(line => buffer.push(line));
}

function formatDecorator(
  buffer: string[],
  indent: string,
  name: TypeormName,
  args: string[],
  group?: Group
) {
  const trailing = group && group.entries.length !== 0 ? group : undefined;
  const rendered = trailing
    ? trailing.open === '['
      ? `[${trailing.entries.join(', ')}]`
      : `{ ${trailing.entries.join(', ')} }`
    : null;
  const all = rendered === null ? args : [...args, rendered];
  const line = `${indent}@${name}(${all.join(', ')})`;

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  const head = trailing
    ? `${indent}@${name}(${[...args, trailing.open].join(', ')}`
    : null;

  if (trailing && head !== null && head.length <= LINE_LIMIT) {
    buffer.push(head);
    trailing.entries.forEach(entry =>
      buffer.push(`${indent}${INDENT}${entry},`)
    );
    buffer.push(`${indent}${trailing.open === '[' ? ']' : '}'})`);
    return;
  }

  if (all.length > 1) {
    buffer.push(`${indent}@${name}(`);
    all.forEach(arg => buffer.push(`${indent}${INDENT}${arg},`));
    buffer.push(`${indent})`);
    return;
  }

  buffer.push(line);
}

function getColumnType(dataType: string, database: number): TypeormColumn {
  const facts = getColumnFacts(dataType, database);

  // A column with no type name states the type TypeORM reflects a string as,
  // since a nullable one, string | null, reflects as an Object it refuses.
  if (facts.base === '') {
    return {
      type: database === Database.MSSQL ? 'nvarchar' : 'varchar',
      annotation: 'string',
      args: [],
      typeInOptions: false,
      isSized: false,
      isArray: false,
      isUnsigned: false,
      isSerial: false,
    };
  }

  const element = elementColumn(facts, database);

  if (facts.arrayDepth === 0) {
    return element;
  }

  return {
    ...element,
    annotation: arrayAnnotation(facts, element),
    args: [...element.args, 'array: true'],
    isArray: true,
  };
}

/**
 * What node-postgres hands over for an array: its elements parsed, a numeric's
 * into numbers and a date's into Dates, or the array's text for a type it has
 * no array parser for.
 */
function arrayAnnotation(
  { base, arrayDepth }: ColumnFacts,
  { type, annotation }: TypeormColumn
): string {
  const stored = postgresSynonymTypes.get(base) ?? base;

  if (
    type !== 'enum' &&
    !INTERVAL.test(stored) &&
    !postgresParsedArrayTypes.has(stored)
  ) {
    return 'string';
  }

  const element =
    stored === 'date'
      ? 'Date'
      : stored === 'decimal' || stored === 'numeric'
        ? 'number'
        : annotation;
  const wrapped = element.includes(' ') ? `(${element})` : element;

  return `${wrapped}${'[]'.repeat(arrayDepth)}`;
}

function elementColumn(facts: ColumnFacts, database: number): TypeormColumn {
  const { base, element, enumMembers, setMembers } = facts;
  // The members name the type, since one holding a parenthesis leaves no
  // readable base name.
  const members = enumMembers ?? setMembers;

  if (members) {
    const quoted = members.map(stringLiteral);
    const union = quoted.join(' | ');
    const isSet = enumMembers === null;

    return {
      type: isSet ? 'set' : 'enum',
      annotation: isSet ? `(${union})[]` : union,
      args: [`enum: [${quoted.join(', ')}]`],
      typeInOptions: false,
      isSized: false,
      isArray: false,
      isUnsigned: false,
      isSerial: false,
    };
  }

  // A synonym reads as the type it is stored as, which the list may not name.
  const primitiveType = getPrimitiveType(
    synonymTypes.get(database)?.get(base) ??
      (isMySQLFamily(database) ? element.replace(SIGN_WORDS, '$1') : element),
    database
  );
  const vendor = vendorType(facts, database);
  const type =
    vendor ??
    (columnTypes.has(base) ? base : fallbackType(base, primitiveType));
  const isUnsigned =
    facts.isUnsigned &&
    (integerTypes.has(type) || unsignedFractionalTypes.has(type));
  // A float's one argument is its width, which the name vendorType gave states.
  const sized =
    floatWidth(facts, database) === null
      ? sizeArguments(type, facts, database)
      : [];

  return {
    type,
    annotation: getAnnotation(facts, type, primitiveType, database),
    args: [...sized, ...(isUnsigned ? ['unsigned: true'] : [])],
    typeInOptions:
      (sized.length !== 0 && sizedObjectTypes.has(type)) ||
      (isUnsigned && unsignedFractionalTypes.has(type)),
    isSized: sized.length !== 0,
    isArray: false,
    isUnsigned,
    isSerial: facts.isSerial,
  };
}

/**
 * The name a database's driver in TypeORM takes for a type it spells otherwise
 * or holds at another width; null where the type's own name serves.
 */
function vendorType(facts: ColumnFacts, database: number): string | null {
  const { base, args, arrayDepth } = facts;
  const width = floatWidth(facts, database);
  const isSingle = width !== null && width <= 24;

  if (database === Database.PostgreSQL) {
    if (INTERVAL.test(base)) {
      return 'interval';
    }
    if (width !== null) {
      return isSingle ? 'real' : 'double precision';
    }
    // The short names take no precision in TypeORM's typed overloads, and an
    // array states none.
    const zoned =
      args.length === 0 || arrayDepth !== 0
        ? undefined
        : postgresZonedTypes.get(base);
    return (
      zoned ??
      postgresSerialTypes.get(base) ??
      postgresSynonymTypes.get(base) ??
      null
    );
  }
  // Past PostgreSQL, floatWidth answers on SQL Server, MySQL and MariaDB alone.
  if (width !== null) {
    if (database === Database.MSSQL) {
      return isSingle ? 'real' : 'float';
    }
    return isSingle ? 'float' : 'double';
  }
  return synonymTypes.get(database)?.get(base) ?? null;
}

/**
 * The width a float of one argument states, which decides the type it stores:
 * FLOAT(1) to FLOAT(53) on PostgreSQL, SQL Server, MySQL and MariaDB, where
 * MySQL and MariaDB also take FLOAT(0) and FLOAT4(p).
 */
function floatWidth(
  { base, args }: ColumnFacts,
  database: number
): number | null {
  if (args.length !== 1 || args[0] > 53) {
    return null;
  }
  if (isMySQLFamily(database)) {
    return base === 'float' || base === 'float4' ? args[0] : null;
  }
  return base === 'float' &&
    args[0] >= 1 &&
    (database === Database.PostgreSQL || database === Database.MSSQL)
    ? args[0]
    : null;
}

function sizeArguments(
  type: string,
  { args, element, arrayDepth, length, precision, scale }: ColumnFacts,
  database: number
): string[] {
  if (
    database === Database.MSSQL &&
    MAX_LENGTH_TYPES.has(type) &&
    MAX_ARGUMENT.test(element)
  ) {
    return ['length: "MAX"'];
  }

  const hasLength = args.length === 1 && args[0] > 0;
  // Oracle's VARCHAR2(50 CHAR) and VARCHAR2(50 BYTE) hold no argument list of
  // numbers alone, which the classifier's length reads past.
  const unitLength = args.length === 0 && length !== null && length > 0;

  if ((hasLength || unitLength) && withLengthTypes.has(type)) {
    return [`length: ${hasLength ? args[0] : length}`];
  }
  if (database === Database.PostgreSQL) {
    if (hasLength && POSTGRES_BIT_TYPES.has(type)) {
      return [`length: ${args[0]}`];
    }
    if (postgresTemporalTypes.has(type)) {
      const seconds = SECONDS_PRECISION.exec(element);
      const stated =
        type !== 'interval'
          ? args.length === 1
            ? args[0]
            : null
          : seconds
            ? Number(seconds[1] ?? seconds[2])
            : null;

      return arrayDepth !== 0 || stated === null
        ? []
        : [`precision: ${Math.min(stated, POSTGRES_MAX_TIME_PRECISION)}`];
    }
  }
  if (withPrecisionTypes.has(type) && args.length === 1) {
    return [`precision: ${args[0]}`];
  }
  if (withPrecisionTypes.has(type) && args.length === 2) {
    return [`precision: ${args[0]}`, `scale: ${args[1]}`];
  }
  // The classifier reads NUMBER(*,2), the widest precision of 38 at that scale,
  // and a negative scale such as NUMBER(10,-2); NUMBER(*) is a bare NUMBER.
  if (withPrecisionTypes.has(type) && args.length === 0 && scale !== null) {
    return [`precision: ${precision}`, `scale: ${scale}`];
  }
  return [];
}

function fallbackType(base: string, primitiveType: PrimitiveType): string {
  // MySQL makes a CHAR BYTE the BINARY of that length.
  if (base === 'char byte') {
    return 'binary';
  }
  if (BINARY_TYPES.has(base)) {
    return 'varbinary';
  }
  if (primitiveType === 'long' && !bigintTypes.has(base)) {
    return 'int';
  }
  return fallbackTypeMap[primitiveType];
}

function getAnnotation(
  { base, isRowVersion, isTextInteger }: ColumnFacts,
  type: string,
  primitiveType: PrimitiveType,
  database: number
): string {
  // Every TypeORM driver hands a "date" column over as a YYYY-MM-DD string,
  // Oracle's DATE included, though that one holds a time of day too.
  if (type === 'date') {
    return 'string';
  }
  if (JSON_TYPES.has(base) || objectTypes.get(database)?.has(type)) {
    return 'object';
  }
  // mysql2 hands a BIT of any width over as its bytes, tedious a rowversion
  // and a hierarchyid.
  if (
    BINARY_TYPES.has(base) ||
    isRowVersion ||
    (isMySQLFamily(database) && base === 'bit') ||
    (database === Database.MSSQL && base === 'hierarchyid')
  ) {
    return 'Buffer';
  }
  const vector =
    type === 'vector' ||
    (type === 'halfvec' && database === Database.PostgreSQL)
      ? vectorAnnotations.get(database)
      : undefined;

  if (vector !== undefined) {
    return vector;
  }
  // node-postgres hands xid, cid and xid8 over as text; better-sqlite3 hands
  // a 64-bit integer over as a number, the others a string.
  if (isTextInteger) {
    return 'string';
  }
  if (
    primitiveType === 'long' &&
    bigintTypes.has(base) &&
    database !== Database.SQLite
  ) {
    return 'string';
  }
  if (primitiveType === 'decimal' && NUMBER_DECIMAL_DATABASES.has(database)) {
    return 'number';
  }
  return convertTypeMap[primitiveType];
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

function createClassContext(state: RootState): ClassContext {
  const context: ClassContext = {
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
    doc: { relationshipIds },
    collections,
  } = state;
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');

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
  context: ClassContext,
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
  { relationships, classNames }: ClassContext
): TableNaming {
  const {
    settings: { tableNameCase, columnNameCase },
    collections,
  } = state;
  const used = new Set<string>();
  const declared: Column[] = [];
  const columnRefs = new Map<string, string>();
  const columnNames = new Map<string, string>();
  const relationshipNames = new Map<string, string>();
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
      uniqueName(
        used,
        tsIdentifier(getNameCase(column.name, columnNameCase), OBJECT_MEMBERS)
      )
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
    .forEach(({ relationship, startTable }) => {
      if (
        !hasOneRelationship(relationship.relationshipType) &&
        !hasNRelationship(relationship.relationshipType)
      ) {
        return;
      }

      const name = isSelfReferential(relationship)
        ? `parent_${startTable.name}`
        : startTable.name;

      relationshipNames.set(
        relationshipKey(relationship, OWNING),
        uniqueName(
          used,
          tsIdentifier(getNameCase(name, columnNameCase), OBJECT_MEMBERS)
        )
      );
    });

  relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable }) => {
      const name = hasNRelationship(relationship.relationshipType)
        ? getNameCase(`${endTable.name}List`, columnNameCase)
        : hasOneRelationship(relationship.relationshipType)
          ? getNameCase(endTable.name, columnNameCase)
          : null;

      if (name === null) {
        return;
      }

      relationshipNames.set(
        relationshipKey(relationship, INVERSE),
        uniqueName(used, tsIdentifier(name, OBJECT_MEMBERS))
      );
    });

  return {
    className: uniqueName(
      classNames,
      tsIdentifier(getNameCase(table.name, tableNameCase), TYPE_NAMES)
    ),
    columnIds: declared.map(column => column.id),
    columnRefs,
    columnNames,
    relationshipNames,
  };
}

function carriedColumns(
  state: RootState,
  naming: TableNaming,
  columns: Column[]
): Column[] {
  const collection = query(state.collections).collection('tableColumnEntities');

  return columns.map(
    column =>
      collection.selectById(naming.columnRefs.get(column.id) ?? column.id) ??
      column
  );
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

// TypeScript refuses these as a class name, or reads them as an operator where
// the class stands as a type, as in Relation<readonly>.
const TYPE_NAMES: ReadonlySet<string> = new Set([
  'any',
  'bigint',
  'boolean',
  'infer',
  'keyof',
  'never',
  'number',
  'object',
  'readonly',
  'string',
  'symbol',
  'undefined',
  'unique',
  'unknown',
]);

const NO_NAMES: ReadonlySet<string> = new Set();

const SAFE_PREFIX = 'x';

function tsIdentifier(
  name: string,
  reserved: ReadonlySet<string> = NO_NAMES
): string {
  const value = name.replace(NON_IDENTIFIER, '_');
  const identifier = IDENTIFIER_START.test(value)
    ? value
    : `${SAFE_PREFIX}${value}`;
  return RESERVED.has(identifier) || reserved.has(identifier)
    ? `${identifier}_`
    : identifier;
}

const BACKSLASH = /\\/g;
const DOUBLE_QUOTE = /"/g;
const NEWLINE = /\r\n|\r|\n/g;

const literalEscapes = new Map([
  ['\\', '\\\\'],
  ['"', '\\"'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

function escapeString(value: string): string {
  return value
    .replace(BACKSLASH, '\\\\')
    .replace(DOUBLE_QUOTE, '\\"')
    .replace(NEWLINE, '\\n');
}

/**
 * A value as a string literal that keeps every character, a control one as an
 * escape, where escapeString folds a line break as a comment may.
 */
function stringLiteral(value: string): string {
  const body = Array.from(value)
    .map(char => {
      const escaped = literalEscapes.get(char);
      if (escaped !== undefined) {
        return escaped;
      }
      const code = char.charCodeAt(0);
      return code < 0x20 || code === 0x7f
        ? `\\x${code.toString(16).padStart(2, '0')}`
        : char;
    })
    .join('');
  return `"${body}"`;
}
