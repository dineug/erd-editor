import {
  Token,
  tokenMatch,
  isStringKeyword,
  isExtraString,
  isNewStatement,
  isSemicolon,
  isCreateTable,
  isCreateIndex,
  isCreateUniqueIndex,
  isAlterTableAddPrimaryKey,
  isAlterTableAddForeignKey,
  isAlterTableAddUnique,
} from "./sqlParser/SQLParserHelper";
import { createTable, CreateTable } from "./sqlParser/create.table";
import { createIndex, CreateIndex } from "./sqlParser/create.index";
import { createUniqueIndex } from "./sqlParser/create.unique.index";
import {
  alterTableAddPrimaryKey,
  AlterTableAddPrimaryKey,
} from "./sqlParser/alter.table.add.primaryKey";
import {
  alterTableAddForeignKey,
  AlterTableAddForeignKey,
} from "./sqlParser/alter.table.add.foreignKey";
import {
  alterTableAddUnique,
  AlterTableAddUnique,
} from "./sqlParser/alter.table.add.unique";

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

    current++;
  }

  tokens.forEach((token) => {
    if (isExtraString(token)) {
      token.type = "string";
    } else if (isStringKeyword(token)) {
      token.type = "keyword";
    }
  });

  return tokens;
}

export interface AST {
  statements: Array<
    | CreateTable
    | CreateIndex
    | AlterTableAddPrimaryKey
    | AlterTableAddForeignKey
    | AlterTableAddUnique
  >;
}

export function parser(tokens: Token[]): AST {
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

  const ast: AST = {
    statements: [],
  };
  statements.forEach((statement) => {
    if (isCreateTable(statement)) {
      ast.statements.push(createTable(statement));
    } else if (isCreateIndex(statement)) {
      ast.statements.push(createIndex(statement));
    } else if (isCreateUniqueIndex(statement)) {
      ast.statements.push(createUniqueIndex(statement));
    } else if (isAlterTableAddPrimaryKey(statement)) {
      ast.statements.push(alterTableAddPrimaryKey(statement));
    } else if (isAlterTableAddForeignKey(statement)) {
      ast.statements.push(alterTableAddForeignKey(statement));
    } else if (isAlterTableAddUnique(statement)) {
      ast.statements.push(alterTableAddUnique(statement));
    }
  });

  return ast;
}
