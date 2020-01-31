import { DataTypeHint } from "../DataType";

// https://docs.microsoft.com/ko-kr/sql/t-sql/data-types/data-types-transact-sql?view=sql-server-ver15
const MSSQLTypes: DataTypeHint[] = [
  { name: "bigint", primitiveType: "int" },
  { name: "numeric", primitiveType: "float" },
  { name: "bit", primitiveType: "int" },
  { name: "smallint", primitiveType: "int" },
  { name: "decimal", primitiveType: "float" },
  { name: "smallmoney", primitiveType: "float" },
  { name: "int", primitiveType: "int" },
  { name: "tinyint", primitiveType: "int" },
  { name: "money", primitiveType: "float" },
  { name: "float", primitiveType: "float" },
  { name: "real", primitiveType: "float" },
  { name: "date", primitiveType: "date" },
  { name: "datetimeoffset", primitiveType: "dateTime" },
  { name: "datetime2", primitiveType: "dateTime" },
  { name: "smalldatetime", primitiveType: "dateTime" },
  { name: "datetime", primitiveType: "dateTime" },
  { name: "time", primitiveType: "time" },
  { name: "char", primitiveType: "string" },
  { name: "varchar", primitiveType: "string" },
  { name: "text", primitiveType: "string" },
  { name: "nchar", primitiveType: "string" },
  { name: "nvarchar", primitiveType: "string" },
  { name: "ntext", primitiveType: "string" },
  { name: "binary", primitiveType: "string" },
  { name: "varbinary", primitiveType: "string" },
  { name: "image", primitiveType: "string" },
  { name: "sql_variant", primitiveType: "string" },
  { name: "xml", primitiveType: "string" },
  { name: "geometry", primitiveType: "string" },
  { name: "geography", primitiveType: "string" }
];

export default MSSQLTypes;
