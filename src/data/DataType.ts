import MariaDB from "./DataType/MariaDB";
import MSSQL from "./DataType/MSSQL";
import MySQL from "./DataType/MySQL";
import Oracle from "./DataType/Oracle";
import PostgreSQL from "./DataType/PostgreSQL";

export const enum Database {
  MariaDB = "MariaDB",
  MSSQL = "MSSQL",
  MySQL = "MySQL",
  Oracle = "Oracle",
  PostgreSQL = "PostgreSQL"
}

export type PrimitiveType =
  | "int"
  | "long"
  | "float"
  | "double"
  | "decimal"
  | "boolean"
  | "string"
  | "lob"
  | "date"
  | "dateTime"
  | "time";

export interface DataTypeHint {
  name: string;
  primitiveType: PrimitiveType;
}

export interface DatabaseHint {
  database: Database;
  dataTypeHints: DataTypeHint[];
}

const databases: DatabaseHint[] = [
  {
    database: Database.MariaDB,
    dataTypeHints: MariaDB
  },
  {
    database: Database.MSSQL,
    dataTypeHints: MSSQL
  },
  {
    database: Database.MySQL,
    dataTypeHints: MySQL
  },
  {
    database: Database.Oracle,
    dataTypeHints: Oracle
  },
  {
    database: Database.PostgreSQL,
    dataTypeHints: PostgreSQL
  }
];

export default databases;
