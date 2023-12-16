import { Token, TokenType } from '@/parser/tokenizer';

const createTypeEqual = (type: string) => (tokens: Token[]) => (pos: number) =>
  tokens[pos] ? tokens[pos].type === type : false;

const createValueEqual = (type: string) => {
  const value = type.toUpperCase();
  return (tokens: Token[]) => (pos: number) =>
    tokens[pos] ? tokens[pos].value.toUpperCase() === value : false;
};

export const isStringToken = createTypeEqual(TokenType.string);
export const isEqualToken = createTypeEqual(TokenType.equal);
export const isPeriodToken = createTypeEqual(TokenType.period);
export const isCommaToken = createTypeEqual(TokenType.comma);
export const isSemicolonToken = createTypeEqual(TokenType.semicolon);
export const isLeftParentToken = createTypeEqual(TokenType.leftParent);
export const isRightParentToken = createTypeEqual(TokenType.rightParent);
export const isLeftBracketToken = createTypeEqual(TokenType.leftBracket);
export const isRightBracketToken = createTypeEqual(TokenType.rightBracket);
export const isCreateValue = createValueEqual('CREATE');
export const isAlterValue = createValueEqual('ALTER');
export const isDropValue = createValueEqual('DROP');
export const isUseValue = createValueEqual('USE');
export const isRenameValue = createValueEqual('RENAME');
export const isDeleteValue = createValueEqual('DELETE');
export const isSelectValue = createValueEqual('SELECT');
export const isTableValue = createValueEqual('TABLE');
export const isIndexValue = createValueEqual('INDEX');
export const isUniqueValue = createValueEqual('UNIQUE');
export const isAddValue = createValueEqual('ADD');
export const isPrimaryValue = createValueEqual('PRIMARY');
export const isKeyValue = createValueEqual('KEY');
export const isConstraintValue = createValueEqual('CONSTRAINT');
export const isForeignValue = createValueEqual('FOREIGN');
export const isNotValue = createValueEqual('NOT');
export const isNullValue = createValueEqual('NULL');
export const isDefaultValue = createValueEqual('DEFAULT');
export const isCommentValue = createValueEqual('COMMENT');
export const isReferencesValue = createValueEqual('REFERENCES');
export const isAscValue = createValueEqual('ASC');
export const isDescValue = createValueEqual('DESC');
export const isOnValue = createValueEqual('ON');
export const isAuto_incrementValue = createValueEqual('AUTO_INCREMENT');
export const isAutoincrementValue = createValueEqual('AUTOINCREMENT');

export const isAutoIncrementValue = (tokens: Token[]) => {
  const isAuto_increment = isAuto_incrementValue(tokens);
  const isAutoincrement = isAutoincrementValue(tokens);
  return (pos: number) => isAuto_increment(pos) || isAutoincrement(pos);
};
