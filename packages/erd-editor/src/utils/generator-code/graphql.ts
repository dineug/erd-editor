import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { isSingleWord } from '@/engine/modules/relationship/fkColumns';
import { RootState } from '@/engine/state';
import { Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatColumnOptions,
  FormatRelationOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'Int',
  long: 'Int',
  float: 'Float',
  double: 'Float',
  decimal: 'Float',
  boolean: 'Boolean',
  string: 'String',
  lob: 'String',
  date: 'String',
  dateTime: 'String',
  time: 'String',
};

// A Name is /[_A-Za-z][_0-9A-Za-z]*/, so anything else -- Hangul, a space, a
// leading digit, the empty name a new table carries -- is a syntax error rather
// than an odd-looking name, and getNameCase leaves all of them untouched.
const NON_NAME = /[^_0-9A-Za-z]/g;
const NAME_START = /^[_A-Za-z]/;
const FALLBACK_NAME = '_';

// A name in a non-ASCII script sanitizes to nothing but underscores, so the
// exported name carries none of what the user typed. The description is the
// only field that reaches a consumer, so it takes the original.
const NAME_INFORMATIVE = /[0-9A-Za-z]/;

// # is an Ignored token: it never reaches the AST, so a comment written as
// one is invisible to every consumer. A description is the form that survives,
// and the block string is the only spelling of it that tolerates a newline.
const BLOCK_STRING = /"""/g;
const NEWLINE = /\r\n|\r|\n/g;

const ID_SUFFIX = /id$/i;
const TRAILING_SEPARATORS = /[^\p{L}\p{M}\p{N}]+$/u;
/** The last letter of a name, read past the marks and digits after it. */
const LAST_LETTER = /\p{L}(?=[\p{M}\p{N}]*$)/u;

type TypeContext = {
  typeNames: Map<string, string>;
  usedTypeNames: Set<string>;
  /** Pairs of tables more than one relationship joins, either way round. */
  sharedPairs: Set<string>;
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
  // other table's.
  formatType(state, { buffer, table }, createTypeContext(state));
}

function formatType(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: TypeContext
) {
  const {
    collections,
    settings: { tableNameCase },
  } = state;
  const typeName = getTypeName(state, context, table);
  const bodyBuffer: string[] = [];
  const fieldNames = new Set<string>();

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

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      formatColumn(state, { buffer: bodyBuffer, column }, fieldNames);
    });
  formatRelation(state, { buffer: bodyBuffer, table }, context, fieldNames);

  // FieldsDefinition is { FieldDefinition+ }: a braceless type is valid, an
  // empty pair of braces is not.
  if (bodyBuffer.length === 0) {
    buffer.push(`type ${typeName}`);
    return;
  }

  buffer.push(`type ${typeName} {`);
  bodyBuffer.forEach(line => buffer.push(line));
  buffer.push('}');
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions,
  fieldNames: Set<string>
) {
  const isPK = bHas(column.ui.keys, ColumnUIKey.primaryKey);
  const isFK = bHas(column.ui.keys, ColumnUIKey.foreignKey);

  if (!isPK && isFK) {
    return;
  }

  const columnName = graphqlName(getNameCase(column.name, columnNameCase));

  // Column names are not unique per table and the case transform folds more of
  // them together, but a field name is unique per type. Claim it before the
  // description, or a dropped field leaves an orphan one behind.
  if (fieldNames.has(columnName)) {
    return;
  }
  fieldNames.add(columnName);

  pushDescription(
    buffer,
    '  ',
    describe(column.name, columnName, column.comment)
  );

  const idType = bHas(column.options, ColumnOption.primaryKey) || isFK;

  if (idType) {
    buffer.push(
      `  ${columnName}: ID${
        bHas(column.options, ColumnOption.notNull) ? '!' : ''
      }`
    );
  } else {
    const primitiveType = getPrimitiveType(column.dataType, database);

    buffer.push(
      `  ${columnName}: ${convertTypeMap[primitiveType]}${
        bHas(column.options, ColumnOption.notNull) ? '!' : ''
      }`
    );
  }
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
 * or, where getForeignKeyStem applies, the foreign key column without its id;
 * a self relationship it cannot name takes parent before the table name.
 */
function getChildFieldName(
  state: RootState,
  context: TypeContext,
  relationship: Relationship,
  parent: Table
): string {
  const { columnNameCase } = state.settings;
  const name = getNameCase(parent.name, columnNameCase);

  if (!isNamedByForeignKey(context, relationship)) {
    return graphqlName(name);
  }

  const stem = getForeignKeyStem(state, relationship);

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
 * getForeignKeyStem applies.
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
  const stem = isNamedByForeignKey(context, relationship)
    ? getForeignKeyStem(state, relationship)
    : null;

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

/**
 * The single foreign key column's name without a last word id, in the column
 * name case: buyer for buyer_id, buyerId or BuyerID. Null for a composite key,
 * a name with no such word, or one left with no letter or digit a Name keeps.
 */
function getForeignKeyStem(
  { collections, settings: { columnNameCase } }: RootState,
  relationship: Relationship
): string | null {
  const { columnIds } = relationship.end;
  const column =
    columnIds.length === 1
      ? query(collections)
          .collection('tableColumnEntities')
          .selectById(columnIds[0])
      : undefined;
  const stem = column ? stripIdWord(column.name) : null;

  if (stem === null) {
    return null;
  }

  // A stem in a non-ASCII script sanitizes to underscores alone, a name that
  // tells two keys apart no better than the table's and that GraphQL reserves
  // when it opens with two of them.
  const name = getNameCase(stem, columnNameCase);
  return NAME_INFORMATIVE.test(name) ? name : null;
}

/**
 * The name before a last word id, in any case, the separator before it
 * dropped, words split as isSingleWord splits them; null where id is not a
 * word of its own, or is the only one.
 */
function stripIdWord(name: string): string | null {
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
  const context: TypeContext = {
    typeNames: new Map<string, string>(),
    usedTypeNames: new Set<string>(),
    sharedPairs: new Set<string>(),
  };
  const pairs = new Set<string>();

  query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds)
    .forEach(relationship => {
      const key = pairKey(relationship);

      if (pairs.has(key)) {
        context.sharedPairs.add(key);
      }
      pairs.add(key);
    });

  query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds)
    .sort(orderByNameASC)
    .forEach(table => getTypeName(state, context, table));

  return context;
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

  const value = comment.replace(BLOCK_STRING, '\\"""');

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
