import databases, {
  PrimitiveType,
  DataTypeHint,
  Database
} from "@/data/DataType";

export function getPrimitiveType(
  dataType: string,
  database: Database
): PrimitiveType {
  const dataTypeHints = getDataTypeHints(database);
  for (const dataTypeHint of dataTypeHints) {
    if (
      dataType
        .toLocaleLowerCase()
        .indexOf(dataTypeHint.name.toLocaleLowerCase()) !== -1
    ) {
      return dataTypeHint.primitiveType;
    }
  }
  return "string";
}

export function getDataTypeHints(database: Database): DataTypeHint[] {
  for (const data of databases) {
    if (data.database === database) {
      return data.dataTypeHints;
    }
  }
  return [];
}
