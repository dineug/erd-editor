import {
  isAddValue,
  isAlterTableAddOnly,
  isCommaToken,
  isConstraintValue,
  isKeyValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isPrimaryValue,
  isSemicolonToken,
  isStringToken,
  isTableValue,
  matchKeyModifiers,
  matchUsingIndexName,
} from '@/parser/helper';
import {
  AlterTableAddPrimaryKey,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { Token } from '@/parser/tokenizer';

export function alterTableAddPrimaryKeyParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isKey = isKeyValue(tokens);
  const isTable = isTableValue(tokens);
  const isComma = isCommaToken(tokens);
  const isAdd = isAddValue(tokens);
  const keyModifiers = matchKeyModifiers(tokens);
  const usingIndexName = matchUsingIndexName(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

  const ast: AlterTableAddPrimaryKey = {
    type: StatementType.alterTableAddPrimaryKey,
    name: '',
    constraintName: '',
    usingIndexName: '',
    columnNames: [],
  };
  // The primary key is the statement's first clause, which ends at the first
  // comma or ADD after its key list: what follows belongs to another key.
  let keyRead = false;
  let keyClause = true;

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

    if (keyRead && (isComma($pos.value) || isAdd($pos.value))) {
      keyClause = false;
    }

    if (isConstraint($pos.value)) {
      token = tokens[++$pos.value];

      // The symbol is optional: CONSTRAINT PRIMARY KEY (a) names nothing.
      if (isString($pos.value) && !isPrimary($pos.value)) {
        if (!keyRead) {
          ast.constraintName = token.value;
        }

        $pos.value++;
      }

      continue;
    }

    // Oracle's USING INDEX "HR"."IX" names the index that already enforces the
    // key, anywhere among the constraint states that follow its key list.
    const usingIndex = usingIndexName($pos.value);

    if (usingIndex) {
      if (keyRead && keyClause) {
        ast.usingIndexName = tokens[$pos.value + usingIndex - 1].value;
      }

      $pos.value += usingIndex;
      continue;
    }

    if (isPrimary($pos.value)) {
      token = tokens[++$pos.value];

      if (isKey($pos.value)) {
        token = tokens[++$pos.value];

        // A modifier may stand before the key list: SSMS writes PRIMARY KEY
        // CLUSTERED, MySQL PRIMARY KEY USING BTREE.
        $pos.value += keyModifiers($pos.value);

        // A key part's first word names its column: the sort after it is not
        // one, and a key named by it would never match the index of the key.
        if (isLeftParent($pos.value)) {
          ast.columnNames = indexColumnsParser(tokens, $pos).map(
            indexColumn => indexColumn.name
          );
          keyRead = true;
        }
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
