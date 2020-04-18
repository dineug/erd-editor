import { MariaDBTypes } from "./dataType/MariaDB";
import { MSSQLTypes } from "./dataType/MSSQL";
import { MySQLTypes } from "./dataType/MySQL";
import { OracleTypes } from "./dataType/Oracle";
import { PostgreSQLTypes } from "./dataType/PostgreSQL";
import { Database } from "./store/Canvas";

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

export const databaseHints: DatabaseHint[] = [
  {
    database: "MariaDB",
    dataTypeHints: MariaDBTypes,
  },
  {
    database: "MSSQL",
    dataTypeHints: MSSQLTypes,
  },
  {
    database: "MySQL",
    dataTypeHints: MySQLTypes,
  },
  {
    database: "Oracle",
    dataTypeHints: OracleTypes,
  },
  {
    database: "PostgreSQL",
    dataTypeHints: PostgreSQLTypes,
  },
];
