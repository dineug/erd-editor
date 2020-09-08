import {
  Token,
  isTable,
  isConstraint,
  isString,
  isPeriod,
  isCurrent,
  isPrimary,
  isKey,
  isLeftParen,
  isRightParen,
} from "./SQLParserHelper";

export interface AlterTableAddPrimaryKey {
  type: "alter.table.add.primaryKey";
  name: string;
  columnNames: string[];
}

export function alterTableAddPrimaryKey(
  tokens: Token[]
): AlterTableAddPrimaryKey {
  let current = 0;

  const ast: AlterTableAddPrimaryKey = {
    type: "alter.table.add.primaryKey",
    name: "",
    columnNames: [],
  };

  while (isCurrent(tokens, current)) {
    let token = tokens[current];

    if (isTable(token)) {
      token = tokens[++current];

      if (isString(token)) {
        ast.name = token.value;

        token = tokens[++current];

        if (isPeriod(token)) {
          token = tokens[++current];

          if (isString(token)) {
            ast.name = token.value;
            current++;
          }
        }
      }

      continue;
    }

    if (isConstraint(token)) {
      token = tokens[++current];

      if (isString(token)) {
        current++;
      }

      continue;
    }

    if (isPrimary(token)) {
      token = tokens[++current];

      if (isKey(token)) {
        token = tokens[++current];

        if (isLeftParen(token)) {
          token = tokens[++current];

          while (isCurrent(tokens, current) && !isRightParen(token)) {
            if (isString(token)) {
              ast.columnNames.push(token.value);
            }
            token = tokens[++current];
          }

          token = tokens[++current];
        }
      }

      continue;
    }

    current++;
  }

  return ast;
}
