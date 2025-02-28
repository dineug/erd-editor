import {
  isAlterTableOnlyAddUnique,
  isConstraintValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isRightParentToken,
  isStringToken,
  isTableValue,
  isUniqueValue,
} from '@/parser/helper';
import { AlterTableAddUnique, RefPos, StatementType } from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

export function alterTableAddUniqueParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isString = isStringToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isOnly = isAlterTableOnlyAddUnique(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

  const ast: AlterTableAddUnique = {
    type: StatementType.alterTableAddUnique,
    name: '',
    columnNames: [],
  };

  $pos.value++;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    if (isTable($pos.value)) {
      token = tokens[++$pos.value];

      if (isOnly) {
        token = tokens[++$pos.value];
      }

      if (isString($pos.value)) {
        ast.name = token.value;

        token = tokens[++$pos.value];

        if (isPeriod($pos.value)) {
          token = tokens[++$pos.value];

          if (isString($pos.value)) {
            ast.name = token.value;
            $pos.value++;
          }
        }
      }

      continue;
    }

    if (isConstraint($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        $pos.value++;
      }

      continue;
    }

    if (isUnique($pos.value)) {
      token = tokens[++$pos.value];

      if (isLeftParent($pos.value)) {
        token = tokens[++$pos.value];

        while (isToken() && !isRightParent($pos.value)) {
          if (isString($pos.value)) {
            ast.columnNames.push(token.value);
          }
          token = tokens[++$pos.value];
        }

        $pos.value++;
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
