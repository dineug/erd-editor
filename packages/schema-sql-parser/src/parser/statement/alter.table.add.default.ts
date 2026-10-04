import {
  isAlterTableAddOnly,
  isDefaultValue,
  isForValue,
  isNewStatement,
  isPeriodToken,
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
import { defaultExpressionParser } from '@/parser/statement/default.expression';
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
  const isString = isStringToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isDefault = isDefaultValue(tokens);
  const isFor = isForValue(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

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

    // The expression ends at FOR, but for the one in NEXT VALUE FOR s, and at
    // the next statement, which a GO script with no FOR would run it into.
    if (!clauseRead && isDefault($pos.value)) {
      $pos.value++;

      let end = $pos.value;
      while (end < tokens.length && !newStatement(end)) end++;

      const $expression: RefPos = { value: 0 };
      ast.default = defaultExpressionParser(
        tokens.slice($pos.value, end),
        $expression,
        database
      );
      $pos.value += $expression.value;
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
