import {
  isAlterTableAddOnly,
  isConstraintValue,
  isKeyValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isPrimaryValue,
  isRightParentToken,
  isSemicolonToken,
  isStringToken,
  isTableValue,
} from '@/parser/helper';
import {
  AlterTableAddPrimaryKey,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

export function alterTableAddPrimaryKeyParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isKey = isKeyValue(tokens);
  const isTable = isTableValue(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

  const ast: AlterTableAddPrimaryKey = {
    type: StatementType.alterTableAddPrimaryKey,
    name: '',
    columnNames: [],
  };

  $pos.value++;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    // The terminator ends the statement; without it the loop runs on into
    // whatever follows, and a COMMENT ON right after is swallowed.
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

        // db.schema.t is what SnowDDL writes, and one period was all this
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

    if (isPrimary($pos.value)) {
      token = tokens[++$pos.value];

      if (isKey($pos.value)) {
        token = tokens[++$pos.value];

        if (isLeftParent($pos.value)) {
          token = tokens[++$pos.value];

          while (isToken() && !isRightParent($pos.value)) {
            if (isString($pos.value)) {
              ast.columnNames.push(token.value);
            }
            token = tokens[++$pos.value];
          }

          token = tokens[++$pos.value];
        }
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
