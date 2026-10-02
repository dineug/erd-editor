import {
  isAddValue,
  isAlterTableAddOnly,
  isCommaToken,
  isConstraintValue,
  isForeignValue,
  isIndexValue,
  isKeyValue,
  isLeftParentToken,
  isNewStatement,
  isPeriodToken,
  isPrimaryValue,
  isRightParentToken,
  isSemicolonToken,
  isStringToken,
  isTableValue,
  isUniqueValue,
  matchKeyModifier,
  matchUsingIndexName,
} from '@/parser/helper';
import { AlterTableAddUnique, RefPos, StatementType } from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { Token } from '@/parser/tokenizer';

/**
 * Reads every unique key an ALTER TABLE adds, one statement each, and leaves
 * $pos past it. Its other clauses are skipped: phpMyAdmin adds a primary key
 * and all the unique keys of a table in one ALTER, each clause its own ADD.
 */
export function alterTableAddUniqueParser(
  tokens: Token[],
  $pos: RefPos
): AlterTableAddUnique[] {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isString = isStringToken(tokens);
  const isComma = isCommaToken(tokens);
  const isAdd = isAddValue(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isForeign = isForeignValue(tokens);
  const isKey = isKeyValue(tokens);
  const isIndex = isIndexValue(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const keyModifier = matchKeyModifier(tokens);
  const usingIndexName = matchUsingIndexName(tokens);
  const isOnly = isAlterTableAddOnly(tokens)($pos.value);

  const isToken = () => $pos.value < tokens.length;

  const skipKeyModifiers = () => {
    let span = keyModifier($pos.value);

    while (span) {
      $pos.value += span;
      span = keyModifier($pos.value);
    }
  };

  // No group holds a terminator, so one still open there is a quote the lexer
  // misread or a typo, and the statements after it are left to the loop. A new
  // statement does not end it: Oracle's USING INDEX (CREATE INDEX ...) is one.
  const skipGroup = () => {
    let depth = 0;

    while (isToken() && !isSemicolon($pos.value)) {
      if (isLeftParent($pos.value)) {
        depth++;
      } else if (isRightParent($pos.value) && --depth === 0) {
        $pos.value++;
        return;
      }

      $pos.value++;
    }
  };

  const keys: AlterTableAddUnique[] = [];
  let name = '';
  // The CONSTRAINT symbol of the clause being read. A clause ends at its comma,
  // so the symbol of a foreign key after a unique key never names that key.
  let constraintName = '';
  // The key the clause being read has added, which a USING INDEX after its key
  // list names.
  let clauseKey: AlterTableAddUnique | null = null;
  // Set once the clause reads a word no branch claims: ADD [COLUMN] c INT
  // defines a column, and its UNIQUE is the column's own.
  let columnClause = false;

  $pos.value++;

  if (isTable($pos.value)) {
    $pos.value++;

    if (isOnly) {
      $pos.value++;
    }

    if (isString($pos.value)) {
      name = tokens[$pos.value].value;
      $pos.value++;

      // db.schema.t is what SnowDDL writes, and one period was all this
      // consumed -- the middle segment became the name and the last was
      // left to be read as something else.
      while (isPeriod($pos.value)) {
        if (!isString($pos.value + 1)) {
          $pos.value++;
          break;
        }

        name = tokens[$pos.value + 1].value;
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

    if (isComma($pos.value) || isAdd($pos.value)) {
      constraintName = '';
      clauseKey = null;
      columnClause = false;
      $pos.value++;
      continue;
    }

    // A CHECK or a foreign key's column list is no key list, and no word in
    // it opens a clause.
    if (isLeftParent($pos.value)) {
      skipGroup();
      continue;
    }

    if (isConstraint($pos.value)) {
      $pos.value++;

      // The symbol is optional: CONSTRAINT UNIQUE (a) names nothing.
      if (
        isString($pos.value) &&
        !isUnique($pos.value) &&
        !isPrimary($pos.value) &&
        !isForeign($pos.value)
      ) {
        constraintName = tokens[$pos.value].value;
        $pos.value++;
      }

      continue;
    }

    // MySQL names the index after UNIQUE KEY, and that name is the one the
    // index takes when a CONSTRAINT symbol stands before it too.
    if (isUnique($pos.value)) {
      $pos.value++;

      // A column's own UNIQUE has no name and no key list, and what follows it
      // is another attribute: CHECK (price > discount) keys no price.
      if (columnClause) {
        constraintName = '';
        continue;
      }

      if (isKey($pos.value) || isIndex($pos.value)) {
        $pos.value++;
      }

      skipKeyModifiers();

      let keyName = constraintName;
      constraintName = '';

      if (isString($pos.value)) {
        keyName = tokens[$pos.value].value;
        $pos.value++;
        skipKeyModifiers();
      }

      if (isLeftParent($pos.value)) {
        const columns = indexColumnsParser(tokens, $pos);

        if (columns.length) {
          clauseKey = {
            type: StatementType.alterTableAddUnique,
            name,
            constraintName: keyName,
            usingIndexName: '',
            columns,
          };
          keys.push(clauseKey);
        }
      }

      continue;
    }

    // Oracle's USING INDEX "HR"."IX" names the index that already enforces the
    // key, anywhere among the constraint states that follow its key list.
    const usingIndex = usingIndexName($pos.value);

    if (usingIndex) {
      if (clauseKey) {
        clauseKey.usingIndexName = tokens[$pos.value + usingIndex - 1].value;
      }

      $pos.value += usingIndex;
      continue;
    }

    columnClause = true;
    $pos.value++;
  }

  return keys;
}
