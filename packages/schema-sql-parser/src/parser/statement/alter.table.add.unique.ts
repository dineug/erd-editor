import {
  isAlterTableAddOnly,
  isConstraintValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isRightParentToken,
  isSemicolonToken,
  isStringToken,
  isTableValue,
  isUniqueValue,
} from '@/parser/helper';
import { AlterTableAddUnique, RefPos, StatementType } from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

export function alterTableAddUniqueParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isString = isStringToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

  const ast: AlterTableAddUnique = {
    type: StatementType.alterTableAddUnique,
    name: '',
    columnNames: [],
  };

  $pos.value++;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    // The terminator ends the statement; without it the loop runs on into
    // whatever follows, and a `COMMENT ON` right after is swallowed.
    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    if (isTable($pos.value)) {
      token = tokens[++$pos.value];

      if (isOnly) {
        token = tokens[++$pos.value];
      }

      if (isString($pos.value)) {
        ast.name = token.value;
        $pos.value++;

        // `db.schema.t` is what SnowDDL writes, and one period was all this
        // consumed -- the middle segment became the name and the last was
        // left to be read as something else.
        while (isPeriod($pos.value)) {
          if (!isString($pos.value + 1)) {
            $pos.value++;
            break;
          }

          ast.name = tokens[$pos.value + 1].value;
          $pos.value += 2;
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
