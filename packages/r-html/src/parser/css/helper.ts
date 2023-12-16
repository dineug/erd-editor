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

export const isProperty = (tokens: Token[]) => (pos: number) =>
  isStringToken(tokens)(pos) &&
  isColonToken(tokens)(pos + 1) &&
  isWhiteSpaceToken(tokens)(pos + 2) &&
  isStringToken(tokens)(pos + 3) &&
  isSemicolonToken(tokens)(pos + 4);

export const isDynamicProperty = (tokens: Token[]) => (pos: number) =>
  isCommercialAtToken(tokens)(pos) &&
  isCommercialAtToken(tokens)(pos + 1) &&
  isStringToken(tokens)(pos + 2) &&
  markerRegexp.test(tokens[pos + 2].value) &&
  (isNextLineToken(tokens)(pos + 3) || isSemicolonToken(tokens)(pos + 3));

export const isAtRule = (tokens: Token[]) => (pos: number) =>
  isCommercialAtToken(tokens)(pos) && isStringToken(tokens)(pos + 1);

export const isPseudoClass = (tokens: Token[]) => (pos: number) =>
  isColonToken(tokens)(pos) && isStringToken(tokens)(pos + 1);

export const isChildCombinator = isGtToken;
export const isGeneralSiblingCombinator = isTildeToken;
export const isAdjacentSiblingCombinator = isPlusToken;

export const isTypeSelector = isStringToken;
export const isUniversalSelector = isAsteriskToken;

export const isDynamicSelector = (tokens: Token[]) => (pos: number) =>
  isCommercialAtToken(tokens)(pos) &&
  isCommercialAtToken(tokens)(pos + 1) &&
  isStringToken(tokens)(pos + 2) &&
  markerRegexp.test(tokens[pos + 2].value);

export const isCombinator = (tokens: Token[]) => (pos: number) =>
  isChildCombinator(tokens)(pos) ||
  isGeneralSiblingCombinator(tokens)(pos) ||
  isAdjacentSiblingCombinator(tokens)(pos);

export const isSingleSelector = (tokens: Token[]) => (pos: number) =>
  isTypeSelector(tokens)(pos) ||
  isUniversalSelector(tokens)(pos) ||
  isAmpersandToken(tokens)(pos) ||
  isDynamicSelector(tokens)(pos);

export const isClassSelector = (tokens: Token[]) => (pos: number) =>
  isPeriodToken(tokens)(pos) && isStringToken(tokens)(pos + 1);

export const isIdSelector = (tokens: Token[]) => (pos: number) =>
  isSharpToken(tokens)(pos) && isStringToken(tokens)(pos + 1);

export const isAttributeSelector = (tokens: Token[]) => (pos: number) =>
  isSingleSelector(tokens)(pos) &&
  isLeftBracketToken(tokens)(pos + 1) &&
  isStringToken(tokens)(pos + 2) &&
  (isRightBracketToken(tokens)(pos + 3) ||
    (isEqualToken(tokens)(pos + 3) &&
      isStringToken(tokens)(pos + 4) &&
      isRightBracketToken(tokens)(pos + 5)));

export const isSelector = (tokens: Token[]) => (pos: number) =>
  isSingleSelector(tokens)(pos) ||
  isClassSelector(tokens)(pos) ||
  isIdSelector(tokens)(pos) ||
  isAtRule(tokens)(pos) ||
  isPseudoClass(tokens)(pos);

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
