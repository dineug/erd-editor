import { Store } from "./Store";
import { Table } from "./store/Table";
import { Name } from "./helper/SQLHelper";
import {
  createDDL as createDDLMariaDB,
  formatTable as formatTableMariaDB,
  formatIndex as formatIndexMariaDB,
} from "./sql/MariaDB";
import {
  createDDL as createDDLMSSQL,
  formatTable as formatTableMSSQL,
  formatIndex as formatIndexMSSQL,
} from "./sql/MSSQL";
import {
  createDDL as createDDLMySQL,
  formatTable as formatTableMySQL,
  formatIndex as formatIndexMySQL,
} from "./sql/MySQL";
import {
  createDDL as createDDLOracle,
  formatTable as formatTableOracle,
  formatIndex as formatIndexOracle,
} from "./sql/Oracle";
import {
  createDDL as createDDLPostgreSQL,
  formatTable as formatTablePostgreSQL,
  formatIndex as formatIndexPostgreSQL,
} from "./sql/PostgreSQL";
import { createDDL as createDDLSQLite } from "./sql/SQLite";

export function createDDL(store: Store): string {
  const database = store.canvasState.database;
  switch (database) {
    case "MariaDB":
      return createDDLMariaDB(store);
    case "MSSQL":
      return createDDLMSSQL(store);
    case "MySQL":
      return createDDLMySQL(store);
    case "Oracle":
      return createDDLOracle(store);
    case "PostgreSQL":
      return createDDLPostgreSQL(store);
    case "SQLite":
      return createDDLSQLite(store);
  }
  return "";
}

export function createDDLTable(store: Store, table: Table): string {
  const stringBuffer: string[] = [""];
  const database = store.canvasState.database;
  const indexNames: Name[] = [];
  const indexes = store.tableState.indexes.filter(
    (index) => index.tableId === table.id
  );
  switch (database) {
    case "MariaDB":
      formatTableMariaDB(table, stringBuffer);
      stringBuffer.push("");
      indexes.forEach((index) => {
        formatIndexMariaDB(table, index, stringBuffer, indexNames);
        stringBuffer.push("");
      });
      break;
    case "MSSQL":
      formatTableMSSQL(table, stringBuffer);
      stringBuffer.push("");
      indexes.forEach((index) => {
        formatIndexMSSQL(table, index, stringBuffer, indexNames);
        stringBuffer.push("");
      });
      break;
    case "MySQL":
      formatTableMySQL(table, stringBuffer);
      stringBuffer.push("");
      indexes.forEach((index) => {
        formatIndexMySQL(table, index, stringBuffer, indexNames);
        stringBuffer.push("");
      });
      break;
    case "Oracle":
      formatTableOracle(table, stringBuffer);
      stringBuffer.push("");
      indexes.forEach((index) => {
        formatIndexOracle(table, index, stringBuffer, indexNames);
        stringBuffer.push("");
      });
      break;
    case "PostgreSQL":
      formatTablePostgreSQL(table, stringBuffer);
      stringBuffer.push("");
      indexes.forEach((index) => {
        formatIndexPostgreSQL(table, index, stringBuffer, indexNames);
        stringBuffer.push("");
      });
      break;
  }
  return stringBuffer.join("\n");
}
