import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { query } from '@/utils/collection/query';

import {
  autoName,
  FormatColumnOptions,
  FormatCommentOptions,
  FormatIndexOptions,
  formatNames,
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
  unique,
  uniqueColumns,
} from './utils';

export function createSchema(state: RootState): string {
  const {
    settings: { bracketType },
    doc: { tableIds, relationshipIds, indexIds },
    collections,
  } = state;
  const fkNames: Name[] = [];
  const aiNames: Name[] = [];
  const trgNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const bracket = getBracket(bracketType);
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

    // unique
    if (unique(columns)) {
      const uqColumns = uniqueColumns(columns);
      uqColumns.forEach(column => {
        stringBuffer.push(`ALTER TABLE ${bracket}${table.name}${bracket}`);
        stringBuffer.push(
          `  ADD CONSTRAINT ${bracket}UQ_${column.name}${bracket} UNIQUE (${bracket}${column.name}${bracket});`
        );
        stringBuffer.push('');
      });
    }

    // Sequence
    columns.forEach(column => {
      if (bHas(column.options, ColumnOption.autoIncrement)) {
        let aiName = `SEQ_${table.name}`;
        aiName = autoName(aiNames, '', aiName);
        aiNames.push({
          id: nanoid(),
          name: aiName,
        });

        stringBuffer.push(`CREATE SEQUENCE ${aiName}`);
        stringBuffer.push(`START WITH 1`);
        stringBuffer.push(`INCREMENT BY 1;`);
        stringBuffer.push('');

        let trgName = `SEQ_TRG_${table.name}`;
        trgName = autoName(aiNames, '', trgName);
        trgNames.push({
          id: nanoid(),
          name: trgName,
        });
        stringBuffer.push(`CREATE OR REPLACE TRIGGER ${trgName}`);
        stringBuffer.push(`BEFORE INSERT ON ${table.name}`);
        stringBuffer.push(`REFERENCING NEW AS NEW FOR EACH ROW`);
        stringBuffer.push(`BEGIN`);
        stringBuffer.push(`  SELECT ${aiName}.NEXTVAL`);
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
    buffer.push(
      `  CONSTRAINT ${bracket}PK_${
        table.name
      }${bracket} PRIMARY KEY (${formatNames(pkColumns, bracket)})`
    );
  }
  buffer.push(`);`);
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
      `COMMENT ON TABLE ${bracket}${table.name}${bracket} IS '${table.comment}';`
    );
    buffer.push('');
  }
  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      if (column.comment.trim() !== '') {
        buffer.push(
          `COMMENT ON COLUMN ${bracket}${table.name}${bracket}.${bracket}${column.name}${bracket} IS '${column.comment}';`
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
    let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
    fkName = autoName(fkNames, '', fkName);
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
      )});`
    );
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
        .selectById(indexColumn.id);
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
