import {
  isIsValue,
  isNewStatement,
  isNullValue,
  isPeriodToken,
  isSemicolonToken,
  isStringToken,
} from '@/parser/helper';
import { CommentOnTable, RefPos, StatementType } from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

// COMMENT ON TABLE [schema.]name IS 'comment';
export function commentOnTableParser(
  tokens: Token[],
  $pos: RefPos
): CommentOnTable {
  const newStatement = isNewStatement(tokens);
  const isString = isStringToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isIs = isIsValue(tokens);
  const isNull = isNullValue(tokens);

  const isToken = () => $pos.value < tokens.length;

  const ast: CommentOnTable = {
    type: StatementType.commentOnTable,
    name: '',
    comment: '',
  };

  $pos.value += 3;
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

    // A qualified name keeps its last segment, the way create.table does.
    if (isPeriod($pos.value)) {
      $pos.value++;
      continue;
    }

    if (isString($pos.value) && !isValue) {
      ast.name = token.value;
      $pos.value++;
      continue;
    }

    $pos.value++;
  }

  return ast;
}
