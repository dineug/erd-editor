import {
  isAlterValue,
  isColumnValue,
  isCommaToken,
  isDefaultValue,
  isDropValue,
  isLeftParentToken,
  isNewStatement,
  isRightParentToken,
  isSemicolonToken,
  isSetValue,
  isStringToken,
  isTableValue,
  matchAlterTableAlter,
} from '@/parser/helper';
import {
  AlterTableAlterColumnAutoIncrement,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { isNextvalDefault } from '@/parser/statement/default.expression';
import { Token } from '@/parser/tokenizer';

const AddIdentity: ReadonlyArray<ReadonlyArray<string>> = [
  ['ADD', 'GENERATED', 'ALWAYS', 'AS', 'IDENTITY'],
  ['ADD', 'GENERATED', 'BY', 'DEFAULT', 'AS', 'IDENTITY'],
];

// The words a PostgreSQL column action opens with. Before one, a statement word
// is the column's name, which pg_dump leaves unquoted where PostgreSQL does not
// reserve it (delete, drop); before anything else it opens the next statement.
const ColumnActionWords: ReadonlyArray<string> = [
  'ADD',
  'DROP',
  'OPTIONS',
  'RESET',
  'RESTART',
  'SET',
  'TYPE',
];

/**
 * Reads ALTER TABLE [ONLY] t ALTER [COLUMN] c ... and leaves $pos past it, with
 * one statement per action that makes its column auto increment, SET DEFAULT
 * nextval('s') or ADD GENERATED ... AS IDENTITY, and none for any other action.
 */
export function alterTableAlterColumnParser(
  tokens: Token[],
  $pos: RefPos
): AlterTableAlterColumnAutoIncrement[] {
  const head = matchAlterTableAlter(tokens);
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isComma = isCommaToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isString = isStringToken(tokens);
  const isAlter = isAlterValue(tokens);
  const isTable = isTableValue(tokens);
  const isDrop = isDropValue(tokens);
  const isColumn = isColumnValue(tokens);
  const isSet = isSetValue(tokens);
  const isDefault = isDefaultValue(tokens);

  // The unquoted word at pos in upper case, '' for anything else.
  const word = (pos: number) => {
    const token = tokens[pos];
    return token && isString(pos) && !token.quoted
      ? token.value.toUpperCase()
      : '';
  };

  const isWords = (pos: number, words: ReadonlyArray<string>) =>
    words.every((value, index) => word(pos + index) === value);

  // The expression ends at the next statement too, which a script with no
  // semicolons would run it into.
  const isNextvalAt = (pos: number) => {
    let end = pos;
    while (end < tokens.length && !newStatement(end)) end++;

    return isNextvalDefault(tokens.slice(pos, end))(0);
  };

  const makesAutoIncrement = (pos: number) =>
    (isSet(pos) && isDefault(pos + 1) && isNextvalAt(pos + 2)) ||
    AddIdentity.some(words => isWords(pos, words));

  const isColumnName = (pos: number) =>
    isString(pos) &&
    (!newStatement(pos) || ColumnActionWords.includes(word(pos + 1)));

  const length = head($pos.value);
  const name = tokens[$pos.value + length - 1].value;
  const ast: AlterTableAlterColumnAutoIncrement[] = [];
  let depth = 0;
  let actionStart = true;

  $pos.value += length;

  while ($pos.value < tokens.length) {
    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    // Each action opens with an ALTER of its own but for an ALTER TABLE, and
    // the DROP of DROP DEFAULT after the column's name is stepped over too; any
    // other statement word there, or as a name no action follows, ends it.
    if (actionStart && isAlter($pos.value) && !isTable($pos.value + 1)) {
      actionStart = false;
      $pos.value++;

      if (isColumn($pos.value)) {
        $pos.value++;
      }

      if (isColumnName($pos.value)) {
        if (makesAutoIncrement($pos.value + 1)) {
          ast.push({
            type: StatementType.alterTableAlterColumnAutoIncrement,
            name,
            columnName: tokens[$pos.value].value,
          });
        }

        $pos.value++;

        if (isDrop($pos.value)) {
          $pos.value++;
        }
      }

      continue;
    }

    if (newStatement($pos.value)) break;

    actionStart = false;

    if (isLeftParent($pos.value)) {
      depth++;
    } else if (isRightParent($pos.value)) {
      depth--;
    } else if (depth === 0 && isComma($pos.value)) {
      actionStart = true;
    }

    $pos.value++;
  }

  return ast;
}
