import { getData } from '@/core/helper';
import { PrimitiveTypeMap } from '@/core/sql/dataType';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import {
  nRelationshipTypes,
  oneRelationshipTypes,
} from '@/engine/store/relationship.state';
import { Store } from '@@types/engine/store';
import { Database, NameCase } from '@@types/engine/store/canvas.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Column, Table } from '@@types/engine/store/table.state';

import { getNameCase, getPrimitiveType } from './helper';

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

export function createCode(store: Store): string {
  const stringBuffer: string[] = [''];
  const { database, tableCase, columnCase } = store.canvasState;
  const tables = orderByNameASC(store.tableState.tables);
  const relationships = store.relationshipState.relationships;

  tables.forEach(table => {
    formatTable(
      table,
      stringBuffer,
      database,
      relationships,
      tables,
      tableCase,
      columnCase
    );
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  table: Table,
  buffer: string[],
  database: Database,
  relationships: Relationship[],
  tables: Table[],
  tableCase: NameCase,
  columnCase: NameCase
) {
  const tableName = getNameCase(table.name, tableCase);
  if (table.comment.trim() !== '') {
    buffer.push(`# ${table.comment}`);
  }
  buffer.push(`type ${tableName} {`);
  table.columns.forEach(column => {
    formatColumn(column, buffer, database, columnCase);
  });
  formatRelation(table, buffer, relationships, tables, tableCase, columnCase);
  buffer.push(`}`);
}

function formatColumn(
  column: Column,
  buffer: string[],
  database: Database,
  columnCase: NameCase
) {
  if (!column.ui.fk) {
    const columnName = getNameCase(column.name, columnCase);
    if (column.comment.trim() !== '') {
      buffer.push(`  # ${column.comment}`);
    }
    const idType = column.option.primaryKey || column.ui.fk;
    if (idType) {
      buffer.push(`  ${columnName}: ID${column.option.notNull ? '!' : ''}`);
    } else {
      const primitiveType = getPrimitiveType(column.dataType, database);
      buffer.push(
        `  ${columnName}: ${convertTypeMap[primitiveType]}${
          column.option.notNull ? '!' : ''
        }`
      );
    }
  }
}

function formatRelation(
  table: Table,
  buffer: string[],
  relationships: Relationship[],
  tables: Table[],
  tableCase: NameCase,
  columnCase: NameCase
) {
  relationships
    .filter(relationship => relationship.end.tableId === table.id)
    .forEach(relationship => {
      const startTable = getData(tables, relationship.start.tableId);
      if (startTable) {
        const typeName = getNameCase(startTable.name, tableCase);
        const fieldName = getNameCase(startTable.name, columnCase);
        if (startTable.comment.trim() !== '') {
          buffer.push(`  # ${startTable.comment}`);
        }
        buffer.push(`  ${fieldName}: ${typeName}`);
      }
    });
  relationships
    .filter(relationship => relationship.start.tableId === table.id)
    .forEach(relationship => {
      const endTable = getData(tables, relationship.end.tableId);
      if (endTable) {
        const typeName = getNameCase(endTable.name, tableCase);
        const fieldName = getNameCase(endTable.name, columnCase);
        if (endTable.comment.trim() !== '') {
          buffer.push(`  # ${endTable.comment}`);
        }
        if (oneRelationshipTypes.includes(relationship.relationshipType)) {
          buffer.push(`  ${fieldName}: ${typeName}`);
        } else if (nRelationshipTypes.includes(relationship.relationshipType)) {
          buffer.push(
            `  ${getNameCase(`${fieldName}List`, columnCase)}: [${typeName}!]!`
          );
        }
      }
    });
}
