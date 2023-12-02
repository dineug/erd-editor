import { Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { query } from '@/utils/collection/query';

import {
  createSchema as createSchemaMariaDB,
  formatIndex as formatIndexMariaDB,
  formatTable as formatTableMariaDB,
} from './MariaDB';
import {
  createSchema as createSchemaMSSQL,
  formatIndex as formatIndexMSSQL,
  formatTable as formatTableMSSQL,
} from './MSSQL';
import {
  createSchema as createSchemaMySQL,
  formatIndex as formatIndexMySQL,
  formatTable as formatTableMySQL,
} from './MySQL';
import {
  createSchema as createSchemaOracle,
  formatIndex as formatIndexOracle,
  formatTable as formatTableOracle,
} from './Oracle';
import {
  createSchema as createSchemaPostgreSQL,
  formatIndex as formatIndexPostgreSQL,
  formatTable as formatTablePostgreSQL,
} from './PostgreSQL';
import {
  createSchema as createSchemaSQLite,
  formatIndex as formatIndexSQLite,
  formatTable as formatTableSQLite,
} from './SQLite';
import { Name } from './utils';

export function createSchemaSQL(state: RootState, database?: number): string {
  const currentDatabase = database ? database : state.settings.database;
  switch (currentDatabase) {
    case Database.MariaDB:
      return createSchemaMariaDB(state);
    case Database.MSSQL:
      return createSchemaMSSQL(state);
    case Database.MySQL:
      return createSchemaMySQL(state);
    case Database.Oracle:
      return createSchemaOracle(state);
    case Database.PostgreSQL:
      return createSchemaPostgreSQL(state);
    case Database.SQLite:
      return createSchemaSQLite(state);
  }

  return '';
}

export function createSchemaSQLTable(state: RootState, table: Table) {
  const {
    settings,
    doc: { indexIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const database = settings.database;
  const indexNames: Name[] = [];
  const indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds);

  switch (database) {
    case Database.MariaDB:
      formatTableMariaDB(state, { table, buffer: stringBuffer });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexMariaDB(state, {
          index,
          buffer: stringBuffer,
          indexNames,
        });
        stringBuffer.push('');
      });
      break;
    case Database.MSSQL:
      formatTableMSSQL(state, { table, buffer: stringBuffer });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexMSSQL(state, {
          index,
          buffer: stringBuffer,
          indexNames,
        });
        stringBuffer.push('');
      });
      break;
    case Database.MySQL:
      formatTableMySQL(state, { table, buffer: stringBuffer });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexMySQL(state, {
          index,
          buffer: stringBuffer,
          indexNames,
        });
        stringBuffer.push('');
      });
      break;
    case Database.Oracle:
      formatTableOracle(state, { table, buffer: stringBuffer });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexOracle(state, {
          index,
          buffer: stringBuffer,
          indexNames,
        });
        stringBuffer.push('');
      });
      break;
    case Database.PostgreSQL:
      formatTablePostgreSQL(state, { table, buffer: stringBuffer });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexPostgreSQL(state, {
          index,
          buffer: stringBuffer,
          indexNames,
        });
        stringBuffer.push('');
      });
      break;
    case Database.SQLite:
      formatTableSQLite(state, {
        table,
        buffer: stringBuffer,
      });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexSQLite(state, {
          index,
          buffer: stringBuffer,
          indexNames,
        });
        stringBuffer.push('');
      });
      break;
  }

  return stringBuffer.join('\n');
}
