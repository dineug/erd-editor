import { autoName, getData, uuid } from '@/core/helper';
import {
  orderByNameASC,
  orderByRelationship,
} from '@/engine/store/helper/table.helper';
import { Store } from '@@types/engine/store';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Table } from '@@types/engine/store/table.state';

import {
  FormatColumnOptions,
  FormatIndexOptions,
  formatNames,
  formatSize,
  formatSpace,
  getBracket,
  KeyColumn,
  Name,
  primaryKey,
  primaryKeyColumns,
} from './helper';

export function createDDL({
  tableState,
  relationshipState,
  canvasState,
}: Store): string {
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const bracket = getBracket(canvasState.bracketType);
  const relationships = relationshipState.relationships;
  const indexes = tableState.indexes;
  const tables = orderByRelationship(
    orderByNameASC(tableState.tables),
    relationships
  );

  tables.forEach(table => {
    formatTable({
      table,
      tables,
      relationships: relationships.filter(
        relationship => relationship.end.tableId === table.id
      ),
      buffer: stringBuffer,
      bracket,
    });
    stringBuffer.push('');
  });

  indexes.forEach(index => {
    const table = getData(tables, index.tableId);
    if (table) {
      formatIndex({ table, index, buffer: stringBuffer, indexNames, bracket });
      stringBuffer.push('');
    }
  });

  return stringBuffer.join('\n');
}

interface FormatTableOptions {
  table: Table;
  tables: Table[];
  relationships: Relationship[];
  buffer: string[];
  bracket: string;
}
export function formatTable({
  table,
  tables,
  relationships,
  buffer,
  bracket,
}: FormatTableOptions) {
  if (table.comment.trim() !== '') {
    buffer.push(`-- ${table.comment}`);
  }
  buffer.push(`CREATE TABLE ${bracket}${table.name}${bracket}`);
  buffer.push(`(`);
  const pk = primaryKey(table.columns);
  const spaceSize = formatSize(table.columns);

  table.columns.forEach((column, i) => {
    if (pk || relationships.length !== 0) {
      formatColumn({ column, isComma: true, spaceSize, buffer, bracket });
    } else {
      formatColumn({
        column,
        isComma: table.columns.length !== i + 1,
        spaceSize,
        buffer,
        bracket,
      });
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
          `  PRIMARY KEY (${formatNames(pkColumns, bracket)}${autoIncrement}),`
        );
      } else {
        buffer.push(`  PRIMARY KEY (${formatNames(pkColumns, bracket)}),`);
      }
    } else {
      if (pkColumns.length === 1) {
        const autoIncrement = pkColumns[0].option.autoIncrement
          ? ' AUTOINCREMENT'
          : '';
        buffer.push(
          `  PRIMARY KEY (${formatNames(pkColumns, bracket)}${autoIncrement})`
        );
      } else {
        buffer.push(`  PRIMARY KEY (${formatNames(pkColumns, bracket)})`);
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
          `  FOREIGN KEY (${formatNames(
            columns.end,
            bracket
          )}) REFERENCES ${bracket}${startTable.name}${bracket} (${formatNames(
            columns.start,
            bracket
          )}),`
        );
      } else {
        buffer.push(
          `  FOREIGN KEY (${formatNames(
            columns.end,
            bracket
          )}) REFERENCES ${bracket}${startTable.name}${bracket} (${formatNames(
            columns.start,
            bracket
          )})`
        );
      }
    }
  });

  buffer.push(`);`);
}

function formatColumn({
  column,
  isComma,
  spaceSize,
  buffer,
  bracket,
}: FormatColumnOptions) {
  if (column.comment.trim() !== '') {
    buffer.push(`  -- ${column.comment}`);
  }
  const stringBuffer: string[] = [];
  stringBuffer.push(
    `  ${bracket}${column.name}${bracket}` +
      formatSpace(spaceSize.name - column.name.length)
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

export function formatIndex({
  table,
  index,
  buffer,
  indexNames,
  bracket,
}: FormatIndexOptions) {
  const columnNames = index.columns
    .map(indexColumn => {
      const column = getData(table.columns, indexColumn.id);
      if (column) {
        return {
          name: `${bracket}${column.name}${bracket} ${indexColumn.orderType}`,
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
      buffer.push(`CREATE UNIQUE INDEX ${bracket}${indexName}${bracket}`);
    } else {
      buffer.push(`CREATE INDEX ${bracket}${indexName}${bracket}`);
    }
    buffer.push(
      `  ON ${bracket}${table.name}${bracket} (${formatNames(columnNames)});`
    );
  }
}
