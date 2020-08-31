import { Token, isDESC, isOn } from "./SQLParserHelper";
import { CreateIndex, IndexColumn } from "./create.index";

export function createUniqueIndex(tokens: Token[]): CreateIndex {
  let current = 0;

  const ast: CreateIndex = {
    type: "create.unique.index",
    name: "",
    unique: true,
    tableName: "",
    columns: [],
  };

  while (current < tokens.length) {
    let token = tokens[current];

    if (token.type === "string") {
      ast.name = token.value;

      current++;
      continue;
    }

    if (isOn(token)) {
      token = tokens[++current];

      if (token && token.type === "string") {
        ast.tableName = token.value;
        token = tokens[++current];

        if (token && token.type === "leftParen") {
          token = tokens[++current];
          let indexColumn: IndexColumn = {
            name: "",
            sort: "ASC",
          };

          while (current < tokens.length && token.type !== "rightParen") {
            if (token.type === "string") {
              indexColumn.name = token.value;
            }
            if (isDESC(token)) {
              indexColumn.sort = "DESC";
            }
            if (token.type === "comma") {
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
