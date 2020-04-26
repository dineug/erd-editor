import { PrimitiveType, DataTypeHint, databaseHints } from "../DataType";
import { NameCase, Database } from "../store/Canvas";
import { camelCase, pascalCase, snakeCase } from "change-case";

export function getPrimitiveType(
  dataType: string,
  database: Database
): PrimitiveType {
  const dataTypeHints = getDataTypeHints(database);
  for (const dataTypeHint of dataTypeHints) {
    if (
      dataType
        .toLocaleLowerCase()
        .indexOf(dataTypeHint.name.toLocaleLowerCase()) === 0
    ) {
      return dataTypeHint.primitiveType;
    }
  }
  return "string";
}

export function getDataTypeHints(database: Database): DataTypeHint[] {
  for (const data of databaseHints) {
    if (data.database === database) {
      return data.dataTypeHints;
    }
  }
  return [];
}

export function getNameCase(name: string, nameCase: NameCase): string {
  let changeName = name;
  switch (nameCase) {
    case "camelCase":
      changeName = camelCase(name);
      break;
    case "pascalCase":
      changeName = pascalCase(name);
      break;
    case "snakeCase":
      changeName = snakeCase(name);
      break;
  }
  return changeName;
}
