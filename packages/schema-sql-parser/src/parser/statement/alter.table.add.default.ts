import {
  isAlterTableAddOnly,
  isCommaToken,
  isDefaultValue,
  isForValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isRightParentToken,
  isSemicolonToken,
  isStringToken,
  isTableValue,
} from '@/parser/helper';
import {
  AlterTableAddDefault,
  DatabaseVendor,
  RefPos,
  StatementType,
} from '@/parser/statement';
import {
  isNextValueFor,
  writeDefaultExpression,
} from '@/parser/statement/default.expression';
import { Token } from '@/parser/tokenizer';

/**
 * Reads SQL Server's ALTER TABLE t ADD [CONSTRAINT n] DEFAULT expression FOR c
 * and leaves $pos past it. Only the first clause is read, the one the matcher
 * found right after the head; its constraint name is dropped.
 */
export function alterTableAddDefaultParser(
  tokens: Token[],
  $pos: RefPos,
  database?: DatabaseVendor
) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isComma = isCommaToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isString = isStringToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isDefault = isDefaultValue(tokens);
  const isFor = isForValue(tokens);
  const nextValueFor = isNextValueFor(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;
  const isColumnFor = (pos: number) => isFor(pos) && !nextValueFor(pos);

  // No column option follows the expression here, so no column keyword ends
  // it: the FOR naming the column does, a comma or a closing paren nothing
  // opened at depth 0, or a terminator or the next statement at any depth.
  const expressionEnd = (start: number) => {
    let depth = 0;
    let cursor = start;

    for (; cursor < tokens.length; cursor++) {
      if (isSemicolon(cursor) || newStatement(cursor)) break;

      if (isLeftParent(cursor)) {
        depth++;
      } else if (isRightParent(cursor)) {
        if (depth === 0) break;
        depth--;
      } else if (depth === 0 && (isComma(cursor) || isColumnFor(cursor))) {
        break;
      }
    }

    return cursor;
  };

  const ast: AlterTableAddDefault = {
    type: StatementType.alterTableAddDefault,
    name: '',
    columnName: '',
    default: '',
  };
  let clauseRead = false;

  $pos.value++;

  if (isTable($pos.value)) {
    $pos.value++;

    if (isOnly) {
      $pos.value++;
    }

    if (isString($pos.value)) {
      ast.name = tokens[$pos.value].value;
      $pos.value++;

      // [dbo].[Orders] keeps its last segment, as every statement does.
      while (isPeriod($pos.value) && isString($pos.value + 1)) {
        ast.name = tokens[$pos.value + 1].value;
        $pos.value += 2;
      }
    }
  }

  while (isToken() && !newStatement($pos.value)) {
    // The terminator ends the statement; without it the loop runs on into
    // whatever follows, and a COMMENT ON right after is swallowed.
    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    if (!clauseRead && isDefault($pos.value)) {
      const start = $pos.value + 1;
      const end = expressionEnd(start);

      ast.default = writeDefaultExpression(tokens.slice(start, end), database);
      $pos.value = end;
      clauseRead = true;

      if (isFor($pos.value) && isString($pos.value + 1)) {
        ast.columnName = tokens[$pos.value + 1].value;
        $pos.value += 2;
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
