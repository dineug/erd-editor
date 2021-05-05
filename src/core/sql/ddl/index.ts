import { Store } from '@@types/engine/store';
import { Table } from '@@types/engine/store/table.state';
import { Database } from '@@types/engine/store/canvas.state';
import { Name, getBracket } from './helper';
import {
  createDDL as createDDLMariaDB,
  formatTable as formatTableMariaDB,
  formatIndex as formatIndexMariaDB,
} from './MariaDB';
import {
  createDDL as createDDLMSSQL,
  formatTable as formatTableMSSQL,
  formatIndex as formatIndexMSSQL,
} from './MSSQL';
import {
  createDDL as createDDLMySQL,
  formatTable as formatTableMySQL,
  formatIndex as formatIndexMySQL,
} from './MySQL';
import {
  createDDL as createDDLOracle,
  formatTable as formatTableOracle,
  formatIndex as formatIndexOracle,
} from './Oracle';
import {
  createDDL as createDDLPostgreSQL,
  formatTable as formatTablePostgreSQL,
  formatIndex as formatIndexPostgreSQL,
} from './PostgreSQL';
import {
  createDDL as createDDLSQLite,
  formatTable as formatTableSQLite,
  formatIndex as formatIndexSQLite,
} from './SQLite';

export function createDDL(store: Store, database?: Database): string {
  const currentDatabase = database ? database : store.canvasState.database;
  switch (currentDatabase) {
    case 'MariaDB':
      return createDDLMariaDB(store);
    case 'MSSQL':
      return createDDLMSSQL(store);
    case 'MySQL':
      return createDDLMySQL(store);
    case 'Oracle':
      return createDDLOracle(store);
    case 'PostgreSQL':
      return createDDLPostgreSQL(store);
    case 'SQLite':
      return createDDLSQLite(store);
  }
  return '';
}

export function createDDLTable(
  { canvasState, tableState, relationshipState }: Store,
  table: Table
): string {
  const stringBuffer: string[] = [''];
  const database = canvasState.database;
  const indexNames: Name[] = [];
  const indexes = tableState.indexes.filter(
    index => index.tableId === table.id
  );
  const relationships = relationshipState.relationships;
  const tables = tableState.tables;
  const bracket = getBracket(canvasState.bracketType);
  switch (database) {
    case 'MariaDB':
      formatTableMariaDB({ table, buffer: stringBuffer, bracket });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexMariaDB({
          table,
          index,
          buffer: stringBuffer,
          indexNames,
          bracket,
        });
        stringBuffer.push('');
      });
      break;
    case 'MSSQL':
      formatTableMSSQL({ table, buffer: stringBuffer, bracket });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexMSSQL({
          table,
          index,
          buffer: stringBuffer,
          indexNames,
          bracket,
        });
        stringBuffer.push('');
      });
      break;
    case 'MySQL':
      formatTableMySQL({ table, buffer: stringBuffer, bracket });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexMySQL({
          table,
          index,
          buffer: stringBuffer,
          indexNames,
          bracket,
        });
        stringBuffer.push('');
      });
      break;
    case 'Oracle':
      formatTableOracle({ table, buffer: stringBuffer, bracket });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexOracle({
          table,
          index,
          buffer: stringBuffer,
          indexNames,
          bracket,
        });
        stringBuffer.push('');
      });
      break;
    case 'PostgreSQL':
      formatTablePostgreSQL({ table, buffer: stringBuffer, bracket });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexPostgreSQL({
          table,
          index,
          buffer: stringBuffer,
          indexNames,
          bracket,
        });
        stringBuffer.push('');
      });
      break;
    case 'SQLite':
      formatTableSQLite({
        table,
        tables,
        relationships: relationships.filter(
          relationship => relationship.end.tableId === table.id
        ),
        buffer: stringBuffer,
        bracket,
      });
      stringBuffer.push('');
      indexes.forEach(index => {
        formatIndexSQLite({
          table,
          index,
          buffer: stringBuffer,
          indexNames,
          bracket,
        });
        stringBuffer.push('');
      });
      break;
  }
  return stringBuffer.join('\n');
}
