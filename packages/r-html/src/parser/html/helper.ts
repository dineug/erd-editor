import { Token, TokenType } from '@/parser/html/tokenizer';
import { VNode } from '@/parser/vNode';

type First<T> = T extends [infer U, ...any[]] ? U : any;

const emptyTagNamesRegexp =
  /^(area|base|br|col|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/i;

const createEqual =
  (prop: keyof Token) =>
  (type: string) =>
  (tokens: Token[]) =>
  (pos: number) => (tokens[pos] ? tokens[pos][prop] === type : false);

const createTypeEqual = createEqual('type');
const createValueEqual = createEqual('value');

export const isLtToken = createTypeEqual(TokenType.lt);
export const isGtToken = createTypeEqual(TokenType.gt);
export const isSlashToken = createTypeEqual(TokenType.slash);
export const isEqualToken = createTypeEqual(TokenType.equal);
export const isStringToken = createTypeEqual(TokenType.string);
export const isWhiteSpaceToken = createTypeEqual(TokenType.whiteSpace);
export const isStartCommentValue = createValueEqual('!--');
export const isEndCommentValue = createValueEqual('--');

export const isStartTag = (tokens: Token[]) => {
  const isLt = isLtToken(tokens);
  const isString = isStringToken(tokens);
  return (pos: number) => isLt(pos) && isString(pos + 1);
};

export const isEndTag = (tokens: Token[]) => {
  const isLt = isLtToken(tokens);
  const isSlash = isSlashToken(tokens);
  const isString = isStringToken(tokens);
  const isGt = isGtToken(tokens);
  return (pos: number) =>
    isLt(pos) && isSlash(pos + 1) && isString(pos + 2) && isGt(pos + 3);
};

export const isSkipEndTag = (tokens: Token[]) => {
  const isLt = isLtToken(tokens);
  const isSlash = isSlashToken(tokens);
  const isGt = isGtToken(tokens);
  return (pos: number) =>
    isLt(pos) && isSlash(pos + 1) && isSlash(pos + 2) && isGt(pos + 3);
};

export const isEmptyTag = (tokens: Token[]) => {
  const isSlash = isSlashToken(tokens);
  const isGt = isGtToken(tokens);
  return (pos: number) => isSlash(pos) && isGt(pos + 1);
};

export const isEmptyTagName = (name: string) => emptyTagNamesRegexp.test(name);

export const isStartCommentTag = (tokens: Token[]) => {
  const isLt = isLtToken(tokens);
  const isString = isStringToken(tokens);
  const isStartComment = isStartCommentValue(tokens);
  return (pos: number) =>
    isLt(pos) && isString(pos + 1) && isStartComment(pos + 1);
};

export const isEndCommentTag = (tokens: Token[]) => {
  const isString = isStringToken(tokens);
  const isEndComment = isEndCommentValue(tokens);
  const isGt = isGtToken(tokens);
  return (pos: number) => isString(pos) && isEndComment(pos) && isGt(pos + 1);
};

const createAdd =
  <K extends keyof Pick<VNode, 'attrs' | 'children'>>(prop: K) =>
  (target: VNode) =>
  (value: First<VNode[K]> | null) => {
    if (!value) return;
    target[prop]
      ? target[prop]?.push(value as unknown as any)
      : (target[prop] = [value]);
  };

export const addAttr = createAdd('attrs');
export const addChild = createAdd('children');
