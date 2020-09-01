import {
  Token,
  Current,
  StatementType,
  isTable,
  isAdd,
  isConstraint,
  isForeign,
  isString,
  isPeriod,
  isCurrent,
} from "./SQLParserHelper";
import { ForeignKey, parserForeignKey } from "./create.table";

export interface AlterTable {
  type: StatementType;
  name: string;
  foreignKeys: ForeignKey[];
}

export function alterTable(tokens: Token[]): AlterTable {
  const current: Current = { value: 0 };

  const ast: AlterTable = {
    type: "alter.table",
    name: "",
    foreignKeys: [],
  };

  while (isCurrent(tokens, current.value)) {
    let token = tokens[current.value];

    if (isTable(token)) {
      token = tokens[++current.value];

      if (isString(token)) {
        ast.name = token.value;

        token = tokens[++current.value];

        if (isPeriod(token)) {
          token = tokens[++current.value];

          if (isString(token)) {
            ast.name = token.value;
            current.value++;
          }
        }
      }

      continue;
    }

    if (isAdd(token)) {
      token = tokens[++current.value];

      if (isConstraint(token)) {
        token = tokens[++current.value];

        if (isString(token)) {
          token = tokens[++current.value];
        }

        if (isForeign(token)) {
          const foreignKey = parserForeignKey(tokens, current);

          if (foreignKey) {
            ast.foreignKeys.push(foreignKey);
          }
        }
      }

      continue;
    }

    current.value++;
  }

  return ast;
}
