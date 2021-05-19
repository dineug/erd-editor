import { Token, CreateIndex, IndexColumn } from "@type/index";
import {
  isDESC,
  isOn,
  isIndex,
  isString,
  isLeftParen,
  isRightParen,
  isComma,
  isCurrent,
} from "./SQLParserHelper";

export function createIndex(tokens: Token[], unique = false): CreateIndex {
  let current = 0;

  const ast: CreateIndex = {
    type: "create.index",
    name: "",
    unique,
    tableName: "",
    columns: [],
  };

  while (isCurrent(tokens, current)) {
    let token = tokens[current];

    if (isIndex(token)) {
      token = tokens[++current];

      if (isString(token)) {
        ast.name = token.value;
      }

      continue;
    }

    if (isOn(token)) {
      token = tokens[++current];

      if (isString(token)) {
        ast.tableName = token.value;
        token = tokens[++current];

        if (isLeftParen(token)) {
          token = tokens[++current];
          let indexColumn: IndexColumn = {
            name: "",
            sort: "ASC",
          };

          while (isCurrent(tokens, current) && !isRightParen(token)) {
            if (isString(token)) {
              indexColumn.name = token.value;
            }
            if (isDESC(token)) {
              indexColumn.sort = "DESC";
            }
            if (isComma(token)) {
              ast.columns.push(indexColumn);
              indexColumn = {
                name: "",
                sort: "ASC",
              };
            }
            token = tokens[++current];
          }

          if (!ast.columns.includes(indexColumn) && indexColumn.name !== "") {
            ast.columns.push(indexColumn);
          }

          current++;
        }
      }

      continue;
    }

    current++;
  }

  return ast;
}
