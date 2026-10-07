import { query } from '@dineug/erd-editor-schema';

import { Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';

import {
  createSchema as createSchemaDatabricks,
  formatDropBlock as formatDropBlockDatabricks,
  formatHeader as formatHeaderDatabricks,
  formatIndex as formatIndexDatabricks,
  formatTable as formatTableDatabricks,
  formatUnique as formatUniqueDatabricks,
} from './Databricks';
import {
  createSchema as createSchemaMariaDB,
  formatDropBlock as formatDropBlockMariaDB,
  formatHeader as formatHeaderMariaDB,
  formatIndex as formatIndexMariaDB,
  formatTable as formatTableMariaDB,
  formatUnique as formatUniqueMariaDB,
} from './MariaDB';
import {
  createSchema as createSchemaMSSQL,
  formatDropBlock as formatDropBlockMSSQL,
  formatHeader as formatHeaderMSSQL,
  formatIndex as formatIndexMSSQL,
  formatTable as formatTableMSSQL,
  formatUnique as formatUniqueMSSQL,
} from './MSSQL';
import {
  createSchema as createSchemaMySQL,
  formatDropBlock as formatDropBlockMySQL,
  formatHeader as formatHeaderMySQL,
  formatIndex as formatIndexMySQL,
  formatTable as formatTableMySQL,
  formatUnique as formatUniqueMySQL,
} from './MySQL';
import {
  formatScript,
  resolveSchemaSQLOptions,
  SchemaSQLHeader,
  SchemaSQLOptions,
  SchemaSQLStatements,
} from './options';
import {
  createSchema as createSchemaOracle,
  formatDropBlock as formatDropBlockOracle,
  formatHeader as formatHeaderOracle,
  formatIndex as formatIndexOracle,
  formatTable as formatTableOracle,
  formatUnique as formatUniqueOracle,
} from './Oracle';
import {
  createSchema as createSchemaPostgreSQL,
  formatDropBlock as formatDropBlockPostgreSQL,
  formatHeader as formatHeaderPostgreSQL,
  formatIndex as formatIndexPostgreSQL,
  formatTable as formatTablePostgreSQL,
} from './PostgreSQL';
import {
  createSchema as createSchemaSnowflake,
  formatDropBlock as formatDropBlockSnowflake,
  formatHeader as formatHeaderSnowflake,
  formatIndex as formatIndexSnowflake,
  formatTable as formatTableSnowflake,
} from './Snowflake';
import {
  createSchema as createSchemaSQLite,
  formatDropBlock as formatDropBlockSQLite,
  formatHeader as formatHeaderSQLite,
  formatIndex as formatIndexSQLite,
  formatTable as formatTableSQLite,
} from './SQLite';
import {
  CreateSchemaOptions,
  createWrittenObjects,
  Name,
  toSchemaEntities,
  WrittenObjects,
} from './utils';

export {
  HEADER_NAME_PATTERN,
  isSchemaSQLHeader,
  isSchemaSQLStatements,
  type ResolvedSchemaSQLOptions,
  resolveSchemaSQLOptions,
  SchemaSQLHeader,
  SchemaSQLHeaderList,
  type SchemaSQLOptions,
  SchemaSQLStatements,
  SchemaSQLStatementsList,
  schemaSQLSupport,
} from './options';
export { oracleLongNames } from './Oracle';

// What one database writes: the tables, the header and the DROP block.
type SchemaSQLWriter = {
  createSchema: (
    state: RootState,
    tableIds: readonly string[] | undefined,
    options: CreateSchemaOptions
  ) => string;
  formatHeader: (
    state: RootState,
    header: Exclude<SchemaSQLHeader, 'none'>,
    name: string
  ) => string;
  formatDropBlock: (
    state: RootState,
    written: WrittenObjects,
    header: SchemaSQLHeader,
    name: string
  ) => string;
};

const WRITERS: Record<number, SchemaSQLWriter> = {
  [Database.Databricks]: {
    createSchema: createSchemaDatabricks,
    formatHeader: formatHeaderDatabricks,
    formatDropBlock: formatDropBlockDatabricks,
  },
  [Database.MariaDB]: {
    createSchema: createSchemaMariaDB,
    formatHeader: formatHeaderMariaDB,
    formatDropBlock: formatDropBlockMariaDB,
  },
  [Database.MSSQL]: {
    createSchema: createSchemaMSSQL,
    formatHeader: formatHeaderMSSQL,
    formatDropBlock: formatDropBlockMSSQL,
  },
  [Database.MySQL]: {
    createSchema: createSchemaMySQL,
    formatHeader: formatHeaderMySQL,
    formatDropBlock: formatDropBlockMySQL,
  },
  [Database.Oracle]: {
    createSchema: createSchemaOracle,
    formatHeader: formatHeaderOracle,
    formatDropBlock: formatDropBlockOracle,
  },
  [Database.PostgreSQL]: {
    createSchema: createSchemaPostgreSQL,
    formatHeader: formatHeaderPostgreSQL,
    formatDropBlock: formatDropBlockPostgreSQL,
  },
  [Database.Snowflake]: {
    createSchema: createSchemaSnowflake,
    formatHeader: formatHeaderSnowflake,
    formatDropBlock: formatDropBlockSnowflake,
  },
  [Database.SQLite]: {
    createSchema: createSchemaSQLite,
    formatHeader: formatHeaderSQLite,
    formatDropBlock: formatDropBlockSQLite,
  },
};

// A body a writer returns opens and closes with a line break, or is empty.
function withoutEdges(sql: string): string {
  return sql === '' ? '' : sql.slice(1, -1);
}

/**
 * The DDL of the document in a database, the document's own by default: the
 * header, the before script, the DROP block, the tables and the after script.
 * Given table ids, only those tables, their indexes and foreign keys, no script.
 */
export function createSchemaSQL(
  state: RootState,
  database?: number,
  tableIds?: readonly string[],
  options?: SchemaSQLOptions
): string {
  const currentDatabase = database ? database : state.settings.database;
  const writer = WRITERS[currentDatabase];
  if (!writer) return '';

  const { databaseName } = state.settings;
  const resolved = resolveSchemaSQLOptions(
    currentDatabase,
    options,
    databaseName
  );
  const written = createWrittenObjects();
  const body = withoutEdges(
    writer.createSchema(state, tableIds, {
      statements: resolved.statements,
      written,
    })
  );
  // The scripts belong to the whole document, never to a few of its tables.
  const whole = tableIds === undefined;
  const scripts = state.settings.ddlScripts;
  const before = whole
    ? formatScript(scripts?.before ?? '', currentDatabase)
    : '';
  const after = whole
    ? formatScript(scripts?.after ?? '', currentDatabase)
    : '';
  // A name no plain identifier writes no header, and no schema on a DROP.
  const header =
    resolved.headerName === 'valid' ? resolved.header : SchemaSQLHeader.none;
  const drop =
    resolved.statements === SchemaSQLStatements.recreate
      ? writer.formatDropBlock(state, written, header, databaseName)
      : '';
  if (!before && !drop && !body && !after) return '';

  const headerText =
    header === SchemaSQLHeader.none
      ? ''
      : writer.formatHeader(state, header, databaseName);
  // An index with no column left writes its blank line alone, a second one
  // before the after script; with none after, the body ends as it always has.
  const tables = after ? body.replace(/\n+$/, '') : body;
  const chunks = [headerText, before, drop, tables, after].filter(Boolean);

  return `\n${chunks.join('\n\n')}\n`;
}

/** The names of the tables the whole document's DDL writes, in its order. */
export function schemaSQLTables(state: RootState): string[] {
  return toSchemaEntities(state).tables.map(table => table.name);
}

/**
 * One table's DDL for the table properties Schema SQL tab: the table, the
 * uniqueness its columns carry where the whole export writes it as its own
 * statement, and the table's indexes.
 */
export function createSchemaSQLTable(state: RootState, table: Table) {
  const {
    settings,
    doc: { indexIds },
    collections,
  } = state;
  const buffer: string[] = [''];
  const database = settings.database;
  const indexNames: Name[] = [];
  const indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id);

  switch (database) {
    case Database.Databricks:
      formatTableDatabricks(state, { buffer, table });
      buffer.push('');
      formatUniqueDatabricks(state, { buffer, table });
      indexes.forEach(index => {
        formatIndexDatabricks(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.MariaDB:
      formatTableMariaDB(state, { buffer, table });
      buffer.push('');
      formatUniqueMariaDB(state, { buffer, table });
      indexes.forEach(index => {
        formatIndexMariaDB(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.MSSQL:
      formatTableMSSQL(state, { buffer, table });
      buffer.push('');
      formatUniqueMSSQL(state, { buffer, table });
      indexes.forEach(index => {
        formatIndexMSSQL(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.MySQL:
      formatTableMySQL(state, { buffer, table });
      buffer.push('');
      formatUniqueMySQL(state, { buffer, table });
      indexes.forEach(index => {
        formatIndexMySQL(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.Oracle:
      formatTableOracle(state, { buffer, table });
      buffer.push('');
      formatUniqueOracle(state, { buffer, table });
      indexes.forEach(index => {
        formatIndexOracle(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.PostgreSQL:
      formatTablePostgreSQL(state, { buffer, table });
      buffer.push('');
      indexes.forEach(index => {
        formatIndexPostgreSQL(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.Snowflake:
      formatTableSnowflake(state, { buffer, table });
      buffer.push('');
      indexes.forEach(index => {
        formatIndexSnowflake(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
    case Database.SQLite:
      formatTableSQLite(state, { buffer, table });
      buffer.push('');
      indexes.forEach(index => {
        formatIndexSQLite(state, {
          index,
          buffer,
          indexNames,
        });
        buffer.push('');
      });
      break;
  }

  return buffer.join('\n');
}
