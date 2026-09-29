import {
  isAscValue,
  isCommaToken,
  isDescValue,
  isLeftParentToken,
  isRightParentToken,
  isStringToken,
} from '@/parser/helper';
import { IndexColumn, RefPos, SortType } from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

/**
 * Reads a key list from its ( through its ), each column with its sort, and
 * leaves $pos past the ). A key with an expression part records no column,
 * since the columns left over would describe another key.
 */
export function indexColumnsParser(
  tokens: Token[],
  $pos: RefPos
): IndexColumn[] {
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isComma = isCommaToken(tokens);
  const isDesc = isDescValue(tokens);
  const isAsc = isAscValue(tokens);

  const isToken = () => $pos.value < tokens.length;

  // A prefix length is a number alone in its group: email(191).
  const isPrefixLength = (pos: number) =>
    isString(pos + 1) &&
    /^\d+$/.test(tokens[pos + 1].value) &&
    isRightParent(pos + 2);

  const indexColumns: IndexColumn[] = [];
  let indexColumn: IndexColumn = {
    name: '',
    sort: SortType.asc,
  };
  let expression = false;
  $pos.value++;

  while (isToken() && !isRightParent($pos.value)) {
    // A prefix length, email(191), or a functional key part, ((a + b)) or
    // PostgreSQL's lower(email), is a group of its own: its ) closes no list,
    // and its words name no column.
    if (isLeftParent($pos.value)) {
      expression ||= !indexColumn.name || !isPrefixLength($pos.value);
      let depth = 0;

      while (isToken()) {
        if (isLeftParent($pos.value)) {
          depth++;
        } else if (isRightParent($pos.value) && --depth === 0) {
          break;
        }

        $pos.value++;
      }
    }
    if (isString($pos.value) && !isDesc($pos.value) && !isAsc($pos.value)) {
      indexColumn.name = tokens[$pos.value].value;
    }
    if (isDesc($pos.value)) {
      indexColumn.sort = SortType.desc;
    }
    if (isComma($pos.value)) {
      indexColumns.push(indexColumn);
      indexColumn = {
        name: '',
        sort: SortType.asc,
      };
    }
    $pos.value++;
  }

  if (indexColumn.name !== '') {
    indexColumns.push(indexColumn);
  }

  $pos.value++;
  // Without its expression the key is another one, and a unique key left
  // with a single column would mark that column unique.
  return expression ? [] : indexColumns;
}
