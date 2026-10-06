import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import {
  autoNameIgnoreCase,
  FormatColumnOptions,
  formatDefault,
  FormatIndexOptions,
  formatNames,
  formatReferentialActions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  getBracket,
  Name,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  splitTableName,
  tableNamePart,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.SQLite);

export function createSchema(
  state: RootState,
  tableIds?: readonly string[]
): string {
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, indexes } = toSchemaEntities(state, tableIds);

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
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const foreignKeys = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .filter(({ end }) => end.tableId === table.id)
    .flatMap(relationship => {
      const pairs = toForeignKeyPairs(state, relationship);
      return pairs ? [{ relationship, ...pairs }] : [];
    });
  // The commas count the foreign keys written, not the relationships ending
  // here: one whose table or columns are gone writes no clause.
  const hasForeignKey = foreignKeys.length !== 0;

  if (table.comment.trim() !== '') {
    buffer.push(`-- ${table.comment}`);
  }
  buffer.push(`CREATE TABLE ${bracket}${table.name}${bracket}`);
  buffer.push(`(`);
  const pk = primaryKey(columns);
  const spaceSize = formatSize(columns);

  columns.forEach((column, i) => {
    formatColumn(state, {
      column,
      isComma: pk || hasForeignKey || columns.length !== i + 1,
      spaceSize,
      buffer,
    });
  });

  if (pk) {
    const pkColumns = primaryKeyColumns(columns);
    const autoIncrement =
      pkColumns.length === 1 &&
      bHas(pkColumns[0].options, ColumnOption.autoIncrement)
        ? ' AUTOINCREMENT'
        : '';
    buffer.push(
      `  PRIMARY KEY (${formatNames(pkColumns, bracket)}${autoIncrement})` +
        (hasForeignKey ? ',' : '')
    );
  }

  foreignKeys.forEach(({ relationship, startTable, start, end }, i) => {
    const actions = formatReferentialActions(relationship, ACTION_SUPPORT)
      .map(clause => ` ${clause}`)
      .join('');
    // SQLite resolves a foreign key in the child table's own schema and
    // refuses a qualified name there.
    const [, referenced] = splitTableName(startTable.name, bracketType);

    buffer.push(
      `  FOREIGN KEY (${formatNames(
        end,
        bracket
      )}) REFERENCES ${bracket}${referenced}${bracket} (${formatNames(
        start,
        bracket
      )})${actions}` + (foreignKeys.length - 1 > i ? ',' : '')
    );
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
    stringBuffer.push(
      `DEFAULT ${formatDefault(column.default, Database.SQLite)}`
    );
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
    const [schema, tableName] = splitTableName(table.name, bracketType);
    let indexName = index.name;
    if (index.name.trim() === '') {
      const namePart = tableNamePart(table.name, bracketType);
      indexName = autoNameIgnoreCase(indexNames, `IDX_${namePart}`);
      indexNames.push({
        id: uuid25(),
        name: indexName,
      });
    }
    // SQLite takes the schema on the index name and the table bare after ON;
    // a name the user already qualified keeps the schema it names.
    const indexSchema =
      schema === '' || indexName.includes('.') ? '' : `${schema}.`;
    const indexRef = `${indexSchema}${bracket}${indexName}${bracket}`;

    if (index.unique) {
      buffer.push(`CREATE UNIQUE INDEX ${indexRef}`);
    } else {
      buffer.push(`CREATE INDEX ${indexRef}`);
    }
    buffer.push(
      `  ON ${bracket}${tableName}${bracket} (${formatNames(columnNames)});`
    );
  }
}
