import { MARKER } from '@/constants';
import { Token, TokenType } from '@/parser/css/tokenizer';
import { VCNode } from '@/parser/vcNode';

type First<T> = T extends [infer U, ...any[]] ? U : any;

const markerRegexp = new RegExp(`^${MARKER.replace('@@', '')}_\\d+_$`);

const createEqual =
  (prop: keyof Token) =>
  (type: string) =>
  (tokens: Token[]) =>
  (pos: number) => (tokens[pos] ? tokens[pos][prop] === type : false);

const createTypeEqual = createEqual('type');
const createValueEqual = createEqual('value');

export const isStringToken = createTypeEqual(TokenType.string);
export const isWhiteSpaceToken = createTypeEqual(TokenType.whiteSpace);
export const isNextLineToken = createTypeEqual(TokenType.nextLine);
export const isEqualToken = createTypeEqual(TokenType.equal);
export const isTildeToken = createTypeEqual(TokenType.tilde);
export const isPlusToken = createTypeEqual(TokenType.plus);
export const isSharpToken = createTypeEqual(TokenType.sharp);
export const isAsteriskToken = createTypeEqual(TokenType.asterisk);
export const isCommercialAtToken = createTypeEqual(TokenType.commercialAt);
export const isAmpersandToken = createTypeEqual(TokenType.ampersand);
export const isPeriodToken = createTypeEqual(TokenType.period);
export const isCommaToken = createTypeEqual(TokenType.comma);
export const isColonToken = createTypeEqual(TokenType.colon);
export const isSemicolonToken = createTypeEqual(TokenType.semicolon);
export const isGtToken = createTypeEqual(TokenType.gt);
export const isLeftBraceToken = createTypeEqual(TokenType.leftBrace);
export const isRightBraceToken = createTypeEqual(TokenType.rightBrace);
export const isLeftBracketToken = createTypeEqual(TokenType.leftBracket);
export const isRightBracketToken = createTypeEqual(TokenType.rightBracket);
export const isLeftParentToken = createTypeEqual(TokenType.leftParent);
export const isRightParentToken = createTypeEqual(TokenType.rightParent);
export const isStartMultiCommentValue = createValueEqual('/*');
export const isEndMultiCommentValue = createValueEqual('*/');
export const isStartSingleCommentValue = createValueEqual('//');
export const isEndSingleCommentValue = isNextLineToken;

export const isProperty = (tokens: Token[]) => {
  const isString = isStringToken(tokens);
  const isColon = isColonToken(tokens);
  const isWhiteSpace = isWhiteSpaceToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  return (pos: number) =>
    isString(pos) &&
    isColon(pos + 1) &&
    isWhiteSpace(pos + 2) &&
    isString(pos + 3) &&
    isSemicolon(pos + 4);
};

export const isDynamicProperty = (tokens: Token[]) => {
  const isCommercialAt = isCommercialAtToken(tokens);
  const isString = isStringToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isNextLine = isNextLineToken(tokens);
  return (pos: number) =>
    isCommercialAt(pos) &&
    isCommercialAt(pos + 1) &&
    isString(pos + 2) &&
    markerRegexp.test(tokens[pos + 2].value) &&
    (isNextLine(pos + 3) || isSemicolon(pos + 3));
};

export const isAtRule = (tokens: Token[]) => {
  const isCommercialAt = isCommercialAtToken(tokens);
  const isString = isStringToken(tokens);
  return (pos: number) => isCommercialAt(pos) && isString(pos + 1);
};

export const isPseudoClass = (tokens: Token[]) => {
  const isColon = isColonToken(tokens);
  const isString = isStringToken(tokens);
  return (pos: number) => isColon(pos) && isString(pos + 1);
};

export const isChildCombinator = isGtToken;
export const isGeneralSiblingCombinator = isTildeToken;
export const isAdjacentSiblingCombinator = isPlusToken;

export const isTypeSelector = isStringToken;
export const isUniversalSelector = isAsteriskToken;

export const isDynamicSelector = (tokens: Token[]) => {
  const isCommercialAt = isCommercialAtToken(tokens);
  const isString = isStringToken(tokens);
  return (pos: number) =>
    isCommercialAt(pos) &&
    isCommercialAt(pos + 1) &&
    isString(pos + 2) &&
    markerRegexp.test(tokens[pos + 2].value);
};

export const isCombinator = (tokens: Token[]) => {
  const childCombinator = isChildCombinator(tokens);
  const generalSiblingCombinator = isGeneralSiblingCombinator(tokens);
  const adjacentSiblingCombinator = isAdjacentSiblingCombinator(tokens);
  return (pos: number) =>
    childCombinator(pos) ||
    generalSiblingCombinator(pos) ||
    adjacentSiblingCombinator(pos);
};

export const isSingleSelector = (tokens: Token[]) => {
  const typeSelector = isTypeSelector(tokens);
  const universalSelector = isUniversalSelector(tokens);
  const isAmpersand = isAmpersandToken(tokens);
  const dynamicSelector = isDynamicSelector(tokens);
  return (pos: number) =>
    typeSelector(pos) ||
    universalSelector(pos) ||
    isAmpersand(pos) ||
    dynamicSelector(pos);
};

export const isClassSelector = (tokens: Token[]) => {
  const isPeriod = isPeriodToken(tokens);
  const isString = isStringToken(tokens);
  return (pos: number) => isPeriod(pos) && isString(pos + 1);
};

export const isIdSelector = (tokens: Token[]) => {
  const isSharp = isSharpToken(tokens);
  const isString = isStringToken(tokens);
  return (pos: number) => isSharp(pos) && isString(pos + 1);
};

export const isAttributeSelector = (tokens: Token[]) => {
  const singleSelector = isSingleSelector(tokens);
  const isLeftBracket = isLeftBracketToken(tokens);
  const isRightBracket = isRightBracketToken(tokens);
  const isString = isStringToken(tokens);
  const isEqual = isEqualToken(tokens);
  return (pos: number) =>
    singleSelector(pos) &&
    isLeftBracket(pos + 1) &&
    isString(pos + 2) &&
    (isRightBracket(pos + 3) ||
      (isEqual(pos + 3) && isString(pos + 4) && isRightBracket(pos + 5)));
};

export const isSelector = (tokens: Token[]) => {
  const singleSelector = isSingleSelector(tokens);
  const classSelector = isClassSelector(tokens);
  const idSelector = isIdSelector(tokens);
  const atRule = isAtRule(tokens);
  const pseudoClass = isPseudoClass(tokens);
  return (pos: number) =>
    singleSelector(pos) ||
    classSelector(pos) ||
    idSelector(pos) ||
    atRule(pos) ||
    pseudoClass(pos);
};

const createAdd =
  <K extends keyof Pick<VCNode, 'properties' | 'children'>>(prop: K) =>
  (target: VCNode) =>
  (value: First<VCNode[K]> | null) => {
    if (!value) return;
    // @ts-ignore
    target[prop] ? target[prop]?.push(value) : (target[prop] = [value]);
  };

export const addProperty = createAdd('properties');
export const addChild = createAdd('children');
