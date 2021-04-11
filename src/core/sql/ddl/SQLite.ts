import { Store } from '@@types/engine/store';
import { Table, Column, Index } from '@@types/engine/store/table.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { getData, uuid, autoName } from '@/core/helper';
import {
  formatNames,
  formatSize,
  formatSpace,
  primaryKey,
  primaryKeyColumns,
  MaxLength,
  Name,
  KeyColumn,
} from './helper';
import {
  orderByNameASC,
  orderByRelationship,
} from '@/engine/store/helper/table.helper';

export function createDDL(store: Store): string {
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const relationships = store.relationshipState.relationships;
  const indexes = store.tableState.indexes;
  const tables = orderByRelationship(
    orderByNameASC(store.tableState.tables),
    relationships
  );

  tables.forEach(table => {
    formatTable(
      table,
      tables,
      relationships.filter(
        relationship => relationship.end.tableId === table.id
      ),
      stringBuffer
    );
    stringBuffer.push('');
  });

  indexes.forEach(index => {
    const table = getData(tables, index.tableId);
    if (table) {
      formatIndex(table, index, stringBuffer, indexNames);
      stringBuffer.push('');
    }
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  table: Table,
  tables: Table[],
  relationships: Relationship[],
  buffer: string[]
) {
  if (table.comment.trim() !== '') {
    buffer.push(`-- ${table.comment}`);
  }
  buffer.push(`CREATE TABLE ${table.name}`);
  buffer.push(`(`);
  const pk = primaryKey(table.columns);
  const spaceSize = formatSize(table.columns);

  table.columns.forEach((column, i) => {
    if (pk || relationships.length !== 0) {
      formatColumn(column, true, spaceSize, buffer);
    } else {
      formatColumn(column, table.columns.length !== i + 1, spaceSize, buffer);
    }
  });
  // PK
  if (pk) {
    const pkColumns = primaryKeyColumns(table.columns);
    if (relationships.length !== 0) {
      if (pkColumns.length === 1) {
        const autoIncrement = pkColumns[0].option.autoIncrement
          ? ' AUTOINCREMENT'
          : '';
        buffer.push(
          `  PRIMARY KEY (${formatNames(pkColumns)}${autoIncrement}),`
        );
      } else {
        buffer.push(`  PRIMARY KEY (${formatNames(pkColumns)}),`);
      }
    } else {
      if (pkColumns.length === 1) {
        const autoIncrement = pkColumns[0].option.autoIncrement
          ? ' AUTOINCREMENT'
          : '';
        buffer.push(
          `  PRIMARY KEY (${formatNames(pkColumns)}${autoIncrement})`
        );
      } else {
        buffer.push(`  PRIMARY KEY (${formatNames(pkColumns)})`);
      }
    }
  }

  relationships.forEach((relationship, i) => {
    const startTable = getData(tables, relationship.start.tableId);
    const endTable = getData(tables, relationship.end.tableId);

    if (startTable && endTable) {
      // key
      const columns: KeyColumn = {
        start: [],
        end: [],
      };
      relationship.end.columnIds.forEach(columnId => {
        const column = getData(endTable.columns, columnId);
        if (column) {
          columns.end.push(column);
        }
      });
      relationship.start.columnIds.forEach(columnId => {
        const column = getData(startTable.columns, columnId);
        if (column) {
          columns.start.push(column);
        }
      });

      if (relationships.length - 1 > i) {
        buffer.push(
          `  FOREIGN KEY (${formatNames(columns.end)}) REFERENCES ${
            startTable.name
          } (${formatNames(columns.start)}),`
        );
      } else {
        buffer.push(
          `  FOREIGN KEY (${formatNames(columns.end)}) REFERENCES ${
            startTable.name
          } (${formatNames(columns.start)})`
        );
      }
    }
  });

  buffer.push(`);`);
}

function formatColumn(
  column: Column,
  isComma: boolean,
  spaceSize: MaxLength,
  buffer: string[]
) {
  if (column.comment.trim() !== '') {
    buffer.push(`  -- ${column.comment}`);
  }
  const stringBuffer: string[] = [];
  stringBuffer.push(
    `  ${column.name}` + formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );
  stringBuffer.push(`${column.option.notNull ? 'NOT NULL' : 'NULL    '}`);
  if (column.option.unique) {
    stringBuffer.push(`UNIQUE`);
  }
  if (!column.option.autoIncrement && column.default.trim() !== '') {
    stringBuffer.push(`DEFAULT ${column.default}`);
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

export function formatIndex(
  table: Table,
  index: Index,
  buffer: string[],
  indexNames: Name[]
) {
  const columnNames = index.columns
    .map(indexColumn => {
      const column = getData(table.columns, indexColumn.id);
      if (column) {
        return {
          name: `${column.name} ${indexColumn.orderType}`,
        };
      }
      return null;
    })
    .filter(columnName => columnName !== null) as { name: string }[];

  if (columnNames.length !== 0) {
    let indexName = index.name;
    if (index.name.trim() === '') {
      indexName = `IDX_${table.name}`;
      indexName = autoName(indexNames, '', indexName);
      indexNames.push({
        id: uuid(),
        name: indexName,
      });
    }

    if (index.unique) {
      buffer.push(`CREATE UNIQUE INDEX ${indexName}`);
    } else {
      buffer.push(`CREATE INDEX ${indexName}`);
    }
    buffer.push(`  ON ${table.name} (${formatNames(columnNames)});`);
  }
}
