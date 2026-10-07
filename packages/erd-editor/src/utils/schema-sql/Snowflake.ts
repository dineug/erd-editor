import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import {
  ColumnOption,
  Database,
  ReferentialActionToSQL,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Relationship } from '@/internal-types';
import { bHas } from '@/utils/bit';

import {
  autoName,
  FormatColumnOptions,
  FormatIndexOptions,
  formatNames,
  formatReferentialActions,
  FormatRelationOptions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  getBracket,
  Name,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
  toStringLiteral,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.Snowflake);

// The double quote is Snowflake's only identifier delimiter, and a quoted name
// is case sensitive where a bare one folds to upper case. So settings
// .bracketType chooses whether to quote, not which character to quote with.
const toBracket = (bracketType: number) =>
  getBracket(bracketType) === '' ? '' : '"';

export function createSchema(
  state: RootState,
  tableIds?: readonly string[]
): string {
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);

  tables.forEach(table => {
    formatTable(state, { table, buffer: stringBuffer });
    stringBuffer.push('');
  });

  relationships.forEach(relationship => {
    const written = formatRelation(state, {
      relationship,
      buffer: stringBuffer,
      fkNames,
    });
    if (written) stringBuffer.push('');
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
    collections,
    settings: { bracketType },
  } = state;
  const bracket = toBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  buffer.push(`CREATE TABLE ${bracket}${table.name}${bracket}`);
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
      `  CONSTRAINT ${bracket}PK_${table.name}${bracket} PRIMARY KEY (${formatNames(
        pkColumns,
        bracket
      )})`
    );
  }

  if (table.comment.trim() === '') {
    buffer.push(`);`);
  } else {
    buffer.push(`)`);
    buffer.push(`COMMENT = ${toStringLiteral(table.comment)};`);
  }
}

function formatColumn(
  { settings: { bracketType } }: RootState,
  { buffer, column, isComma, spaceSize }: FormatColumnOptions
) {
  const bracket = toBracket(bracketType);
  const stringBuffer: string[] = [];

  stringBuffer.push(
    `  ${bracket}${column.name}${bracket}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );

  // The column grammar is ordered: an inline constraint comes before NOT NULL,
  // and DEFAULT / AUTOINCREMENT before COMMENT.
  if (bHas(column.options, ColumnOption.unique)) {
    stringBuffer.push(`UNIQUE`);
  }

  // Snowflake has no bare NULL marker, so a nullable column contributes
  // padding only -- the trailing run is trimmed off below. A key column has
  // to be NOT NULL whether or not the diagram says so.
  const notNull =
    bHas(column.options, ColumnOption.notNull) ||
    bHas(column.options, ColumnOption.primaryKey);
  stringBuffer.push(notNull ? 'NOT NULL' : '        ');

  if (bHas(column.options, ColumnOption.autoIncrement)) {
    stringBuffer.push(`AUTOINCREMENT`);
  } else if (column.default.trim() !== '') {
    stringBuffer.push(`DEFAULT ${column.default}`);
  }
  if (column.comment.trim() !== '') {
    stringBuffer.push(`COMMENT ${toStringLiteral(column.comment)}`);
  }

  buffer.push(stringBuffer.join(' ').trimEnd() + `${isComma ? ',' : ''}`);
}

function formatRelation(
  state: RootState,
  { buffer, relationship, fkNames }: FormatRelationOptions
): boolean {
  const {
    settings: { bracketType },
  } = state;
  const columns = toForeignKeyPairs(state, relationship);
  if (!columns) return false;

  const { startTable, endTable } = columns;
  const bracket = toBracket(bracketType);
  const leftOut = leftOutActions(relationship);
  if (leftOut.length !== 0) {
    buffer.push(
      `-- Snowflake creates no foreign key with a referential action other than NO ACTION, so ${leftOut.join(' and ')} ${leftOut.length === 1 ? 'is' : 'are'} left out.`
    );
  }
  buffer.push(`ALTER TABLE ${bracket}${endTable.name}${bracket}`);

  let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
  fkName = autoName(fkNames, '', fkName);
  fkNames.push({
    id: uuid25(),
    name: fkName,
  });

  buffer.push(`  ADD CONSTRAINT ${bracket}${fkName}${bracket}`);

  buffer.push(`    FOREIGN KEY (${formatNames(columns.end, bracket)})`);
  buffer.push(
    `    REFERENCES ${bracket}${startTable.name}${bracket} (${formatNames(
      columns.start,
      bracket
    )})`,
    ...formatReferentialActions(relationship, ACTION_SUPPORT).map(
      clause => `    ${clause}`
    )
  );
  buffer[buffer.length - 1] += ';';
  return true;
}

// The clauses a relationship sets that the DDL leaves out, ON DELETE first,
// for the comment above its foreign key.
function leftOutActions({
  onDelete,
  onUpdate,
}: Pick<Relationship, 'onDelete' | 'onUpdate'>): string[] {
  const clauses: string[] = [];

  if (
    ReferentialActionToSQL[onDelete] &&
    !ACTION_SUPPORT.onDelete.includes(onDelete)
  ) {
    clauses.push(`ON DELETE ${ReferentialActionToSQL[onDelete]}`);
  }
  if (
    ReferentialActionToSQL[onUpdate] &&
    !ACTION_SUPPORT.onUpdate.includes(onUpdate)
  ) {
    clauses.push(`ON UPDATE ${ReferentialActionToSQL[onUpdate]}`);
  }

  return clauses;
}

export function formatIndex(
  { collections, settings: { bracketType } }: RootState,
  { buffer, index, indexNames }: FormatIndexOptions
) {
  const bracket = toBracket(bracketType);
  const table = query(collections)
    .collection('tableEntities')
    .selectById(index.tableId);
  if (!table) return;

  const indexColumns = query(collections)
    .collection('indexColumnEntities')
    .selectByIds(index.indexColumnIds);
  const columns = indexColumns
    .map(indexColumn =>
      query(collections)
        .collection('tableColumnEntities')
        .selectById(indexColumn.columnId)
    )
    .filter(column => column !== undefined);

  if (columns.length === 0) return;

  let indexName = index.name;
  if (index.name.trim() === '') {
    indexName = `IDX_${table.name}`;
    indexName = autoName(indexNames, '', indexName);
    indexNames.push({
      id: uuid25(),
      name: indexName,
    });
  }

  // A unique index is a constraint Snowflake accepts -- informational like
  // every other key it declares -- so it survives the round trip.
  if (index.unique) {
    buffer.push(`ALTER TABLE ${bracket}${table.name}${bracket}`);
    buffer.push(
      `  ADD CONSTRAINT ${bracket}${indexName}${bracket} UNIQUE (${formatNames(
        columns,
        bracket
      )});`
    );
    return;
  }

  const sortedNames = indexColumns
    .map(indexColumn => {
      const column = query(collections)
        .collection('tableColumnEntities')
        .selectById(indexColumn.columnId);
      if (!column) return null;
      return {
        name: `${bracket}${column.name}${bracket} ${toOrderName(
          indexColumn.orderType
        )}`,
      };
    })
    .filter(columnName => columnName !== null);

  // There is no CREATE INDEX in Snowflake. The index is emitted as the
  // clustering it maps onto, commented out: CLUSTER BY takes one key set per
  // table and drops the per-column sort, so it cannot be applied blindly.
  buffer.push(
    `-- Snowflake has no secondary indexes. ${bracket}${indexName}${bracket} on ${bracket}${table.name}${bracket} (${formatNames(sortedNames)})`
  );
  buffer.push(
    `-- ALTER TABLE ${bracket}${table.name}${bracket} CLUSTER BY (${formatNames(
      columns,
      bracket
    )});`
  );
}
