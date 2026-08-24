import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, NameCase } from '@/constants/schema';
import { PrimitiveType, PrimitiveTypeMap } from '@/constants/sql/dataType';
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

const GLOBAL_NAMES = ['Buffer', 'Date'] as const;

type TypeormName = (typeof TYPEORM_NAMES)[number];

const MODULE_SCOPE_NAMES: ReadonlySet<string> = new Set<string>([
  ...TYPEORM_NAMES,
  ...GLOBAL_NAMES,
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

const binaryTypes = new Set([
  'bfile',
  'binary',
  'binary varying',
  'blob',
  'bytea',
  'image',
  'long raw',
  'long varbinary',
  'longblob',
  'mediumblob',
  'raw',
  'tinyblob',
  'varbinary',
]);

const jsonTypes = new Set(['json', 'jsonb']);

const uuidTypes = new Set(['uniqueidentifier', 'uuid']);

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

type ColumnType = {
  type: string | null;
  annotation: string;
  args: string[];
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
  const { type, annotation, args } = getColumnType(column.dataType, database);
  const typeArg = type === null ? [] : [`"${escapeString(type)}"`];
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
  const isAutoIncrement = bHas(column.options, ColumnOption.autoIncrement);
  const isNullable =
    !isPrimaryKey && !bHas(column.options, ColumnOption.notNull);
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

  if (isPrimaryKey && isAutoIncrement) {
    const isUuid = type !== null && uuidTypes.has(type);
    const numeric =
      !isUuid && type !== null && generatedNumericTypes.has(type)
        ? [`type: "${escapeString(type)}"`]
        : [];

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
      { open: '{', entries: [...numeric, ...named, ...comment] }
    );
  } else {
    const decorator: TypeormName = isPrimaryKey ? 'PrimaryColumn' : 'Column';
    const generated = isAutoIncrement ? ['generated: "increment"'] : [];
    const constraints = isPrimaryKey
      ? []
      : [
          ...(isNullable ? ['nullable: true'] : []),
          ...(bHas(column.options, ColumnOption.unique)
            ? ['unique: true']
            : []),
        ];

    formatDecorator(memberBuffer, INDENT, decorator, typeArg, {
      open: '{',
      entries: [
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
        relationArguments(parentNaming, startTable, relationship, INVERSE)
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

const ARGUMENTS = /\([^)]*\)/g;
const WHITESPACE = /\s+/g;
const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;

function getColumnType(dataType: string, database: number): ColumnType {
  const base = dataType
    .toLocaleLowerCase()
    .replace(ARGUMENTS, ' ')
    .replace(WHITESPACE, ' ')
    .trim();

  if (base === '') {
    return { type: null, annotation: 'string', args: [] };
  }

  if (base === 'enum' || base === 'set') {
    const members = enumMembers(dataType);

    if (members.length !== 0) {
      const union = members
        .map(member => `"${escapeString(member)}"`)
        .join(' | ');

      return {
        type: base,
        annotation: base === 'set' ? `(${union})[]` : union,
        args: [
          `enum: [${members.map(member => `"${escapeString(member)}"`).join(', ')}]`,
        ],
      };
    }
  }

  const primitiveType = getPrimitiveType(dataType, database);
  const annotation = getAnnotation(base, primitiveType);
  const args = typeArguments(dataType);
  const type = columnTypes.has(base)
    ? base
    : fallbackType(base, primitiveType, annotation);

  if (withLengthTypes.has(type) && args.length === 1 && args[0] > 0) {
    return { type, annotation, args: [`length: ${args[0]}`] };
  }
  if (withPrecisionTypes.has(type) && args.length === 1) {
    return { type, annotation, args: [`precision: ${args[0]}`] };
  }
  if (withPrecisionTypes.has(type) && args.length === 2) {
    return {
      type,
      annotation,
      args: [`precision: ${args[0]}`, `scale: ${args[1]}`],
    };
  }

  return { type, annotation, args: [] };
}

function fallbackType(
  base: string,
  primitiveType: PrimitiveType,
  annotation: string
): string {
  if (binaryTypes.has(base)) {
    return 'varbinary';
  }
  if (primitiveType === 'long' && annotation !== 'string') {
    return 'int';
  }
  return fallbackTypeMap[primitiveType];
}

function getAnnotation(base: string, primitiveType: PrimitiveType): string {
  if (jsonTypes.has(base)) {
    return 'object';
  }
  if (binaryTypes.has(base)) {
    return 'Buffer';
  }
  if (primitiveType === 'long' && bigintTypes.has(base)) {
    return 'string';
  }
  return convertTypeMap[primitiveType];
}

const SEPARATOR = /[\s,]/;

function enumMembers(dataType: string): string[] {
  const matched = TYPE_ARGUMENTS.exec(dataType);
  if (!matched) {
    return [];
  }

  const source = matched[1];
  const members: string[] = [];
  let index = 0;

  while (index < source.length) {
    if (SEPARATOR.test(source[index])) {
      index += 1;
      continue;
    }

    const quote = source[index];
    if (quote !== "'" && quote !== '"') {
      return [];
    }

    let member = '';
    index += 1;

    while (index < source.length) {
      if (source[index] !== quote) {
        member += source[index];
        index += 1;
      } else if (source[index + 1] === quote) {
        member += quote;
        index += 2;
      } else {
        index += 1;
        break;
      }
    }

    members.push(member);
  }

  return members;
}

function typeArguments(dataType: string): number[] {
  const matched = TYPE_ARGUMENTS.exec(dataType);
  if (!matched) {
    return [];
  }

  const values = matched[1].split(',').map(value => value.trim());
  return values.every(value => DIGITS.test(value)) ? values.map(Number) : [];
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
        uniqueName(used, tsIdentifier(getNameCase(name, columnNameCase)))
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
        uniqueName(used, tsIdentifier(name))
      );
    });

  return {
    className: uniqueName(
      classNames,
      tsIdentifier(getNameCase(table.name, tableNameCase))
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
const NEWLINE = /\r\n|\r|\n/g;

function escapeString(value: string): string {
  return value
    .replace(BACKSLASH, '\\\\')
    .replace(DOUBLE_QUOTE, '\\"')
    .replace(NEWLINE, '\\n');
}
