import {
  isAlterTableAddOnly,
  isConstraintValue,
  isIndexValue,
  isKeyValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isSemicolonToken,
  isStringToken,
  isTableValue,
  isUniqueValue,
  matchKeyModifier,
} from '@/parser/helper';
import { AlterTableAddUnique, RefPos, StatementType } from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { Token } from '@/parser/tokenizer';

export function alterTableAddUniqueParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isString = isStringToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isKey = isKeyValue(tokens);
  const isIndex = isIndexValue(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const keyModifier = matchKeyModifier(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

  const skipKeyModifiers = () => {
    let span = keyModifier($pos.value);

    while (span) {
      $pos.value += span;
      span = keyModifier($pos.value);
    }
  };

  const ast: AlterTableAddUnique = {
    type: StatementType.alterTableAddUnique,
    name: '',
    constraintName: '',
    columns: [],
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

      if (isString($pos.value) && !isUnique($pos.value)) {
        ast.constraintName = token.value;
        $pos.value++;
      }

      continue;
    }

    // MySQL names the index after UNIQUE KEY, and that name is the one the
    // index takes when a CONSTRAINT symbol stands before it too.
    if (isUnique($pos.value)) {
      token = tokens[++$pos.value];

      if (isKey($pos.value) || isIndex($pos.value)) {
        token = tokens[++$pos.value];
      }

      skipKeyModifiers();

      if (isString($pos.value)) {
        ast.constraintName = tokens[$pos.value].value;
        $pos.value++;
        skipKeyModifiers();
      }

      if (isLeftParent($pos.value)) {
        ast.columns = indexColumnsParser(tokens, $pos);
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
