import { query } from '@dineug/erd-editor-schema';
import { nanoid } from '@dineug/shared';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import {
  autoName,
  FormatColumnOptions,
  FormatIndexOptions,
  formatNames,
  FormatRelationOptions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  KeyColumn,
  Name,
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
  toOrderName,
  unique,
  uniqueColumns,
} from './utils';

// Databricks SQL quotes identifiers with backticks only -- "x" and 'x' are
// string literals there -- so `settings.bracketType` cannot be honoured.
const BRACKET = '`';

// Keys are never enforced. RELY is what lets the optimizer act on the
// declaration, which is the only reason to export one at all.
const CONSTRAINT_OPTIONS = 'NOT ENFORCED RELY';

export function createSchema(state: RootState): string {
  const {
    doc: { tableIds, relationshipIds, indexIds },
    collections,
  } = state;
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);
  const indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds);

  tables.forEach(table => {
    formatTable(state, { table, buffer: stringBuffer });
    stringBuffer.push('');

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    // UNIQUE is not one of the constraints Databricks accepts, so the column
    // is reported rather than silently dropped.
    if (unique(columns)) {
      uniqueColumns(columns).forEach(column => {
        stringBuffer.push(
          `-- Databricks does not support UNIQUE constraints: ${BRACKET}${table.name}${BRACKET}.${BRACKET}${column.name}${BRACKET}`
        );
        stringBuffer.push('');
      });
    }
  });

  relationships.forEach(relationship => {
    formatRelation(state, {
      relationship,
      buffer: stringBuffer,
      fkNames,
    });
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
  const { collections } = state;
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  buffer.push(`CREATE TABLE ${BRACKET}${table.name}${BRACKET}`);
  buffer.push(`(`);
  const pk = primaryKey(columns);
  const spaceSize = formatSize(columns);

  columns.forEach((column, i) => {
    formatColumn(state, {
      column,
      isComma: pk || columns.length !== i + 1,
      spaceSize,
      buffer,
    });
  });

  if (pk) {
    const pkColumns = primaryKeyColumns(columns);
    buffer.push(
      `  CONSTRAINT ${BRACKET}PK_${table.name}${BRACKET} PRIMARY KEY (${formatNames(
        pkColumns,
        BRACKET
      )}) ${CONSTRAINT_OPTIONS}`
    );
  }

  buffer.push(`)`);

  if (table.comment.trim() === '') {
    buffer.push(`USING DELTA;`);
  } else {
    buffer.push(`USING DELTA`);
    buffer.push(`COMMENT '${table.comment}';`);
  }
}

function formatColumn(
  _: RootState,
  { buffer, column, isComma, spaceSize }: FormatColumnOptions
) {
  const stringBuffer: string[] = [];

  stringBuffer.push(
    `  ${BRACKET}${column.name}${BRACKET}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );

  // Databricks has no bare NULL marker, so a nullable column contributes
  // padding only -- the trailing run is trimmed off below. A key column has
  // to be NOT NULL whether or not the diagram says so.
  const notNull =
    bHas(column.options, ColumnOption.notNull) ||
    bHas(column.options, ColumnOption.primaryKey);
  stringBuffer.push(notNull ? 'NOT NULL' : '        ');

  if (bHas(column.options, ColumnOption.autoIncrement)) {
    stringBuffer.push(`GENERATED ALWAYS AS IDENTITY`);
  } else if (column.default.trim() !== '') {
    stringBuffer.push(`DEFAULT ${column.default}`);
  }
  if (column.comment.trim() !== '') {
    stringBuffer.push(`COMMENT '${column.comment}'`);
  }

  buffer.push(stringBuffer.join(' ').trimEnd() + `${isComma ? ',' : ''}`);
}

function formatRelation(
  { collections }: RootState,
  { buffer, relationship, fkNames }: FormatRelationOptions
) {
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const startTable = tableCollection.selectById(relationship.start.tableId);
  const endTable = tableCollection.selectById(relationship.end.tableId);

  if (startTable && endTable) {
    buffer.push(`ALTER TABLE ${BRACKET}${endTable.name}${BRACKET}`);

    let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
    fkName = autoName(fkNames, '', fkName);
    fkNames.push({
      id: nanoid(),
      name: fkName,
    });

    buffer.push(`  ADD CONSTRAINT ${BRACKET}${fkName}${BRACKET}`);

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

    buffer.push(`    FOREIGN KEY (${formatNames(columns.end, BRACKET)})`);
    buffer.push(
      `    REFERENCES ${BRACKET}${startTable.name}${BRACKET} (${formatNames(
        columns.start,
        BRACKET
      )}) ${CONSTRAINT_OPTIONS};`
    );
  }
}

export function formatIndex(
  { collections }: RootState,
  { buffer, index, indexNames }: FormatIndexOptions
) {
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
          name: `${BRACKET}${column.name}${BRACKET} ${toOrderName(
            indexColumn.orderType
          )}`,
        };
      }
      return null;
    })
    .filter(columnName => columnName !== null) as { name: string }[];

  if (columnNames.length === 0) return;

  let indexName = index.name;
  if (index.name.trim() === '') {
    indexName = `IDX_${table.name}`;
    indexName = autoName(indexNames, '', indexName);
    indexNames.push({
      id: nanoid(),
      name: indexName,
    });
  }

  // There is no CREATE INDEX in Databricks. The index is emitted as the
  // clustering it maps onto, commented out: CLUSTER BY takes one key set per
  // table and drops the per-column sort, so it cannot be applied blindly.
  buffer.push(
    `-- Databricks has no secondary indexes. ${BRACKET}${indexName}${BRACKET} on ${BRACKET}${table.name}${BRACKET} (${formatNames(columnNames)})`
  );
  buffer.push(
    `-- ALTER TABLE ${BRACKET}${table.name}${BRACKET} CLUSTER BY (${formatNames(
      query(collections)
        .collection('indexColumnEntities')
        .selectByIds(index.indexColumnIds)
        .map(indexColumn =>
          query(collections)
            .collection('tableColumnEntities')
            .selectById(indexColumn.columnId)
        )
        .filter(column => column !== undefined) as { name: string }[],
      BRACKET
    )});`
  );
}
