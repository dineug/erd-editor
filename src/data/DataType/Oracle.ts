import { DataTypeHint } from "../DataType";

// https://docs.oracle.com/cd/B28359_01/server.111/b28318/datatype.htm#CNCPT012
const OracleTypes: DataTypeHint[] = [
  { name: "CHAR", primitiveType: "string" },
  { name: "VARCHAR", primitiveType: "string" },
  { name: "VARCHAR2", primitiveType: "string" },
  { name: "NCHAR", primitiveType: "string" },
  { name: "NVARCHAR2", primitiveType: "string" },
  { name: "CLOB", primitiveType: "string" },
  { name: "NCLOB", primitiveType: "string" },
  { name: "LONG", primitiveType: "string" },
  { name: "BLOB", primitiveType: "string" },
  { name: "BFILE", primitiveType: "string" },
  { name: "RAW", primitiveType: "string" },
  { name: "LONG RAW", primitiveType: "string" },
  { name: "NUMBER", primitiveType: "int" },
  { name: "BINARY_FLOAT", primitiveType: "float" },
  { name: "BINARY_DOUBLE", primitiveType: "float" },
  { name: "DATE", primitiveType: "date" },
  { name: "DATETIME", primitiveType: "dateTime" },
  { name: "TIMESTAMP", primitiveType: "dateTime" },
  { name: "TIMESTAMP WITH TIME ZONE", primitiveType: "dateTime" },
  { name: "TIMESTAMP WITH LOCAL TIME ZONE", primitiveType: "dateTime" },
  { name: "XMLType", primitiveType: "string" },
  { name: "UriType", primitiveType: "string" }
];

export default OracleTypes;
