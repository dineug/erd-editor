import { Token, AlterTableAddUnique } from '@type/index';
import {
  isTable,
  isConstraint,
  isString,
  isPeriod,
  isCurrent,
  isUnique,
  isLeftParen,
  isRightParen,
} from './SQLParserHelper';

export function alterTableAddUnique(tokens: Token[]): AlterTableAddUnique {
  let current = 0;

  const ast: AlterTableAddUnique = {
    type: 'alter.table.add.unique',
    name: '',
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

    if (isUnique(token)) {
      token = tokens[++current];

      if (isLeftParen(token)) {
        token = tokens[++current];

        while (isCurrent(tokens, current) && !isRightParen(token)) {
          if (isString(token)) {
            ast.columnNames.push(token.value);
          }
          token = tokens[++current];
        }

        current++;
      }

      continue;
    }

    current++;
  }

  return ast;
}
