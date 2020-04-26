import { Store } from "./Store";
import { createDDL as MariaDB } from "./sql/MariaDB";
import { createDDL as MSSQL } from "./sql/MSSQL";
import { createDDL as MySQL } from "./sql/MySQL";
import { createDDL as Oracle } from "./sql/Oracle";
import { createDDL as PostgreSQL } from "./sql/PostgreSQL";

export function createDDL(store: Store): string {
  const database = store.canvasState.database;
  switch (database) {
    case "MariaDB":
      return MariaDB(store);
    case "MSSQL":
      return MSSQL(store);
    case "MySQL":
      return MySQL(store);
    case "Oracle":
      return Oracle(store);
    case "PostgreSQL":
      return PostgreSQL(store);
  }
  return "";
}
