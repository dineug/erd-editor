import { query } from '@dineug/erd-editor-schema';

import { BracketType, ColumnOption, Database } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import {
  autoNameIgnoreCase,
  isDelimitedPart,
  Name,
  orderByNameASC,
  referentialActionSupport,
  splitNameParts,
  tableNamePart,
  unquoteNamePart,
} from '@/utils/schema-sql/utils';

import { enumMembers, POSTGRES_BIT_TYPES } from './columnTypes';
import { DOCTRINE_RESERVED_WORDS } from './doctrineReservedWords';
import { INDENT, isPostgresArray, PHP_HEADER, toClassName } from './php';
import {
  baseTypeName,
  FormatTableOptions,
  fractionalNumber,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
  referentialActionEntries,
} from './utils';

/**
 * The PHP value each Doctrine type hydrates to under DBAL 4, a BIGINT's being
 * an int but for a value past PHP's range, which only an unsigned type reaches.
 */
const PHP_TYPES = {
  BIGINT: 'int',
  BINARY: 'string',
  BLOB: 'mixed',
  BOOLEAN: 'bool',
  DATE_IMMUTABLE: '\\DateTimeImmutable',
  DATETIME_IMMUTABLE: '\\DateTimeImmutable',
  DATETIMETZ_IMMUTABLE: '\\DateTimeImmutable',
  DECIMAL: 'string',
  ENUM: 'string',
  FLOAT: 'float',
  GUID: 'string',
  INTEGER: 'int',
  JSON: 'array',
  SIMPLE_ARRAY: 'array',
  SMALLFLOAT: 'float',
  SMALLINT: 'int',
  STRING: 'string',
  TEXT: 'string',
  TIME_IMMUTABLE: '\\DateTimeImmutable',
} as const;

type DoctrineType = keyof typeof PHP_TYPES;

// The PHP generator writes a time as a string, since the shared tables file a
// PostgreSQL interval there too; here the names that are a time of day get
// Doctrine's own type, or migrations would turn their columns into VARCHAR.
const convertTypeMap: Record<PrimitiveType, DoctrineType> = {
  int: 'INTEGER',
  long: 'BIGINT',
  float: 'FLOAT',
  double: 'FLOAT',
  decimal: 'DECIMAL',
  boolean: 'BOOLEAN',
  string: 'STRING',
  lob: 'TEXT',
  date: 'DATE_IMMUTABLE',
  dateTime: 'DATETIME_IMMUTABLE',
  time: 'STRING',
};

/**
 * Names the shared vendor tables file under a category Doctrine splits, or
 * under the wrong one, read before them under every database.
 */
const namedTypes = new Map<string, DoctrineType>([
  ['bfile', 'BLOB'],
  ['binary', 'BINARY'],
  ['binary varying', 'BINARY'],
  ['binary_float', 'FLOAT'],
  ['blob', 'BLOB'],
  ['bytea', 'BLOB'],
  ['datetimeoffset', 'DATETIMETZ_IMMUTABLE'],
  ['image', 'BLOB'],
  ['int2', 'SMALLINT'],
  ['json', 'JSON'],
  ['jsonb', 'JSON'],
  ['long raw', 'BLOB'],
  ['long varbinary', 'BLOB'],
  ['longblob', 'BLOB'],
  ['mediumblob', 'BLOB'],
  ['money', 'DECIMAL'],
  ['raw', 'BINARY'],
  ['serial2', 'SMALLINT'],
  ['smallint', 'SMALLINT'],
  ['smallmoney', 'DECIMAL'],
  ['smallserial', 'SMALLINT'],
  ['time', 'TIME_IMMUTABLE'],
  ['time with time zone', 'TIME_IMMUTABLE'],
  ['time without time zone', 'TIME_IMMUTABLE'],
  ['timestamp with time zone', 'DATETIMETZ_IMMUTABLE'],
  ['timestamp_tz', 'DATETIMETZ_IMMUTABLE'],
  ['timestamptz', 'DATETIMETZ_IMMUTABLE'],
  ['timetz', 'TIME_IMMUTABLE'],
  ['tinyblob', 'BLOB'],
  ['tinyint', 'SMALLINT'],
  ['uniqueidentifier', 'GUID'],
  ['uuid', 'GUID'],
  ['varbinary', 'BINARY'],
]);

/**
 * Names one database reads its own way, read before the others: SQL Server's
 * bit is a flag and its numeric a decimal, Oracle's SMALLINT and DATE what DBAL
 * reads them back as, an INTEGER and a DATE, and MySQL's CHAR BYTE a BINARY.
 */
const vendorTypes = new Map<number, ReadonlyMap<string, DoctrineType>>([
  [
    Database.MSSQL,
    new Map<string, DoctrineType>([
      ['bit', 'BOOLEAN'],
      ['numeric', 'DECIMAL'],
    ]),
  ],
  [
    Database.Oracle,
    new Map<string, DoctrineType>([
      ['date', 'DATE_IMMUTABLE'],
      ['smallint', 'INTEGER'],
    ]),
  ],
  [Database.MySQL, new Map<string, DoctrineType>([['char byte', 'BINARY']])],
  [Database.MariaDB, new Map<string, DoctrineType>([['char byte', 'BINARY']])],
]);

// SQL Server's, where timestamp names a rowversion and no date and time.
const rowVersionTypes = new Set(['rowversion', 'timestamp']);

const nationalTypes = new Set([
  'national char varying',
  'national character varying',
  'nvarchar',
]);

// SQL Server's Unicode text, which DBAL would write as a VARCHAR(MAX).
const unicodeTextTypes = new Set(['national text', 'ntext']);

// MySQL's national character types, which it stores in utf8mb3.
const mysqlNationalTypes = new Set([
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
  'nvarchar',
]);

// Oracle's names of a NUMBER, whose scale-less forms DBAL reads as integers.
const oracleNumberTypes = new Set(['dec', 'decimal', 'number', 'numeric']);

/** The character and binary types whose one argument is a length. */
const lengthTypes = new Set([
  'binary',
  'binary varying',
  'bpchar',
  'char',
  'char byte',
  'char varying',
  'character',
  'character varying',
  'national char',
  'national char varying',
  'national character',
  'national character varying',
  'national varchar',
  'national varcharacter',
  'native character',
  'nchar',
  'nchar varchar',
  'nchar varcharacter',
  'nchar varying',
  'nvarchar',
  'nvarchar2',
  'raw',
  'string',
  'text',
  'varbinary',
  'varchar',
  'varchar2',
  'varcharacter',
  'varying character',
]);

const fixedLengthTypes = new Set([
  'binary',
  'bpchar',
  'char',
  'char byte',
  'character',
  'national char',
  'national character',
  'nchar',
]);

// A bare CHAR holds one character in every database, where a bare PostgreSQL
// bpchar is unbounded.
const oneCharacterTypes = new Set([
  'char',
  'character',
  'national char',
  'national character',
  'nchar',
]);

// Unbounded wherever they name no length: PostgreSQL and SQLite text, and
// Snowflake's and Databricks' text and string.
const unboundedStringTypes = new Set(['string', 'text']);

/**
 * The lengths DBAL reads back from MySQL's sized text and blob types, a LONG
 * one being a MEDIUMTEXT or a MEDIUMBLOB there.
 */
const mysqlLobLengths = new Map([
  ['long', 16777215],
  ['long char varying', 16777215],
  ['long character varying', 16777215],
  ['long varbinary', 16777215],
  ['long varchar', 16777215],
  ['long varcharacter', 16777215],
  ['mediumblob', 16777215],
  ['mediumtext', 16777215],
  ['tinyblob', 255],
  ['tinytext', 255],
  ['blob', 65535],
  ['text', 65535],
]);

// MySQL counts TEXT(n) in characters, four bytes each under utf8mb4, and
// creates the smallest of these that holds them, or a LONGTEXT.
const MYSQL_TEXT_BYTES = [255, 65535, 16777215];

const serialTypes = new Set([
  'bigserial',
  'serial',
  'serial2',
  'serial4',
  'serial8',
  'smallserial',
]);

const integerTypes: ReadonlySet<DoctrineType> = new Set<DoctrineType>([
  'BIGINT',
  'INTEGER',
  'SMALLINT',
]);

// MySQL takes UNSIGNED on these, and makes a ZEROFILL one unsigned too.
const unsignedTypes: ReadonlySet<DoctrineType> = new Set<DoctrineType>([
  ...integerTypes,
  'DECIMAL',
  'FLOAT',
  'SMALLFLOAT',
]);

const timestampTypes: ReadonlySet<DoctrineType> = new Set<DoctrineType>([
  'DATETIME_IMMUTABLE',
  'DATETIMETZ_IMMUTABLE',
]);

/** The names the header's use statements bring into the file. */
const IMPORTED_NAMES = ['ArrayCollection', 'Collection', 'ORM', 'Types'];

const USE_COLLECTIONS = [
  'use Doctrine\\Common\\Collections\\ArrayCollection;',
  'use Doctrine\\Common\\Collections\\Collection;',
];
const USE_TYPES = 'use Doctrine\\DBAL\\Types\\Types;';
const USE_ORM = 'use Doctrine\\ORM\\Mapping as ORM;';

// PER Coding Style's soft limit.
const LINE_LIMIT = 120;
const OWNING = 'owning';
const INVERSE = 'inverse';

type RelationshipSide = typeof OWNING | typeof INVERSE;

type ResolvedRelationship = {
  relationship: Relationship;
  startTable: Table;
  endTable: Table;
  startColumns: Column[];
  endColumns: Column[];
};

type TableNaming = {
  className: string;
  fields: Column[];
  owning: ResolvedRelationship[];
  propertyNames: Map<string, string>;
  relationshipNames: Map<string, string>;
};

type ClassContext = {
  relationships: ResolvedRelationship[];
  derivedIds: Set<string>;
  oneToOneIds: Set<string>;
  indexNames: Map<string, string>;
  namings: Map<string, TableNaming>;
  classNames: Set<string>;
};

type Uses = {
  collections: boolean;
  types: boolean;
};

type ColumnType = {
  type: DoctrineType;
  php: string;
  args: string[];
  options: string[];
  definition: string | null;
  isReadOnly: boolean;
  scale: number | null;
};

type SqlName = {
  text: string;
  isQuoted: boolean;
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

  const context = createClassContext(state);
  const uses: Uses = { collections: false, types: false };
  const classBuffer: string[] = [];

  tables.forEach(table => {
    classBuffer.push('');
    formatClass(state, { buffer: classBuffer, table }, context, uses);
  });

  return joinFile(uses, classBuffer);
}

/** One table's entity under the header and the use statements it needs. */
export function createTableCode(state: RootState, table: Table): string {
  const uses: Uses = { collections: false, types: false };
  const classBuffer = [''];

  formatClass(
    state,
    { buffer: classBuffer, table },
    createClassContext(state),
    uses
  );

  return joinFile(uses, classBuffer);
}

function joinFile(uses: Uses, classBuffer: string[]): string {
  const buffer = [
    ...PHP_HEADER,
    '',
    ...(uses.collections ? USE_COLLECTIONS : []),
    ...(uses.types ? [USE_TYPES] : []),
    USE_ORM,
    ...classBuffer,
    '',
  ];

  return buffer.join('\n');
}

function formatClass(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: ClassContext,
  uses: Uses
) {
  const naming = getNaming(state, context, table);
  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const fieldIds = new Set(naming.fields.map(column => column.id));
  const quotedIds = quotedColumnIds(state, naming.owning);
  const identifierCount =
    naming.fields.filter(isPrimaryKey).length +
    naming.owning.filter(({ relationship }) =>
      context.derivedIds.has(relationship.id)
    ).length;
  const uniqueColumnIds = new Set<string>();
  const members: string[][] = [];
  const collectionNames: string[] = [];

  // Doctrine builds the key in the order its members are declared, so each
  // association stands at its first join column, keeping the document's order.
  columns.forEach(column => {
    if (fieldIds.has(column.id)) {
      uses.types = true;
      members.push(
        columnMember(state, naming, column, identifierCount === 1, quotedIds)
      );
    }

    naming.owning
      .filter(resolved => firstJoinColumnId(columns, resolved) === column.id)
      .forEach(resolved => {
        members.push(
          owningMember(
            state,
            context,
            naming,
            resolved,
            uniqueColumnIds,
            quotedIds
          )
        );
      });
  });

  context.relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable }) => {
      const name = relationshipName(naming, relationship, INVERSE);
      const childNaming = getNaming(state, context, endTable);
      const target = childNaming.className;
      const mappedBy = phpString(
        relationshipName(childNaming, relationship, OWNING)
      );

      if (context.oneToOneIds.has(relationship.id)) {
        members.push([
          ...formatAttribute(INDENT, 'OneToOne', [
            `targetEntity: ${target}::class`,
            `mappedBy: ${mappedBy}`,
          ]),
          propertyLine(target, name, true),
        ]);
        return;
      }

      collectionNames.push(name);
      members.push([
        `${INDENT}/** @var Collection<int, ${target}> */`,
        ...formatAttribute(INDENT, 'OneToMany', [
          `targetEntity: ${target}::class`,
          `mappedBy: ${mappedBy}`,
        ]),
        `${INDENT}public Collection $${name};`,
      ]);
    });

  if (collectionNames.length !== 0) {
    uses.collections = true;
    members.push([
      `${INDENT}public function __construct()`,
      `${INDENT}{`,
      ...collectionNames.map(
        name => `${INDENT}${INDENT}$this->${name} = new ArrayCollection();`
      ),
      `${INDENT}}`,
    ]);
  }

  [
    '#[ORM\\Entity]',
    ...formatAttribute('', 'Table', [
      ...tableNameArguments(state, table.name),
      ...optionsArgument(commentEntry(table.comment)),
    ]),
    ...indexAttributes(state, context, table, quotedIds),
  ].forEach(line => buffer.push(line));

  if (members.length === 0) {
    buffer.push(`class ${naming.className} {}`);
    return;
  }

  buffer.push(`class ${naming.className}`);
  buffer.push('{');
  members.forEach((lines, index) => {
    if (index !== 0) {
      buffer.push('');
    }
    lines.forEach(line => buffer.push(line));
  });
  buffer.push('}');
}

function columnMember(
  state: RootState,
  naming: TableNaming,
  column: Column,
  isSingleIdentifier: boolean,
  quotedIds: Set<string>
): string[] {
  const { database } = state.settings;
  const isPrimary = isPrimaryKey(column);
  const columnType = getColumnType(column.dataType, database, isPrimary);
  const { type, php, args, options, definition, isReadOnly } = columnType;
  // Doctrine numbers a single column key alone, and an integer alone: through
  // IDENTITY, or on Oracle a sequence named after the table and the column.
  const isGenerated =
    isPrimary &&
    isSingleIdentifier &&
    integerTypes.has(type) &&
    (bHas(column.options, ColumnOption.autoIncrement) ||
      serialTypes.has(baseTypeName(column.dataType)));
  // The database writes a read-only column, never NULL, after the insert.
  const isNullable = !isReadOnly && !isRequired(column);
  const isUnset = isNullable || isGenerated || isReadOnly;

  return [
    ...(isPrimary ? [`${INDENT}#[ORM\\Id]`] : []),
    ...(isGenerated ? [`${INDENT}#[ORM\\GeneratedValue]`] : []),
    ...formatAttribute(INDENT, 'Column', [
      `name: ${phpString(sqlText(columnSqlName(state, column, quotedIds)))}`,
      `type: Types::${type}`,
      ...args,
      ...(!isPrimary && bHas(column.options, ColumnOption.unique)
        ? ['unique: true']
        : []),
      ...(isNullable ? ['nullable: true'] : []),
      ...(isReadOnly ? ['insertable: false', 'updatable: false'] : []),
      ...optionsArgument([
        ...options,
        ...defaultEntry(database, column.default, columnType, isGenerated),
        ...commentEntry(column.comment),
      ]),
      ...definitionArgument(database, column, definition, isNullable),
      ...(isReadOnly ? ["generated: 'ALWAYS'"] : []),
    ]),
    propertyLine(php, naming.propertyNames.get(column.id) as string, isUnset),
  ];
}

function owningMember(
  state: RootState,
  context: ClassContext,
  naming: TableNaming,
  { relationship, startTable, startColumns, endColumns }: ResolvedRelationship,
  uniqueColumnIds: Set<string>,
  quotedIds: Set<string>
): string[] {
  const { database } = state.settings;
  const parentNaming = getNaming(state, context, startTable);
  const isDerived = context.derivedIds.has(relationship.id);
  const isOneToOne = context.oneToOneIds.has(relationship.id);
  const onDelete = referentialActionEntries(
    relationship,
    referentialActionSupport(database)
  )
    .filter(({ key }) => key === 'onDelete')
    .map(({ sql }) => `onDelete: ${phpString(sql)}`);

  const joinColumns = endColumns.flatMap((column, index) => {
    const parent = startColumns[index];
    const isCarried = isDerived || !isPrimaryKey(column);
    const isUnique =
      !isPrimaryKey(column) &&
      bHas(column.options, ColumnOption.unique) &&
      !(isOneToOne && endColumns.length === 1) &&
      !uniqueColumnIds.has(column.id);
    const parentType = getColumnType(
      parent.dataType,
      database,
      isPrimaryKey(parent)
    );

    if (isUnique) {
      uniqueColumnIds.add(column.id);
    }

    return formatAttribute(INDENT, 'JoinColumn', [
      ...joinColumnNames(state, column, parent, quotedIds.has(column.id)),
      ...(isUnique ? ['unique: true'] : []),
      ...(isRequired(column) ? ['nullable: false'] : []),
      ...onDelete,
      ...(isCarried
        ? definitionArgument(
            database,
            column,
            parentType.definition,
            !isRequired(column)
          )
        : []),
      ...optionsArgument(
        isCarried ? carriedOptions(database, column, parent, parentType) : []
      ),
    ]);
  });

  return [
    ...(isDerived ? [`${INDENT}#[ORM\\Id]`] : []),
    ...formatAttribute(INDENT, isOneToOne ? 'OneToOne' : 'ManyToOne', [
      `targetEntity: ${parentNaming.className}::class`,
      `inversedBy: ${phpString(
        relationshipName(parentNaming, relationship, INVERSE)
      )}`,
    ]),
    ...joinColumns,
    propertyLine(
      parentNaming.className,
      relationshipName(naming, relationship, OWNING),
      !endColumns.every(isRequired)
    ),
  ];
}

/**
 * SchemaTool fills a join column's options from the field it references, so a
 * carried column writes its own default and comment, or none over the parent's.
 */
function carriedOptions(
  database: number,
  column: Column,
  parent: Column,
  parentType: ColumnType
): string[] {
  const ownDefault = defaultEntry(database, column.default, parentType, false);
  const parentDefault = defaultEntry(
    database,
    parent.default,
    parentType,
    false
  );

  return [
    ...(ownDefault.length === 0 && parentDefault.length !== 0
      ? ["'default' => null"]
      : ownDefault),
    ...(column.comment.trim() === '' && parent.comment.trim() !== ''
      ? ["'comment' => ''"]
      : commentEntry(column.comment)),
  ];
}

function firstJoinColumnId(
  columns: Column[],
  { endColumns }: ResolvedRelationship
): string | undefined {
  return columns.find(column => endColumns.some(end => end.id === column.id))
    ?.id;
}

/** Both names of a join column, which Doctrine keeps one quoted flag for. */
function joinColumnNames(
  state: RootState,
  column: Column,
  parent: Column,
  isQuoted: boolean
): string[] {
  return [
    `name: ${phpString(sqlText({ ...sqlName(state, column.name), isQuoted }))}`,
    `referencedColumnName: ${phpString(
      sqlText({ ...sqlName(state, parent.name), isQuoted })
    )}`,
  ];
}

/**
 * The columns of a table its join columns write in backticks: Doctrine keeps
 * one quoted flag for a join column's two names, so a column takes them where
 * it or any key it references in any association needs them, its field too.
 */
function quotedColumnIds(
  state: RootState,
  owning: ResolvedRelationship[]
): Set<string> {
  return new Set(
    owning.flatMap(({ startColumns, endColumns }) =>
      endColumns
        .filter(
          (column, index) =>
            sqlName(state, column.name).isQuoted ||
            sqlName(state, startColumns[index].name).isQuoted
        )
        .map(column => column.id)
    )
  );
}

function columnSqlName(
  state: RootState,
  column: Column,
  quotedIds: Set<string>
): SqlName {
  const name = sqlName(state, column.name);
  return quotedIds.has(column.id) ? { ...name, isQuoted: true } : name;
}

function indexAttributes(
  state: RootState,
  { indexNames }: ClassContext,
  table: Table,
  quotedIds: Set<string>
): string[] {
  const {
    doc: { indexIds },
    collections,
  } = state;
  const columnCollection = query(collections).collection('tableColumnEntities');
  const indexColumnCollection = query(collections).collection(
    'indexColumnEntities'
  );
  const unnamed = new Set<string>();
  // DBAL compares index names in lower case and names the key's primary.
  const names = new Set<string>(['primary']);

  return query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .flatMap(index => {
      const columns = indexColumnCollection
        .selectByIds(index.indexColumnIds)
        .map(indexColumn => columnCollection.selectById(indexColumn.columnId))
        .filter(
          (column): column is Column =>
            column !== undefined && table.columnIds.includes(column.id)
        );

      const written = indexName(indexNames.get(index.id) ?? index.name);
      const name =
        written === null || names.has(written.toLowerCase()) ? null : written;
      // DBAL names an index it is given no name for after its table, its
      // columns and whether it is unique, and refuses a second of one name.
      const key = `${index.unique}:${columns.map(({ id }) => id).join(',')}`;

      if (columns.length === 0 || (name === null && unnamed.has(key))) {
        return [];
      }
      if (name === null) {
        unnamed.add(key);
      } else {
        names.add(name.toLowerCase());
      }

      return formatAttribute('', index.unique ? 'UniqueConstraint' : 'Index', [
        ...(name === null ? [] : [`name: ${phpString(name)}`]),
        `columns: [${columns
          .map(column =>
            phpString(sqlText(columnSqlName(state, column, quotedIds)))
          )
          .join(', ')}]`,
      ]);
    });
}

const INDEX_NAME = /^[0-9A-Za-z_]+$/;
// ORM reads a name PHP takes for a number as no name.
const NUMERIC_NAME = /^[0-9]+([Ee][0-9]+)?$/;
const BACKTICKED = /^`((?:[^`]|``)*)`$/;

/** An index name out of its delimiters, if DBAL and ORM take it as given. */
function indexName(name: string): string | null {
  const text = name.trim();
  const value = backtickedName(text) ?? unquoteNamePart(text);

  return INDEX_NAME.test(value) && !NUMERIC_NAME.test(value) ? value : null;
}

/** The name inside a pair of backticks, a doubled one read as one, or null. */
function backtickedName(text: string): string | null {
  const matched = BACKTICKED.exec(text);
  return matched ? matched[1].replaceAll('``', '`') : null;
}

function propertyLine(type: string, name: string, isNullable: boolean): string {
  return isNullable
    ? `${INDENT}public ${nullableType(type)} $${name} = null;`
    : `${INDENT}public ${type} $${name};`;
}

// mixed takes null already and PHP refuses ?mixed, and a union takes it as a
// member, ?int|string being no type.
function nullableType(type: string): string {
  if (type === 'mixed') {
    return type;
  }
  return type.includes('|') ? `${type}|null` : `?${type}`;
}

function isRequired(column: Column): boolean {
  return isPrimaryKey(column) || bHas(column.options, ColumnOption.notNull);
}

/**
 * A column definition DBAL writes as given: its NOT NULL, but on an Oracle key
 * DBAL reads back otherwise, whose MODIFY refuses a NOT NULL the key holds
 * already, and its comment, which MySQL writes nowhere else.
 */
function definitionArgument(
  database: number,
  column: Column,
  definition: string | null,
  isNullable: boolean
): string[] {
  if (definition === null) {
    return [];
  }

  const isOracleKey =
    database === Database.Oracle &&
    isPrimaryKey(column) &&
    (baseTypeName(definition) !== 'date' || column.default.trim() !== '');
  const text =
    isNullable || isOracleKey ? definition : `${definition} NOT NULL`;
  const declaration =
    isMySQLFamily(database) && column.comment.trim() !== ''
      ? `${text} COMMENT ${mysqlString(column.comment)}`
      : text;

  return [`columnDefinition: ${phpString(declaration)}`];
}

/** A string as DBAL quotes it for MySQL, whose literals read a backslash. */
function mysqlString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

function isMySQLFamily(database: number): boolean {
  return database === Database.MySQL || database === Database.MariaDB;
}

function commentEntry(comment: string): string[] {
  return comment.trim() === '' ? [] : [`'comment' => ${phpString(comment)}`];
}

function optionsArgument(entries: string[]): string[] {
  return entries.length === 0 ? [] : [`options: [${entries.join(', ')}]`];
}

/** One attribute on a line, or one argument a line where that runs too long. */
function formatAttribute(
  indent: string,
  name: string,
  args: string[]
): string[] {
  const line = `${indent}#[ORM\\${name}(${args.join(', ')})]`;

  if (line.length <= LINE_LIMIT || args.length < 2) {
    return [line];
  }

  return [
    `${indent}#[ORM\\${name}(`,
    ...args.map(arg => `${indent}${INDENT}${arg},`),
    `${indent})]`,
  ];
}

// The number grammar the editor's DDL writes a default in.
const NUMBER_LITERAL =
  /^([+-]?)([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee]([+-]?[0-9]+))?$/;
const LEADING_ZEROS = /^0+(?=[0-9])/;
const TRAILING_ZEROS = /0+$/;
// MySQL reads a backslash in a literal as an escape, and an N or a character
// set before one; elsewhere only an N, and in SQL Server's case that keeps the
// characters its code page lacks, which a plain literal would lose.
const MYSQL_STRING = /^(?:[Nn]|_[0-9A-Za-z]+\s*)?'((?:[^'\\]|''|\\[\s\S])*)'$/;
const MYSQL_ESCAPE = /''|\\([\s\S])/g;
const STRING_LITERAL = /^([Nn]?)'((?:[^']|'')*)'$/;
const PRINTABLE_ASCII = /^[ -~]*$/;
const BOOLEAN_LITERAL = /^(true|false)$/i;
// PostgreSQL also reads t, y, yes and on as true, and f, n, no and off as false.
const POSTGRES_TRUE = /^(t|true|y|yes|on|1)$/i;
const POSTGRES_FALSE = /^(f|false|n|no|off|0)$/i;
const CURRENT_TIMESTAMP = /^current_timestamp(\(\s*\))?$/i;
const MYSQL_NOW =
  /^(current_timestamp|now|localtime|localtimestamp)(\(\s*\))?$/i;
// The largest integer PHP reads as an int, past which it reads a float.
const PHP_INT_MAX = 9223372036854775807n;

const mysqlEscapes = new Map([
  ['0', String.fromCharCode(0)],
  ['b', '\b'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ['Z', String.fromCharCode(0x1a)],
]);

/** The spellings each database runs as the current time. */
const currentTimes = new Map<number, RegExp>([
  [Database.MariaDB, MYSQL_NOW],
  [Database.MSSQL, /^(current_timestamp|getdate\(\s*\))$/i],
  [Database.MySQL, MYSQL_NOW],
  [
    Database.PostgreSQL,
    /^(current_timestamp|localtimestamp|(now|transaction_timestamp)\(\s*\))$/i,
  ],
]);

/**
 * A default DBAL can write: a number, a quoted string, a boolean or the
 * current time, never an expression, which it would quote as a string.
 */
function defaultEntry(
  database: number,
  value: string,
  columnType: ColumnType,
  isGenerated: boolean
): string[] {
  const text = value.trim();

  if (text === '' || isGenerated || columnType.definition !== null) {
    return [];
  }

  const literal = stringLiteral(database, text);
  const entry =
    literal === null
      ? bareDefault(database, text, columnType)
      : literalDefault(database, literal, columnType);

  return entry === null ? [] : [`'default' => ${entry}`];
}

/** A quoted default, a number in it read as a number column's one. */
function literalDefault(
  database: number,
  literal: string,
  columnType: ColumnType
): string | null {
  const { type } = columnType;

  if (type === 'BOOLEAN') {
    return booleanDefault(database, literal.trim());
  }
  if (NUMBER_LITERAL.test(literal) && isNumberType(type)) {
    return numberDefault(database, literal, columnType);
  }
  // MySQL takes a JSON default in parentheses alone, which DBAL never writes.
  if (type === 'JSON' && database === Database.MySQL) {
    return null;
  }
  return phpString(literal);
}

function bareDefault(
  database: number,
  text: string,
  columnType: ColumnType
): string | null {
  const { type } = columnType;

  if (NUMBER_LITERAL.test(text)) {
    return isNumberType(type)
      ? numberDefault(database, text, columnType)
      : phpString(numberText(database, text));
  }
  if (BOOLEAN_LITERAL.test(text)) {
    // MySQL and SQLite read a boolean as 1 or 0 on an integer column.
    if (
      integerTypes.has(type) &&
      (isMySQLFamily(database) || database === Database.SQLite)
    ) {
      return text.toLowerCase() === 'true' ? '1' : '0';
    }
    return type === 'BOOLEAN' ? text.toLowerCase() : null;
  }
  if (
    timestampTypes.has(type) &&
    (currentTimes.get(database) ?? CURRENT_TIMESTAMP).test(text)
  ) {
    return "'CURRENT_TIMESTAMP'";
  }
  return null;
}

function booleanDefault(database: number, text: string): string | null {
  if (database === Database.PostgreSQL) {
    if (POSTGRES_TRUE.test(text)) {
      return 'true';
    }
    return POSTGRES_FALSE.test(text) ? 'false' : null;
  }
  if (BOOLEAN_LITERAL.test(text)) {
    return text.toLowerCase();
  }

  const number = NUMBER_LITERAL.test(text) ? canonicalNumber(text) : null;
  return number === '0' || number === '1' ? number : null;
}

function isNumberType(type: DoctrineType): boolean {
  return (
    integerTypes.has(type) ||
    type === 'BOOLEAN' ||
    type === 'DECIMAL' ||
    type === 'FLOAT' ||
    type === 'SMALLFLOAT'
  );
}

/**
 * A number default as its database reads it back: an integer bare where PHP
 * reads it as an int, any other number as a string, as DBAL compares it, and
 * on MySQL one at its column's scale, a DECIMAL's or a FLOAT(M,D)'s.
 */
function numberDefault(
  database: number,
  text: string,
  { type, scale }: ColumnType
): string | null {
  if (type === 'BOOLEAN') {
    return booleanDefault(database, text);
  }

  const isMySQL = isMySQLFamily(database);

  if (integerTypes.has(type)) {
    const value = isMySQL
      ? decimalAtScale(canonicalNumber(text), 0)
      : numberText(database, text);
    const isPhpInt =
      value === canonicalNumber(value) &&
      !value.includes('.') &&
      BigInt(value.replace('-', '')) <= PHP_INT_MAX;

    return isPhpInt ? value : phpString(value);
  }
  if (isMySQL && scale !== null) {
    return phpString(decimalAtScale(canonicalNumber(text), scale));
  }
  return phpString(numberText(database, text));
}

/**
 * A number as its database keeps it: Oracle and SQLite keep the text as typed,
 * where the others read the number, written here with no sign but a minus, no
 * leading zero, which PHP reads as octal, and no exponent or trailing zero.
 */
function numberText(database: number, text: string): string {
  return database === Database.Oracle || database === Database.SQLite
    ? text
    : canonicalNumber(text);
}

function canonicalNumber(text: string): string {
  const [, sign, mantissa, exponent = '0'] = NUMBER_LITERAL.exec(
    text
  ) as RegExpExecArray;
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = `${whole}${fraction}`;
  const point = whole.length + Number(exponent);
  const padded =
    point < 0 ? `${'0'.repeat(-point)}${digits}` : digits.padEnd(point, '0');
  const at = Math.max(point, 0);
  const integer = (padded.slice(0, at) || '0').replace(LEADING_ZEROS, '');
  const decimals = padded.slice(at).replace(TRAILING_ZEROS, '');
  const value = decimals === '' ? integer : `${integer}.${decimals}`;

  return value === '0' || sign !== '-' ? value : `-${value}`;
}

/** A decimal rounded half away from zero to its scale and padded to it. */
function decimalAtScale(number: string, scale: number): string {
  const [whole, fraction = ''] = number.replace('-', '').split('.');
  const digits =
    BigInt(`${whole}${fraction.slice(0, scale).padEnd(scale, '0')}`) +
    (fraction.charAt(scale) >= '5' ? 1n : 0n);
  const text = digits.toString().padStart(scale + 1, '0');
  const value =
    scale === 0 ? text : `${text.slice(0, -scale)}.${text.slice(-scale)}`;

  return number.startsWith('-') && digits !== 0n ? `-${value}` : value;
}

/** The text of a string literal as its database reads it, or null for none. */
function stringLiteral(database: number, text: string): string | null {
  if (isMySQLFamily(database)) {
    const matched = MYSQL_STRING.exec(text);
    return matched ? unescapeMySQL(matched[1]) : null;
  }

  const matched = STRING_LITERAL.exec(text);

  if (!matched) {
    return null;
  }

  const [, prefix, body] = matched;
  const value = body.replaceAll("''", "'");

  return database === Database.MSSQL &&
    prefix !== '' &&
    !PRINTABLE_ASCII.test(value)
    ? null
    : value;
}

// A backslash before a percent sign or an underscore stays, for LIKE.
function unescapeMySQL(body: string): string {
  return body.replace(MYSQL_ESCAPE, (escape, char: string | undefined) => {
    if (char === undefined) {
      return "'";
    }
    return char === '%' || char === '_'
      ? escape
      : (mysqlEscapes.get(char) ?? char);
  });
}

const ASCII_IDENTIFIER = /^[A-Za-z_][0-9A-Za-z_]*$/;
const ASCII_CAPITALS = /[A-Z]+/g;

function quotesNames({ settings: { bracketType } }: RootState): boolean {
  return bracketType !== BracketType.none;
}

/** Whether a query needs the name quoted: a reserved word or other characters. */
function needsQuotes(name: string): boolean {
  return (
    !ASCII_IDENTIFIER.test(name) ||
    DOCTRINE_RESERVED_WORDS.has(name.toLowerCase())
  );
}

/**
 * An unquoted name as its database stores it: Oracle folds each letter whose
 * capital is one character and PostgreSQL its ASCII letters to lower case,
 * where a quoted one keeps its case, which Doctrine's backticks give it.
 */
function foldName(database: number, name: string): string {
  if (database === Database.Oracle) {
    return Array.from(name, oracleCapital).join('');
  }
  if (database === Database.PostgreSQL) {
    return name.replace(ASCII_CAPITALS, letters => letters.toLowerCase());
  }
  return name;
}

/**
 * A letter as Oracle capitalizes it: its capital where that is one character,
 * else the letter, but for a Greek letter with an iota below, whose capital is
 * the letter with the iota beside it, eight or nine code points on.
 */
function oracleCapital(char: string): string {
  const upper = char.toUpperCase();
  const code = char.codePointAt(0) as number;

  if (Array.from(upper).length === 1) {
    return upper;
  }
  if (code >= 0x1f80 && code <= 0x1fa7 && (code & 0xf) < 8) {
    return String.fromCodePoint(code + 8);
  }
  return code === 0x1fb3 || code === 0x1fc3 || code === 0x1ff3
    ? String.fromCodePoint(code + 9)
    : char;
}

/**
 * A name where the document quotes names, as its DDL writes it whole; else
 * one the user typed in delimiters keeps its case, and any other folds.
 */
function sqlName(state: RootState, name: string): SqlName {
  if (quotesNames(state)) {
    return { text: name, isQuoted: true };
  }
  if (isDelimitedPart(name)) {
    return { text: unquoteNamePart(name), isQuoted: true };
  }

  const text = foldName(state.settings.database, name);
  return { text, isQuoted: needsQuotes(text) };
}

function sqlText({ text, isQuoted }: SqlName): string {
  return isQuoted ? `\`${text}\`` : text;
}

// The databases whose names a pair of backticks delimits.
const BACKTICK_DATABASES: ReadonlySet<number> = new Set([
  Database.Databricks,
  Database.MariaDB,
  Database.MySQL,
  Database.SQLite,
]);

/**
 * Doctrine reads a dot in a table name as the end of its schema before it reads
 * a backtick, and keeps one schema, so a dotted name goes out as its last two
 * parts, unquoted, the backticks on the table alone, which quote the schema too.
 */
function tableNameArguments(state: RootState, name: string): string[] {
  const { database } = state.settings;

  // A quoted name is one identifier, written whole as the DDL writes it.
  if (quotesNames(state) && !name.includes('.')) {
    return [`name: ${phpString(sqlText({ text: name, isQuoted: true }))}`];
  }

  const parts = splitNameParts(name)
    .slice(-2)
    .map(part => {
      const backticked = BACKTICK_DATABASES.has(database)
        ? backtickedName(part)
        : null;

      if (backticked !== null) {
        return { text: backticked, isQuoted: true };
      }
      // A part loses its delimiters even where the document quotes names.
      if (isDelimitedPart(part)) {
        return { text: unquoteNamePart(part), isQuoted: true };
      }
      return sqlName(state, part);
    });
  const table = parts[parts.length - 1];

  return [
    `name: ${phpString(
      sqlText({ ...table, isQuoted: parts.some(part => part.isQuoted) })
    )}`,
    ...(parts.length === 1 ? [] : [`schema: ${phpString(parts[0].text)}`]),
  ];
}

const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;
// Oracle writes a unit after a length: VARCHAR2(4000 CHAR), CHAR(1 BYTE).
const LENGTH = /^([0-9]+)(?:\s+(?:byte|char))?$/i;
const MAX_ARGUMENT = /\(\s*max\s*\)/i;
const UNSIGNED = /(^|[^0-9a-z_])unsigned([^0-9a-z_]|$)/;
const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/;
const SPACES = /\s+/g;

// DBAL 4 writes no DECIMAL without a precision, so a type naming none takes
// the one DBAL 3 defaulted to, or a money type the digits its vendor keeps.
const DEFAULT_DECIMAL = [10, 0];
const moneyDecimals = new Map([
  ['money', [19, 2]],
  ['smallmoney', [10, 4]],
]);
const MSSQL_MONEY = [19, 4];
// SQL Server makes a DECIMAL of no precision a DECIMAL(18,0).
const MSSQL_DECIMAL = [18, 0];

const FIXED = "'fixed' => true";
const UTF8MB3 = "'charset' => 'utf8mb3'";
const JSONB = "'jsonb' => true";
const UNSIGNED_OPTION = "'unsigned' => true";

function createColumnType(
  type: DoctrineType,
  rest: Partial<ColumnType> = {}
): ColumnType {
  return {
    type,
    php: PHP_TYPES[type],
    args: [],
    options: [],
    definition: null,
    isReadOnly: false,
    scale: null,
    ...rest,
  };
}

function getColumnType(
  dataType: string,
  database: number,
  isKey: boolean
): ColumnType {
  const isMySQL = isMySQLFamily(database);
  const typeName = baseTypeName(dataType);
  const isUnsigned =
    isMySQL &&
    (UNSIGNED.test(typeName) ||
      ZEROFILL.test(typeName) ||
      typeName === 'serial');
  const base = isMySQL
    ? typeName
        .replace(UNSIGNED, '$1$2')
        .replace(ZEROFILL, '$1$2')
        .replace(SPACES, ' ')
        .trim()
    : typeName;
  const resolved = resolveColumnType(dataType, base, database, isKey);

  if (
    !isUnsigned ||
    !unsignedTypes.has(resolved.type) ||
    resolved.definition !== null
  ) {
    return resolved;
  }
  return {
    ...resolved,
    options: [...resolved.options, UNSIGNED_OPTION],
    php: resolved.type === 'BIGINT' ? 'int|string' : resolved.php,
  };
}

function resolveColumnType(
  dataType: string,
  base: string,
  database: number,
  isKey: boolean
): ColumnType {
  const isMySQL = isMySQLFamily(database);
  const args = typeArguments(dataType);

  // SQL Server writes a rowversion itself, eight bytes on every change, which
  // DBAL reads back as a binary of that length, never fixed.
  if (database === Database.MSSQL && rowVersionTypes.has(base)) {
    return createColumnType('BINARY', {
      args: ['length: 8'],
      definition: 'ROWVERSION',
      isReadOnly: true,
    });
  }
  // PostgreSQL types DBAL has no type for come back from pdo_pgsql as text, so
  // a TEXT keeps them, the definition their column.
  if (
    isPostgresArray(dataType, database) ||
    (database === Database.PostgreSQL &&
      (POSTGRES_BIT_TYPES.has(base) || base === 'pg_lsn'))
  ) {
    return createColumnType('TEXT', { definition: dataType.trim() });
  }
  if (isMySQL && base === 'enum') {
    const members = enumMembers(dataType);

    if (members) {
      return createColumnType('ENUM', {
        options: [`'values' => [${members.map(phpString).join(', ')}]`],
      });
    }
  }
  // DBAL reads a SET column back as a simple array, so that keeps it as it is.
  if (isMySQL && base === 'set') {
    return createColumnType('SIMPLE_ARRAY');
  }

  const fraction = fractionalNumber(dataType, database);

  if (fraction) {
    return createColumnType('DECIMAL', {
      args: [`precision: ${fraction[0]}`, `scale: ${fraction[1]}`],
      scale: fraction[1],
    });
  }
  if (database === Database.Oracle && oracleNumberTypes.has(base)) {
    if (args.length === 1 || (args.length === 2 && args[1] === 0)) {
      return createColumnType(oracleIntegerType(args[0]));
    }
    // Oracle stores a DECIMAL of no precision as NUMBER(*,0), an INTEGER to DBAL.
    if (base !== 'number' && args.length === 0) {
      return createColumnType('INTEGER');
    }
  }
  // DBAL writes a TEXT as VARCHAR(MAX) on SQL Server, which keeps no Unicode.
  if (
    database === Database.MSSQL &&
    (unicodeTextTypes.has(base) ||
      (nationalTypes.has(base) && MAX_ARGUMENT.test(dataType)))
  ) {
    return createColumnType('STRING', {
      args: ['length: -1'],
      definition: 'NVARCHAR(MAX)',
    });
  }

  const type =
    vendorTypes.get(database)?.get(base) ??
    namedTypes.get(base) ??
    (isSmallFloat(base, database, args) ? 'SMALLFLOAT' : undefined) ??
    convertTypeMap[getPrimitiveType(dataType, database)];

  // Doctrine hashes a key as a string, which no date and time object is.
  if (isKey && PHP_TYPES[type] === '\\DateTimeImmutable') {
    return createColumnType('STRING', {
      args: ['length: 255'],
      definition: dataType.trim(),
    });
  }
  // Nor is a stream, which a BLOB hydrates to, where PostgreSQL and SQLite
  // store a BINARY of no length as the same BYTEA and BLOB.
  if (
    isKey &&
    type === 'BLOB' &&
    (database === Database.PostgreSQL || database === Database.SQLite)
  ) {
    return createColumnType('BINARY');
  }
  if (type === 'STRING' || type === 'BINARY') {
    const resolved = lengthType(type, base, dataType, database);

    // SchemaTool copies a key's length, not the 255 ORM gives a string of
    // none, to a join column toward it, which DBAL then cannot write.
    return isKey && resolved.type === 'STRING' && resolved.args.length === 0
      ? { ...resolved, args: ['length: 255'] }
      : resolved;
  }
  if (isMySQL && (type === 'TEXT' || type === 'BLOB')) {
    const length = mysqlLobLength(base, database, args);

    return createColumnType(type, {
      args: length === undefined ? [] : [`length: ${length}`],
    });
  }
  if (type === 'DECIMAL' && args.length === 1) {
    return createColumnType(type, {
      args: [`precision: ${args[0]}`],
      scale: 0,
    });
  }
  if (type === 'DECIMAL') {
    const [precision, scale] = decimalDigits(base, database, args);

    return createColumnType(type, {
      args: [`precision: ${precision}`, `scale: ${scale}`],
      scale,
    });
  }
  if (type === 'JSON' && base === 'jsonb') {
    return createColumnType(type, { options: [JSONB] });
  }
  // MySQL rounds and pads a FLOAT(M,D) default to D digits, as a DECIMAL's.
  if (
    isMySQL &&
    (type === 'FLOAT' || type === 'SMALLFLOAT') &&
    args.length === 2
  ) {
    return createColumnType(type, { scale: args[1] });
  }

  return createColumnType(type);
}

/**
 * The length DBAL reads back from a MySQL text or blob type: its class's, the
 * class a TEXT(n) needs for n characters, or a BLOB(n)'s n bytes.
 */
function mysqlLobLength(
  base: string,
  database: number,
  args: number[]
): number | undefined {
  if (args.length !== 1 || (base !== 'text' && base !== 'blob')) {
    return mysqlLobLengths.get(base);
  }
  // MySQL makes a TEXT(0) and a BLOB(0) a TINYTEXT and a TINYBLOB, MariaDB a
  // TEXT and a BLOB.
  if (args[0] === 0) {
    return database === Database.MariaDB ? mysqlLobLengths.get(base) : 255;
  }
  if (base === 'text') {
    return MYSQL_TEXT_BYTES.find(bytes => args[0] * 4 <= bytes);
  }
  return args[0];
}

function decimalDigits(
  base: string,
  database: number,
  args: number[]
): number[] {
  if (args.length === 2) {
    return args;
  }
  if (base === 'money' && database === Database.MSSQL) {
    return MSSQL_MONEY;
  }
  return (
    moneyDecimals.get(base) ??
    (database === Database.MSSQL ? MSSQL_DECIMAL : DEFAULT_DECIMAL)
  );
}

/**
 * The type of an Oracle NUMBER of no scale, as DBAL reads it back but for one
 * of precision 1, its BOOLEAN: 5 a SMALLINT and any other up to 10 an INTEGER,
 * which writes NUMBER(10); a wider one a BIGINT, which an int cast could cut.
 */
function oracleIntegerType(precision: number): DoctrineType {
  if (precision === 5) {
    return 'SMALLINT';
  }
  return precision <= 10 ? 'INTEGER' : 'BIGINT';
}

function lengthType(
  type: 'STRING' | 'BINARY',
  base: string,
  dataType: string,
  database: number
): ColumnType {
  const length = lengthTypes.has(base) ? lengthArgument(dataType) : null;
  const options = [
    ...(fixedLengthTypes.has(base) ? [FIXED] : []),
    ...(isMySQLFamily(database) && mysqlNationalTypes.has(base)
      ? [UTF8MB3]
      : []),
  ];

  if (length !== null) {
    // SQL Server keeps at most 4000 characters in the NVARCHAR DBAL writes.
    return createColumnType(type, {
      args: [`length: ${length}`],
      options,
      definition:
        database === Database.MSSQL &&
        type === 'STRING' &&
        !nationalTypes.has(base) &&
        length > 4000
          ? dataType.trim()
          : null,
    });
  }
  // A bare binary is one byte on MySQL and SQL Server, and unbounded on the
  // others, where DBAL 4, which writes no VARBINARY without a length, and ORM,
  // which cuts a string of none to 255 characters, take the unbounded types.
  if (
    type === 'BINARY' &&
    (isMySQLFamily(database) || database === Database.MSSQL) &&
    !MAX_ARGUMENT.test(dataType)
  ) {
    return createColumnType('BINARY', { args: ['length: 1'], options });
  }
  if (type === 'BINARY') {
    return createColumnType('BLOB');
  }
  if (MAX_ARGUMENT.test(dataType) || unboundedStringTypes.has(base)) {
    return createColumnType('TEXT');
  }
  if (oneCharacterTypes.has(base)) {
    return createColumnType('STRING', { args: ['length: 1'], options });
  }
  return createColumnType('STRING');
}

// The single precision types, as each DBAL platform reads them back: MySQL's
// FLOAT(M,D) whatever M, and a float of up to 24 bits where it is a real.
function isSmallFloat(base: string, database: number, args: number[]): boolean {
  const isSinglePrecision =
    base === 'float' && args.length === 1 && args[0] <= 24;

  switch (database) {
    case Database.MySQL:
    case Database.MariaDB:
      return (
        (base === 'float' || base === 'float4') &&
        (args.length !== 1 || args[0] <= 24)
      );
    case Database.PostgreSQL:
      return base === 'real' || base === 'float4' || isSinglePrecision;
    case Database.MSSQL:
      return base === 'real' || isSinglePrecision;
    case Database.Oracle:
      return (
        base === 'real' ||
        (base === 'float' && args.length === 1 && args[0] === 63)
      );
    case Database.SQLite:
      return base === 'real';
  }
  return false;
}

function typeArguments(dataType: string): number[] {
  const matched = TYPE_ARGUMENTS.exec(dataType);
  if (!matched) {
    return [];
  }

  const values = matched[1].split(',').map(value => value.trim());
  return values.every(value => DIGITS.test(value)) ? values.map(Number) : [];
}

function lengthArgument(dataType: string): number | null {
  const matched = LENGTH.exec(TYPE_ARGUMENTS.exec(dataType)?.[1].trim() ?? '');
  const length = Number(matched?.[1]);

  return length > 0 ? length : null;
}

function createClassContext(state: RootState): ClassContext {
  const relationships = resolveRelationships(state);
  const derivedIds = new Set(
    relationships
      .filter(resolved => isDerivedIdentity(state, resolved, relationships))
      .map(({ relationship }) => relationship.id)
  );
  // An association that is the child's one key column holds one child a
  // parent, and Doctrine refuses a many-to-one as an entity's only identifier.
  const oneToOneIds = new Set(
    relationships
      .filter(
        ({ relationship, endTable }) =>
          !hasNRelationship(relationship.relationshipType) ||
          (derivedIds.has(relationship.id) &&
            keyColumns(state, endTable).length === 1)
      )
      .map(({ relationship }) => relationship.id)
  );
  const context: ClassContext = {
    relationships,
    derivedIds,
    oneToOneIds,
    indexNames: createIndexNames(state),
    namings: new Map<string, TableNaming>(),
    classNames: new Set(IMPORTED_NAMES.map(name => name.toLowerCase())),
  };

  query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds)
    .sort(orderByNameASC)
    .forEach(table => getNaming(state, context, table));

  return context;
}

/**
 * The names the editor's DDL gives the indexes the document names none for,
 * numbered in its index order across every table, which the one-table view
 * then writes the same.
 */
function createIndexNames(state: RootState): Map<string, string> {
  const {
    doc: { indexIds },
    settings: { bracketType },
    collections,
  } = state;
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const indexColumnCollection = query(collections).collection(
    'indexColumnEntities'
  );
  const used: Name[] = [];
  const names = new Map<string, string>();

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .forEach(index => {
      const table = tableCollection.selectById(index.tableId);
      const hasColumns = indexColumnCollection
        .selectByIds(index.indexColumnIds)
        .some(({ columnId }) => columnCollection.selectById(columnId));

      if (!table || index.name.trim() !== '' || !hasColumns) {
        return;
      }

      const name = autoNameIgnoreCase(
        used,
        `IDX_${tableNamePart(table.name, bracketType)}`
      );
      used.push({ id: index.id, name });
      names.set(index.id, name);
    });

  return names;
}

/**
 * The relationships Doctrine can map: both tables in the document and every
 * column present, the columns paired, and the parent's side all key columns,
 * the one column Doctrine lets a join column reference.
 */
function resolveRelationships(state: RootState): ResolvedRelationship[] {
  const {
    doc: { relationshipIds, tableIds },
    collections,
  } = state;
  const documentTableIds = new Set(tableIds);
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

      return !isMapped(relationship) ||
        !startTable ||
        !endTable ||
        !documentTableIds.has(startTable.id) ||
        !documentTableIds.has(endTable.id) ||
        endColumns.length === 0 ||
        startColumns.length !== relationship.start.columnIds.length ||
        endColumns.length !== relationship.end.columnIds.length ||
        startColumns.length !== endColumns.length ||
        !startColumns.every(
          column =>
            startTable.columnIds.includes(column.id) && isPrimaryKey(column)
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

/**
 * The class name and every property name of a table: its columns but those an
 * association it owns carries, which Doctrine maps through the join columns,
 * then the associations it owns, then those it is the inverse side of.
 */
function createTableNaming(
  state: RootState,
  table: Table,
  { relationships, derivedIds, oneToOneIds, classNames }: ClassContext
): TableNaming {
  const {
    settings: { tableNameCase, columnNameCase },
    collections,
  } = state;
  const used = new Set<string>();
  const propertyNames = new Map<string, string>();
  const relationshipNames = new Map<string, string>();
  const owning = relationships.filter(
    ({ relationship }) => relationship.end.tableId === table.id
  );
  const carried = new Set(
    owning.flatMap(({ relationship, endColumns }) =>
      endColumns
        .filter(
          column => derivedIds.has(relationship.id) || !isPrimaryKey(column)
        )
        .map(column => column.id)
    )
  );
  const columnNames = new Set<string>();
  const fields = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .filter(column => {
      // A second column of one name would map that name twice.
      if (carried.has(column.id) || columnNames.has(column.name)) {
        return false;
      }
      columnNames.add(column.name);
      return true;
    });

  fields.forEach(column => {
    propertyNames.set(
      column.id,
      uniqueName(used, phpIdentifier(getNameCase(column.name, columnNameCase)))
    );
  });

  owning.forEach(({ relationship, startTable }) => {
    const name = isSelfReferential(relationship)
      ? `parent_${startTable.name}`
      : startTable.name;

    relationshipNames.set(
      relationshipKey(relationship, OWNING),
      uniqueName(used, phpIdentifier(getNameCase(name, columnNameCase)))
    );
  });

  relationships
    .filter(({ relationship }) => relationship.start.tableId === table.id)
    .forEach(({ relationship, endTable }) => {
      const name = oneToOneIds.has(relationship.id)
        ? endTable.name
        : `${endTable.name}List`;

      relationshipNames.set(
        relationshipKey(relationship, INVERSE),
        uniqueName(used, phpIdentifier(getNameCase(name, columnNameCase)))
      );
    });

  return {
    className: uniqueClassName(
      classNames,
      toClassName(phpIdentifier(getNameCase(table.name, tableNameCase)))
    ),
    fields,
    owning,
    propertyNames,
    relationshipNames,
  };
}

/**
 * Whether an association can be its table's key itself: Doctrine takes one
 * only toward a parent keyed by one column of its own, so elsewhere a key
 * column stays an identifier field beside the association on that column.
 */
function isDerivedIdentity(
  state: RootState,
  { startTable, startColumns, endColumns }: ResolvedRelationship,
  relationships: ResolvedRelationship[]
): boolean {
  const parentKey = keyColumns(state, startTable);

  return (
    endColumns.every(isPrimaryKey) &&
    parentKey.length === 1 &&
    startColumns.length === 1 &&
    startColumns[0].id === parentKey[0].id &&
    !relationships.some(
      ({ relationship, endColumns: parentColumns }) =>
        relationship.end.tableId === startTable.id &&
        parentColumns.every(isPrimaryKey) &&
        parentColumns.some(column => column.id === parentKey[0].id)
    )
  );
}

function keyColumns(state: RootState, table: Table): Column[] {
  return query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .filter(isPrimaryKey);
}

function isMapped(relationship: Relationship): boolean {
  return (
    hasOneRelationship(relationship.relationshipType) ||
    hasNRelationship(relationship.relationshipType)
  );
}

function isPrimaryKey(column: Column): boolean {
  return bHas(column.options, ColumnOption.primaryKey);
}

function relationshipKey(
  relationship: Relationship,
  side: RelationshipSide
): string {
  return `${relationship.id}:${side}`;
}

function relationshipName(
  naming: TableNaming,
  relationship: Relationship,
  side: RelationshipSide
): string {
  return naming.relationshipNames.get(
    relationshipKey(relationship, side)
  ) as string;
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

// PHP reads a class name in any letter case, so the names compare folded.
function uniqueClassName(used: Set<string>, name: string): string {
  let result = name;
  let index = 2;

  while (used.has(result.toLowerCase())) {
    result = `${name}${index}`;
    index += 1;
  }

  used.add(result.toLowerCase());
  return result;
}

const WORD_CHARACTER = /^[0-9A-Za-z_]$/;
const DIGIT_START = /^[0-9]/;

/**
 * A name PHP reads as one identifier, which opens on no digit: any other ASCII
 * character becomes an underscore, and PHP takes a byte from 0x80 up as a letter.
 */
function phpIdentifier(name: string): string {
  const value = Array.from(name, char =>
    char.charCodeAt(0) >= 0x80 || WORD_CHARACTER.test(char) ? char : '_'
  ).join('');
  return value === '' || DIGIT_START.test(value) ? `_${value}` : value;
}

const SINGLE_QUOTED = /[\\']/g;

const doubleQuotedEscapes = new Map([
  ['\\', '\\\\'],
  ['"', '\\"'],
  ['$', '\\$'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

/**
 * A string literal, in single quotes unless it holds a control character,
 * which a double-quoted one writes as an escape.
 */
function phpString(value: string): string {
  const chars = Array.from(value);

  if (!chars.some(isControlCharacter)) {
    return `'${value.replace(SINGLE_QUOTED, '\\$&')}'`;
  }

  return `"${chars.map(escapeDoubleQuoted).join('')}"`;
}

function escapeDoubleQuoted(char: string): string {
  const escape = doubleQuotedEscapes.get(char);

  if (escape !== undefined) {
    return escape;
  }
  return isControlCharacter(char)
    ? `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
    : char;
}

function isControlCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}
