import {
  Token,
  tokenMatch,
  isKeyword,
  isString,
  isNewStatement,
  isSemicolon,
  isCreateTable,
  isCreateIndex,
  isCreateUniqueIndex,
  isDataType,
} from "./sqlParser/SQLParserHelper";

/**
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */
export function tokenizer(input: string): Token[] {
  let current = 0;

  const tokens: Token[] = [];

  while (current < input.length) {
    let char = input[current];

    if (tokenMatch.whiteSpace.test(char)) {
      current++;
      continue;
    }

    if (char === tokenMatch.leftParen) {
      tokens.push({
        type: "leftParen",
        value: "(",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.rightParen) {
      tokens.push({
        type: "rightParen",
        value: ")",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.comma) {
      tokens.push({
        type: "comma",
        value: ",",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.period) {
      tokens.push({
        type: "period",
        value: ".",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.equal) {
      tokens.push({
        type: "equal",
        value: "=",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.semicolon) {
      tokens.push({
        type: "semicolon",
        value: ";",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.doubleQuote) {
      let value = "";

      char = input[++current];

      while (char !== tokenMatch.doubleQuote) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: "doubleQuoteString", value });

      continue;
    }

    if (char === tokenMatch.singleQuote) {
      let value = "";

      char = input[++current];

      while (char !== tokenMatch.singleQuote) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: "singleQuoteString", value });

      continue;
    }

    if (char === tokenMatch.backtick) {
      let value = "";

      char = input[++current];

      while (char !== tokenMatch.backtick) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: "backtickString", value });

      continue;
    }

    if (tokenMatch.string.test(char)) {
      let value = "";

      while (tokenMatch.string.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: "string", value });

      continue;
    }

    if (tokenMatch.unknown.test(char)) {
      let value = "";

      while (tokenMatch.unknown.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: "unknown", value });

      continue;
    }

    throw new TypeError("I dont know what this character is: " + char);
  }

  tokens.forEach((token) => {
    if (isString(token)) {
      token.type = "string";
    } else if (isKeyword(token)) {
      token.type = "keyword";
      token.value = token.value.toUpperCase();
    }
  });

  return tokens;
}

export function parser(tokens: Token[]): any {
  let current = 0;

  const statements: Array<Array<Token>> = [];

  while (current < tokens.length) {
    let token = tokens[current];

    if (isNewStatement(token)) {
      const statement: Token[] = [];

      statement.push(token);
      token = tokens[++current];

      while (
        current < tokens.length &&
        !isNewStatement(token) &&
        !isSemicolon(token)
      ) {
        statement.push(token);
        token = tokens[++current];
      }

      statements.push(statement);
    }

    if (token && isNewStatement(token)) {
      continue;
    }

    current++;
  }

  const ast: any = {
    statements: [],
  };
  statements.forEach((statement) => {
    if (isCreateTable(statement)) {
      ast.statements.push(createTable(statement));
    } else if (isCreateIndex(statement)) {
      console.log("create.index");
    } else if (isCreateUniqueIndex(statement)) {
      console.log("create.unique.index");
    }
  });

  return ast;
}

function createTable(tokens: Token[]): any {
  const current = { value: 0 };

  const ast: any = {
    type: "create.table",
    name: "",
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

function createTableColumn(tokens: Token[], current: { value: number }): any {
  const ast: any[] = [];

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

  if (ast.indexOf(column) === -1) {
    ast.push(column);
  }

  return ast;
}
