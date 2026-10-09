import { query } from '@dineug/erd-editor-schema';

import {
  BracketType,
  ColumnOption,
  Database,
  ReferentialAction,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { isIntegerFamily } from '@/utils/schema-sql/SQLite';
import {
  isDelimitedPart,
  orderByNameASC,
  referentialActionSupport,
  splitNameParts,
  toForeignKeyPairs,
  unquoteNamePart,
} from '@/utils/schema-sql/utils';

import { stripIdWord } from './graphql';
import { toSnakeCase, toUpperCamelCase } from './heck';
import { INDENT, toRustIdentifier } from './rust';
import { getRustColumnType, RustColumnType, RustScalar } from './rustTypes';
import { hasOneRelationship } from './utils';

/** Each scalar as the prelude every entity module imports spells it. */
const PRELUDE_TYPES: Readonly<Record<RustScalar, string>> = {
  bool: 'bool',
  i8: 'i8',
  i16: 'i16',
  i32: 'i32',
  i64: 'i64',
  u8: 'u8',
  u16: 'u16',
  u32: 'u32',
  u64: 'u64',
  f32: 'f32',
  f64: 'f64',
  decimal: 'Decimal',
  string: 'String',
  bytes: 'Vec<u8>',
  uuid: 'Uuid',
  json: 'Json',
  date: 'Date',
  time: 'Time',
  dateTime: 'DateTime',
  dateTimeUtc: 'DateTimeUtc',
  dateTimeOffset: 'DateTimeWithTimeZone',
};

/** The type SeaORM's schema builder writes on SQLite for a scalar it is given no column_type for. */
const SQLITE_TYPES: Readonly<Record<RustScalar, string>> = {
  bool: 'boolean',
  i8: 'tinyint',
  i16: 'smallint',
  i32: 'integer',
  i64: 'integer',
  u8: 'tinyint',
  u16: 'smallint',
  u32: 'integer',
  u64: 'integer',
  f32: 'float',
  f64: 'double',
  decimal: 'real_decimal',
  string: 'varchar',
  bytes: 'varbinary_blob',
  uuid: 'uuid_text',
  json: 'json_text',
  date: 'date_text',
  time: 'time_text',
  dateTime: 'datetime_text',
  dateTimeUtc: 'timestamp_with_timezone_text',
  dateTimeOffset: 'timestamp_with_timezone_text',
};

// The PostgreSQL types the schema builder writes from the Rust type alone.
const POSTGRES_NATIVE_TYPES = new Set([
  'bigint',
  'bool',
  'boolean',
  'bytea',
  'character varying',
  'date',
  'decimal',
  'double precision',
  'float',
  'float4',
  'float8',
  'int',
  'int2',
  'int4',
  'int8',
  'integer',
  'json',
  'numeric',
  'real',
  'smallint',
  'time',
  'time without time zone',
  'timestamp',
  'timestamp with time zone',
  'timestamp without time zone',
  'timestamptz',
  'uuid',
  'varchar',
]);

const POSTGRES_COLUMN_TYPES = new Map([
  ['bit', 'Bit(None)'],
  ['cidr', 'Cidr'],
  ['inet', 'Inet'],
  ['interval', 'Interval(None, None)'],
  ['jsonb', 'JsonBinary'],
  ['macaddr', 'MacAddr'],
  ['money', 'Money(None)'],
  ['text', 'Text'],
]);

// The MySQL and MariaDB types the schema builder writes from the Rust type alone.
const MYSQL_NATIVE_TYPES = new Set([
  'bool',
  'boolean',
  'date',
  'datetime',
  'dec',
  'decimal',
  'double',
  'double precision',
  'fixed',
  'float',
  'float4',
  'float8',
  'json',
  'numeric',
  'real',
  'time',
  'timestamp',
]);

const MYSQL_INTEGER_TYPES = new Set([
  'bigint',
  'int',
  'int1',
  'int2',
  'int4',
  'int8',
  'integer',
  'smallint',
  'tinyint',
]);

const DECIMAL_TYPES = new Set(['dec', 'decimal', 'fixed', 'numeric']);
const VARCHAR_TYPES = new Set(['character varying', 'varchar']);
const CHAR_TYPES = new Set(['char', 'character']);
const UNSIGNED_SCALARS = new Set<RustScalar>(['u8', 'u16', 'u32', 'u64']);

// The databases whose names a pair of backticks delimits, as in doctrine.ts.
const BACKTICK_DATABASES: ReadonlySet<number> = new Set([
  Database.Databricks,
  Database.MariaDB,
  Database.MySQL,
  Database.SQLite,
]);

const REFERENTIAL_ACTION_NAMES: Readonly<Record<number, string>> = {
  [ReferentialAction.noAction]: 'NoAction',
  [ReferentialAction.cascade]: 'Cascade',
  [ReferentialAction.setNull]: 'SetNull',
  [ReferentialAction.setDefault]: 'SetDefault',
  [ReferentialAction.restrict]: 'Restrict',
};

const NON_XID_CONTINUE = /[^\p{XID_Continue}]/gu;
const XID_START = /^\p{XID_Start}$/u;
const LEADING_UNDERSCORES = /^_+/;
const ASCII_CAPITALS = /[A-Z]+/g;
const BACKTICKED = /^`((?:[^`]|``)*)`$/;
const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/i;
const RAW_PREFIX = /^r#/;

// A field whose setter would shadow the ActiveModelTrait method of that name,
// which the code the macros derive for a relation calls on the model.
const SHADOWING_FIELDS: ReadonlySet<string> = new Set([
  'parent_key',
  'parent_key_for',
  'parent_key_for_self_rev',
]);

// The SQLite affinities that store text which looks like a number as one.
const NUMERIC_AFFINITIES: ReadonlySet<string> = new Set([
  'INTEGER',
  'NUMERIC',
  'REAL',
]);

// rustfmt keeps an attribute of several items on one line while they take 70
// columns, and one of a single item while the line takes fewer than 100.
const ATTRIBUTE_ITEMS_WIDTH = 70;
const LINE_WIDTH = 100;

type RelationKind = 'belongs_to' | 'has_one' | 'has_many';

type ResolvedRelationship = {
  relationship: Relationship;
  startTable: Table;
  endTable: Table;
  start: Column[];
  end: Column[];
  isSelf: boolean;
  /** Self, or one of several between its two tables: named by its key. */
  isNamed: boolean;
};

type RelationField = {
  kind: RelationKind;
  resolved: ResolvedRelationship;
  field: string;
  target: string;
  isOptional: boolean;
  variant: string;
  isExplicit: boolean;
};

type EntityModule = {
  name: string;
  /** The name before a keyword's underscore, which relation names build on. */
  base: string;
};

type EntityNaming = {
  fields: Map<string, string>;
  uniqueIds: Set<string>;
  uniqueKeys: Map<string, string>;
  relations: RelationField[];
};

type EntityContext = {
  tables: Table[];
  modules: Map<string, EntityModule>;
  moduleNames: Set<string>;
  relationships: ResolvedRelationship[];
  namings: Map<string, EntityNaming>;
};

type EntityColumnType = {
  type: string;
  columnType: string | null;
  selectAs: string | null;
  saveAs: string | null;
  isFloat: boolean;
};

export function createCode(state: RootState): string {
  const context = createEntityContext(state);
  const buffer: string[] = [''];

  context.tables.forEach(table => {
    buffer.push(`pub mod ${getModule(context, table).name} {`);
    formatEntity(state, context, table, buffer, INDENT);
    buffer.push('}', '');
  });

  return buffer.join('\n');
}

/** One table's entity as its module file holds it, named in the whole document. */
export function createTableCode(state: RootState, table: Table): string {
  const buffer: string[] = [''];

  formatEntity(state, createEntityContext(state), table, buffer, '');
  buffer.push('');

  return buffer.join('\n');
}

function formatEntity(
  state: RootState,
  context: EntityContext,
  table: Table,
  buffer: string[],
  indent: string
) {
  const naming = getNaming(state, context, table);
  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const types = columns.map(column =>
    getEntityColumnType(column.dataType, state.settings.database)
  );
  const fieldIndent = `${indent}${INDENT}`;
  const body: string[] = [];

  columns.forEach((column, index) => {
    const field = naming.fields.get(column.id) as string;
    const { type, columnType, selectAs, saveAs } = types[index];
    const sqlName = sqlNamePart(state, column.name);
    const items: string[] = [];

    if (derivedColumnName(field) !== sqlName) {
      items.push(`column_name = ${rustString(sqlName)}`);
    }
    if (isPrimaryKey(column)) {
      items.push('primary_key');

      if (!bHas(column.options, ColumnOption.autoIncrement)) {
        items.push('auto_increment = false');
      }
    }
    if (columnType !== null) {
      items.push(`column_type = ${rustString(columnType)}`);
    }
    if (selectAs !== null) {
      items.push(`select_as = ${rustString(selectAs)}`);
    }
    if (saveAs !== null) {
      items.push(`save_as = ${rustString(saveAs)}`);
    }
    if (naming.uniqueIds.has(column.id)) {
      items.push('unique');
    }

    const uniqueKey = naming.uniqueKeys.get(column.id);
    if (uniqueKey !== undefined) {
      items.push(`unique_key = ${rustString(uniqueKey)}`);
    }
    if (column.comment.trim() !== '') {
      items.push(`comment = ${rustString(column.comment)}`);
    }

    formatAttribute(body, fieldIndent, items);
    body.push(
      `${fieldIndent}pub ${field}: ${isNullable(column) ? `Option<${type}>` : type},`
    );
  });

  naming.relations.forEach(relation => {
    formatAttribute(
      body,
      fieldIndent,
      relationItems(state, context, naming, relation)
    );
    body.push(
      `${fieldIndent}pub ${relation.field}: ${relationType(relation)},`
    );
  });

  const derives = types.some(({ isFloat }) => isFloat)
    ? 'Clone, Debug, PartialEq, DeriveEntityModel'
    : 'Clone, Debug, PartialEq, Eq, DeriveEntityModel';

  buffer.push(
    `${indent}use sea_orm::entity::prelude::*;`,
    '',
    `${indent}#[sea_orm::model]`,
    `${indent}#[derive(${derives})]`
  );
  formatAttribute(buffer, indent, tableItems(state, table));

  if (body.length === 0) {
    buffer.push(`${indent}pub struct Model {}`);
  } else {
    buffer.push(`${indent}pub struct Model {`, ...body, `${indent}}`);
  }
  buffer.push('', `${indent}impl ActiveModelBehavior for ActiveModel {}`);
}

function tableItems(state: RootState, table: Table): string[] {
  const items: string[] = [];
  const [schema, name] = sqlTableName(state, table.name);

  if (schema !== null) {
    items.push(`schema_name = ${rustString(schema)}`);
  }
  items.push(`table_name = ${rustString(name)}`);

  if (table.comment.trim() !== '') {
    items.push(`comment = ${rustString(table.comment)}`);
  }
  return items;
}

function relationItems(
  state: RootState,
  context: EntityContext,
  naming: EntityNaming,
  { kind, resolved, variant, isExplicit }: RelationField
): string[] {
  const reverse = resolved.isSelf
    ? naming.relations.find(
        relation => relation.resolved === resolved && relation.kind !== kind
      )
    : undefined;
  const items: string[] = reverse
    ? [
        'self_ref',
        `relation_enum = "${variant}"`,
        `relation_reverse = "${reverse.variant}"`,
      ]
    : [kind, ...(isExplicit ? [`relation_enum = "${variant}"`] : [])];

  if (kind !== 'belongs_to') {
    if (!reverse && resolved.isNamed) {
      const child = getNaming(state, context, resolved.endTable).relations.find(
        relation =>
          relation.resolved === resolved && relation.kind === 'belongs_to'
      ) as RelationField;
      items.push(`via_rel = "${child.variant}"`);
    }
    return items;
  }

  const { database } = state.settings;
  const support = referentialActionSupport(database);
  const { onDelete, onUpdate } = resolved.relationship;
  const fieldsOf = (table: Table, columns: Column[]) => {
    const { fields } = getNaming(state, context, table);
    const names = columns.map(column => fields.get(column.id));
    return names.length === 1 ? names[0] : `(${names.join(', ')})`;
  };

  items.push(
    `from = "${fieldsOf(resolved.endTable, resolved.end)}"`,
    `to = "${fieldsOf(resolved.startTable, resolved.start)}"`
  );
  if (support.onUpdate.includes(onUpdate)) {
    items.push(`on_update = "${REFERENTIAL_ACTION_NAMES[onUpdate]}"`);
  }
  if (support.onDelete.includes(onDelete)) {
    items.push(`on_delete = "${REFERENTIAL_ACTION_NAMES[onDelete]}"`);
  }
  return items;
}

function relationType({ kind, target, isOptional }: RelationField): string {
  switch (kind) {
    case 'belongs_to':
      return `BelongsTo<${isOptional ? `Option<${target}>` : target}>`;
    case 'has_one':
      return `HasOne<${target}>`;
    default:
      return `HasMany<${target}>`;
  }
}

/** An attribute on one line where rustfmt keeps it there, else an item a line. */
function formatAttribute(buffer: string[], indent: string, items: string[]) {
  if (items.length === 0) {
    return;
  }

  const line = `${indent}#[sea_orm(${items.join(', ')})]`;
  const fits =
    items.length === 1
      ? width(line) < LINE_WIDTH
      : width(items.join(', ')) <= ATTRIBUTE_ITEMS_WIDTH;

  if (fits) {
    buffer.push(line);
    return;
  }

  buffer.push(`${indent}#[sea_orm(`);
  items.forEach((item, index) => {
    const comma = index === items.length - 1 ? '' : ',';
    buffer.push(`${indent}${INDENT}${item}${comma}`);
  });
  buffer.push(`${indent})]`);
}

function width(text: string): number {
  return Array.from(text).length;
}

function createEntityContext(state: RootState): EntityContext {
  const context: EntityContext = {
    tables: query(state.collections)
      .collection('tableEntities')
      .selectByIds(state.doc.tableIds)
      .sort(orderByNameASC),
    modules: new Map(),
    moduleNames: new Set(),
    relationships: resolveRelationships(state),
    namings: new Map(),
  };

  context.tables.forEach(table => getModule(context, table));
  return context;
}

function resolveRelationships(state: RootState): ResolvedRelationship[] {
  const resolved = query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds)
    .flatMap(relationship => {
      const pairs = toForeignKeyPairs(state, relationship);

      return pairs
        ? [
            {
              relationship,
              ...pairs,
              isSelf: pairs.startTable.id === pairs.endTable.id,
              isNamed: false,
            },
          ]
        : [];
    });
  const counts = new Map<string, number>();

  resolved.forEach(({ relationship }) => {
    const key = pairKey(relationship);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  resolved.forEach(item => {
    item.isNamed =
      item.isSelf || (counts.get(pairKey(item.relationship)) as number) > 1;
  });

  return resolved;
}

function pairKey({ start, end }: Relationship): string {
  return [start.tableId, end.tableId].sort().join(':');
}

/** A table's module, numbered in name order; a table outside the document last. */
function getModule(context: EntityContext, table: Table): EntityModule {
  const cached = context.modules.get(table.id);

  if (cached) {
    return cached;
  }

  const base = rustBase(table.name, 'table');
  const first = fieldName(base);
  const name = claimName(
    base,
    first,
    candidate => !context.moduleNames.has(candidate)
  );
  const entityModule = { name, base: name === first ? base : name };

  context.moduleNames.add(name);
  context.modules.set(table.id, entityModule);
  return entityModule;
}

function getNaming(
  state: RootState,
  context: EntityContext,
  table: Table
): EntityNaming {
  const cached = context.namings.get(table.id);

  if (cached) {
    return cached;
  }

  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const uniqueIndexes = uniqueIndexColumns(state, table);
  const isSingleKey = columns.filter(isPrimaryKey).length === 1;
  const uniqueIds = new Set(
    columns
      .filter(
        column =>
          bHas(column.options, ColumnOption.unique) &&
          !(
            isSingleKey &&
            isPrimaryKey(column) &&
            foldsKeyUnique(state, column)
          )
      )
      .map(column => column.id)
  );
  const composites = uniqueIndexes.filter(
    ({ columnIds }) => columnIds.length > 1
  );
  const keyedIds = new Set(composites.flatMap(({ columnIds }) => columnIds));

  uniqueIndexes
    .filter(({ columnIds }) => columnIds.length === 1)
    .forEach(({ columnIds }) => uniqueIds.add(columnIds[0]));

  const used = new Set<string>();
  const variants = new Set<string>();
  const fields = new Map<string, string>();

  columns.forEach(column => {
    const base = rustBase(column.name, 'column');
    const isUnique = uniqueIds.has(column.id) || keyedIds.has(column.id);
    const isKey = isPrimaryKey(column);
    // rustc refuses Column::Self, which find_by_ on a unique field names, and a
    // key variant Column, beside which PrimaryKey's Self::Column is ambiguous.
    const field = claimName(
      base,
      fieldName(base),
      candidate =>
        !used.has(candidate) &&
        !variants.has(columnVariant(candidate)) &&
        !(isUnique && toUpperCamelCase(candidate) === 'Self') &&
        !(isKey && toUpperCamelCase(candidate) === 'Column') &&
        !SHADOWING_FIELDS.has(candidate)
    );

    used.add(field);
    variants.add(columnVariant(field));
    fields.set(column.id, field);
  });

  const naming: EntityNaming = {
    fields,
    uniqueIds,
    uniqueKeys: uniqueKeyNames(columns, composites, fields, uniqueIds),
    relations: [],
  };

  context.namings.set(table.id, naming);
  naming.relations = relationFields(context, table, used);
  return naming;
}

type UniqueIndexColumns = { name: string; columnIds: string[] };

/** Each UNIQUE index of a table as the columns it keeps, in document order. */
function uniqueIndexColumns(
  { doc: { indexIds }, collections }: RootState,
  table: Table
): UniqueIndexColumns[] {
  const indexColumnCollection = query(collections).collection(
    'indexColumnEntities'
  );

  return query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id && index.unique)
    .map(index => ({
      name: index.name,
      columnIds: indexColumnCollection
        .selectByIds(index.indexColumnIds)
        .map(indexColumn => indexColumn.columnId)
        .filter(columnId => table.columnIds.includes(columnId)),
    }))
    .filter(({ columnIds }) => columnIds.length > 0);
}

/**
 * A unique_key name for the columns of each composite UNIQUE index, one sharing
 * a column with an earlier one left out, since a field keeps only its last key.
 */
function uniqueKeyNames(
  columns: Column[],
  composites: UniqueIndexColumns[],
  fields: Map<string, string>,
  uniqueIds: Set<string>
): Map<string, string> {
  const keys = new Map<string, string>();
  const names = new Set(
    columns
      .filter(column => uniqueIds.has(column.id))
      .map(column => fields.get(column.id) as string)
  );

  composites.forEach(({ name, columnIds }) => {
    if (columnIds.some(columnId => keys.has(columnId))) {
      return;
    }

    // A keyword field ends in an underscore, which rustBase folds away again.
    const base = rustBase(
      name.trim() === ''
        ? columnIds.map(columnId => fields.get(columnId)).join('_')
        : name,
      'unique'
    );
    // A key named id would derive a find_by_id hiding EntityTrait's.
    const key = claimName(
      base,
      fieldName(base),
      candidate => candidate !== 'id' && !names.has(candidate)
    );

    names.add(key);
    columnIds.forEach(columnId => keys.set(columnId, key));
  });

  return keys;
}

/**
 * A table's relation fields, those to its parents first, each named apart from
 * its fields and from the setters the macro derives, set_x_option among them.
 */
function relationFields(
  context: EntityContext,
  table: Table,
  used: Set<string>
): RelationField[] {
  const reserved = new Set<string>();
  const relations: RelationField[] = [];
  const claim = (base: string, isOptional: boolean): string => {
    const field = claimName(base, toRustIdentifier(base), candidate => {
      const plain = candidate.replace(RAW_PREFIX, '');
      const setter = `${plain}_option`;

      return (
        !used.has(plain) &&
        !reserved.has(plain) &&
        !SHADOWING_FIELDS.has(plain) &&
        !(isOptional && (used.has(setter) || reserved.has(setter)))
      );
    });
    const plain = field.replace(RAW_PREFIX, '');

    used.add(plain);
    if (isOptional) {
      reserved.add(`${plain}_option`);
    }
    return field;
  };
  const push = (
    kind: RelationKind,
    resolved: ResolvedRelationship,
    other: Table,
    base: string,
    isOptional: boolean
  ) => {
    relations.push({
      kind,
      resolved,
      field: claim(base, isOptional || kind === 'has_one'),
      target: resolved.isSelf
        ? 'Entity'
        : `super::${getModule(context, other).name}::Entity`,
      isOptional,
      variant: '',
      isExplicit: false,
    });
  };

  context.relationships
    .filter(({ endTable }) => endTable.id === table.id)
    .forEach(resolved => {
      const parent = getModule(context, resolved.startTable);
      const stem = resolved.isNamed ? foreignKeyStem(resolved) : null;
      const base =
        stem ?? (resolved.isSelf ? `parent_${parent.base}` : parent.base);

      push(
        'belongs_to',
        resolved,
        resolved.startTable,
        base,
        resolved.end.some(isNullable)
      );
    });
  context.relationships
    .filter(({ startTable }) => startTable.id === table.id)
    .forEach(resolved => {
      const child = getModule(context, resolved.endTable).base;
      // SeaORM takes a has_one only where the related entity appears once.
      const isOne =
        !resolved.isNamed &&
        hasOneRelationship(resolved.relationship.relationshipType);
      const stem = resolved.isNamed ? foreignKeyStem(resolved) : null;
      // Ending in _list, a HasMany's add_ setter keeps its name in the singular.
      const base = isOne
        ? child
        : stem === null
          ? `${child}_list`
          : `${child}_by_${stem}_list`;

      push(
        isOne ? 'has_one' : 'has_many',
        resolved,
        resolved.endTable,
        base,
        false
      );
    });

  nameVariants(context, table, relations);
  return relations;
}

/**
 * Each relation's Relation variant: the one the macro infers from its target
 * module, or one from its field where several share a target, numbered apart.
 */
function nameVariants(
  context: EntityContext,
  table: Table,
  relations: RelationField[]
) {
  const taken = new Set<string>();

  relations.forEach(relation => {
    const target = relation.resolved.isSelf
      ? table
      : relation.kind === 'belongs_to'
        ? relation.resolved.startTable
        : relation.resolved.endTable;
    const inferred = toUpperCamelCase(getModule(context, target).name);
    const wanted = relation.resolved.isNamed
      ? stableUpperCamelCase(relation.field.replace(RAW_PREFIX, ''))
      : inferred;
    const stable = stableUpperCamelCase(wanted);
    let variant = wanted;

    for (let n = 2; taken.has(variant) || variant === 'Self'; n++) {
      variant = `${stable}${n}`;
    }

    taken.add(variant);
    relation.variant = variant;
    relation.isExplicit = relation.resolved.isNamed || variant !== inferred;
  });
}

/** The single foreign key column's name before its id word, as a field base. */
function foreignKeyStem({ end }: ResolvedRelationship): string | null {
  const stem = end.length === 1 ? stripIdWord(end[0].name) : null;

  return stem === null || toSnakeCase(stem.normalize('NFC')) === ''
    ? null
    : rustBase(stem, 'column');
}

/** The first of first, base_2, base_3 that isFree takes. */
function claimName(
  base: string,
  first: string,
  isFree: (name: string) => boolean
): string {
  let name = first;

  for (let n = 2; !isFree(name); n++) {
    name = `${base}_${n}`;
  }
  return name;
}

/**
 * A snake_case name heck reads back as itself and rustc takes, or fallback
 * before it where the macros would build no identifier from it.
 */
function rustBase(name: string, fallback: string): string {
  // A character no identifier holds parts words as a space does, so it leaves
  // no run of underscores, which the derived setters would warn on.
  const base = toSnakeCase(
    name.normalize('NFC').replace(NON_XID_CONTINUE, ' ')
  ).replace(NON_XID_CONTINUE, '_');
  const first = Array.from(base)[0];
  const head = Array.from(toUpperCamelCase(base))[0];

  // U+0345 continues an identifier but cannot open one, though its capital can.
  if (
    first !== undefined &&
    head !== undefined &&
    XID_START.test(first) &&
    XID_START.test(head)
  ) {
    return base;
  }

  const rest = base.replace(LEADING_UNDERSCORES, '');
  return rest === '' ? fallback : `${fallback}_${rest}`;
}

/** A column field or module name, a keyword with an underscore after it. */
function fieldName(base: string): string {
  return toRustIdentifier(base) === base ? base : `${base}_`;
}

/** The Column variant DeriveEntityModel derives for a field. */
function columnVariant(field: string): string {
  const variant = toUpperCamelCase(field);
  return variant === 'Self' ? 'Self_' : variant;
}

/** The column name DeriveEntityModel gives a field it reads without column_name. */
export function derivedColumnName(field: string): string {
  return field === toSnakeCase(toUpperCamelCase(field))
    ? field
    : toSnakeCase(field);
}

/** UpperCamelCase applied until it stops changing: aBC gives ABc, then ABc. */
export function stableUpperCamelCase(value: string): string {
  let current = toUpperCamelCase(value);

  for (
    let next = toUpperCamelCase(current);
    next !== current;
    next = toUpperCamelCase(current)
  ) {
    current = next;
  }
  return current;
}

/**
 * A table name as its database stores it: where names are unquoted, its last
 * part the table and the one before it the schema, PostgreSQL folding each.
 */
function sqlTableName(
  state: RootState,
  name: string
): [schema: string | null, table: string] {
  if (state.settings.bracketType !== BracketType.none) {
    return [null, name];
  }

  const parts = splitNameParts(name);
  const table = sqlNamePart(state, parts[parts.length - 1]);

  return parts.length > 1
    ? [sqlNamePart(state, parts[parts.length - 2]), table]
    : [null, table];
}

/** A name as its database stores it, where the document writes it unquoted. */
function sqlNamePart(state: RootState, part: string): string {
  const { bracketType, database } = state.settings;

  if (bracketType !== BracketType.none) {
    return part;
  }

  const backticked = BACKTICK_DATABASES.has(database)
    ? BACKTICKED.exec(part)
    : null;

  if (backticked) {
    return backticked[1].replaceAll('``', '`');
  }
  if (isDelimitedPart(part)) {
    return unquoteNamePart(part);
  }
  return database === Database.PostgreSQL
    ? part.replace(ASCII_CAPITALS, letters => letters.toLowerCase())
    : part;
}

/** A Rust string literal rustc takes for any text. */
export function rustString(value: string): string {
  let literal = '"';

  for (const char of value) {
    const code = char.codePointAt(0) as number;

    if (char === '\\' || char === '"') {
      literal += `\\${char}`;
    } else if (char === '\n') {
      literal += '\\n';
    } else if (char === '\r') {
      literal += '\\r';
    } else if (char === '\t') {
      literal += '\\t';
    } else if (
      code < 0x20 ||
      code === 0x7f ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      literal += `\\u{${code.toString(16).toUpperCase().padStart(4, '0')}}`;
    } else {
      literal += char;
    }
  }
  return `${literal}"`;
}

function isPrimaryKey({ options }: Column): boolean {
  return bHas(options, ColumnOption.primaryKey);
}

/**
 * Whether the database keeps no index of its own for a UNIQUE on a table's only
 * key column: PostgreSQL, and SQLite on a key it does not make its rowid.
 */
function foldsKeyUnique(
  { settings: { database } }: RootState,
  column: Column
): boolean {
  return (
    database === Database.PostgreSQL ||
    (database === Database.SQLite && !isSqliteRowid(column))
  );
}

// SQLite makes a table's only key column its rowid where it is written INTEGER,
// as the editor's DDL writes an integer key with AUTOINCREMENT.
function isSqliteRowid({ dataType, options }: Column): boolean {
  return (
    dataType.trim().toUpperCase() === 'INTEGER' ||
    (bHas(options, ColumnOption.autoIncrement) && isIntegerFamily(dataType))
  );
}

// A primary key takes no NULL, its flag set or not, as the other ORMs read it.
function isNullable(column: Column): boolean {
  return !isPrimaryKey(column) && !bHas(column.options, ColumnOption.notNull);
}

/** The field type, column_type, select_as and save_as an entity writes. */
export function getEntityColumnType(
  dataType: string,
  database: number
): EntityColumnType {
  const columnType = getRustColumnType(dataType, database);
  const { entityScalar, arrayDepth, selectAs } = columnType;
  const type = PRELUDE_TYPES[entityScalar];
  const declared = dataType.trim();

  return {
    type: arrayDepth === 1 ? `Vec<${type}>` : type,
    columnType: seaormColumnType(declared, database, columnType),
    selectAs:
      database === Database.SQLite
        ? sqliteSelectAs(declared, entityScalar)
        : selectAs,
    saveAs: selectAs === null ? null : declared,
    isFloat: entityScalar === 'f32' || entityScalar === 'f64',
  };
}

/**
 * The type a SQLite column is read back as where its affinity may have stored
 * a number: SeaORM reads a Decimal through f64, and a Json or a String as text.
 */
function sqliteSelectAs(dataType: string, scalar: RustScalar): string | null {
  if (scalar === 'decimal') {
    return 'REAL';
  }
  return (scalar === 'json' || scalar === 'string') &&
    dataType !== '' &&
    NUMERIC_AFFINITIES.has(sqliteAffinity(dataType))
    ? 'TEXT'
    : null;
}

/**
 * The column_type that makes SeaORM's schema builder write the type the
 * editor's DDL writes, where the Rust type alone would give another one.
 */
function seaormColumnType(
  dataType: string,
  database: number,
  { scalar, base, args, arrayDepth, isUnsigned }: RustColumnType
): string | null {
  if (dataType === '') {
    return null;
  }

  switch (database) {
    case Database.PostgreSQL:
      return arrayDepth > 0 || !fitsU32(args)
        ? custom(dataType)
        : postgresColumnType(dataType, base, args);
    case Database.MySQL:
    case Database.MariaDB:
      // A native type would drop ZEROFILL, and UNSIGNED but on an integer.
      return ZEROFILL.test(dataType) ||
        (isUnsigned && !UNSIGNED_SCALARS.has(scalar)) ||
        !fitsU32(args)
        ? custom(dataType)
        : mysqlColumnType(dataType, base, args);
    case Database.SQLite:
      // A SQLite column keeps an affinity, not the name it was declared with.
      return sqliteAffinity(dataType) === sqliteAffinity(SQLITE_TYPES[scalar])
        ? null
        : custom(dataType);
    default:
      return null;
  }
}

function postgresColumnType(
  dataType: string,
  base: string,
  args: number[]
): string | null {
  if (
    POSTGRES_NATIVE_TYPES.has(base) &&
    (args.length === 0 || base === 'float')
  ) {
    return null;
  }
  if (DECIMAL_TYPES.has(base) && args.length > 0) {
    return decimalColumnType(args);
  }
  if (VARCHAR_TYPES.has(base) && args.length === 1) {
    return `String(StringLen::N(${args[0]}))`;
  }
  if ((CHAR_TYPES.has(base) || base === 'bpchar') && args.length === 1) {
    return `Char(Some(${args[0]}))`;
  }
  if (CHAR_TYPES.has(base) && args.length === 0) {
    return 'Char(None)';
  }

  const native = args.length === 0 ? POSTGRES_COLUMN_TYPES.get(base) : null;

  if (native) {
    return native;
  }
  if (base === 'bit' && args.length === 1) {
    return `Bit(Some(${args[0]}))`;
  }
  if ((base === 'varbit' || base === 'bit varying') && args.length === 1) {
    return `VarBit(${args[0]})`;
  }
  return custom(dataType);
}

function mysqlColumnType(
  dataType: string,
  base: string,
  args: number[]
): string | null {
  if (
    MYSQL_INTEGER_TYPES.has(base) ||
    (MYSQL_NATIVE_TYPES.has(base) && args.length === 0) ||
    (base === 'float' && args.length === 1)
  ) {
    return null;
  }
  if (DECIMAL_TYPES.has(base) && args.length > 0) {
    return decimalColumnType(args);
  }
  if (VARCHAR_TYPES.has(base) && args.length === 1) {
    return `String(StringLen::N(${args[0]}))`;
  }
  if (CHAR_TYPES.has(base) && args.length < 2) {
    return args.length === 1 ? `Char(Some(${args[0]}))` : 'Char(None)';
  }
  if (base === 'binary' && args.length < 2) {
    return `Binary(${args[0] ?? 1})`;
  }
  if (base === 'varbinary' && args.length === 1) {
    return `VarBinary(StringLen::N(${args[0]}))`;
  }
  if (base === 'text' && args.length === 0) {
    return 'Text';
  }
  if (base === 'blob' && args.length === 0) {
    return 'Blob';
  }
  if (base === 'year' || base === 'sql_tsi_year') {
    return 'Year';
  }
  if (base === 'bit' && args.length < 2) {
    return args.length === 1 ? `Bit(Some(${args[0]}))` : 'Bit(None)';
  }
  return custom(dataType);
}

function decimalColumnType([precision, scale = 0]: number[]): string {
  return `Decimal(Some((${precision}, ${scale})))`;
}

/** A native ColumnType takes its lengths and precisions as u32. */
function fitsU32(args: number[]): boolean {
  return args.every(arg => arg <= 0xffffffff);
}

function custom(dataType: string): string {
  return `custom(${rustString(dataType)})`;
}

/** SQLite's type affinity of a declared type, by the rules of its datatype page. */
function sqliteAffinity(dataType: string): string {
  const name = dataType.toUpperCase();

  if (name.includes('INT')) {
    return 'INTEGER';
  }
  if (name.includes('CHAR') || name.includes('CLOB') || name.includes('TEXT')) {
    return 'TEXT';
  }
  if (name.includes('BLOB')) {
    return 'BLOB';
  }
  if (name.includes('REAL') || name.includes('FLOA') || name.includes('DOUB')) {
    return 'REAL';
  }
  return 'NUMERIC';
}
