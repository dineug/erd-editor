import {
  isCommaToken,
  isDefaultValue,
  isEqualToken,
  isGoValue,
  isNewStatement,
  isNullValue,
  isSemicolonToken,
  isStringToken,
  matchAddExtendedProperty,
} from '@/parser/helper';
import {
  CommentOnColumn,
  CommentOnTable,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

// The procedure's parameters, in the order its positional arguments fill them.
const Parameters: ReadonlyArray<string> = [
  '@NAME',
  '@VALUE',
  '@LEVEL0TYPE',
  '@LEVEL0NAME',
  '@LEVEL1TYPE',
  '@LEVEL1NAME',
  '@LEVEL2TYPE',
  '@LEVEL2NAME',
];

// The parameters that decide the comment: the level 0 schema is not kept.
const ReadParameters = Parameters.filter(
  parameter => !parameter.startsWith('@LEVEL0')
);

// An unquoted @word is a T-SQL variable, whose value the script does not show.
const isVariable = (token?: Token) =>
  !!token && !token.quoted && token.value[0] === '@';

// What may join a value to more of it, N'a' + N'b': no literal to read whole.
const isOperator = (token?: Token) =>
  !!token && !token.quoted && /^[-+*/%&|^]/.test(token.value);

/**
 * Reads SQL Server's EXEC sp_addextendedproperty and leaves $pos past its
 * arguments. An MS_Description on a table or one of its columns is that
 * comment; any other property, level or value gives null.
 */
export function addExtendedPropertyParser(
  tokens: Token[],
  $pos: RefPos
): CommentOnTable | CommentOnColumn | null {
  const isString = isStringToken(tokens);
  const isEqual = isEqualToken(tokens);
  const isComma = isCommaToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isNull = isNullValue(tokens);
  const isDefault = isDefaultValue(tokens);
  const isGo = isGoValue(tokens);
  const newStatement = isNewStatement(tokens);
  const isArgument = (pos: number) =>
    isString(pos) && !isGo(pos) && !newStatement(pos);
  const args = new Map<string, Token>();

  // The dispatch loop only reaches here where the call matched, but this
  // parser is exported: a zero span would leave $pos on EXEC and spin.
  const call = matchAddExtendedProperty(tokens)($pos.value);

  if (!call) {
    $pos.value++;
    return null;
  }

  $pos.value += call;

  // Each argument is one token, by position or as @parameter = value. The list
  // ends at the first one no comma follows, a GO or the next statement.
  for (let index = 0; isArgument($pos.value); index++) {
    const token = tokens[$pos.value];
    let parameter = Parameters[index] ?? '';

    if (isVariable(token) && isEqual($pos.value + 1)) {
      parameter = token.value.toUpperCase();
      $pos.value += 2;

      if (!isArgument($pos.value)) break;
    }

    // NULL or DEFAULT, the parameter's own default of NULL, leaves it unset.
    if (!isNull($pos.value) && !isDefault($pos.value)) {
      args.set(parameter, tokens[$pos.value]);
    }

    $pos.value++;

    if (isOperator(tokens[$pos.value])) return null;
    if (!isComma($pos.value)) break;
    $pos.value++;
  }

  if (isSemicolon($pos.value)) {
    $pos.value++;
  }

  return toComment(args);
}

function toComment(
  args: Map<string, Token>
): CommentOnTable | CommentOnColumn | null {
  // A variable leaves the property, its level or its text unknown, and a
  // column's description read as its table's would replace that comment.
  if (ReadParameters.some(parameter => isVariable(args.get(parameter)))) {
    return null;
  }

  const nameOf = (parameter: string) => args.get(parameter)?.value ?? '';
  const value = args.get('@VALUE');
  const tableName = nameOf('@LEVEL1NAME');
  const level2type = nameOf('@LEVEL2TYPE').toUpperCase();
  const columnName = nameOf('@LEVEL2NAME');

  // The comment is a string literal, N'...' or '...'; a number is no text
  // the editor can show.
  if (
    nameOf('@NAME').toUpperCase() !== 'MS_DESCRIPTION' ||
    value?.quoted !== "'" ||
    nameOf('@LEVEL1TYPE').toUpperCase() !== 'TABLE' ||
    !tableName
  ) {
    return null;
  }

  if (!level2type) {
    return {
      type: StatementType.commentOnTable,
      name: tableName,
      comment: value.value,
    };
  }

  if (level2type !== 'COLUMN' || !columnName) return null;

  return {
    type: StatementType.commentOnColumn,
    tableName,
    columnName,
    comment: value.value,
  };
}
