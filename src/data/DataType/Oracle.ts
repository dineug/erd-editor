import { DataTypeHint } from "../DataType";

// https://docs.oracle.com/cd/B28359_01/server.111/b28318/datatype.htm#CNCPT012
const OracleTypes: DataTypeHint[] = [
  { name: "CHAR", primitiveType: "string" },
  { name: "VARCHAR", primitiveType: "string" },
  { name: "VARCHAR2", primitiveType: "string" },
  { name: "NCHAR", primitiveType: "string" },
  { name: "NVARCHAR2", primitiveType: "string" },
  { name: "CLOB", primitiveType: "lob" },
  { name: "NCLOB", primitiveType: "lob" },
  { name: "LONG", primitiveType: "lob" },
  { name: "BLOB", primitiveType: "lob" },
  { name: "BFILE", primitiveType: "lob" },
  { name: "RAW", primitiveType: "lob" },
  { name: "LONG RAW", primitiveType: "lob" },
  { name: "NUMBER", primitiveType: "long" },
  { name: "BINARY_FLOAT", primitiveType: "float" },
  { name: "BINARY_DOUBLE", primitiveType: "double" },
  { name: "DATE", primitiveType: "date" },
  { name: "DATETIME", primitiveType: "dateTime" },
  { name: "TIMESTAMP", primitiveType: "dateTime" },
  { name: "TIMESTAMP WITH TIME ZONE", primitiveType: "dateTime" },
  { name: "TIMESTAMP WITH LOCAL TIME ZONE", primitiveType: "dateTime" },
  { name: "XMLType", primitiveType: "string" },
  { name: "UriType", primitiveType: "string" }
];

export default OracleTypes;
