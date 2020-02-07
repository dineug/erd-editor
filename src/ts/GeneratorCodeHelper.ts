import databases, {
  PrimitiveType,
  DataTypeHint,
  Database
} from "@/data/DataType";
import { Case } from "@/ts/GeneratorCode";
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
  for (const data of databases) {
    if (data.database === database) {
      return data.dataTypeHints;
    }
  }
  return [];
}

export function getNameCase(name: string, nameCase: Case): string {
  let changeName = name;
  switch (nameCase) {
    case Case.camelCase:
      changeName = camelCase(name);
      break;
    case Case.pascalCase:
      changeName = pascalCase(name);
      break;
    case Case.snakeCase:
      changeName = snakeCase(name);
      break;
  }
  return changeName;
}
