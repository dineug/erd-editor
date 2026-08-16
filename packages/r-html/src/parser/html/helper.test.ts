import { describe, expect, it } from 'vite-plus/test';

import {
  addAttr,
  addChild,
  isEmptyTag,
  isEmptyTagName,
  isEndCommentTag,
  isEndCommentValue,
  isEndTag,
  isEqualToken,
  isGtToken,
  isLtToken,
  isSkipEndTag,
  isSlashToken,
  isStartCommentTag,
  isStartCommentValue,
  isStartTag,
  isStringToken,
  isWhiteSpaceToken,
} from '@/parser/html/helper';
import { Token, TokenType } from '@/parser/html/tokenizer';
import { VNode, VNodeType } from '@/parser/vNode';

const t = (type: TokenType, value: string): Token => ({ type, value });

const lt = t(TokenType.lt, '<');
const gt = t(TokenType.gt, '>');
const slash = t(TokenType.slash, '/');
const equal = t(TokenType.equal, '=');
const ws = t(TokenType.whiteSpace, ' ');
const str = (value: string) => t(TokenType.string, value);

describe('parser/html/helper', () => {
  describe('type predicates', () => {
    const tokens = [lt, gt, slash, equal, str('div'), ws];

    it('matches each token type at its position', () => {
      expect(isLtToken(tokens)(0)).toBe(true);
      expect(isGtToken(tokens)(1)).toBe(true);
      expect(isSlashToken(tokens)(2)).toBe(true);
      expect(isEqualToken(tokens)(3)).toBe(true);
      expect(isStringToken(tokens)(4)).toBe(true);
      expect(isWhiteSpaceToken(tokens)(5)).toBe(true);
    });

    it('returns false when the token at the position has another type', () => {
      expect(isLtToken(tokens)(1)).toBe(false);
      expect(isGtToken(tokens)(0)).toBe(false);
      expect(isSlashToken(tokens)(4)).toBe(false);
      expect(isEqualToken(tokens)(5)).toBe(false);
      expect(isStringToken(tokens)(5)).toBe(false);
      expect(isWhiteSpaceToken(tokens)(4)).toBe(false);
    });

    it('returns false for out of range positions', () => {
      expect(isLtToken(tokens)(999)).toBe(false);
      expect(isLtToken(tokens)(-1)).toBe(false);
      expect(isStringToken([])(0)).toBe(false);
    });
  });

  describe('comment value predicates', () => {
    const tokens = [str('!--'), str('--'), str('!-'), lt];

    it('matches the exact comment marker values', () => {
      expect(isStartCommentValue(tokens)(0)).toBe(true);
      expect(isEndCommentValue(tokens)(1)).toBe(true);
    });

    it('does not match other values', () => {
      expect(isStartCommentValue(tokens)(1)).toBe(false);
      expect(isStartCommentValue(tokens)(2)).toBe(false);
      expect(isEndCommentValue(tokens)(2)).toBe(false);
      expect(isEndCommentValue(tokens)(3)).toBe(false);
      expect(isStartCommentValue(tokens)(10)).toBe(false);
    });
  });

  describe('isStartTag', () => {
    it('is true for "<" followed by a string token', () => {
      expect(isStartTag([lt, str('div'), gt])(0)).toBe(true);
    });

    it('is false when the "<" is followed by a non string token', () => {
      expect(isStartTag([lt, slash, str('div'), gt])(0)).toBe(false);
    });

    it('is false when the position is not a "<"', () => {
      expect(isStartTag([lt, str('div'), gt])(1)).toBe(false);
    });
  });

  describe('isEndTag', () => {
    const tokens = [lt, slash, str('div'), gt];

    it('is true for "</name>"', () => {
      expect(isEndTag(tokens)(0)).toBe(true);
    });

    it('is false when any of the four tokens does not match', () => {
      expect(isEndTag([lt, str('div'), gt])(0)).toBe(false);
      expect(isEndTag([lt, slash, slash, gt])(0)).toBe(false);
      expect(isEndTag([lt, slash, str('div'), str('x')])(0)).toBe(false);
      expect(isEndTag([slash, slash, str('div'), gt])(0)).toBe(false);
      expect(isEndTag(tokens)(1)).toBe(false);
    });
  });

  describe('isSkipEndTag', () => {
    it('is true for "<//>"', () => {
      expect(isSkipEndTag([lt, slash, slash, gt])(0)).toBe(true);
    });

    it('is false for a named end tag', () => {
      expect(isSkipEndTag([lt, slash, str('div'), gt])(0)).toBe(false);
      expect(isSkipEndTag([lt, slash, slash, str('x')])(0)).toBe(false);
      expect(isSkipEndTag([str('a'), slash, slash, gt])(0)).toBe(false);
    });
  });

  describe('isEmptyTag', () => {
    it('is true for "/>"', () => {
      expect(isEmptyTag([str('br'), slash, gt])(1)).toBe(true);
    });

    it('is false otherwise', () => {
      expect(isEmptyTag([str('br'), slash, gt])(0)).toBe(false);
      expect(isEmptyTag([slash, slash])(0)).toBe(false);
      expect(isEmptyTag([slash])(0)).toBe(false);
    });
  });

  describe('isEmptyTagName', () => {
    it('matches the void element names case insensitively', () => {
      for (const name of [
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'keygen',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
      ]) {
        expect(isEmptyTagName(name)).toBe(true);
        expect(isEmptyTagName(name.toUpperCase())).toBe(true);
      }
    });

    it('does not match non void element names', () => {
      expect(isEmptyTagName('div')).toBe(false);
      expect(isEmptyTagName('brr')).toBe(false);
      expect(isEmptyTagName('xbr')).toBe(false);
      expect(isEmptyTagName('')).toBe(false);
    });
  });

  describe('isStartCommentTag', () => {
    it('is true when "<" is followed by the "!--" string token', () => {
      expect(isStartCommentTag([lt, str('!--'), gt])(0)).toBe(true);
    });

    it('is false for a normal start tag or a non lt position', () => {
      expect(isStartCommentTag([lt, str('div'), gt])(0)).toBe(false);
      expect(isStartCommentTag([str('!--'), str('!--')])(0)).toBe(false);
      expect(isStartCommentTag([lt, ws, gt])(0)).toBe(false);
    });
  });

  describe('isEndCommentTag', () => {
    it('is true for the "--" string token followed by ">"', () => {
      expect(isEndCommentTag([str('--'), gt])(0)).toBe(true);
    });

    it('is false when the marker or the ">" is missing', () => {
      expect(isEndCommentTag([str('--'), str('x')])(0)).toBe(false);
      expect(isEndCommentTag([str('-'), gt])(0)).toBe(false);
      expect(isEndCommentTag([ws, gt])(0)).toBe(false);
      expect(isEndCommentTag([str('--')])(0)).toBe(false);
    });
  });

  describe('addAttr / addChild', () => {
    it('creates the attrs array on first add and pushes afterwards', () => {
      const node = new VNode({ type: VNodeType.element, value: 'div' });
      expect(node.attrs).toBeUndefined();

      addAttr(node)({ name: 'a' });
      expect(node.attrs).toEqual([{ name: 'a' }]);

      addAttr(node)({ name: 'b', value: '1' });
      expect(node.attrs).toEqual([{ name: 'a' }, { name: 'b', value: '1' }]);
    });

    it('pushes into an existing children array', () => {
      const parent = new VNode({
        type: VNodeType.element,
        value: 'ul',
        children: [],
      });
      const child = new VNode({ type: VNodeType.element, value: 'li' });

      addChild(parent)(child);
      expect(parent.children).toEqual([child]);
    });

    it('creates the children array on first add', () => {
      const parent = new VNode({ type: VNodeType.element, value: 'ul' });
      const child = new VNode({ type: VNodeType.element, value: 'li' });

      addChild(parent)(child);
      expect(parent.children).toEqual([child]);
    });

    it('ignores null values', () => {
      const node = new VNode({ type: VNodeType.element, value: 'div' });

      addChild(node)(null);
      addAttr(node)(null);

      expect(node.children).toBeUndefined();
      expect(node.attrs).toBeUndefined();
    });
  });
});
