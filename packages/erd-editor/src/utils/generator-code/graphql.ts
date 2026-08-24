import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
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
// leading digit, the empty name a table carries the moment it is created -- is
// a syntax error rather than an odd-looking name. `getNameCase` is a case
// transform and leaves all of them untouched.
const NON_NAME = /[^_0-9A-Za-z]/g;
const NAME_START = /^[_A-Za-z]/;
const FALLBACK_NAME = '_';

// A name written in Hangul or any other non-ASCII script sanitizes to nothing
// but underscores, so the exported name carries none of what the user typed.
// The description is the only field that survives to a consumer, so it takes
// the original.
const NAME_INFORMATIVE = /[0-9A-Za-z]/;

// `#` is an Ignored token: it never reaches the AST, so a comment written as
// one is invisible to every consumer. A description is the form that survives,
// and the block string is the only spelling of it that tolerates a newline.
const BLOCK_STRING = /"""/g;
const NEWLINE = /\r\n|\r|\n/g;

type TypeContext = {
  typeNames: Map<string, string>;
  usedTypeNames: Set<string>;
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
  // same context `createCode` does -- a type name is only unique against every
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

  // Judged on the sanitized name, never on `typeName` -- the digit `uniqueName`
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

  // `FieldsDefinition` is `{ FieldDefinition+ }`: a braceless type is valid, an
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

  // A relation field is named after the table it points at, so the description
  // is judged on that name alone -- the `List` suffix is ours, and would make
  // an all-underscore name look informative.
  const pushField = (
    relatedTable: Table,
    fieldName: string,
    fieldType: string
  ) => {
    if (fieldNames.has(fieldName)) {
      return;
    }
    fieldNames.add(fieldName);

    pushDescription(
      buffer,
      '  ',
      describe(
        relatedTable.name,
        graphqlName(getNameCase(relatedTable.name, columnNameCase)),
        relatedTable.comment
      )
    );
    buffer.push(`  ${fieldName}: ${fieldType}`);
  };

  relationships
    .filter(relationship => relationship.end.tableId === table.id)
    .forEach(relationship => {
      const startTable = tableCollection.selectById(relationship.start.tableId);

      if (startTable) {
        pushField(
          startTable,
          graphqlName(getNameCase(startTable.name, columnNameCase)),
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

      const fieldName = getNameCase(endTable.name, columnNameCase);
      const typeName = getTypeName(state, context, endTable);

      if (hasOneRelationship(relationship.relationshipType)) {
        pushField(endTable, graphqlName(fieldName), typeName);
      } else if (hasNRelationship(relationship.relationshipType)) {
        pushField(
          endTable,
          graphqlName(getNameCase(`${fieldName}List`, columnNameCase)),
          `[${typeName}!]!`
        );
      }
    });
}

function createTypeContext(state: RootState): TypeContext {
  const context: TypeContext = {
    typeNames: new Map<string, string>(),
    usedTypeNames: new Set<string>(),
  };

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

  // The case transform is many-to-one -- `user_profile` and `UserProfile` both
  // fold to `UserProfile` -- and sanitizing folds far more together, so two
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
