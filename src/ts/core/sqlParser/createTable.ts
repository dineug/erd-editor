import {
  Token,
  StatementType,
  isDataType,
  isNot,
  isNull,
  isDefault,
  isAutoIncrement,
  isComment,
  isPrimary,
  isKey,
  isUnique,
  isConstraint,
} from "./SQLParserHelper";

export interface CreateTable {
  type: StatementType;
  name: string;
  comment: string;
  columns: Column[];
}

interface Column {
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  nullable: boolean;
}

export function createTable(tokens: Token[]): CreateTable {
  const current = { value: 0 };

  const ast: CreateTable = {
    type: "create.table",
    name: "",
    comment: "",
    columns: [],
  };

  while (current.value < tokens.length) {
    let token = tokens[current.value];

    if (token.type === "leftParen") {
      current.value++;
      ast.columns = createTableColumns(tokens, current);
      continue;
    }

    if (token.type === "string" && ast.name === "") {
      ast.name = token.value;
      current.value++;
      continue;
    }

    if (isComment(token)) {
      token = tokens[++current.value];

      if (token && token.type === "string") {
        ast.comment = token.value;
        current.value++;
      }

      continue;
    }

    current.value++;
  }

  return ast;
}

function createTableColumns(
  tokens: Token[],
  current: { value: number }
): Column[] {
  const ast: Column[] = [];
  const primaryKeyNames: string[] = [];
  const uniqueNames: string[] = [];

  let column = {
    name: "",
    dataType: "",
    default: "",
    comment: "",
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    nullable: true,
  };

  while (current.value < tokens.length) {
    let token = tokens[current.value];

    if (token.type === "string" && column.name === "") {
      column.name = token.value;
      current.value++;
      continue;
    }

    if (isDataType(token)) {
      let value = token.value;
      token = tokens[++current.value];

      if (token && token.type === "leftParen") {
        value += "(";
        token = tokens[++current.value];

        while (current.value < tokens.length && token.type !== "rightParen") {
          value += token.value;
          token = tokens[++current.value];
        }

        value += ")";
        current.value++;
      }

      column.dataType = value;
      continue;
    }

    if (token.type === "leftParen") {
      token = tokens[++current.value];

      while (current.value < tokens.length && token.type !== "rightParen") {
        token = tokens[++current.value];
      }

      current.value++;
      continue;
    }

    if (isConstraint(token)) {
      token = tokens[++current.value];

      if (token.type === "string") {
        current.value++;
      }

      continue;
    }

    if (isPrimary(token)) {
      token = tokens[++current.value];

      if (token && isKey(token)) {
        token = tokens[++current.value];

        if (token && token.type === "leftParen") {
          token = tokens[++current.value];

          while (current.value < tokens.length && token.type !== "rightParen") {
            if (token.type !== "comma") {
              primaryKeyNames.push(token.value.toUpperCase());
            }
            token = tokens[++current.value];
          }

          current.value++;
        } else {
          column.primaryKey = true;
        }
      }

      continue;
    }

    if (isUnique(token)) {
      token = tokens[++current.value];

      if (token && token.type === "leftParen") {
        token = tokens[++current.value];

        while (current.value < tokens.length && token.type !== "rightParen") {
          if (token.type !== "comma") {
            uniqueNames.push(token.value.toUpperCase());
          }
          token = tokens[++current.value];
        }

        current.value++;
      } else {
        column.unique = true;
      }

      continue;
    }

    if (isNot(token)) {
      token = tokens[++current.value];

      if (token && isNull(token)) {
        column.nullable = false;
        current.value++;
      }

      continue;
    }

    if (isDefault(token)) {
      token = tokens[++current.value];

      if (token && (token.type === "string" || token.type === "keyword")) {
        column.default = token.value;
        current.value++;
      }

      continue;
    }

    if (isComment(token)) {
      token = tokens[++current.value];

      if (token && token.type === "string") {
        column.comment = token.value;
        current.value++;
      }

      continue;
    }

    if (isAutoIncrement(token)) {
      column.autoIncrement = true;
      current.value++;
      continue;
    }

    if (token.type === "comma") {
      ast.push(column);
      column = {
        name: "",
        dataType: "",
        default: "",
        comment: "",
        primaryKey: false,
        autoIncrement: false,
        unique: false,
        nullable: true,
      };
      current.value++;
      continue;
    }

    if (token.type === "rightParen") {
      current.value++;
      break;
    }

    current.value++;
  }

  if (!ast.includes(column) && (column.name !== "" || column.dataType !== "")) {
    ast.push(column);
  }

  ast.forEach((column) => {
    if (primaryKeyNames.includes(column.name.toUpperCase())) {
      column.primaryKey = true;
    }

    if (uniqueNames.includes(column.name.toUpperCase())) {
      column.unique = true;
    }
  });

  return ast;
}
