import { query } from '@dineug/erd-editor-schema';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import {
  autoName,
  FormatColumnOptions,
  FormatIndexOptions,
  formatNames,
  formatSize,
  formatSpace,
  FormatTableOptions,
  getBracket,
  KeyColumn,
  Name,
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
  toOrderName,
} from './utils';

export function createSchema(state: RootState): string {
  const {
    doc: { tableIds, indexIds },
    collections,
  } = state;
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);
  const indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds);

  tables.forEach(table => {
    formatTable(state, { table, buffer: stringBuffer });
    stringBuffer.push('');
  });

  indexes.forEach(index => {
    formatIndex(state, {
      index,
      buffer: stringBuffer,
      indexNames,
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
    settings: { bracketType },
    doc: { relationshipIds },
    collections,
  } = state;
  const bracket = getBracket(bracketType);
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const columns = columnCollection.selectByIds(table.columnIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .filter(({ end }) => end.tableId === table.id);

  if (table.comment.trim() !== '') {
    buffer.push(`-- ${table.comment}`);
  }
  buffer.push(`CREATE TABLE ${bracket}${table.name}${bracket}`);
  buffer.push(`(`);
  const pk = primaryKey(columns);
  const spaceSize = formatSize(columns);

  columns.forEach((column, i) => {
    if (pk) {
      formatColumn(state, {
        column,
        isComma: true,
        spaceSize,
        buffer,
      });
    } else {
      formatColumn(state, {
        column,
        isComma: columns.length !== i + 1,
        spaceSize,
        buffer,
      });
    }
  });

  if (pk) {
    const pkColumns = primaryKeyColumns(columns);
    if (relationships.length !== 0) {
      if (pkColumns.length === 1) {
        const autoIncrement = bHas(
          pkColumns[0].options,
          ColumnOption.autoIncrement
        )
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
        const autoIncrement = bHas(
          pkColumns[0].options,
          ColumnOption.autoIncrement
        )
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
    const startTable = tableCollection.selectById(relationship.start.tableId);
    const endTable = tableCollection.selectById(relationship.end.tableId);

    if (startTable && endTable) {
      // key
      const columns: KeyColumn = {
        start: [],
        end: [],
      };
      relationship.end.columnIds.forEach(columnId => {
        const column = columnCollection.selectById(columnId);
        if (column) {
          columns.end.push(column);
        }
      });
      relationship.start.columnIds.forEach(columnId => {
        const column = columnCollection.selectById(columnId);
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

function formatColumn(
  { settings: { bracketType } }: RootState,
  { buffer, column, isComma, spaceSize }: FormatColumnOptions
) {
  const bracket = getBracket(bracketType);
  const stringBuffer: string[] = [];

  if (column.comment.trim() !== '') {
    buffer.push(`  -- ${column.comment}`);
  }

  stringBuffer.push(
    `  ${bracket}${column.name}${bracket}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );
  stringBuffer.push(
    `${bHas(column.options, ColumnOption.notNull) ? 'NOT NULL' : 'NULL    '}`
  );
  if (bHas(column.options, ColumnOption.unique)) {
    stringBuffer.push(`UNIQUE`);
  }
  if (
    !bHas(column.options, ColumnOption.autoIncrement) &&
    column.default.trim() !== ''
  ) {
    stringBuffer.push(`DEFAULT ${column.default}`);
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

export function formatIndex(
  { settings: { bracketType }, collections }: RootState,
  { buffer, index, indexNames }: FormatIndexOptions
) {
  const bracket = getBracket(bracketType);
  const table = query(collections)
    .collection('tableEntities')
    .selectById(index.tableId);
  if (!table) return;

  const columnNames = query(collections)
    .collection('indexColumnEntities')
    .selectByIds(index.indexColumnIds)
    .map(indexColumn => {
      const column = query(collections)
        .collection('tableColumnEntities')
        .selectById(indexColumn.columnId);
      if (column) {
        return {
          name: `${bracket}${column.name}${bracket} ${toOrderName(
            indexColumn.orderType
          )}`,
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
        id: nanoid(),
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
