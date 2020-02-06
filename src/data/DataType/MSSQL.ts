import { DataTypeHint } from "../DataType";

// https://docs.microsoft.com/ko-kr/sql/t-sql/data-types/data-types-transact-sql?view=sql-server-ver15
const MSSQLTypes: DataTypeHint[] = [
  { name: "bigint", primitiveType: "long" },
  { name: "numeric", primitiveType: "float" },
  { name: "bit", primitiveType: "int" },
  { name: "smallint", primitiveType: "int" },
  { name: "decimal", primitiveType: "decimal" },
  { name: "smallmoney", primitiveType: "float" },
  { name: "int", primitiveType: "int" },
  { name: "tinyint", primitiveType: "int" },
  { name: "money", primitiveType: "double" },
  { name: "float", primitiveType: "double" },
  { name: "real", primitiveType: "float" },
  { name: "date", primitiveType: "date" },
  { name: "datetimeoffset", primitiveType: "dateTime" },
  { name: "datetime2", primitiveType: "dateTime" },
  { name: "smalldatetime", primitiveType: "dateTime" },
  { name: "datetime", primitiveType: "dateTime" },
  { name: "time", primitiveType: "time" },
  { name: "char", primitiveType: "string" },
  { name: "varchar", primitiveType: "string" },
  { name: "text", primitiveType: "lob" },
  { name: "nchar", primitiveType: "string" },
  { name: "nvarchar", primitiveType: "string" },
  { name: "ntext", primitiveType: "lob" },
  { name: "binary", primitiveType: "lob" },
  { name: "varbinary", primitiveType: "string" },
  { name: "image", primitiveType: "lob" },
  { name: "sql_variant", primitiveType: "string" },
  { name: "xml", primitiveType: "lob" },
  { name: "geometry", primitiveType: "string" },
  { name: "geography", primitiveType: "string" }
];

export default MSSQLTypes;
