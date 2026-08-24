import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';
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

const SEQUELIZE_NAMES = [
  'CreationOptional',
  'DataTypes',
  'InferAttributes',
  'InferCreationAttributes',
  'Model',
  'NonAttribute',
  'Sequelize',
  'sequelize',
] as const;

const GLOBAL_NAMES = ['Buffer', 'Date'] as const;

const MODEL_MEMBER_NAMES: ReadonlyArray<string> = [
  '_attributes',
  '_creationAttributes',
  '_previousDataValues',
  'changed',
  'dataValues',
  'decrement',
  'destroy',
  'equals',
  'equalsOneOf',
  'get',
  'getDataValue',
  'increment',
  'isNewRecord',
  'isSoftDeleted',
  'previous',
  'reload',
  'restore',
  'save',
  'sequelize',
  'set',
  'setAttributes',
  'setDataValue',
  'toJSON',
  'update',
  'validate',
  'where',
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
};

const CHAR = `${TYPES}.CHAR`;
const STRING = `${TYPES}.STRING`;

const VENDOR_TYPES: ReadonlyArray<[string[], Emission]> = [
  [
    [
      'bpchar',
      'char',
      'char byte',
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
  [
    [
      'bfile',
      'binary',
      'binary varying',
      'blob',
      'bytea',
      'image',
      'long raw',
      'long varbinary',
      'raw',
      'varbinary',
    ],
    { expr: `${TYPES}.BLOB`, ts: 'Buffer', args: 'none' },
  ],
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
    { expr: `${TYPES}.DECIMAL`, ts: 'string', args: 'precision' },
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

const NUMERIC_EXPRESSIONS: ReadonlySet<string> = new Set([
  `${TYPES}.BIGINT`,
  `${TYPES}.DECIMAL`,
  `${TYPES}.DOUBLE`,
  `${TYPES}.FLOAT`,
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
  long: { expr: `${TYPES}.BIGINT`, ts: 'string', args: 'none' },
  float: { expr: `${TYPES}.FLOAT`, ts: 'number', args: 'none' },
  double: { expr: `${TYPES}.DOUBLE`, ts: 'number', args: 'none' },
  decimal: { expr: `${TYPES}.DECIMAL`, ts: 'string', args: 'precision' },
  boolean: { expr: `${TYPES}.BOOLEAN`, ts: 'boolean', args: 'none' },
  string: { expr: STRING, ts: 'string', args: 'length' },
  lob: { expr: `${TYPES}.TEXT`, ts: 'string', args: 'none' },
  date: { expr: `${TYPES}.DATEONLY`, ts: 'string', args: 'none' },
  dateTime: { expr: `${TYPES}.DATE`, ts: 'Date', args: 'none' },
  time: { expr: `${TYPES}.TIME`, ts: 'string', args: 'none' },
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

  columns.forEach(column => {
    const columnContext: ColumnContext = {
      property: naming.columnNames.get(column.id) ?? column.name,
      type: getColumnType(column.dataType, database),
    };

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
  { property, type }: ColumnContext
) {
  const { isAutoIncrement, isNullable } = columnFlags(column);
  const annotation = isNullable
    ? `${type.ts} | null`
    : isAutoIncrement || column.default.trim() !== ''
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

function columnFlags(column: Column): ColumnFlags {
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);

  return {
    isPrimaryKey,
    isAutoIncrement: bHas(column.options, ColumnOption.autoIncrement),
    isNullable: !isPrimaryKey && !bHas(column.options, ColumnOption.notNull),
  };
}

function createAttribute(
  column: Column,
  { property, type }: ColumnContext
): Entry {
  const { isPrimaryKey, isAutoIncrement, isNullable } = columnFlags(column);
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
        ...(bHas(column.options, ColumnOption.unique) && !isPrimaryKey
          ? ['unique: true']
          : []),
        ...(!isAutoIncrement && value !== '' ? [defaultValue(value)] : []),
        ...(column.comment.trim() === ''
          ? []
          : [`comment: "${escapeString(column.comment)}"`]),
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
        : [`comment: "${escapeString(table.comment)}"`]),
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

const ARGUMENTS = /\([^)]*\)/g;
const WHITESPACE = /\s+/g;
const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;
const UNSIGNED = /(^|[^0-9a-z_])unsigned([^0-9a-z_]|$)/;

function getColumnType(dataType: string, database: number): SequelizeType {
  const base = dataType
    .toLocaleLowerCase()
    .replace(ARGUMENTS, ' ')
    .replace(WHITESPACE, ' ')
    .trim();

  if (base === '') {
    return { expr: STRING, ts: 'string' };
  }

  if (base === 'enum') {
    const members = enumMembers(dataType);

    if (members.length !== 0) {
      const quoted = members.map(member => `"${escapeString(member)}"`);

      return {
        expr: `${TYPES}.ENUM(${quoted.join(', ')})`,
        ts: quoted.join(' | '),
      };
    }
  }

  const primitiveType = getPrimitiveType(dataType, database);
  const emission = vendorTypeMap.get(base) ?? fallbackTypeMap[primitiveType];
  const { expr, attached } = applyArguments(emission, typeArguments(dataType));
  const unsigned =
    !attached &&
    NUMERIC_EXPRESSIONS.has(expr) &&
    UNSIGNED.test(base) &&
    (database === Database.MySQL || database === Database.MariaDB);

  return { expr: unsigned ? `${expr}.UNSIGNED` : expr, ts: emission.ts };
}

function applyArguments(
  emission: Emission,
  args: number[]
): { expr: string; attached: boolean } {
  if (emission.args === 'length' && args.length === 1 && args[0] > 0) {
    return { expr: `${emission.expr}(${args[0]})`, attached: true };
  }
  if (emission.args === 'precision' && args.length === 1) {
    return { expr: `${emission.expr}(${args[0]})`, attached: true };
  }
  if (emission.args === 'precision' && args.length === 2) {
    return {
      expr: `${emission.expr}(${args[0]}, ${args[1]})`,
      attached: true,
    };
  }

  return {
    expr: emission.expr === CHAR ? STRING : emission.expr,
    attached: false,
  };
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
        uniqueName(used, tsIdentifier(getNameCase(name, columnNameCase)))
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
        uniqueName(used, tsIdentifier(name))
      );
    });

  return {
    className: uniqueName(
      classNames,
      tsIdentifier(getNameCase(table.name, tableNameCase))
    ),
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
