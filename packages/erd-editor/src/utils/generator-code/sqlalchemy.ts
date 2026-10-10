import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
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
  ColumnType,
  getColumnType,
  isMySQLFamily,
  JSON_TYPES,
  POSTGRES_TIME_TZ_TYPES,
  TIMESTAMP_TZ_TYPES,
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

// A class body sees module scope, so every identifier this generator can put
// there is off limits to a class name and a column attribute. Each import set
// is typed from its tuple, so an unreserved name fails tsc --noEmit.
const SQLALCHEMY_NAMES = [
  'ARRAY',
  'BINARY',
  'BigInteger',
  'Boolean',
  'CHAR',
  'Date',
  'DateTime',
  'Double',
  'Enum',
  'Float',
  'ForeignKey',
  'ForeignKeyConstraint',
  'Index',
  'Integer',
  'Interval',
  'JSON',
  'LargeBinary',
  'NCHAR',
  'NVARCHAR',
  'Numeric',
  'REAL',
  'SmallInteger',
  'String',
  'Text',
  'Time',
  'UUID',
  'Uuid',
  'VARBINARY',
  'text',
] as const;

// One output targets one database, so it imports from one dialect module at
// most, and a name two modules share (TIMESTAMP, UUID) is never imported twice.
const DIALECT_NAMES = {
  mssql: ['MONEY', 'NTEXT', 'SMALLMONEY'],
  mysql: [
    'BIGINT',
    'BIT',
    'DATETIME',
    'DECIMAL',
    'DOUBLE',
    'FLOAT',
    'INET4',
    'INET6',
    'INTEGER',
    'LONGBLOB',
    'LONGTEXT',
    'MEDIUMBLOB',
    'MEDIUMINT',
    'MEDIUMTEXT',
    'SET',
    'SMALLINT',
    'TIME',
    'TIMESTAMP',
    'TINYBLOB',
    'TINYINT',
    'TINYTEXT',
    'VARCHAR',
    'YEAR',
  ],
  oracle: ['DATE', 'NCLOB', 'NVARCHAR2', 'RAW', 'TIMESTAMP'],
  postgresql: [
    'BIT',
    'CIDR',
    'DATEMULTIRANGE',
    'DATERANGE',
    'INET',
    'INT4MULTIRANGE',
    'INT4RANGE',
    'INT8MULTIRANGE',
    'INT8RANGE',
    'INTERVAL',
    'JSONB',
    'JSONPATH',
    'MACADDR',
    'MACADDR8',
    'MONEY',
    'NUMMULTIRANGE',
    'NUMRANGE',
    'OID',
    'REGCLASS',
    'REGCONFIG',
    'Range',
    'TIME',
    'TIMESTAMP',
    'TSMULTIRANGE',
    'TSQUERY',
    'TSRANGE',
    'TSTZMULTIRANGE',
    'TSTZRANGE',
    'TSVECTOR',
    'UUID',
  ],
} as const;

const ORM_NAMES = [
  'DeclarativeBase',
  'Mapped',
  'mapped_column',
  'relationship',
] as const;

const STDLIB_PLAIN_NAMES = ['uuid'] as const;

const STDLIB_FROM_NAMES = {
  datetime: ['date', 'datetime', 'time', 'timedelta'],
  decimal: ['Decimal'],
  typing: ['Any', 'List', 'Optional', 'Set'],
} as const;

// Builtins rather than imports, but an attribute named str shadows the
// annotation of every column after it exactly the way an import name does.
const BUILTIN_NAMES = ['bool', 'bytes', 'float', 'int', 'str'] as const;

const BASE_CLASS_NAME = 'Base';

type SqlalchemyName = (typeof SQLALCHEMY_NAMES)[number];
type Dialect = keyof typeof DIALECT_NAMES;
type DialectName<T extends Dialect> = (typeof DIALECT_NAMES)[T][number];
type OrmName = (typeof ORM_NAMES)[number];
type StdlibPlainName = (typeof STDLIB_PLAIN_NAMES)[number];
type StdlibModule = keyof typeof STDLIB_FROM_NAMES;
type StdlibFromName<T extends StdlibModule> =
  (typeof STDLIB_FROM_NAMES)[T][number];
type AnyStdlibFromName = StdlibFromName<StdlibModule>;
type AnnotationName =
  | (typeof BUILTIN_NAMES)[number]
  | StdlibFromName<'datetime'>
  | StdlibFromName<'decimal'>;

const MODULE_SCOPE_NAMES: ReadonlySet<string> = new Set<string>([
  BASE_CLASS_NAME,
  ...SQLALCHEMY_NAMES,
  ...Object.values(DIALECT_NAMES).flatMap<string>(names => [...names]),
  ...ORM_NAMES,
  ...STDLIB_PLAIN_NAMES,
  ...Object.values(STDLIB_FROM_NAMES).flatMap<string>(names => [...names]),
  ...BUILTIN_NAMES,
]);

const convertTypeMap: Record<keyof PrimitiveTypeMap, SqlalchemyName> = {
  int: 'Integer',
  long: 'BigInteger',
  float: 'Float',
  double: 'Double',
  decimal: 'Numeric',
  boolean: 'Boolean',
  string: 'String',
  lob: 'Text',
  date: 'Date',
  dateTime: 'DateTime',
  time: 'Time',
};

const annotationMap: Record<keyof PrimitiveTypeMap, AnnotationName> = {
  int: 'int',
  long: 'int',
  float: 'float',
  double: 'float',
  decimal: 'Decimal',
  boolean: 'bool',
  string: 'str',
  lob: 'str',
  date: 'date',
  dateTime: 'datetime',
  time: 'time',
};

const LINE_LIMIT = 88;
const INDENT = '    ';
const OWNING = 'owning';
const INVERSE = 'inverse';

type RelationshipSide = typeof OWNING | typeof INVERSE;

type ImportSet = {
  stdlibPlain: Set<StdlibPlainName>;
  stdlibFrom: Map<StdlibModule, Set<AnyStdlibFromName>>;
  sqlalchemy: Set<SqlalchemyName>;
  dialects: Map<Dialect, Set<string>>;
  orm: Set<OrmName>;
};

type CallEntry = {
  head: string;
  args: string[];
};

type SqlalchemyType = {
  expression: string;
  annotation: string;
  /** Integer or Numeric affinity, which autoincrement="auto" makes an identity. */
  isNumeric: boolean;
  /** The same expression as a call whose arguments may go one to a line. */
  call?: CallEntry;
};

type CallArgument = string | CallEntry;

type ResolvedRelationship = {
  relationship: Relationship;
  startTable: Table;
  endTable: Table;
  startColumns: Column[];
  endColumns: Column[];
};

type TableNaming = {
  className: string;
  // the columns this class declares, in table order
  columnIds: string[];
  // every column id of the table, mapped to the id of the column that carries
  // it: itself, or the earlier column that already claimed its name
  columnRefs: Map<string, string>;
  columnNames: Map<string, string>;
  // the Table.c key of each column, which is what every string that names a
  // column -- ForeignKey, ForeignKeyConstraint, Index -- is resolved against
  columnKeys: Map<string, string>;
  relationshipNames: Map<string, string>;
};

type ClassContext = {
  imports: ImportSet;
  indexNames: Name[];
  relationships: ResolvedRelationship[];
  namings: Map<string, TableNaming>;
  classNames: Set<string>;
  ambiguous: Set<string>;
};

type ColumnContext = {
  imports: ImportSet;
  attribute: string;
  key: string;
  foreignKeys: string[];
  isSoleKey: boolean;
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

  // One import header and one class Base serve the whole module, so the classes
  // render into a scratch buffer first and the header is written once, after
  // every class has contributed the names it imports.
  const stringBuffer: string[] = [''];
  const classBuffer: string[] = [];
  const context = createClassContext(state);

  tables.forEach(table => {
    classBuffer.push('');
    classBuffer.push('');
    formatClass(state, { buffer: classBuffer, table }, context);
  });

  formatImports(stringBuffer, context.imports);
  formatBase(stringBuffer);
  classBuffer.forEach(line => stringBuffer.push(line));
  stringBuffer.push('');

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const classBuffer: string[] = [];
  const context = createClassContext(state);

  formatClass(state, { buffer: classBuffer, table }, context);

  formatImports(buffer, context.imports);
  formatBase(buffer);
  buffer.push('');
  buffer.push('');
  classBuffer.forEach(line => buffer.push(line));
}

function formatBase(buffer: string[]) {
  buffer.push('');
  buffer.push('');
  buffer.push(`class ${BASE_CLASS_NAME}(DeclarativeBase):`);
  buffer.push(`${INDENT}pass`);
}

function formatClass(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: ClassContext
) {
  const { collections } = state;
  const { imports } = context;
  const naming = getNaming(state, context, table);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(naming.columnIds);
  const foreignKeys = new Map<string, string[]>();
  const entries: CallEntry[] = [];

  context.relationships
    .filter(({ relationship }) => relationship.end.tableId === table.id)
    .forEach(({ relationship, startTable, startColumns, endColumns }) => {
      const parentNaming = getNaming(state, context, startTable);
      const actions = referentialActionEntries(
        relationship,
        referentialActionSupport(state.settings.database)
      ).map(({ key, sql }) => `${key.toLowerCase()}="${sql}"`);

      if (endColumns.length === 1) {
        addSqlalchemy(imports, 'ForeignKey');
        const target = `${startTable.name}.${columnKey(parentNaming, startColumns[0])}`;
        const carrier = columnRef(naming, endColumns[0]);
        const args = [pythonString(target), ...actions];
        const values = foreignKeys.get(carrier) ?? [];
        values.push(`ForeignKey(${args.join(', ')})`);
        foreignKeys.set(carrier, values);
        return;
      }

      addSqlalchemy(imports, 'ForeignKeyConstraint');
      entries.push({
        head: 'ForeignKeyConstraint(',
        args: [
          formatStringList(endColumns.map(column => columnKey(naming, column))),
          formatStringList(
            startColumns.map(
              column => `${startTable.name}.${columnKey(parentNaming, column)}`
            )
          ),
          ...actions,
        ],
      });
    });

  createIndexEntries(state, table, naming, context).forEach(entry =>
    entries.push(entry)
  );

  buffer.push(`class ${naming.className}(${BASE_CLASS_NAME}):`);

  if (table.comment.trim() !== '') {
    buffer.push(`${INDENT}"""${formatDocstring(table.comment)}"""`);
    buffer.push('');
  }

  buffer.push(`${INDENT}__tablename__ = ${pythonString(table.name)}`);
  formatTableArgs(buffer, entries, table.comment);

  const bodyBuffer: string[] = [];
  const isSoleKey =
    columns.filter(column => bHas(column.options, ColumnOption.primaryKey))
      .length === 1;

  columns.forEach(column => {
    formatColumn(
      state,
      { buffer: bodyBuffer, column },
      {
        imports,
        attribute: naming.columnNames.get(column.id) ?? column.name,
        key: columnKey(naming, column),
        foreignKeys: foreignKeys.get(column.id) ?? [],
        isSoleKey,
      }
    );
  });

  const relationBuffer: string[] = [];
  formatRelation(state, { buffer: relationBuffer, table }, context);

  // A relationship line means a resolved relationship names this table, which
  // means a column of this table carries it, so bodyBuffer is never empty
  // here -- the second half is defence, not a shape the document reaches.
  if (relationBuffer.length !== 0 && bodyBuffer.length !== 0) {
    bodyBuffer.push('');
  }
  relationBuffer.forEach(line => bodyBuffer.push(line));

  if (bodyBuffer.length !== 0) {
    buffer.push('');
    bodyBuffer.forEach(line => buffer.push(line));
  }
}

function formatColumn(
  { settings: { database } }: RootState,
  { buffer, column }: FormatColumnOptions,
  { imports, attribute, key, foreignKeys, isSoleKey }: ColumnContext
) {
  const columnType = getColumnType(column.dataType, database);
  const { expression, annotation, isNumeric, call } = getSqlalchemyType(
    columnType,
    database,
    imports
  );
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
  const isNotNull = bHas(column.options, ColumnOption.notNull);
  // SQLAlchemy's autoincrement="auto" makes a lone numeric key an identity the
  // document never asked for, unless its type numbers the rows itself, as
  // SQLite's key declared INTEGER does, an alias of the rowid "auto" models.
  const isRowid =
    database === Database.SQLite &&
    columnType.element.trim().toLowerCase() === 'integer';
  const isGeneratedKey = isPrimaryKey && isSoleKey && isNumeric && !isRowid;
  const isAutoIncrement =
    bHas(column.options, ColumnOption.autoIncrement) ||
    (isGeneratedKey && columnType.isSerial);
  // MySQL's SERIAL adds a unique index of its own wherever the column stands.
  const isUnique =
    bHas(column.options, ColumnOption.unique) ||
    (isMySQLFamily(database) && columnType.isSerial);
  const isOptional = !isPrimaryKey && !isNotNull;
  const args: CallArgument[] = [];

  if (attribute !== column.name) {
    args.push(pythonString(column.name));
  }
  args.push(call ?? expression);
  foreignKeys.forEach(foreignKey => args.push(foreignKey));

  if (key !== column.name) {
    args.push(`key=${pythonString(key)}`);
  }
  if (isPrimaryKey) {
    args.push('primary_key=True');
  }
  if (isAutoIncrement) {
    args.push('autoincrement=True');
  } else if (isGeneratedKey) {
    args.push('autoincrement=False');
  }
  if (!isPrimaryKey && isNotNull) {
    args.push('nullable=False');
  }
  if (isUnique) {
    args.push('unique=True');
  }
  if (!isAutoIncrement && column.default.trim() !== '') {
    addSqlalchemy(imports, 'text');
    args.push({
      head: 'server_default=text(',
      args: [pythonString(column.default)],
    });
  }
  if (column.comment.trim() !== '') {
    args.push(`comment=${pythonString(column.comment)}`);
  }

  addOrm(imports, 'Mapped');
  addOrm(imports, 'mapped_column');

  if (isOptional) {
    addStdlibFrom(imports, 'typing', 'Optional');
  }

  formatAssignment(
    buffer,
    attribute,
    isOptional ? `Optional[${annotation}]` : annotation,
    'mapped_column(',
    args
  );
}

function formatRelation(
  state: RootState,
  { buffer, table }: FormatRelationOptions,
  context: ClassContext
) {
  const { imports } = context;
  const naming = getNaming(state, context, table);

  context.relationships
    .filter(({ relationship }) => relationship.end.tableId === table.id)
    .forEach(resolved => {
      const { relationship, startTable, endColumns } = resolved;
      const attribute = naming.relationshipNames.get(
        relationshipKey(relationship, OWNING)
      );

      if (!attribute) {
        return;
      }

      const parentNaming = getNaming(state, context, startTable);
      const isRequired = carriedColumns(state, naming, endColumns).every(
        column =>
          bHas(column.options, ColumnOption.primaryKey) ||
          bHas(column.options, ColumnOption.notNull)
      );

      // No Optional import here: isRequired is false exactly when formatColumn
      // would call the column optional, and formatClass has already run it over
      // every column this relationship can name.
      const annotation = isRequired
        ? `"${parentNaming.className}"`
        : `Optional["${parentNaming.className}"]`;

      addOrm(imports, 'relationship');
      formatAssignment(
        buffer,
        attribute,
        annotation,
        'relationship(',
        relationArguments(state, context, resolved, INVERSE)
      );
    });

  context.relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(resolved => {
      const { relationship, endTable } = resolved;
      const attribute = naming.relationshipNames.get(
        relationshipKey(relationship, INVERSE)
      );

      if (!attribute) {
        return;
      }

      const childNaming = getNaming(state, context, endTable);
      const isMany = hasNRelationship(relationship.relationshipType);

      addStdlibFrom(imports, 'typing', isMany ? 'List' : 'Optional');

      const annotation = isMany
        ? `List["${childNaming.className}"]`
        : `Optional["${childNaming.className}"]`;

      addOrm(imports, 'relationship');
      formatAssignment(
        buffer,
        attribute,
        annotation,
        'relationship(',
        relationArguments(state, context, resolved, OWNING)
      );
    });
}

function relationArguments(
  state: RootState,
  context: ClassContext,
  resolved: ResolvedRelationship,
  backPopulatesSide: RelationshipSide
): string[] {
  const { relationship, startTable, startColumns, endTable, endColumns } =
    resolved;
  const args: string[] = [];
  const otherTable = backPopulatesSide === OWNING ? endTable : startTable;
  const backPopulates = getNaming(
    state,
    context,
    otherTable
  ).relationshipNames.get(relationshipKey(relationship, backPopulatesSide));

  // Both ends name themselves under the same condition, so an end that got this
  // far always finds the other. The guard is defence: a template literal would
  // write the string undefined without complaint, and tsc would not object.
  if (backPopulates) {
    args.push(`back_populates="${backPopulates}"`);
  }

  // SQLAlchemy cannot pick between two foreign keys joining the same pair of
  // tables -- without foreign_keys it raises AmbiguousForeignKeysError at
  // mapper configuration. The string form keeps the forward reference lazy.
  if (context.ambiguous.has(pairKey(relationship))) {
    const childNaming = getNaming(state, context, endTable);
    const names = endColumns.map(
      column =>
        `${childNaming.className}.${childNaming.columnNames.get(column.id) ?? column.name}`
    );
    args.push(`foreign_keys="[${names.join(', ')}]"`);
  }

  // An adjacency list joins one table to itself, so nothing in the join
  // condition tells the ends apart and SQLAlchemy calls both one-to-many.
  // remote_side marks this end as the many-to-one side, the one holding the key.
  if (isSelfReferential(relationship) && backPopulatesSide === INVERSE) {
    const parentNaming = getNaming(state, context, startTable);
    const names = startColumns.map(
      column =>
        `${parentNaming.className}.${parentNaming.columnNames.get(column.id) ?? column.name}`
    );
    args.push(`remote_side="[${names.join(', ')}]"`);
  }

  return args;
}

function createIndexEntries(
  state: RootState,
  table: Table,
  naming: TableNaming,
  { imports, indexNames }: ClassContext
): CallEntry[] {
  const {
    doc: { indexIds },
    collections,
  } = state;
  const columnCollection = query(collections).collection('tableColumnEntities');
  const entries: CallEntry[] = [];

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .forEach(index => {
      const columns = query(collections)
        .collection('indexColumnEntities')
        .selectByIds(index.indexColumnIds)
        .map(indexColumn => columnCollection.selectById(indexColumn.columnId))
        .filter(column => column !== undefined) as Column[];

      if (columns.length === 0) {
        return;
      }

      let indexName = index.name;
      if (index.name.trim() === '') {
        indexName = autoName(indexNames, '', `IDX_${table.name}`);
        indexNames.push({ id: index.id, name: indexName });
      }

      const args = [pythonString(indexName)];
      columns.forEach(column =>
        args.push(pythonString(columnKey(naming, column)))
      );
      if (index.unique) {
        args.push('unique=True');
      }

      addSqlalchemy(imports, 'Index');
      entries.push({ head: 'Index(', args });
    });

  return entries;
}

function formatTableArgs(
  buffer: string[],
  entries: CallEntry[],
  comment: string
) {
  const commentArg =
    comment.trim() === '' ? null : `"comment": ${pythonString(comment)}`;

  if (entries.length === 0) {
    if (commentArg !== null) {
      formatCall(buffer, INDENT, '__table_args__ = {', [commentArg], '}');
    }
    return;
  }

  // The comma after a lone entry is what makes the tuple, not one that keeps
  // it open, so black joins the tuple onto one line wherever it fits.
  const single = `${INDENT}__table_args__ = (${callText(entries[0])},)`;
  if (
    entries.length === 1 &&
    commentArg === null &&
    lineWidth(single) <= LINE_LIMIT
  ) {
    buffer.push(single);
    return;
  }

  buffer.push(`${INDENT}__table_args__ = (`);
  entries.forEach(entry => {
    formatCall(buffer, `${INDENT}${INDENT}`, entry.head, entry.args, '),');
  });
  if (commentArg !== null) {
    formatCall(buffer, `${INDENT}${INDENT}`, '{', [commentArg], '},');
  }
  buffer.push(`${INDENT})`);
}

function formatCall(
  buffer: string[],
  indent: string,
  head: string,
  args: CallArgument[],
  tail: string
) {
  const line = `${indent}${head}${args.map(callText).join(', ')}${tail}`;

  if (lineWidth(line) <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  // Keep the trailing comma: it is black's magic trailing comma, and without it
  // black pulls the arguments back onto one line.
  buffer.push(`${indent}${head}`);
  args.forEach(arg => {
    if (typeof arg === 'string') {
      buffer.push(`${indent}${INDENT}${arg},`);
      return;
    }
    formatCall(buffer, `${indent}${INDENT}`, arg.head, arg.args, '),');
  });
  buffer.push(`${indent}${tail}`);
}

/**
 * A Mapped attribute set to a call. Where the call would open past the line,
 * black moves it into parentheses of its own if the target, = and ( fit on
 * one line, and otherwise opens the annotation's brackets instead.
 */
function formatAssignment(
  buffer: string[],
  attribute: string,
  annotation: string,
  head: string,
  args: CallArgument[]
) {
  const target = `${attribute}: Mapped[${annotation}]`;
  const opening = `${INDENT}${target} = ${head}`;
  const line = `${opening}${args.map(callText).join(', ')})`;
  const wrapped = `${INDENT}${target} = (`;

  if (lineWidth(line) <= LINE_LIMIT || lineWidth(opening) <= LINE_LIMIT) {
    formatCall(buffer, INDENT, `${target} = ${head}`, args, ')');
    return;
  }
  if (lineWidth(wrapped) <= LINE_LIMIT) {
    buffer.push(wrapped);
    formatCall(buffer, `${INDENT}${INDENT}`, head, args, ')');
    buffer.push(`${INDENT})`);
    return;
  }

  buffer.push(`${INDENT}${attribute}: Mapped[`);
  buffer.push(`${INDENT}${INDENT}${annotation}`);
  formatCall(buffer, INDENT, `] = ${head}`, args, ')');
}

/**
 * The code points black counts as two columns in the East Asian scripts:
 * Hangul, kana, the CJK ideographs, symbols and punctuation, fullwidth forms.
 */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x2e99],
  [0x2e9b, 0x2ef3],
  [0x2f00, 0x2fd5],
  [0x2ff0, 0x2ffb],
  [0x3000, 0x3029],
  [0x302e, 0x303e],
  [0x3041, 0x3096],
  [0x309b, 0x30ff],
  [0x3105, 0x312f],
  [0x3131, 0x318e],
  [0x3190, 0x31e3],
  [0x31f0, 0x321e],
  [0x3220, 0x3247],
  [0x3250, 0x4dbf],
  [0x4e00, 0xa48c],
  [0xa490, 0xa4c6],
  [0xa960, 0xa97c],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe52],
  [0xfe54, 0xfe66],
  [0xfe68, 0xfe6b],
  [0xff01, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

// The columns black gives a line: a code point at a time, two for a wide one.
// Emoji and combining marks, which black also counts apart, count one here.
function lineWidth(line: string): number {
  if (PRINTABLE_ASCII.test(line)) {
    return line.length;
  }

  let width = 0;
  for (const char of line) {
    const code = char.codePointAt(0) as number;
    width += WIDE_RANGES.some(([first, last]) => first <= code && code <= last)
      ? 2
      : 1;
  }
  return width;
}

function callText(arg: CallArgument): string {
  return typeof arg === 'string' ? arg : `${arg.head}${arg.args.join(', ')})`;
}

function formatImports(buffer: string[], imports: ImportSet) {
  const stdlibBuffer: string[] = [];
  const sqlalchemyBuffer: string[] = [];

  // uuid is the only member STDLIB_PLAIN_NAMES has, so this sort is
  // defence for a second one rather than something the output shows.
  Array.from(imports.stdlibPlain)
    .sort()
    .forEach(name => stdlibBuffer.push(`import ${name}`));
  Array.from(imports.stdlibFrom.keys())
    .sort()
    .forEach(module => {
      formatFromImport(
        stdlibBuffer,
        module,
        imports.stdlibFrom.get(module) as ReadonlySet<string>
      );
    });

  if (imports.sqlalchemy.size !== 0) {
    formatFromImport(sqlalchemyBuffer, 'sqlalchemy', imports.sqlalchemy);
  }
  Array.from(imports.dialects.keys())
    .sort()
    .forEach(dialect => {
      formatFromImport(
        sqlalchemyBuffer,
        `sqlalchemy.dialects.${dialect}`,
        imports.dialects.get(dialect) as ReadonlySet<string>
      );
    });
  formatFromImport(sqlalchemyBuffer, 'sqlalchemy.orm', imports.orm);

  stdlibBuffer.forEach(line => buffer.push(line));
  if (stdlibBuffer.length !== 0) {
    buffer.push('');
  }
  sqlalchemyBuffer.forEach(line => buffer.push(line));
}

function formatFromImport(
  buffer: string[],
  module: string,
  names: ReadonlySet<string>
) {
  const sorted = sortImportNames(names);
  const line = `from ${module} import ${sorted.join(', ')}`;

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  buffer.push(`from ${module} import (`);
  sorted.forEach(name => buffer.push(`${INDENT}${name},`));
  buffer.push(')');
}

// JSON and UUID are CONSTANT to isort where DateTime is a class, so the two are
// different groups. The lookahead reproduces isupper() being false for a name
// of digits and underscores alone, which no current member reaches.
const CONSTANT = /^(?=.*[A-Z])[A-Z0-9_]{2,}$/;

// isort keys a name by its bucket, then by the name lowercased. Over the closed
// tuples above only the CONSTANT bucket has to be spelled out; the class/rest
// split falls out of a raw ASCII comparison, so the raw name is the second half.
function importGroup(name: string): number {
  return CONSTANT.test(name) ? 0 : 1;
}

function sortImportNames(names: ReadonlySet<string>): string[] {
  return Array.from(names).sort((a, b) => {
    const group = importGroup(a) - importGroup(b);
    if (group !== 0) {
      return group;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function createImportSet(): ImportSet {
  const imports: ImportSet = {
    stdlibPlain: new Set<StdlibPlainName>(),
    stdlibFrom: new Map<StdlibModule, Set<AnyStdlibFromName>>(),
    sqlalchemy: new Set<SqlalchemyName>(),
    dialects: new Map<Dialect, Set<string>>(),
    orm: new Set<OrmName>(),
  };

  addOrm(imports, 'DeclarativeBase');

  return imports;
}

function addSqlalchemy(imports: ImportSet, name: SqlalchemyName) {
  imports.sqlalchemy.add(name);
}

function addDialect<T extends Dialect>(
  imports: ImportSet,
  dialect: T,
  name: DialectName<T>
) {
  const names = imports.dialects.get(dialect) ?? new Set<string>();
  names.add(name);
  imports.dialects.set(dialect, names);
}

function addOrm(imports: ImportSet, name: OrmName) {
  imports.orm.add(name);
}

function addStdlibPlain(imports: ImportSet, name: StdlibPlainName) {
  imports.stdlibPlain.add(name);
}

function addStdlibFrom<T extends StdlibModule>(
  imports: ImportSet,
  module: T,
  name: StdlibFromName<T>
) {
  const names = imports.stdlibFrom.get(module) ?? new Set<AnyStdlibFromName>();
  names.add(name);
  imports.stdlibFrom.set(module, names);
}

// TEXT, BLOB and JSON share primitive types the eleven categories cannot tell
// apart. Alembic compares the mapped type against the reflected one, so a model
// that collapsed them would emit a modify_type back to the type it already has.
const textTypes = new Set([
  'clob',
  'long varchar',
  'longtext',
  'mediumtext',
  'nclob',
  'ntext',
  'text',
  'tinytext',
]);

// Each integer name with the dialect type that carries UNSIGNED and ZEROFILL,
// and the core type a signed one keeps where the core has one.
const mysqlIntegerTypes = new Map<
  string,
  [DialectName<'mysql'>, SqlalchemyName | null]
>([
  ['bigint', ['BIGINT', 'BigInteger']],
  ['int', ['INTEGER', 'Integer']],
  ['int1', ['TINYINT', null]],
  ['int2', ['SMALLINT', 'SmallInteger']],
  ['int3', ['MEDIUMINT', null]],
  ['int4', ['INTEGER', 'Integer']],
  ['int8', ['BIGINT', 'BigInteger']],
  ['integer', ['INTEGER', 'Integer']],
  ['mediumint', ['MEDIUMINT', null]],
  ['middleint', ['MEDIUMINT', null]],
  ['smallint', ['SMALLINT', 'SmallInteger']],
  ['tinyint', ['TINYINT', null]],
]);

// MySQL stores LONG and LONG VARCHAR as MEDIUMTEXT and LONG VARBINARY as a
// MEDIUMBLOB; MariaDB's Oracle mode takes CLOB for LONGTEXT.
const mysqlSizedTypes = new Map<string, [DialectName<'mysql'>, AnnotationName]>(
  [
    ['clob', ['LONGTEXT', 'str']],
    ['long', ['MEDIUMTEXT', 'str']],
    ['long char varying', ['MEDIUMTEXT', 'str']],
    ['long character varying', ['MEDIUMTEXT', 'str']],
    ['long varbinary', ['MEDIUMBLOB', 'bytes']],
    ['long varchar', ['MEDIUMTEXT', 'str']],
    ['long varcharacter', ['MEDIUMTEXT', 'str']],
    ['longblob', ['LONGBLOB', 'bytes']],
    ['longtext', ['LONGTEXT', 'str']],
    ['mediumblob', ['MEDIUMBLOB', 'bytes']],
    ['mediumtext', ['MEDIUMTEXT', 'str']],
    ['tinyblob', ['TINYBLOB', 'bytes']],
    ['tinytext', ['TINYTEXT', 'str']],
  ]
);

// The databases with an interval column type; on any other an interval is
// not a type, and stays the string its vendor list files it under.
const intervalDatabases = new Set<number>([
  Database.Databricks,
  Database.Oracle,
  Database.PostgreSQL,
]);

const mysqlDecimalTypes = new Set(['dec', 'decimal', 'fixed', 'numeric']);
const mysqlYearTypes = new Set(['sql_tsi_year', 'year']);
const characterTypes = new Set(['char', 'character']);
const nationalCharacterTypes = new Set([
  'national char',
  'national character',
  'nchar',
]);
// Every spelling MySQL and MariaDB read as a VARCHAR of the national
// character set, utf8mb3.
const mysqlNationalVaryingTypes = new Set([
  'national char varying',
  'national character varying',
  'national varchar',
  'national varcharacter',
  'nchar varchar',
  'nchar varcharacter',
  'nchar varying',
  'nvarchar',
]);
const mssqlNationalVaryingTypes = new Set([
  'national char varying',
  'national character varying',
  'nvarchar',
]);
const oracleNationalVaryingTypes = new Set([
  'national char varying',
  'national character varying',
  'nchar varying',
  'nvarchar2',
]);
const postgresSmallintTypes = new Set([
  'int2',
  'serial2',
  'smallint',
  'smallserial',
]);
const postgresTimeTypes = new Set(['time', 'time without time zone']);
const postgresTimestampTypes = new Set([
  'timestamp',
  'timestamp without time zone',
]);

// The element types whose arrays psycopg2, SQLAlchemy's default PostgreSQL
// driver, parses into a list. It hands any other array over as one string
// such as {a,b}, which an ARRAY would split into its letters.
const postgresArrayTypes = new Set([
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
  'daterange',
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
  'int4range',
  'int8',
  'int8range',
  'integer',
  'json',
  'jsonb',
  'macaddr',
  'name',
  'numeric',
  'numrange',
  'oid',
  'real',
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
  'tsrange',
  'tstzrange',
  'uuid',
  'varchar',
]);

// The PostgreSQL types the dialect names that psycopg2 reads as text, and oid,
// which it reads as a number.
const postgresNamedTypes = new Map<
  string,
  [DialectName<'postgresql'>, AnnotationName]
>([
  ['cidr', ['CIDR', 'str']],
  ['inet', ['INET', 'str']],
  ['jsonpath', ['JSONPATH', 'str']],
  ['macaddr', ['MACADDR', 'str']],
  ['macaddr8', ['MACADDR8', 'str']],
  ['oid', ['OID', 'int']],
  ['regclass', ['REGCLASS', 'str']],
  ['regconfig', ['REGCONFIG', 'str']],
  ['tsquery', ['TSQUERY', 'str']],
  ['tsvector', ['TSVECTOR', 'str']],
]);

// Each range type with the Python type of its bounds; a multirange reads as a
// list of ranges.
const postgresRangeTypes = new Map<
  string,
  [DialectName<'postgresql'>, AnnotationName]
>([
  ['datemultirange', ['DATEMULTIRANGE', 'date']],
  ['daterange', ['DATERANGE', 'date']],
  ['int4multirange', ['INT4MULTIRANGE', 'int']],
  ['int4range', ['INT4RANGE', 'int']],
  ['int8multirange', ['INT8MULTIRANGE', 'int']],
  ['int8range', ['INT8RANGE', 'int']],
  ['nummultirange', ['NUMMULTIRANGE', 'Decimal']],
  ['numrange', ['NUMRANGE', 'Decimal']],
  ['tsmultirange', ['TSMULTIRANGE', 'datetime']],
  ['tsrange', ['TSRANGE', 'datetime']],
  ['tstzmultirange', ['TSTZMULTIRANGE', 'datetime']],
  ['tstzrange', ['TSTZRANGE', 'datetime']],
]);

// The names SQLAlchemy gives Integer or Numeric affinity: on a lone primary
// key its autoincrement="auto" turns each into SERIAL, AUTO_INCREMENT or an
// IDENTITY, or a CREATE TABLE that SQL Server and MySQL refuse.
const NUMERIC_NAMES: ReadonlySet<string> = new Set<
  SqlalchemyName | DialectName<'mysql'>
>([
  'BIGINT',
  'BigInteger',
  'DECIMAL',
  'DOUBLE',
  'Double',
  'FLOAT',
  'Float',
  'INTEGER',
  'Integer',
  'MEDIUMINT',
  'Numeric',
  'REAL',
  'SMALLINT',
  'SmallInteger',
  'TINYINT',
]);

const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/i;
const ORACLE_DAY_TO_SECOND =
  /^\s*interval\s+day\s*(?:\(\s*(\d+)\s*\))?\s+to\s+second\s*(?:\(\s*(\d+)\s*\))?\s*$/i;
const INTERVAL_WORD = 'interval';

/**
 * The SQLAlchemy type of a column and the Python type it reads as. On each
 * database the type is the one its DDL names where SQLAlchemy has it, so that
 * create_all writes that type and Alembic reports no difference against it.
 */
function getSqlalchemyType(
  column: ColumnType,
  database: number,
  imports: ImportSet
): SqlalchemyType {
  if (column.arrayDepth === 0) {
    return elementType(column, database, imports);
  }
  // An enum array, which no vendor list names, or an array psycopg2 cannot
  // parse stays the text it hands over.
  if (
    !column.isListed ||
    (!postgresArrayTypes.has(column.base) && column.scalar !== 'interval')
  ) {
    return coreType(imports, 'String', 'str');
  }

  const element = elementType(column, database, imports);
  const dimensions =
    column.arrayDepth > 1 ? `, dimensions=${column.arrayDepth}` : '';

  addSqlalchemy(imports, 'ARRAY');
  addStdlibFrom(imports, 'typing', 'List');
  return {
    expression: `ARRAY(${element.expression}${dimensions})`,
    annotation: `${'List['.repeat(column.arrayDepth)}${element.annotation}${']'.repeat(column.arrayDepth)}`,
    isNumeric: false,
  };
}

function elementType(
  column: ColumnType,
  database: number,
  imports: ImportSet
): SqlalchemyType {
  switch (database) {
    case Database.MariaDB:
    case Database.MySQL:
      return (
        mysqlType(column, database, imports) ??
        portableType(column, database, imports)
      );
    case Database.PostgreSQL:
      return (
        postgresType(column, imports) ?? portableType(column, database, imports)
      );
    case Database.MSSQL:
      return (
        mssqlType(column, imports) ?? portableType(column, database, imports)
      );
    case Database.Oracle:
      return (
        oracleType(column, imports) ?? portableType(column, database, imports)
      );
  }
  return portableType(column, database, imports);
}

function portableType(
  column: ColumnType,
  database: number,
  imports: ImportSet
): SqlalchemyType {
  const { base, element, args } = column;

  if (textTypes.has(base)) {
    return coreType(imports, 'Text', 'str');
  }
  if (BINARY_TYPES.has(base)) {
    return coreType(imports, 'LargeBinary', 'bytes');
  }
  if (base === 'jsonb' && database === Database.PostgreSQL) {
    addStdlibFrom(imports, 'typing', 'Any');
    return dialectType(imports, 'postgresql', 'JSONB', 'Any');
  }
  if (JSON_TYPES.has(base)) {
    addStdlibFrom(imports, 'typing', 'Any');
    return coreType(imports, 'JSON', 'Any');
  }
  if (base === 'uuid' && database === Database.PostgreSQL) {
    addStdlibPlain(imports, 'uuid');
    return dialectType(
      imports,
      'postgresql',
      'UUID',
      'uuid.UUID',
      '(as_uuid=True)'
    );
  }
  if (UUID_TYPES.has(base)) {
    addStdlibPlain(imports, 'uuid');
    return coreType(imports, 'Uuid', 'uuid.UUID');
  }
  if (TIMESTAMP_TZ_TYPES.has(base)) {
    return coreType(imports, 'DateTime', 'datetime', '(timezone=True)');
  }
  if (POSTGRES_TIME_TZ_TYPES.has(base)) {
    return coreType(imports, 'Time', 'time', '(timezone=True)');
  }
  if (column.scalar === 'interval' && intervalDatabases.has(database)) {
    return coreType(imports, 'Interval', 'timedelta');
  }

  const primitiveType = getPrimitiveType(element, database);
  const callable = convertTypeMap[primitiveType];
  const annotation = annotationMap[primitiveType];

  if (primitiveType === 'string') {
    return coreType(imports, callable, annotation, lengthArgument(column));
  }
  if (primitiveType === 'decimal' && (args.length === 1 || args.length === 2)) {
    return coreType(imports, callable, annotation, `(${args.join(', ')})`);
  }
  // Oracle's NUMBER(*,2) is a NUMBER(38,2), which Numeric spells with digits.
  if (
    primitiveType === 'decimal' &&
    column.precision !== null &&
    column.scale !== null
  ) {
    return coreType(
      imports,
      callable,
      annotation,
      `(${column.precision}, ${column.scale})`
    );
  }
  return coreType(imports, callable, annotation);
}

// A character type's declared length, an Oracle BYTE or CHAR unit dropped,
// else a positive lone argument; null where neither gives one.
function lengthValue({ args, length }: ColumnType): number | null {
  const value = length ?? (args.length === 1 ? args[0] : null);
  return value !== null && value > 0 ? value : null;
}

function lengthArgument(column: ColumnType): string {
  const value = lengthValue(column);
  return value === null ? '' : `(${value})`;
}

// A MySQL or MariaDB String needs a length, and a type the core spells only
// one way (TINYINT, YEAR, BIT, the sized TEXT and BLOB types, a fractional
// second on TIMESTAMP, DATETIME and TIME) comes from the dialect.
function mysqlType(
  column: ColumnType,
  database: number,
  imports: ImportSet
): SqlalchemyType | null {
  const { base, args } = column;
  const isMariaDB = database === Database.MariaDB;
  const length = lengthArgument(column);
  const fsp = args.length === 1 && args[0] > 0 ? `(fsp=${args[0]})` : '';
  const integer = mysqlIntegerTypes.get(base);
  const sized = mysqlSizedTypes.get(base);

  if (column.enumMembers) {
    return memberCall(coreType(imports, 'Enum', 'str'), column.enumMembers);
  }
  if (column.setMembers) {
    addStdlibFrom(imports, 'typing', 'Set');
    return {
      ...memberCall(
        dialectType(imports, 'mysql', 'SET', 'str'),
        column.setMembers
      ),
      annotation: 'Set[str]',
    };
  }
  if (column.network === 'ipv4') {
    return dialectType(imports, 'mysql', 'INET4', 'str');
  }
  if (column.network === 'ipv6') {
    return dialectType(imports, 'mysql', 'INET6', 'str');
  }
  if (isMariaDB && base === 'uuid') {
    addStdlibPlain(imports, 'uuid');
    return coreType(imports, 'UUID', 'uuid.UUID');
  }
  if (base === 'serial') {
    return dialectType(imports, 'mysql', 'BIGINT', 'int', '(unsigned=True)');
  }
  if (integer) {
    return mysqlInteger(column, integer, imports);
  }
  if (base === 'bit') {
    return dialectType(imports, 'mysql', 'BIT', 'int', length);
  }
  if (mysqlYearTypes.has(base)) {
    return dialectType(imports, 'mysql', 'YEAR', 'int');
  }
  if (mysqlDecimalTypes.has(base) && column.isUnsigned) {
    const digits = [column.precision, column.scale].filter(
      value => value !== null
    );
    return dialectType(
      imports,
      'mysql',
      'DECIMAL',
      'Decimal',
      `(${[...digits, ...unsignedOptions(column)].join(', ')})`
    );
  }
  // The dialect's DOUBLE reads a Decimal unless told otherwise; its FLOAT and
  // the core Double read a float.
  if (column.isFloat && column.isUnsigned) {
    const isDouble = column.scalar === 'f64';
    const options = unsignedOptions(column);

    return dialectType(
      imports,
      'mysql',
      isDouble ? 'DOUBLE' : 'FLOAT',
      'float',
      `(${(isDouble ? [...options, 'asdecimal=False'] : options).join(', ')})`
    );
  }
  // CLOB, RAW and NUMBER exist in MariaDB's Oracle mode alone, which stores
  // them as LONGTEXT, VARBINARY(n) and, for a bare NUMBER, a DOUBLE.
  if (sized && (base !== 'clob' || isMariaDB)) {
    return dialectType(imports, 'mysql', sized[0], sized[1]);
  }
  // TEXT(n) and BLOB(n) are the smallest class that holds n, TEXT(0) MySQL's
  // TINYTEXT, so n goes on and the database picks the class for create_all as
  // it did for the editor's DDL.
  if (base === 'text' && args.length === 1) {
    return coreType(imports, 'Text', 'str', `(${args[0]})`);
  }
  if (base === 'blob' && args.length === 1) {
    return coreType(imports, 'LargeBinary', 'bytes', `(${args[0]})`);
  }
  if (base === 'binary' || base === 'char byte') {
    return coreType(imports, 'BINARY', 'bytes', length);
  }
  if (
    (base === 'varbinary' || (isMariaDB && base === 'raw')) &&
    length !== ''
  ) {
    return coreType(imports, 'VARBINARY', 'bytes', length);
  }
  if (isMariaDB && base === 'number' && column.precision === null) {
    return coreType(imports, 'Double', 'float');
  }
  if (characterTypes.has(base)) {
    return coreType(imports, 'CHAR', 'str', length);
  }
  if (nationalCharacterTypes.has(base)) {
    return coreType(imports, 'NCHAR', 'str', length);
  }
  if (mysqlNationalVaryingTypes.has(base) && length !== '') {
    return dialectType(
      imports,
      'mysql',
      'VARCHAR',
      'str',
      `(${lengthValue(column)}, charset="utf8mb3")`
    );
  }
  if (base === 'timestamp') {
    return dialectType(imports, 'mysql', 'TIMESTAMP', 'datetime', fsp);
  }
  if (base === 'datetime' && fsp !== '') {
    return dialectType(imports, 'mysql', 'DATETIME', 'datetime', fsp);
  }
  if (base === 'time' && fsp !== '') {
    return dialectType(imports, 'mysql', 'TIME', 'time', fsp);
  }
  return null;
}

// MySQL keeps a display width only on TINYINT(1) and on a ZEROFILL column,
// where SHOW CREATE TABLE still prints it, and deprecates it everywhere else.
function mysqlInteger(
  column: ColumnType,
  [name, signed]: [DialectName<'mysql'>, SqlalchemyName | null],
  imports: ImportSet
): SqlalchemyType {
  const { args, element } = column;
  const options = unsignedOptions(column);
  const width = args.length === 1 ? args[0] : null;

  if (!column.isUnsigned && signed) {
    return coreType(imports, signed, 'int');
  }

  const keepsWidth =
    width !== null &&
    (ZEROFILL.test(element) || (name === 'TINYINT' && width === 1));
  const values = keepsWidth ? [String(width), ...options] : options;

  return dialectType(
    imports,
    'mysql',
    name,
    'int',
    values.length === 0 ? '' : `(${values.join(', ')})`
  );
}

// ZEROFILL makes a MySQL column UNSIGNED too, and SHOW CREATE TABLE says both.
function unsignedOptions({ element, isUnsigned }: ColumnType): string[] {
  if (ZEROFILL.test(element)) {
    return ['unsigned=True', 'zerofill=True'];
  }
  return isUnsigned ? ['unsigned=True'] : [];
}

function postgresType(
  column: ColumnType,
  imports: ImportSet
): SqlalchemyType | null {
  const { base, args } = column;
  const precision = args.length === 1 ? args[0] : null;
  const length = lengthArgument(column);
  const named = postgresNamedTypes.get(base);
  const range = postgresRangeTypes.get(base);

  if (postgresSmallintTypes.has(base)) {
    return coreType(imports, 'SmallInteger', 'int');
  }
  if (column.scalar === 'f32') {
    return coreType(imports, 'REAL', 'float');
  }
  if (characterTypes.has(base) || (base === 'bpchar' && length !== '')) {
    return coreType(imports, 'CHAR', 'str', length);
  }
  if (column.isBitString) {
    const values = length === '' ? [] : [String(args[0])];
    if (base !== 'bit') {
      values.push('varying=True');
    }
    return dialectType(
      imports,
      'postgresql',
      'BIT',
      'str',
      values.length === 0 ? '' : `(${values.join(', ')})`
    );
  }
  if (column.isMoney) {
    return dialectType(imports, 'postgresql', 'MONEY', 'str');
  }
  if (named) {
    return dialectType(imports, 'postgresql', named[0], named[1]);
  }
  if (range) {
    const isMultirange = base.endsWith('multirange');

    addDialect(imports, 'postgresql', 'Range');
    if (isMultirange) {
      addStdlibFrom(imports, 'typing', 'List');
    }
    return {
      ...dialectType(imports, 'postgresql', range[0], range[1]),
      annotation: isMultirange
        ? `List[Range[${range[1]}]]`
        : `Range[${range[1]}]`,
    };
  }
  if (column.scalar === 'interval') {
    return postgresInterval(base, precision, imports);
  }
  if (precision === null) {
    return null;
  }
  if (postgresTimeTypes.has(base) || POSTGRES_TIME_TZ_TYPES.has(base)) {
    return dialectType(
      imports,
      'postgresql',
      'TIME',
      'time',
      timePrecision(postgresTimeTypes.has(base), precision)
    );
  }
  if (postgresTimestampTypes.has(base) || TIMESTAMP_TZ_TYPES.has(base)) {
    return dialectType(
      imports,
      'postgresql',
      'TIMESTAMP',
      'datetime',
      timePrecision(postgresTimestampTypes.has(base), precision)
    );
  }
  return null;
}

function timePrecision(isNaive: boolean, precision: number): string {
  return isNaive
    ? `(precision=${precision})`
    : `(timezone=True, precision=${precision})`;
}

// interval day to second(3) keeps its fields and its precision, which the
// core Interval cannot write.
function postgresInterval(
  base: string,
  precision: number | null,
  imports: ImportSet
): SqlalchemyType {
  const fields = base.slice(INTERVAL_WORD.length).trim();
  const values: string[] = [];

  if (fields !== '') {
    values.push(`fields="${fields}"`);
  }
  if (precision !== null) {
    values.push(`precision=${precision}`);
  }
  if (values.length === 0) {
    return coreType(imports, 'Interval', 'timedelta');
  }
  return dialectType(
    imports,
    'postgresql',
    'INTERVAL',
    'timedelta',
    `(${values.join(', ')})`
  );
}

function mssqlType(
  column: ColumnType,
  imports: ImportSet
): SqlalchemyType | null {
  const { base } = column;
  const length = lengthArgument(column);

  if (base === 'money') {
    return dialectType(imports, 'mssql', 'MONEY', 'Decimal');
  }
  if (base === 'smallmoney') {
    return dialectType(imports, 'mssql', 'SMALLMONEY', 'Decimal');
  }
  if (mssqlNationalVaryingTypes.has(base)) {
    return coreType(imports, 'NVARCHAR', 'str', length);
  }
  if (characterTypes.has(base)) {
    return coreType(imports, 'CHAR', 'str', length);
  }
  if (nationalCharacterTypes.has(base)) {
    return coreType(imports, 'NCHAR', 'str', length);
  }
  if (base === 'ntext' || base === 'national text') {
    return dialectType(imports, 'mssql', 'NTEXT', 'str');
  }
  if (base === 'binary') {
    return coreType(imports, 'BINARY', 'bytes', length);
  }
  if ((base === 'varbinary' || base === 'binary varying') && length !== '') {
    return coreType(imports, 'VARBINARY', 'bytes', length);
  }
  return null;
}

// SQLAlchemy writes DATE and every TIMESTAMP as DATE on Oracle unless the
// dialect's own types are used, and a TIMESTAMP's precision has no argument
// there: TIMESTAMP(3) takes the 3 as timezone.
function oracleType(
  column: ColumnType,
  imports: ImportSet
): SqlalchemyType | null {
  const { base, element } = column;
  const length = lengthArgument(column);

  if (base === 'date') {
    return dialectType(imports, 'oracle', 'DATE', 'datetime');
  }
  if (base === 'timestamp') {
    return dialectType(imports, 'oracle', 'TIMESTAMP', 'datetime');
  }
  if (base === 'timestamp with time zone') {
    return dialectType(
      imports,
      'oracle',
      'TIMESTAMP',
      'datetime',
      '(timezone=True)'
    );
  }
  if (base === 'timestamp with local time zone') {
    return dialectType(
      imports,
      'oracle',
      'TIMESTAMP',
      'datetime',
      '(local_timezone=True)'
    );
  }
  if (oracleNationalVaryingTypes.has(base) && length !== '') {
    return dialectType(imports, 'oracle', 'NVARCHAR2', 'str', length);
  }
  if (characterTypes.has(base)) {
    return coreType(imports, 'CHAR', 'str', length);
  }
  if (nationalCharacterTypes.has(base)) {
    return coreType(imports, 'NCHAR', 'str', length);
  }
  if (base === 'nclob') {
    return dialectType(imports, 'oracle', 'NCLOB', 'str');
  }
  if (base === 'raw' && length !== '') {
    return dialectType(imports, 'oracle', 'RAW', 'bytes', length);
  }

  const daySecond = ORACLE_DAY_TO_SECOND.exec(element);

  if (daySecond) {
    const [, day, second] = daySecond;
    const values = [
      day === undefined ? null : `day_precision=${day}`,
      second === undefined ? null : `second_precision=${second}`,
    ].filter(value => value !== null);

    return coreType(
      imports,
      'Interval',
      'timedelta',
      values.length === 0 ? '' : `(${values.join(', ')})`
    );
  }
  return null;
}

function coreType(
  imports: ImportSet,
  name: SqlalchemyName,
  annotation: AnnotationName | 'Any' | 'uuid.UUID',
  args = ''
): SqlalchemyType {
  addSqlalchemy(imports, name);
  addAnnotationImport(imports, annotation);
  return {
    expression: `${name}${args}`,
    annotation,
    isNumeric: NUMERIC_NAMES.has(name),
  };
}

function dialectType<T extends Dialect>(
  imports: ImportSet,
  dialect: T,
  name: DialectName<T>,
  annotation: AnnotationName | 'Any' | 'uuid.UUID',
  args = ''
): SqlalchemyType {
  addDialect(imports, dialect, name);
  addAnnotationImport(imports, annotation);
  return {
    expression: `${name}${args}`,
    annotation,
    isNumeric: NUMERIC_NAMES.has(name),
  };
}

function addAnnotationImport(imports: ImportSet, annotation: string) {
  switch (annotation) {
    case 'Decimal':
      addStdlibFrom(imports, 'decimal', 'Decimal');
      break;
    case 'date':
    case 'datetime':
    case 'time':
    case 'timedelta':
      addStdlibFrom(imports, 'datetime', annotation);
      break;
  }
}

const PYTHON_ESCAPES = new Map([
  ['\\', '\\\\'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

// The members an ENUM or SET reads, as Python string literals: a control
// character a MySQL escape put there is written as an escape of its own.
function memberCall(type: SqlalchemyType, members: string[]): SqlalchemyType {
  const call = { head: `${type.expression}(`, args: members.map(pythonString) };
  return { ...type, expression: callText(call), call };
}

// Black keeps double quotes unless single ones need fewer escapes, which is
// where the value holds more double quotes than single ones.
function pythonString(value: string): string {
  const chars = Array.from(value);
  const doubles = chars.filter(char => char === '"').length;
  const singles = chars.filter(char => char === "'").length;
  const quote = doubles > singles ? "'" : '"';
  return `${quote}${escapeChars(chars, quote)}${quote}`;
}

// A line break, a backslash, the quote and every other control character as
// its escape, so that the literal holds the value and nothing ends it early.
function escapeChars(chars: string[], quote: string): string {
  return chars
    .map(char => {
      if (char === quote) {
        return `\\${char}`;
      }
      const escaped = PYTHON_ESCAPES.get(char);
      if (escaped !== undefined) {
        return escaped;
      }
      const code = char.charCodeAt(0);
      return code < 0x20 || code === 0x7f
        ? `\\x${code.toString(16).padStart(2, '0')}`
        : char;
    })
    .join('');
}

function createClassContext(state: RootState): ClassContext {
  const relationships = resolveRelationships(state);
  const counts = new Map<string, number>();
  const ambiguous = new Set<string>();

  relationships.forEach(({ relationship }) => {
    const key = pairKey(relationship);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  counts.forEach((count, key) => {
    if (count > 1) {
      ambiguous.add(key);
    }
  });

  const context: ClassContext = {
    imports: createImportSet(),
    indexNames: [],
    relationships,
    namings: new Map<string, TableNaming>(),
    classNames: new Set<string>(MODULE_SCOPE_NAMES),
    ambiguous,
  };

  // A class name is unique per declarative Base, so tables normalizing to one
  // identifier resolve against each other. formatTable renders one table but
  // resolves every table here, in the order createCode emits them.
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

      // A column the table does not hold cannot carry the foreign key, and no
      // string could name it. Both ends are checked here so the rest of the
      // file can take that for granted -- formatRelation leans on it.
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
  const used = new Set<string>(MODULE_SCOPE_NAMES);
  const declared: Column[] = [];
  const columnRefs = new Map<string, string>();
  const columnNames = new Map<string, string>();
  const columnKeys = new Map<string, string>();
  const relationshipNames = new Map<string, string>();
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  // A diagram can carry two columns of one name; a table cannot, and declaring
  // both stops the module importing. So the first column of a name is the
  // column, and every later one resolves to its attribute and key.
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
      uniqueName(used, pyIdentifier(getNameCase(column.name, columnNameCase)))
    );
  });

  assignColumnKeys(declared, columnNames, columnKeys);

  columns.forEach(column => {
    const carrier = columnRefs.get(column.id);

    if (carrier === undefined || carrier === column.id) {
      return;
    }

    const name = columnNames.get(carrier);
    const key = columnKeys.get(carrier);
    if (name !== undefined) {
      columnNames.set(column.id, name);
    }
    if (key !== undefined) {
      columnKeys.set(column.id, key);
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

      // Both ends of an adjacency list land on this one class, so naming the
      // owning end after its table points a same-named attribute at the parent
      // row and collides with the scalar inverse end of a one-to-one.
      const name = isSelfReferential(relationship)
        ? `parent_${startTable.name}`
        : startTable.name;

      relationshipNames.set(
        relationshipKey(relationship, OWNING),
        uniqueName(used, pyIdentifier(getNameCase(name, columnNameCase)))
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
        uniqueName(used, pyIdentifier(name))
      );
    });

  return {
    // Two tables can share a name and __tablename__ keeps it on both, because
    // the DDL declares the same collision. The class name is deduplicated all
    // the same: a repeated class statement silently drops the earlier one.
    className: uniqueName(
      classNames,
      pyIdentifier(getNameCase(table.name, tableNameCase))
    ),
    columnIds: declared.map(column => column.id),
    columnRefs,
    columnNames,
    columnKeys,
    relationshipNames,
  };
}

const DOT = '.';

// Table.c is keyed by a Column's key, not its name, which is what ForeignKey
// and Index resolve against. A dotted name breaks that, because ForeignKey
// splits its target, so a dotted column takes its dot-free attribute as key.
function assignColumnKeys(
  declared: Column[],
  columnNames: Map<string, string>,
  columnKeys: Map<string, string>
) {
  const used = new Set<string>();

  declared.forEach(column => {
    if (!column.name.includes(DOT)) {
      used.add(column.name);
      columnKeys.set(column.id, column.name);
    }
  });
  declared.forEach(column => {
    if (column.name.includes(DOT)) {
      columnKeys.set(
        column.id,
        uniqueName(used, columnNames.get(column.id) ?? column.name)
      );
    }
  });
}

function columnKey(naming: TableNaming, column: Column): string {
  return naming.columnKeys.get(column.id) ?? column.name;
}

function columnRef(naming: TableNaming, column: Column): string {
  return naming.columnRefs.get(column.id) ?? column.id;
}

// Each column replaced by the one that carries it: only the carrier reaches
// formatColumn.
function carriedColumns(
  state: RootState,
  naming: TableNaming,
  columns: Column[]
): Column[] {
  const collection = query(state.collections).collection('tableColumnEntities');

  return columns.map(
    column => collection.selectById(columnRef(naming, column)) ?? column
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

// SQLAlchemy resolves a join over every foreign key between two Tables in
// whichever direction each points, so two opposite keys over one pair are both
// ambiguous. The ambiguity belongs to the unordered pair; sort the ids to key it.
function pairKey(relationship: Relationship): string {
  const [first, second] = [
    relationship.start.tableId,
    relationship.end.tableId,
  ].sort();
  return `${first}<->${second}`;
}

function uniqueName(used: Set<string>, name: string): string {
  let result = name;
  let index = 2;

  while (used.has(result)) {
    result = `${name}_${index}`;
    index += 1;
  }

  used.add(result);
  return result;
}

const NON_IDENTIFIER = /[^0-9A-Za-z_]/g;
const IDENTIFIER_START = /^[A-Za-z]/;

// metadata is no Python keyword but DeclarativeBase owns it, and mapping a
// column onto it is rejected; registry is carried and not rejected, so it is
// absent. The _sa_ names are absent because pyIdentifier bars that namespace.
const RESERVED = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'metadata',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

// Inside a class body every leading underscore belongs to name mangling, the
// dunders or SQLAlchemy's instrumentation, and the owners are not enumerable,
// so a generated identifier starts with a letter and only the identifier moves.
const SAFE_PREFIX = 'x';

function pyIdentifier(name: string): string {
  const value = name.replace(NON_IDENTIFIER, '_');
  const identifier = IDENTIFIER_START.test(value)
    ? value
    : `${SAFE_PREFIX}${value}`;
  return RESERVED.has(identifier) ? `${identifier}_` : identifier;
}

const NEWLINE = /\r\n|\r|\n/g;
// What Python's str.strip removes that escapeChars leaves as it is.
const PYTHON_SPACE =
  /^[ \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[ \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;

/**
 * The comment as black writes a one-line docstring: each line break a space,
 * the ends stripped, and one ending in a quote padded so that it does not
 * close as \"""". Stripped to nothing it is one space.
 */
function formatDocstring(comment: string): string {
  const value = escapeChars(
    Array.from(comment.replace(NEWLINE, ' ')),
    '"'
  ).replace(PYTHON_SPACE, '');

  if (value === '') {
    return ' ';
  }
  return value.endsWith('"') ? `${value} ` : value;
}

function formatStringList(names: string[]): string {
  return `[${names.map(pythonString).join(', ')}]`;
}
