import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, ColumnUIKey, Database } from '@/constants/schema';
import { isSingleWord } from '@/engine/modules/relationship/fkColumns';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  ColumnScalar,
  ColumnType,
  getColumnType,
  isMySQLFamily,
} from './columnTypes';
import {
  FormatRelationOptions,
  FormatTableOptions,
  getNameCase,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

/**
 * The scalars a document declares when a field uses them, each by the name
 * graphql-scalars gives it, but Decimal, which it has none of.
 */
const CUSTOM_SCALARS = [
  'BigInt',
  'Byte',
  'Date',
  'DateTime',
  'Decimal',
  'JSON',
] as const;

type CustomScalar = (typeof CUSTOM_SCALARS)[number];
type FieldScalar = 'Boolean' | 'Float' | 'Int' | 'String' | CustomScalar;

const BUILT_IN_TYPES = ['Boolean', 'Float', 'ID', 'Int', 'String'];

// Int is 32 bits, which a BIGINT or an INT UNSIGNED overflows. A time of day
// and an interval stay String: graphql-scalars' Time refuses the 12:34:56 the
// drivers hand over, and its Duration the interval object node-postgres builds.
const scalarTypes: Readonly<Record<ColumnScalar, FieldScalar>> = {
  bool: 'Boolean',
  i8: 'Int',
  i16: 'Int',
  i32: 'Int',
  i64: 'BigInt',
  u8: 'Int',
  u16: 'Int',
  u32: 'BigInt',
  u64: 'BigInt',
  f32: 'Float',
  f64: 'Float',
  decimal: 'Decimal',
  string: 'String',
  bytes: 'Byte',
  uuid: 'String',
  json: 'JSON',
  date: 'Date',
  time: 'String',
  timeTz: 'String',
  dateTime: 'DateTime',
  dateTimeUtc: 'DateTime',
  dateTimeOffset: 'DateTime',
  interval: 'String',
};

/** The most digits a NUMBER(p) or NUMBER(p,s) can fill that an Int holds. */
const INT_DIGITS = 9;

/**
 * The PostgreSQL types whose arrays node-postgres parses, under each name the
 * classifier reads them by; it hands over any other array, a bit string's, an
 * enum's and a range's but numrange's among them, as text a list refuses.
 */
const PARSED_ARRAY_TYPES: ReadonlySet<string> = new Set([
  'bool',
  'boolean',
  'bytea',
  'int2',
  'smallint',
  'int4',
  'int',
  'integer',
  'int8',
  'bigint',
  'oid',
  'float4',
  'real',
  'float8',
  'float',
  'double precision',
  'numeric',
  'decimal',
  'dec',
  'money',
  'bpchar',
  'char',
  'character',
  'nchar',
  'national char',
  'national character',
  'varchar',
  'char varying',
  'character varying',
  'nchar varying',
  'national char varying',
  'national character varying',
  'text',
  'regproc',
  'uuid',
  'macaddr',
  'inet',
  'cidr',
  'numrange',
  'date',
  'time',
  'time without time zone',
  'timetz',
  'time with time zone',
  'timestamp',
  'timestamp without time zone',
  'timestamptz',
  'timestamp with time zone',
  'json',
  'jsonb',
  'point',
]);

// A Name is /[_A-Za-z][_0-9A-Za-z]*/, so anything else -- Hangul, a space, a
// leading digit, the empty name a new table carries -- is a syntax error rather
// than an odd-looking name, and getNameCase leaves all of them untouched.
const NON_NAME = /[^_0-9A-Za-z]/g;
const NAME_START = /^[_A-Za-z]/;
const FALLBACK_NAME = '_';

/** GraphQL reserves a Name opening with two underscores for introspection. */
const LEADING_UNDERSCORES = /^_+/;
const LEADING_RUN = /^__/;

// A name in a non-ASCII script sanitizes to nothing but underscores, so the
// exported name carries none of what the user typed. The description is the
// only field that reaches a consumer, so it takes the original.
const NAME_INFORMATIVE = /[0-9A-Za-z]/;

// # is an Ignored token: it never reaches the AST, so a comment written as
// one is invisible to every consumer. A description is the form that survives,
// and the block string is the only spelling of it that tolerates a newline.
const BLOCK_STRING = /"""/g;
const NEWLINE = /\r\n|\r|\n/g;

/** A string holds Unicode scalar values only, so half a pair fails the parse. */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const REPLACEMENT_CHARACTER = '\uFFFD';
const TYPE_WRAPPERS = /[[\]!]/g;

const ID_SUFFIX = /id$/i;
const TRAILING_SEPARATORS = /[^\p{L}\p{M}\p{N}]+$/u;
/** The last letter of a name, read past the marks and digits after it. */
const LAST_LETTER = /\p{L}(?=[\p{M}\p{N}]*$)/u;

type TypeContext = {
  typeNames: Map<string, string>;
  usedTypeNames: Set<string>;
  /** Pairs of tables more than one relationship joins, either way round. */
  sharedPairs: Set<string>;
  /** The custom scalars the fields of every table use. */
  scalars: CustomScalar[];
};

type ColumnField = {
  column: Column;
  name: string;
  type: string;
};

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);
  const context = createTypeContext(state);

  pushScalars(stringBuffer, context.scalars);
  tables.forEach(table => {
    formatType(state, { buffer: stringBuffer, table }, context);
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  // The standalone entry has no document-wide view of its own, so it builds the
  // same context createCode does -- a type name is only unique against every
  // other table's -- and declares the scalars of its own fields alone.
  pushScalars(buffer, usedScalars(getColumnFields(state, table)));
  formatType(state, { buffer, table }, createTypeContext(state));
}

function formatType(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: TypeContext
) {
  const {
    settings: { tableNameCase },
  } = state;
  const typeName = getTypeName(state, context, table);
  const bodyBuffer: string[] = [];
  const fields = getColumnFields(state, table);
  const fieldNames = new Set(fields.map(({ name }) => name));

  // Judged on the sanitized name, never on typeName -- the digit uniqueName
  // appends to a collision would read as information the name does not carry.
  pushDescription(
    buffer,
    '',
    describe(
      table.name,
      graphqlName(getNameCase(table.name, tableNameCase)),
      table.comment
    )
  );

  fields.forEach(({ column, name, type }) => {
    pushDescription(
      bodyBuffer,
      '  ',
      describe(column.name, name, column.comment)
    );
    bodyBuffer.push(`  ${name}: ${type}`);
  });
  formatRelation(state, { buffer: bodyBuffer, table }, context, fieldNames);

  // FieldsDefinition is { FieldDefinition+ }, so an empty pair of braces does
  // not parse; a braceless type does and builds, though a server refuses an
  // object type with no field until the table gets one.
  if (bodyBuffer.length === 0) {
    buffer.push(`type ${typeName}`);
    return;
  }

  buffer.push(`type ${typeName} {`);
  bodyBuffer.forEach(line => buffer.push(line));
  buffer.push('}');
}

/**
 * The fields a table's columns give, in column order: a foreign key that is
 * not part of the key leaves its field to the relationship it belongs to.
 */
function getColumnFields(
  { collections, settings: { columnNameCase, database } }: RootState,
  table: Table
): ColumnField[] {
  const fieldNames = new Set<string>();
  const fields: ColumnField[] = [];

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      const isPK = bHas(column.ui.keys, ColumnUIKey.primaryKey);
      const isFK = bHas(column.ui.keys, ColumnUIKey.foreignKey);

      if (!isPK && isFK) {
        return;
      }

      const name = graphqlName(getNameCase(column.name, columnNameCase));

      // Column names are not unique per table and the case transform folds
      // more of them together, but a field name is unique per type.
      if (fieldNames.has(name)) {
        return;
      }
      fieldNames.add(name);
      fields.push({ column, name, type: getFieldType(column, isFK, database) });
    });

  return fields;
}

// A primary key is NOT NULL whatever its flag says, as the other generators
// read it.
function getFieldType(column: Column, isFK: boolean, database: number): string {
  const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
  const nonNull =
    isPrimaryKey || bHas(column.options, ColumnOption.notNull) ? '!' : '';

  if (isPrimaryKey || isFK) {
    return `ID${nonNull}`;
  }
  return `${getDataType(column.dataType, database)}${nonNull}`;
}

/** A column's type, one list per dimension of a PostgreSQL array. */
function getDataType(dataType: string, database: number): string {
  const columnType = getColumnType(dataType, database);
  const { arrayDepth, base, scalar } = columnType;

  // An interval of any fields is one type to node-postgres, which parses its
  // array, though into objects that a String item refuses.
  if (
    arrayDepth > 0 &&
    scalar !== 'interval' &&
    !PARSED_ARRAY_TYPES.has(base)
  ) {
    return 'String';
  }

  return `${'['.repeat(arrayDepth)}${getScalar(columnType, database)}${']'.repeat(arrayDepth)}`;
}

function getScalar(columnType: ColumnType, database: number): FieldScalar {
  const { scalar, base, bits, isMoney } = columnType;

  // node-postgres reads money as the session's currency text, $1,234.56.
  if (isMoney && database === Database.PostgreSQL) {
    return 'String';
  }
  if (
    base === 'number' &&
    scalar === 'i64' &&
    (database === Database.Oracle || database === Database.Snowflake)
  ) {
    return getNumberScalar(columnType, database);
  }
  // A MySQL BIT or BIT(1) stays an Int, as a TINYINT(1) does: mysql2 hands it
  // over as a Buffer, which Boolean refuses as Int does, and the true the
  // mariadb connector hands over an Int writes as 1.
  if (scalar === 'bool' && base === 'bit' && isMySQLFamily(database)) {
    return 'Int';
  }
  // MEDIUMINT UNSIGNED stops at 16777215, which an Int holds.
  return bits === 24 ? 'Int' : scalarTypes[scalar];
}

/**
 * An Oracle or Snowflake NUMBER of no fraction by its digits, a negative scale
 * adding zeros before the point. Oracle's bare NUMBER and NUMBER(*) keep any
 * scale; Snowflake's is a NUMBER(38,0), its DECIMAL left to the vendor list.
 */
function getNumberScalar(
  { args, precision, scale }: ColumnType,
  database: number
): FieldScalar {
  if (database === Database.Oracle && args.length === 0 && scale === null) {
    return 'Decimal';
  }
  if (precision === null) {
    return 'BigInt';
  }
  return precision - Math.min(scale ?? 0, 0) <= INT_DIGITS ? 'Int' : 'BigInt';
}

function formatRelation(
  state: RootState,
  { buffer, table }: FormatRelationOptions,
  context: TypeContext,
  fieldNames: Set<string>
) {
  const {
    doc: { relationshipIds },
    collections,
    settings: { columnNameCase },
  } = state;
  const tableCollection = query(collections).collection('tableEntities');
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);
  const tableNamedFields = new Set<string>();

  // The description is the related table's, so it is judged on that table's
  // name alone -- the List suffix and the by part are ours, and would make an
  // all-underscore name look informative.
  const pushField = (
    relationship: Relationship,
    relatedTable: Table,
    fieldName: string,
    fieldType: string
  ) => {
    // Outside the foreign key rule, two relation fields named after one table
    // keep only the first, which the owner kept for those documents. Any other
    // taken name takes a digit, since a dropped field drops its relationship.
    if (!isNamedByForeignKey(context, relationship)) {
      if (tableNamedFields.has(fieldName)) {
        return;
      }
      tableNamedFields.add(fieldName);
    }

    const name = uniqueName(fieldNames, fieldName);

    pushDescription(
      buffer,
      '  ',
      describe(
        relatedTable.name,
        graphqlName(getNameCase(relatedTable.name, columnNameCase)),
        relatedTable.comment
      )
    );
    buffer.push(`  ${name}: ${fieldType}`);
  };

  relationships
    .filter(relationship => relationship.end.tableId === table.id)
    .forEach(relationship => {
      const startTable = tableCollection.selectById(relationship.start.tableId);

      if (startTable) {
        pushField(
          relationship,
          startTable,
          getChildFieldName(state, context, relationship, startTable),
          getTypeName(state, context, startTable)
        );
      }
    });

  relationships
    .filter(relationship => relationship.start.tableId === table.id)
    .forEach(relationship => {
      const endTable = tableCollection.selectById(relationship.end.tableId);

      if (!endTable) {
        return;
      }

      const typeName = getTypeName(state, context, endTable);

      if (hasOneRelationship(relationship.relationshipType)) {
        pushField(
          relationship,
          endTable,
          getParentFieldName(state, context, relationship, endTable, false),
          typeName
        );
      } else if (hasNRelationship(relationship.relationshipType)) {
        pushField(
          relationship,
          endTable,
          getParentFieldName(state, context, relationship, endTable, true),
          `[${typeName}!]!`
        );
      }
    });
}

/**
 * The field the child type points at its parent through: the parent's name,
 * or the foreign key column without its id where getRelationStem finds one;
 * a self relationship, which it always checks, takes parent before the name.
 */
function getChildFieldName(
  state: RootState,
  context: TypeContext,
  relationship: Relationship,
  parent: Table
): string {
  const { columnNameCase } = state.settings;
  const name = getNameCase(parent.name, columnNameCase);
  const stem = getRelationStem(state, context, relationship);

  if (stem !== null) {
    return graphqlName(stem);
  }

  return graphqlName(
    isSelfRelationship(relationship)
      ? getNameCase(`parent_${name}`, columnNameCase)
      : name
  );
}

/**
 * The field the parent type lists its children through: the child's name,
 * with List on the N side, and by and the foreign key stem after it where
 * getRelationStem finds one.
 */
function getParentFieldName(
  state: RootState,
  context: TypeContext,
  relationship: Relationship,
  child: Table,
  many: boolean
): string {
  const { columnNameCase } = state.settings;
  const name = getNameCase(child.name, columnNameCase);
  const stem = getRelationStem(state, context, relationship);

  if (stem !== null) {
    return graphqlName(
      getNameCase(
        many ? `${name}List_by_${stem}` : `${name}_by_${stem}`,
        columnNameCase
      )
    );
  }

  return many
    ? graphqlName(getNameCase(`${name}List`, columnNameCase))
    : graphqlName(name);
}

/** The foreign key stem both fields take, where isNamedByForeignKey holds. */
function getRelationStem(
  state: RootState,
  context: TypeContext,
  relationship: Relationship
): string | null {
  return isNamedByForeignKey(context, relationship)
    ? getForeignKeyStem(state, relationship)
    : null;
}

// Two relationships between one pair of tables, or one back to its own table,
// would give their fields one name, so those take the foreign key's -- the
// same condition drizzle.ts writes relationName under.
function isNamedByForeignKey(
  { sharedPairs }: TypeContext,
  relationship: Relationship
): boolean {
  return (
    isSelfRelationship(relationship) || sharedPairs.has(pairKey(relationship))
  );
}

function isSelfRelationship({ start, end }: Relationship): boolean {
  return start.tableId === end.tableId;
}

function pairKey({ start, end }: Relationship): string {
  return [start.tableId, end.tableId].sort().join(':');
}

function findSharedPairs({
  collections,
  doc: { relationshipIds },
}: RootState): Set<string> {
  const pairs = new Set<string>();
  const sharedPairs = new Set<string>();

  query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .forEach(relationship => {
      const key = pairKey(relationship);

      if (pairs.has(key)) {
        sharedPairs.add(key);
      }
      pairs.add(key);
    });

  return sharedPairs;
}

/**
 * The single foreign key column's name without a last word id, in the column
 * name case: buyer for buyer_id. Null for a composite key, a name with no such
 * word, or a stem whose Name keeps no letter or digit or opens with __.
 */
function getForeignKeyStem(
  { collections, settings: { columnNameCase } }: RootState,
  relationship: Relationship
): string | null {
  const { columnIds } = relationship.end;

  if (columnIds.length !== 1) {
    return null;
  }

  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(columnIds[0]);
  const stem = column ? stripIdWord(column.name) : null;

  if (stem === null) {
    return null;
  }

  // A stem in a non-ASCII script sanitizes to underscores alone, which tells
  // two keys apart no better than the table's name, and one that sanitizes to
  // a run of them first, as 회원No does, loses its start to a single one.
  const name = getNameCase(stem, columnNameCase);
  return NAME_INFORMATIVE.test(name) && !LEADING_RUN.test(sanitizeName(name))
    ? name
    : null;
}

/**
 * The name before a last word id, in any case, the separator before it
 * dropped, words split as isSingleWord splits them; null where id is not a
 * word of its own, or is the only one.
 */
export function stripIdWord(name: string): string | null {
  const id = name.slice(-2);

  if (!ID_SUFFIX.test(name) || !isSingleWord(id)) {
    return null;
  }

  const head = name.slice(0, -2);
  const stem = head.replace(TRAILING_SEPARATORS, '');

  if (stem === '') {
    return null;
  }

  if (stem !== head) {
    return stem;
  }

  // With no separator, id is a word of its own only where a case or script
  // break meets its first letter, as in sellerId, OwnerID and 회원ID.
  const letter = LAST_LETTER.exec(head)?.[0];
  return letter !== undefined && !isSingleWord(`${letter}${id}`) ? head : null;
}

function createTypeContext(state: RootState): TypeContext {
  const tables = query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds)
    .sort(orderByNameASC);
  const scalars = usedScalars(
    tables.flatMap(table => getColumnFields(state, table))
  );
  // A table named after a scalar the document uses would define that name a
  // second time, which buildSchema refuses, or shadow a built-in one.
  const context: TypeContext = {
    typeNames: new Map<string, string>(),
    usedTypeNames: new Set<string>([...BUILT_IN_TYPES, ...scalars]),
    sharedPairs: findSharedPairs(state),
    scalars,
  };

  tables.forEach(table => getTypeName(state, context, table));

  return context;
}

/** The custom scalars the fields name, in the order the output declares them. */
function usedScalars(fields: ColumnField[]): CustomScalar[] {
  const named = new Set(
    fields.map(({ type }) => type.replace(TYPE_WRAPPERS, ''))
  );
  return CUSTOM_SCALARS.filter(scalar => named.has(scalar));
}

function pushScalars(buffer: string[], scalars: CustomScalar[]) {
  if (scalars.length === 0) {
    return;
  }

  scalars.forEach(scalar => buffer.push(`scalar ${scalar}`));
  buffer.push('');
}

function getTypeName(
  { settings: { tableNameCase } }: RootState,
  context: TypeContext,
  table: Table
): string {
  const cached = context.typeNames.get(table.id);

  if (cached !== undefined) {
    return cached;
  }

  // The case transform is many-to-one -- user_profile and UserProfile both
  // fold to UserProfile -- and sanitizing folds far more together, so two
  // tables can reach the same type name.
  const typeName = uniqueName(
    context.usedTypeNames,
    graphqlName(getNameCase(table.name, tableNameCase))
  );
  context.typeNames.set(table.id, typeName);

  return typeName;
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

function describe(name: string, exported: string, comment: string): string {
  if (NAME_INFORMATIVE.test(exported)) {
    return comment;
  }

  return comment.trim() === '' ? name : `${name} - ${comment}`;
}

function graphqlName(name: string): string {
  return sanitizeName(name).replace(LEADING_UNDERSCORES, '_');
}

function sanitizeName(name: string): string {
  const value = name.replace(NON_NAME, '_');

  if (value === '') {
    return FALLBACK_NAME;
  }

  return NAME_START.test(value) ? value : `_${value}`;
}

function pushDescription(buffer: string[], indent: string, comment: string) {
  if (comment.trim() === '') {
    return;
  }

  const value = comment
    .replace(LONE_SURROGATE, REPLACEMENT_CHARACTER)
    .replace(BLOCK_STRING, '\\"""');

  // The closing delimiter fuses with a trailing quote or backslash, and the
  // single-line form cannot hold a newline at all.
  if (
    value.includes('\n') ||
    value.includes('\r') ||
    value.endsWith('"') ||
    value.endsWith('\\')
  ) {
    buffer.push(`${indent}"""`);
    value
      .split(NEWLINE)
      .forEach(line => buffer.push(line === '' ? '' : `${indent}${line}`));
    buffer.push(`${indent}"""`);
    return;
  }

  buffer.push(`${indent}"""${value}"""`);
}
