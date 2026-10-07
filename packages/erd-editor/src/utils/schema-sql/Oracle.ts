import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import { SchemaSQLHeader, SchemaSQLStatements } from './options';
import {
  autoName,
  autoNameIgnoreCase,
  CreateSchemaOptions,
  createWrittenObjects,
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
  Name,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  splitTableName,
  tableNamePart,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
  toStringLiteral,
  unique,
  uniqueColumns,
  unquoteNamePart,
  WrittenObjects,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.Oracle);

export function createSchema(
  state: RootState,
  tableIds?: readonly string[],
  { written }: CreateSchemaOptions = { statements: SchemaSQLStatements.create }
): string {
  const {
    settings: { bracketType },
    collections,
  } = state;
  const fkNames: Name[] = [];
  const aiNames: Name[] = [];
  const trgNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);

  tables.forEach(table => {
    written?.tables.push(table);
    formatTable(state, { table, buffer: stringBuffer, written });
    stringBuffer.push('');

    formatUnique(state, { table, buffer: stringBuffer, written });

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
          id: uuid25(),
          name: aiName,
        });
        const sequence = `${owner}${aiName}`;
        written?.sequences.push(sequence);
        written?.identifiers.push(aiName);

        stringBuffer.push(`CREATE SEQUENCE ${sequence}`);
        stringBuffer.push(`START WITH 1`);
        stringBuffer.push(`INCREMENT BY 1;`);
        stringBuffer.push('');

        const trgName = autoName(aiNames, '', `SEQ_TRG_${tableName}`);
        trgNames.push({
          id: uuid25(),
          name: trgName,
        });
        written?.identifiers.push(trgName);
        stringBuffer.push(`CREATE OR REPLACE TRIGGER ${owner}${trgName}`);
        stringBuffer.push(`BEFORE INSERT ON ${table.name}`);
        stringBuffer.push(`REFERENCING NEW AS NEW FOR EACH ROW`);
        stringBuffer.push(`BEGIN`);
        stringBuffer.push(`  SELECT ${sequence}.NEXTVAL`);
        stringBuffer.push(`  INTO :NEW.${column.name}`);
        stringBuffer.push(`  FROM DUAL;`);
        stringBuffer.push(`END;`);
        // SQL*Plus and SQLcl run a PL/SQL block at the slash line after it.
        stringBuffer.push('/');
        stringBuffer.push('');
      }
    });

    formatComment(state, { table, buffer: stringBuffer });
  });

  relationships.forEach(relationship => {
    const wrote = formatRelation(state, {
      relationship,
      buffer: stringBuffer,
      fkNames,
      written,
    });
    if (wrote) stringBuffer.push('');
  });

  indexes.forEach(index => {
    formatIndex(state, {
      index,
      buffer: stringBuffer,
      indexNames,
      written,
    });
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table, written }: FormatTableOptions
) {
  const {
    settings: { bracketType },
    collections,
  } = state;
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  if (written) {
    const [schema, tableName] = splitTableName(table.name, bracketType);
    if (schema !== '') written.identifiers.push(unquoteNamePart(schema));
    written.identifiers.push(unquoteNamePart(tableName));
    written.identifiers.push(...columns.map(column => column.name));
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
    const pkName = `PK_${tableNamePart(table.name, bracketType)}`;
    written?.identifiers.push(pkName);
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
  { buffer, table, written }: FormatTableOptions
) {
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  if (!unique(columns)) return;

  uniqueColumns(columns).forEach(column => {
    const uqName = `UQ_${tableNamePart(table.name, bracketType)}_${column.name}`;
    written?.identifiers.push(uqName);
    buffer.push(`ALTER TABLE ${bracket}${table.name}${bracket}`);
    buffer.push(
      `  ADD CONSTRAINT ${bracket}${uqName}${bracket} UNIQUE (${bracket}${column.name}${bracket});`
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
  state: RootState,
  { buffer, relationship, fkNames, written }: FormatRelationOptions
): boolean {
  const {
    settings: { bracketType },
  } = state;
  const columns = toForeignKeyPairs(state, relationship);
  if (!columns) return false;

  const { startTable, endTable } = columns;
  const bracket = getBracket(bracketType);
  buffer.push(`ALTER TABLE ${bracket}${endTable.name}${bracket}`);

  // FK
  const startName = tableNamePart(startTable.name, bracketType);
  const endName = tableNamePart(endTable.name, bracketType);
  const fkName = autoNameIgnoreCase(fkNames, `FK_${startName}_TO_${endName}`);
  fkNames.push({
    id: uuid25(),
    name: fkName,
  });
  written?.identifiers.push(fkName);

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

export function formatIndex(
  { settings: { bracketType }, collections }: RootState,
  { buffer, index, indexNames, written }: FormatIndexOptions
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
        id: uuid25(),
        name: indexName,
      });
    }
    // Unqualified, the index lands in the current user's schema, where one name
    // given in two schemas clashes; a name the user already qualified keeps the
    // schema it names.
    const indexSchema =
      schema === '' || indexName.includes('.') ? '' : `${schema}.`;
    const indexRef = `${indexSchema}${bracket}${indexName}${bracket}`;
    written?.identifiers.push(indexName.slice(indexName.lastIndexOf('.') + 1));

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

/** The names an Oracle script writes that run past the 30 bytes Oracle 12.1 and older allow. */
export function oracleLongNames(state: RootState): string[] {
  const written = createWrittenObjects();
  createSchema(state, undefined, {
    statements: SchemaSQLStatements.create,
    written,
  });
  const encoder = new TextEncoder();

  return [...new Set(written.identifiers)].filter(
    name => encoder.encode(name).length > 30
  );
}

/** ALTER SESSION SET CURRENT_SCHEMA for use; Oracle creates no schema apart from a user. */
export function formatHeader(
  { settings: { bracketType } }: RootState,
  header: Exclude<SchemaSQLHeader, 'none'>,
  name: string
): string {
  if (header !== SchemaSQLHeader.use) return '';

  const bracket = getBracket(bracketType);
  return `ALTER SESSION SET CURRENT_SCHEMA = ${bracket}${name}${bracket};`;
}

// A PL/SQL block that runs one statement and lets the error pass that says
// what it drops is not there; SQL*Plus runs it at the slash line.
function ignoringError(statement: string, code: number): string {
  return [
    'BEGIN',
    `  EXECUTE IMMEDIATE ${toStringLiteral(statement)};`,
    'EXCEPTION WHEN OTHERS THEN',
    `  IF SQLCODE != ${code} THEN RAISE; END IF;`,
    'END;',
    '/',
  ].join('\n');
}

/**
 * Each table written dropped with its constraints, then each sequence, every one
 * in a block that passes over ORA-00942 or ORA-02289, since Oracle has no DROP
 * IF EXISTS before 23ai.
 */
export function formatDropBlock(
  { settings: { bracketType } }: RootState,
  { tables, sequences }: WrittenObjects
): string {
  if (tables.length === 0) return '';

  const bracket = getBracket(bracketType);
  return [
    ...tables.map(({ name }) =>
      ignoringError(
        `DROP TABLE ${bracket}${name}${bracket} CASCADE CONSTRAINTS`,
        -942
      )
    ),
    ...sequences.map(sequence =>
      ignoringError(`DROP SEQUENCE ${sequence}`, -2289)
    ),
  ].join('\n\n');
}
