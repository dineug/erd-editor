import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
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

  tables.forEach(table => {
    formatTable(state, {
      buffer: stringBuffer,
      table,
    });
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { tableNameCase },
    collections,
  } = state;
  const tableName = getNameCase(table.name, tableNameCase);

  if (table.comment.trim() !== '') {
    buffer.push(`# ${table.comment}`);
  }
  buffer.push(`type ${tableName} {`);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      formatColumn(state, { buffer, column });
    });
  formatRelation(state, { buffer, table });

  buffer.push(`}`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const isPK = bHas(column.ui.keys, ColumnUIKey.primaryKey);
  const isFK = bHas(column.ui.keys, ColumnUIKey.foreignKey);

  if (!isPK && isFK) {
    return;
  }

  const columnName = getNameCase(column.name, columnNameCase);

  if (column.comment.trim() !== '') {
    buffer.push(`  # ${column.comment}`);
  }

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
  {
    doc: { relationshipIds },
    collections,
    settings: { tableNameCase, columnNameCase },
  }: RootState,
  { buffer, table }: FormatRelationOptions
) {
  const tableCollection = query(collections).collection('tableEntities');
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  relationships
    .filter(relationship => relationship.end.tableId === table.id)
    .forEach(relationship => {
      const startTable = tableCollection.selectById(relationship.start.tableId);

      if (startTable) {
        const typeName = getNameCase(startTable.name, tableNameCase);
        const fieldName = getNameCase(startTable.name, columnNameCase);

        if (startTable.comment.trim() !== '') {
          buffer.push(`  # ${startTable.comment}`);
        }
        buffer.push(`  ${fieldName}: ${typeName}`);
      }
    });

  relationships
    .filter(relationship => relationship.start.tableId === table.id)
    .forEach(relationship => {
      const endTable = tableCollection.selectById(relationship.end.tableId);

      if (endTable) {
        const typeName = getNameCase(endTable.name, tableNameCase);
        const fieldName = getNameCase(endTable.name, columnNameCase);

        if (endTable.comment.trim() !== '') {
          buffer.push(`  # ${endTable.comment}`);
        }

        if (hasOneRelationship(relationship.relationshipType)) {
          buffer.push(`  ${fieldName}: ${typeName}`);
        } else if (hasNRelationship(relationship.relationshipType)) {
          buffer.push(
            `  ${getNameCase(
              `${fieldName}List`,
              columnNameCase
            )}: [${typeName}!]!`
          );
        }
      }
    });
}
