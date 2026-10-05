import { query } from '@dineug/erd-editor-schema';
import { nanoid } from 'nanoid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import {
  autoName,
  autoNameIgnoreCase,
  FormatColumnOptions,
  FormatCommentOptions,
  FormatIndexOptions,
  formatNames,
  formatReferentialActions,
  FormatRelationOptions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  getBracket,
  KeyColumn,
  Name,
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  splitTableName,
  tableNamePart,
  toOrderName,
  toStringLiteral,
  unique,
  uniqueColumns,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.Oracle);

export function createSchema(state: RootState): string {
  const {
    doc: { tableIds, relationshipIds, indexIds },
    settings: { bracketType },
    collections,
  } = state;
  const fkNames: Name[] = [];
  const aiNames: Name[] = [];
  const trgNames: Name[] = [];
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

    formatUnique(state, { table, buffer: stringBuffer });

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);
    // The sequence and its trigger go beside the table, as an index does.
    const [schema] = splitTableName(table.name, bracketType);
    const tableName = tableNamePart(table.name, bracketType);
    const owner = schema === '' ? '' : `${schema}.`;

    // Sequence
    columns.forEach(column => {
      if (bHas(column.options, ColumnOption.autoIncrement)) {
        const aiName = autoName(aiNames, '', `SEQ_${tableName}`);
        aiNames.push({
          id: nanoid(),
          name: aiName,
        });
        const sequence = `${owner}${aiName}`;

        stringBuffer.push(`CREATE SEQUENCE ${sequence}`);
        stringBuffer.push(`START WITH 1`);
        stringBuffer.push(`INCREMENT BY 1;`);
        stringBuffer.push('');

        const trgName = autoName(aiNames, '', `SEQ_TRG_${tableName}`);
        trgNames.push({
          id: nanoid(),
          name: trgName,
        });
        stringBuffer.push(`CREATE OR REPLACE TRIGGER ${owner}${trgName}`);
        stringBuffer.push(`BEFORE INSERT ON ${table.name}`);
        stringBuffer.push(`REFERENCING NEW AS NEW FOR EACH ROW`);
        stringBuffer.push(`BEGIN`);
        stringBuffer.push(`  SELECT ${sequence}.NEXTVAL`);
        stringBuffer.push(`  INTO: NEW.${column.name}`);
        stringBuffer.push(`  FROM DUAL;`);
        stringBuffer.push(`END;`);
        stringBuffer.push('');
      }
    });

    formatComment(state, { table, buffer: stringBuffer });
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
  const {
    settings: { bracketType },
    collections,
  } = state;
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

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
    const pkName = `PK_${tableNamePart(table.name, bracketType)}`;
    buffer.push(
      `  CONSTRAINT ${bracket}${pkName}${bracket} PRIMARY KEY (${formatNames(pkColumns, bracket)})`
    );
  }
  buffer.push(`);`);
}

/**
 * One named constraint per column the diagram marks unique, after the table.
 * The whole export and the per-table Schema SQL tab both write it.
 */
export function formatUnique(
  { settings: { bracketType }, collections }: RootState,
  { buffer, table }: FormatTableOptions
) {
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  if (!unique(columns)) return;

  uniqueColumns(columns).forEach(column => {
    buffer.push(`ALTER TABLE ${bracket}${table.name}${bracket}`);
    buffer.push(
      `  ADD CONSTRAINT ${bracket}UQ_${tableNamePart(table.name, bracketType)}_${column.name}${bracket} UNIQUE (${bracket}${column.name}${bracket});`
    );
    buffer.push('');
  });
}

function formatColumn(
  { settings: { bracketType } }: RootState,
  { buffer, column, isComma, spaceSize }: FormatColumnOptions
) {
  const bracket = getBracket(bracketType);
  const stringBuffer: string[] = [];

  stringBuffer.push(
    `  ${bracket}${column.name}${bracket}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );
  if (column.default.trim() !== '') {
    stringBuffer.push(`DEFAULT ${column.default}`);
  }
  if (bHas(column.options, ColumnOption.notNull)) {
    stringBuffer.push(`NOT NULL`);
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

function formatComment(
  { settings: { bracketType }, collections }: RootState,
  { table, buffer }: FormatCommentOptions
) {
  const bracket = getBracket(bracketType);

  if (table.comment.trim() !== '') {
    buffer.push(
      `COMMENT ON TABLE ${bracket}${table.name}${bracket} IS ${toStringLiteral(table.comment)};`
    );
    buffer.push('');
  }
  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      if (column.comment.trim() !== '') {
        buffer.push(
          `COMMENT ON COLUMN ${bracket}${table.name}${bracket}.${bracket}${column.name}${bracket} IS ${toStringLiteral(column.comment)};`
        );
        buffer.push('');
      }
    });
}

function formatRelation(
  { settings: { bracketType }, collections }: RootState,
  { buffer, relationship, fkNames }: FormatRelationOptions
) {
  const bracket = getBracket(bracketType);
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const startTable = tableCollection.selectById(relationship.start.tableId);
  const endTable = tableCollection.selectById(relationship.end.tableId);

  if (startTable && endTable) {
    buffer.push(`ALTER TABLE ${bracket}${endTable.name}${bracket}`);

    // FK
    const startName = tableNamePart(startTable.name, bracketType);
    const endName = tableNamePart(endTable.name, bracketType);
    const fkName = autoNameIgnoreCase(fkNames, `FK_${startName}_TO_${endName}`);
    fkNames.push({
      id: nanoid(),
      name: fkName,
    });

    buffer.push(`  ADD CONSTRAINT ${bracket}${fkName}${bracket}`);

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
  }
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
    const [schema] = splitTableName(table.name, bracketType);
    let indexName = index.name;
    if (index.name.trim() === '') {
      const tableName = tableNamePart(table.name, bracketType);
      indexName = autoNameIgnoreCase(indexNames, `IDX_${tableName}`);
      indexNames.push({
        id: nanoid(),
        name: indexName,
      });
    }
    // Unqualified, the index lands in the current user's schema, where one name
    // given in two schemas clashes; a name the user already qualified keeps the
    // schema it names.
    const indexSchema =
      schema === '' || indexName.includes('.') ? '' : `${schema}.`;
    const indexRef = `${indexSchema}${bracket}${indexName}${bracket}`;

    if (index.unique) {
      buffer.push(`CREATE UNIQUE INDEX ${indexRef}`);
    } else {
      buffer.push(`CREATE INDEX ${indexRef}`);
    }
    buffer.push(
      `  ON ${bracket}${table.name}${bracket} (${formatNames(columnNames)});`
    );
  }
}
