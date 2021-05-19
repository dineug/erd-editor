import { Store } from '@@types/engine/store';
import { getData, uuid, autoName } from '@/core/helper';
import {
  formatNames,
  formatSize,
  formatSpace,
  primaryKey,
  primaryKeyColumns,
  unique,
  uniqueColumns,
  Name,
  KeyColumn,
  getBracket,
  FormatTableOptions,
  FormatColumnOptions,
  FormatRelationOptions,
  FormatIndexOptions,
  FormatCommentOptions,
} from './helper';
import { orderByNameASC } from '@/engine/store/helper/table.helper';

export function createDDL({
  tableState,
  relationshipState,
  canvasState,
}: Store): string {
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const bracket = getBracket(canvasState.bracketType);
  const tables = orderByNameASC(tableState.tables);
  const relationships = relationshipState.relationships;
  const indexes = tableState.indexes;

  tables.forEach(table => {
    formatTable({ table, buffer: stringBuffer, bracket });
    stringBuffer.push('');
    // unique
    if (unique(table.columns)) {
      const uqColumns = uniqueColumns(table.columns);
      uqColumns.forEach(column => {
        stringBuffer.push(`ALTER TABLE ${bracket}${table.name}${bracket}`);
        stringBuffer.push(
          `  ADD CONSTRAINT ${bracket}UQ_${column.name}${bracket} UNIQUE (${bracket}${column.name}${bracket})\nGO`
        );
        stringBuffer.push('');
      });
    }
    formatComment({ table, buffer: stringBuffer, bracket });
  });
  relationships.forEach(relationship => {
    formatRelation({
      tables,
      relationship,
      buffer: stringBuffer,
      fkNames,
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

export function formatTable({ table, buffer, bracket }: FormatTableOptions) {
  buffer.push(`CREATE TABLE ${bracket}${table.name}${bracket}`);
  buffer.push(`(`);
  const pk = primaryKey(table.columns);
  const spaceSize = formatSize(table.columns);

  table.columns.forEach((column, i) => {
    if (pk) {
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
    buffer.push(
      `  CONSTRAINT ${bracket}PK_${
        table.name
      }${bracket} PRIMARY KEY (${formatNames(pkColumns, bracket)})`
    );
  }
  buffer.push(`)\nGO`);
}

function formatColumn({
  column,
  isComma,
  spaceSize,
  buffer,
  bracket,
}: FormatColumnOptions) {
  const stringBuffer: string[] = [];
  stringBuffer.push(
    `  ${bracket}${column.name}${bracket}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );
  if (column.option.notNull) {
    stringBuffer.push(`NOT NULL`);
  }
  if (column.option.autoIncrement) {
    stringBuffer.push(`IDENTITY(1,1)`);
  } else {
    if (column.default.trim() !== '') {
      stringBuffer.push(`DEFAULT ${column.default}`);
    }
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

function formatComment({ table, buffer }: FormatCommentOptions) {
  if (table.comment.trim() !== '') {
    buffer.push(`EXECUTE sys.sp_addextendedproperty 'MS_Description',`);
    buffer.push(
      `  '${table.comment}', 'user', dbo, 'table', '${table.name}'\nGO`
    );
    buffer.push('');
  }
  table.columns.forEach(column => {
    if (column.comment.trim() !== '') {
      buffer.push(`EXECUTE sys.sp_addextendedproperty 'MS_Description',`);
      buffer.push(
        `  '${column.comment}', 'user', dbo, 'table', '${table.name}', 'column', '${column.name}'\nGO`
      );
      buffer.push('');
    }
  });
}

function formatRelation({
  tables,
  relationship,
  buffer,
  fkNames,
  bracket,
}: FormatRelationOptions) {
  const startTable = getData(tables, relationship.start.tableId);
  const endTable = getData(tables, relationship.end.tableId);

  if (startTable && endTable) {
    buffer.push(`ALTER TABLE ${bracket}${endTable.name}${bracket}`);

    // FK
    let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
    fkName = autoName(fkNames, '', fkName);
    fkNames.push({
      id: uuid(),
      name: fkName,
    });

    buffer.push(`  ADD CONSTRAINT ${bracket}${fkName}${bracket}`);

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

    buffer.push(`    FOREIGN KEY (${formatNames(columns.end, bracket)})`);
    buffer.push(
      `    REFERENCES ${bracket}${startTable.name}${bracket} (${formatNames(
        columns.start,
        bracket
      )})\nGO`
    );
  }
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
    if (indexName.trim() === '') {
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
      `  ON ${bracket}${table.name}${bracket} (${formatNames(columnNames)})\nGO`
    );
  }
}
