import { Token, TokenType } from '@/parser/html/tokenizer';
import { VNode } from '@/parser/vNode';

type First<T> = T extends [infer U, ...any[]] ? U : any;

const emptyTagNamesRegexp =
  /^(area|base|br|col|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/i;

const createEqual =
  (prop: keyof Token) => (type: string) => (tokens: Token[]) => (pos: number) =>
    tokens[pos] ? tokens[pos][prop] === type : false;

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

export const isStartTag = (tokens: Token[]) => (pos: number) =>
  isLtToken(tokens)(pos) && isStringToken(tokens)(pos + 1);

export const isEndTag = (tokens: Token[]) => (pos: number) =>
  isLtToken(tokens)(pos) &&
  isSlashToken(tokens)(pos + 1) &&
  isStringToken(tokens)(pos + 2) &&
  isGtToken(tokens)(pos + 3);

export const isSkipEndTag = (tokens: Token[]) => (pos: number) =>
  isLtToken(tokens)(pos) &&
  isSlashToken(tokens)(pos + 1) &&
  isSlashToken(tokens)(pos + 2) &&
  isGtToken(tokens)(pos + 3);

export const isEmptyTag = (tokens: Token[]) => (pos: number) =>
  isSlashToken(tokens)(pos) && isGtToken(tokens)(pos + 1);

export const isEmptyTagName = (name: string) => emptyTagNamesRegexp.test(name);

export const isStartCommentTag = (tokens: Token[]) => (pos: number) =>
  isLtToken(tokens)(pos) &&
  isStringToken(tokens)(pos + 1) &&
  isStartCommentValue(tokens)(pos + 1);

export const isEndCommentTag = (tokens: Token[]) => (pos: number) =>
  isStringToken(tokens)(pos) &&
  isEndCommentValue(tokens)(pos) &&
  isGtToken(tokens)(pos + 1);

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
