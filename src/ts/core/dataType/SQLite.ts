import { DataTypeHint } from "../DataType";

/**
 * https://www.sqlite.org/datatype3.html
 */
export const SQLiteTypes: DataTypeHint[] = [
  { name: "TEXT", primitiveType: "string" },
  { name: "NUMERIC", primitiveType: "decimal" },
  { name: "INTEGER", primitiveType: "int" },
  { name: "REAL", primitiveType: "double" },
  { name: "BLOB", primitiveType: "lob" },
];
