import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { autoName, Name, orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatColumnOptions,
  FormatRelationOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

// A class body sees module scope, so every identifier this generator can put
// there is off limits to a class name and a column attribute. Each import set
// is typed from its tuple, so an unreserved name fails tsc --noEmit.
const SQLALCHEMY_NAMES = [
  'BigInteger',
  'Boolean',
  'Date',
  'DateTime',
  'Double',
  'Float',
  'ForeignKey',
  'ForeignKeyConstraint',
  'Index',
  'Integer',
  'JSON',
  'LargeBinary',
  'Numeric',
  'String',
  'Text',
  'Time',
  'Uuid',
  'text',
] as const;

const POSTGRESQL_NAMES = ['JSONB', 'UUID'] as const;

const ORM_NAMES = [
  'DeclarativeBase',
  'Mapped',
  'mapped_column',
  'relationship',
] as const;

const STDLIB_PLAIN_NAMES = ['uuid'] as const;

const STDLIB_FROM_NAMES = {
  datetime: ['date', 'datetime', 'time'],
  decimal: ['Decimal'],
  typing: ['Any', 'List', 'Optional'],
} as const;

// Builtins rather than imports, but an attribute named str shadows the
// annotation of every column after it exactly the way an import name does.
const BUILTIN_NAMES = ['bool', 'bytes', 'float', 'int', 'str'] as const;

const BASE_CLASS_NAME = 'Base';

type SqlalchemyName = (typeof SQLALCHEMY_NAMES)[number];
type PostgresqlName = (typeof POSTGRESQL_NAMES)[number];
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
  ...POSTGRESQL_NAMES,
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
  postgresql: Set<PostgresqlName>;
  orm: Set<OrmName>;
};

type ColumnType = {
  expression: string;
  annotation: string;
};

type CallEntry = {
  head: string;
  args: string[];
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
    .forEach(({ startTable, startColumns, endColumns }) => {
      const parentNaming = getNaming(state, context, startTable);

      if (endColumns.length === 1) {
        addSqlalchemy(imports, 'ForeignKey');
        const target = `${startTable.name}.${columnKey(parentNaming, startColumns[0])}`;
        const carrier = columnRef(naming, endColumns[0]);
        const values = foreignKeys.get(carrier) ?? [];
        values.push(`ForeignKey("${escapeString(target)}")`);
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

  buffer.push(`${INDENT}__tablename__ = "${escapeString(table.name)}"`);
  formatTableArgs(buffer, entries, table.comment);

  const bodyBuffer: string[] = [];

  columns.forEach(column => {
    formatColumn(
      state,
      { buffer: bodyBuffer, column },
      {
        imports,
        attribute: naming.columnNames.get(column.id) ?? column.name,
        key: columnKey(naming, column),
        foreignKeys: foreignKeys.get(column.id) ?? [],
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
  { imports, attribute, key, foreignKeys }: ColumnContext
) {
  const { expression, annotation } = getColumnType(
    column.dataType,
    database,
    imports
  );
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
  const isNotNull = bHas(column.options, ColumnOption.notNull);
  const isAutoIncrement = bHas(column.options, ColumnOption.autoIncrement);
  const isOptional = !isPrimaryKey && !isNotNull;
  const args: string[] = [];

  if (attribute !== column.name) {
    args.push(`"${escapeString(column.name)}"`);
  }
  args.push(expression);
  foreignKeys.forEach(foreignKey => args.push(foreignKey));

  if (key !== column.name) {
    args.push(`key="${escapeString(key)}"`);
  }
  if (isPrimaryKey) {
    args.push('primary_key=True');
  }
  if (isAutoIncrement) {
    args.push('autoincrement=True');
  }
  if (!isPrimaryKey && isNotNull) {
    args.push('nullable=False');
  }
  if (bHas(column.options, ColumnOption.unique)) {
    args.push('unique=True');
  }
  if (!isAutoIncrement && column.default.trim() !== '') {
    addSqlalchemy(imports, 'text');
    args.push(`server_default=text("${escapeString(column.default)}")`);
  }
  if (column.comment.trim() !== '') {
    args.push(`comment="${escapeString(column.comment)}"`);
  }

  addOrm(imports, 'Mapped');
  addOrm(imports, 'mapped_column');

  if (isOptional) {
    addStdlibFrom(imports, 'typing', 'Optional');
  }

  const mapped = isOptional
    ? `Mapped[Optional[${annotation}]]`
    : `Mapped[${annotation}]`;

  formatCall(
    buffer,
    INDENT,
    `${attribute}: ${mapped} = mapped_column(`,
    args,
    ')'
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
        ? `Mapped["${parentNaming.className}"]`
        : `Mapped[Optional["${parentNaming.className}"]]`;

      addOrm(imports, 'relationship');
      formatCall(
        buffer,
        INDENT,
        `${attribute}: ${annotation} = relationship(`,
        relationArguments(state, context, resolved, INVERSE),
        ')'
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
        ? `Mapped[List["${childNaming.className}"]]`
        : `Mapped[Optional["${childNaming.className}"]]`;

      addOrm(imports, 'relationship');
      formatCall(
        buffer,
        INDENT,
        `${attribute}: ${annotation} = relationship(`,
        relationArguments(state, context, resolved, OWNING),
        ')'
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

      const args = [`"${escapeString(indexName)}"`];
      columns.forEach(column =>
        args.push(`"${escapeString(columnKey(naming, column))}"`)
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
    comment.trim() === '' ? null : `"comment": "${escapeString(comment)}"`;

  if (entries.length === 0) {
    if (commentArg !== null) {
      formatCall(buffer, INDENT, '__table_args__ = {', [commentArg], '}');
    }
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
  args: string[],
  tail: string
) {
  const line = `${indent}${head}${args.join(', ')}${tail}`;

  if (line.length <= LINE_LIMIT) {
    buffer.push(line);
    return;
  }

  // Keep the trailing comma: it is black's magic trailing comma, and without it
  // black pulls the arguments back onto one line.
  buffer.push(`${indent}${head}`);
  args.forEach(arg => buffer.push(`${indent}${INDENT}${arg},`));
  buffer.push(`${indent}${tail}`);
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
  if (imports.postgresql.size !== 0) {
    formatFromImport(
      sqlalchemyBuffer,
      'sqlalchemy.dialects.postgresql',
      imports.postgresql
    );
  }
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
    postgresql: new Set<PostgresqlName>(),
    orm: new Set<OrmName>(),
  };

  addOrm(imports, 'DeclarativeBase');

  return imports;
}

function addSqlalchemy(imports: ImportSet, name: SqlalchemyName) {
  imports.sqlalchemy.add(name);
}

function addPostgresql(imports: ImportSet, name: PostgresqlName) {
  imports.postgresql.add(name);
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

// ARGUMENTS is global to match getPrimitiveType's copy, because a vendor name
// can carry two argument groups. TYPE_ARGUMENTS stays non-global: it is module
// scoped and read with exec, whose lastIndex would carry between columns.
const ARGUMENTS = /\([^)]*\)/g;
const WHITESPACE = /\s+/g;
const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;

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

const binaryTypes = new Set([
  'bfile',
  'binary',
  'blob',
  'bytea',
  'image',
  'long raw',
  'longblob',
  'mediumblob',
  'raw',
  'tinyblob',
  'varbinary',
]);

const timestampTzTypes = new Set([
  'datetimeoffset',
  'timestamp with time zone',
  'timestamp_tz',
  'timestamptz',
]);

const timeTzTypes = new Set(['time with time zone', 'timetz']);

// The 11 primitive types cannot tell TEXT from BLOB from JSON. Alembic compares
// the mapped type against the reflected one, so a model that collapsed them
// would emit a modify_type back to the type the database already has.
function getColumnType(
  dataType: string,
  database: number,
  imports: ImportSet
): ColumnType {
  const base = dataType
    .toLocaleLowerCase()
    .replace(ARGUMENTS, ' ')
    .replace(WHITESPACE, ' ')
    .trim();

  if (textTypes.has(base)) {
    addSqlalchemy(imports, 'Text');
    return { expression: 'Text', annotation: 'str' };
  }
  if (binaryTypes.has(base)) {
    addSqlalchemy(imports, 'LargeBinary');
    return { expression: 'LargeBinary', annotation: 'bytes' };
  }
  if (base === 'jsonb' && database === Database.PostgreSQL) {
    addPostgresql(imports, 'JSONB');
    addStdlibFrom(imports, 'typing', 'Any');
    return { expression: 'JSONB', annotation: 'Any' };
  }
  if (base === 'json' || base === 'jsonb') {
    addSqlalchemy(imports, 'JSON');
    addStdlibFrom(imports, 'typing', 'Any');
    return { expression: 'JSON', annotation: 'Any' };
  }
  if (base === 'uuid' && database === Database.PostgreSQL) {
    addPostgresql(imports, 'UUID');
    addStdlibPlain(imports, 'uuid');
    return { expression: 'UUID(as_uuid=True)', annotation: 'uuid.UUID' };
  }
  if (base === 'uuid' || base === 'uniqueidentifier') {
    addSqlalchemy(imports, 'Uuid');
    addStdlibPlain(imports, 'uuid');
    return { expression: 'Uuid', annotation: 'uuid.UUID' };
  }
  if (timestampTzTypes.has(base)) {
    addSqlalchemy(imports, 'DateTime');
    addStdlibFrom(imports, 'datetime', 'datetime');
    return { expression: 'DateTime(timezone=True)', annotation: 'datetime' };
  }
  if (timeTzTypes.has(base)) {
    addSqlalchemy(imports, 'Time');
    addStdlibFrom(imports, 'datetime', 'time');
    return { expression: 'Time(timezone=True)', annotation: 'time' };
  }

  const primitiveType = getPrimitiveType(dataType, database);
  const callable = convertTypeMap[primitiveType];
  const annotation = annotationMap[primitiveType];
  const args = typeArguments(dataType);

  addSqlalchemy(imports, callable);
  addAnnotationImport(imports, annotation);

  if (primitiveType === 'string' && args.length === 1 && args[0] > 0) {
    return { expression: `String(${args[0]})`, annotation };
  }
  if (primitiveType === 'decimal' && args.length === 1) {
    return { expression: `Numeric(${args[0]})`, annotation };
  }
  if (primitiveType === 'decimal' && args.length === 2) {
    return { expression: `Numeric(${args[0]}, ${args[1]})`, annotation };
  }

  return { expression: callable, annotation };
}

function typeArguments(dataType: string): number[] {
  const matched = TYPE_ARGUMENTS.exec(dataType);
  if (!matched) {
    return [];
  }

  const values = matched[1].split(',').map(value => value.trim());
  return values.every(value => DIGITS.test(value)) ? values.map(Number) : [];
}

function addAnnotationImport(imports: ImportSet, annotation: AnnotationName) {
  switch (annotation) {
    case 'Decimal':
      addStdlibFrom(imports, 'decimal', 'Decimal');
      break;
    case 'date':
    case 'datetime':
    case 'time':
      addStdlibFrom(imports, 'datetime', annotation);
      break;
  }
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

const BACKSLASH = /\\/g;
const DOUBLE_QUOTE = /"/g;
const NEWLINE = /\r\n|\r|\n/g;

function escapeString(value: string): string {
  return value
    .replace(BACKSLASH, '\\\\')
    .replace(DOUBLE_QUOTE, '\\"')
    .replace(NEWLINE, ' ');
}

// A comment ending in a quote would close the docstring as \"""". That parses,
// but it is unreadable and black rewrites it -- pad it the way black does.
function formatDocstring(comment: string): string {
  const value = escapeString(comment);
  return value.endsWith('"') ? `${value} ` : value;
}

function formatStringList(names: string[]): string {
  return `[${names.map(name => `"${escapeString(name)}"`).join(', ')}]`;
}
