import { describe, expect, it } from 'vite-plus/test';

import { Token, tokenizer, TokenType } from '@/parser/html/tokenizer';

const t = (type: TokenType, value: string): Token => ({ type, value });

describe('parser/html/tokenizer', () => {
  it('exposes the token type enum as string values', () => {
    expect(TokenType.string).toBe('string');
    expect(TokenType.whiteSpace).toBe('whiteSpace');
    expect(TokenType.lt).toBe('lt');
    expect(TokenType.gt).toBe('gt');
    expect(TokenType.slash).toBe('slash');
    expect(TokenType.equal).toBe('equal');
  });

  it('returns no tokens for an empty source', () => {
    expect(tokenizer('')).toEqual([]);
  });

  it('emits a whiteSpace token for text level whitespace', () => {
    expect(tokenizer(' \n\t')).toEqual([t(TokenType.whiteSpace, ' \n\t')]);
  });

  it('tokenizes plain text as a single string token', () => {
    expect(tokenizer('hello')).toEqual([t(TokenType.string, 'hello')]);
  });

  it('tokenizes an element with a double quoted attribute', () => {
    expect(tokenizer('<div class="a">text</div>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'div'),
      t(TokenType.string, 'class'),
      t(TokenType.equal, '='),
      t(TokenType.string, 'a'),
      t(TokenType.gt, '>'),
      t(TokenType.string, 'text'),
      t(TokenType.lt, '<'),
      t(TokenType.slash, '/'),
      t(TokenType.string, 'div'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('drops whitespace inside an element but keeps it in text', () => {
    expect(tokenizer('<div  id="a" >  hi  </div>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'div'),
      t(TokenType.string, 'id'),
      t(TokenType.equal, '='),
      t(TokenType.string, 'a'),
      t(TokenType.gt, '>'),
      t(TokenType.whiteSpace, '  '),
      t(TokenType.string, 'hi'),
      t(TokenType.whiteSpace, '  '),
      t(TokenType.lt, '<'),
      t(TokenType.slash, '/'),
      t(TokenType.string, 'div'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('tokenizes a single quoted attribute value including spaces', () => {
    expect(tokenizer(`<a title='x y'>`)).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'a'),
      t(TokenType.string, 'title'),
      t(TokenType.equal, '='),
      t(TokenType.string, 'x y'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('tokenizes an empty quoted attribute value', () => {
    expect(tokenizer('<a b="">')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'a'),
      t(TokenType.string, 'b'),
      t(TokenType.equal, '='),
      t(TokenType.string, ''),
      t(TokenType.gt, '>'),
    ]);
  });

  it('closes an unterminated double quoted value at the end of the source', () => {
    expect(tokenizer('<div class="ab')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'div'),
      t(TokenType.string, 'class'),
      t(TokenType.equal, '='),
      t(TokenType.string, 'ab'),
    ]);
  });

  it('closes an unterminated single quoted value at the end of the source', () => {
    expect(tokenizer(`<div class='ab`)).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'div'),
      t(TokenType.string, 'class'),
      t(TokenType.equal, '='),
      t(TokenType.string, 'ab'),
    ]);
  });

  it('emits a slash token for a self closing tag written with a space', () => {
    expect(tokenizer('<br />')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'br'),
      t(TokenType.slash, '/'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('glues the slash onto the tag name when "<br/>" has no space', () => {
    // "/" is not part of the breakString pattern (/<|>|=/), so it is only
    // recognised as a slash token when it starts a new scan.
    expect(tokenizer('<br/>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'br/'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('emits two slash tokens for the skip end tag', () => {
    expect(tokenizer('<//>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.slash, '/'),
      t(TokenType.slash, '/'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('tokenizes a nested lt while inside an element', () => {
    expect(tokenizer('<div <span>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'div'),
      t(TokenType.lt, '<'),
      t(TokenType.string, 'span'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('tokenizes a comment with the "!--" and "--" marker strings', () => {
    expect(tokenizer('<!-- hi -->')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, '!--'),
      t(TokenType.whiteSpace, ' '),
      t(TokenType.string, 'hi'),
      t(TokenType.whiteSpace, ' '),
      t(TokenType.string, '--'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('keeps a lt inside comment content as a lt token', () => {
    expect(tokenizer('<!-- <b -->')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, '!--'),
      t(TokenType.whiteSpace, ' '),
      t(TokenType.lt, '<'),
      t(TokenType.string, 'b'),
      t(TokenType.whiteSpace, ' '),
      t(TokenType.string, '--'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('treats "<!doctype" as an element because it is not a comment start', () => {
    expect(tokenizer('<!doctype html>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, '!doctype'),
      t(TokenType.string, 'html'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('requires two hyphens after "<!" to start a comment', () => {
    expect(tokenizer('<!-x>')).toEqual([
      t(TokenType.lt, '<'),
      t(TokenType.string, '!-x'),
      t(TokenType.gt, '>'),
    ]);
  });

  it('tokenizes sibling and nested elements in document order', () => {
    expect(tokenizer('<ul><li>a</li></ul>').map(({ value }) => value)).toEqual([
      '<',
      'ul',
      '>',
      '<',
      'li',
      '>',
      'a',
      '<',
      '/',
      'li',
      '>',
      '<',
      '/',
      'ul',
      '>',
    ]);
  });

  it('does not emit an element token stream for text that never opens a tag', () => {
    expect(tokenizer('a b')).toEqual([
      t(TokenType.string, 'a'),
      t(TokenType.whiteSpace, ' '),
      t(TokenType.string, 'b'),
    ]);
  });
});
