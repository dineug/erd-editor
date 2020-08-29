import {
  Token,
  StatementType,
  isDataType,
  isNot,
  isNull,
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
    const token = tokens[current.value];

    if (token.type === "leftParen") {
      current.value++;
      ast.columns = createTableColumn(tokens, current);
      continue;
    }

    if (token.type === "string") {
      ast.name = token.value;
      current.value++;
      continue;
    }

    current.value++;
  }

  return ast;
}

function createTableColumn(
  tokens: Token[],
  current: { value: number }
): Column[] {
  const ast: Column[] = [];

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

    if (token.type === "string") {
      column.name = token.value;
      current.value++;
      continue;
    }

    if (isDataType(token)) {
      let value = token.value;
      token = tokens[++current.value];

      if (token.type === "leftParen") {
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

    if (isNot(token)) {
      token = tokens[++current.value];

      if (isNull(token)) {
        column.nullable = false;
      }

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

    current.value++;
  }

  if (!ast.includes(column) && (column.name !== "" || column.dataType !== "")) {
    ast.push(column);
  }

  return ast;
}
