import {
  isIsValue,
  isNewStatement,
  isNullValue,
  isPeriodToken,
  isSemicolonToken,
  isStringToken,
} from '@/parser/helper';
import { CommentOnColumn, RefPos, StatementType } from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

// COMMENT ON COLUMN [schema.]table.column IS 'comment';
export function commentOnColumnParser(
  tokens: Token[],
  $pos: RefPos
): CommentOnColumn {
  const newStatement = isNewStatement(tokens);
  const isString = isStringToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isIs = isIsValue(tokens);
  const isNull = isNullValue(tokens);

  const isToken = () => $pos.value < tokens.length;

  const ast: CommentOnColumn = {
    type: StatementType.commentOnColumn,
    tableName: '',
    columnName: '',
    comment: '',
  };

  $pos.value += 3;
  const names: string[] = [];
  let isValue = false;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    if (isIs($pos.value)) {
      isValue = true;
      token = tokens[++$pos.value];

      // `IS NULL` removes a comment rather than setting one.
      if (isNull($pos.value)) {
        $pos.value++;
        continue;
      }

      if (isString($pos.value)) {
        ast.comment = token.value;
        $pos.value++;
      }

      continue;
    }

    if (isPeriod($pos.value)) {
      $pos.value++;
      continue;
    }

    if (isString($pos.value) && !isValue) {
      names.push(token.value);
      $pos.value++;
      continue;
    }

    $pos.value++;
  }

  // [schema.]table.column — the last two segments are the ones that matter.
  ast.columnName = names.length ? names[names.length - 1] : '';
  ast.tableName = names.length > 1 ? names[names.length - 2] : '';

  return ast;
}
