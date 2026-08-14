import { describe, expect, it } from 'vitest';

import { htmlParser, parser } from '@/parser/html';
import { Token, TokenType } from '@/parser/html/tokenizer';
import { VNode, VNodeType } from '@/parser/vNode';

const t = (type: TokenType, value: string): Token => ({ type, value });

const children = (node: VNode) => node.children ?? [];
const firstChild = (node: VNode) => children(node)[0];

describe('parser/html', () => {
  it('returns an empty template root for an empty source', () => {
    const ast = htmlParser('');

    expect(ast).toBeInstanceOf(VNode);
    expect(ast.type).toBe(VNodeType.element);
    expect(ast.value).toBe('template');
    expect(ast.children).toEqual([]);
    expect(ast.parent).toBeNull();
  });

  it('parses an element with attributes and a text child', () => {
    const ast = htmlParser('<div class="a" id="b">text</div>');
    const div = firstChild(ast);

    expect(children(ast)).toHaveLength(1);
    expect(div.type).toBe(VNodeType.element);
    expect(div.value).toBe('div');
    expect(div.parent).toBe(ast);
    expect(div.attrs).toEqual([
      { name: 'class', value: 'a' },
      { name: 'id', value: 'b' },
    ]);

    const text = firstChild(div);
    expect(text.type).toBe(VNodeType.text);
    expect(text.value).toBe('text');
    expect(text.parent).toBe(div);
  });

  it('lowercases the tag name but keeps attribute names as written', () => {
    const div = firstChild(htmlParser('<DIV DataX="1"></DIV>'));

    expect(div.value).toBe('div');
    expect(div.attrs).toEqual([{ name: 'DataX', value: '1' }]);
    expect(div.children).toBeUndefined();
  });

  it('parses a valueless attribute', () => {
    const input = firstChild(htmlParser('<div hidden></div>'));

    expect(input.attrs).toEqual([{ name: 'hidden' }]);
  });

  it('parses an attribute whose "=" is not followed by a value', () => {
    const div = firstChild(htmlParser('<div a=>'));

    expect(div.attrs).toEqual([{ name: 'a' }]);
  });

  it('parses an empty attribute value', () => {
    const div = firstChild(htmlParser('<div a="">'));

    expect(div.attrs).toEqual([{ name: 'a', value: '' }]);
  });

  it('skips non string tokens while collecting attributes', () => {
    const div = firstChild(htmlParser('<div = x>'));

    expect(div.value).toBe('div');
    expect(div.attrs).toEqual([{ name: 'x' }]);
  });

  it('trims text nodes and drops whitespace only text', () => {
    const ast = htmlParser('   <div>  a  b  </div>   ');

    expect(children(ast)).toHaveLength(1);

    const div = firstChild(ast);
    expect(children(div)).toHaveLength(1);
    expect(firstChild(div).value).toBe('a  b');
  });

  it('parses nested siblings in document order', () => {
    const ul = firstChild(htmlParser('<ul><li>a</li><li>b</li></ul>'));

    expect(ul.value).toBe('ul');
    expect(children(ul).map(node => node.value)).toEqual(['li', 'li']);
    expect(children(ul).map(node => firstChild(node).value)).toEqual([
      'a',
      'b',
    ]);
    expect(children(ul).every(node => node.parent === ul)).toBe(true);
  });

  it('parses a self closing tag without consuming the following siblings', () => {
    const ast = htmlParser('<my-el />text');

    expect(children(ast).map(node => [node.type, node.value])).toEqual([
      [VNodeType.element, 'my-el'],
      [VNodeType.text, 'text'],
    ]);
    expect(firstChild(ast).children).toBeUndefined();
  });

  it('treats a void tag name as self closing even without a slash', () => {
    const ast = htmlParser('<br>text');

    expect(children(ast).map(node => [node.type, node.value])).toEqual([
      [VNodeType.element, 'br'],
      [VNodeType.text, 'text'],
    ]);
    expect(firstChild(ast).children).toBeUndefined();
  });

  it('keeps the slash in the tag name when "<br/>" is written without a space', () => {
    const node = firstChild(htmlParser('<br/>'));

    expect(node.type).toBe(VNodeType.element);
    expect(node.value).toBe('br/');
    expect(node.attrs).toBeUndefined();
  });

  it('parses a void tag with attributes', () => {
    const img = firstChild(htmlParser('<img src="a.png" alt="a">'));

    expect(img.value).toBe('img');
    expect(img.attrs).toEqual([
      { name: 'src', value: 'a.png' },
      { name: 'alt', value: 'a' },
    ]);
  });

  it('closes an element with the "<//>" skip end tag', () => {
    const ast = htmlParser('<div>a<//>b');
    const div = firstChild(ast);

    expect(div.value).toBe('div');
    expect(children(div).map(node => node.value)).toEqual(['a']);
    expect(children(ast).map(node => node.value)).toEqual(['div', 'b']);
  });

  it('parses a comment and keeps its untrimmed inner value', () => {
    const comment = firstChild(htmlParser('<!-- hi -->'));

    expect(comment.type).toBe(VNodeType.comment);
    expect(comment.value).toBe(' hi ');
  });

  it('parses a comment nested inside an element', () => {
    const div = firstChild(htmlParser('<div><!-- c --></div>'));

    expect(children(div)).toHaveLength(1);
    expect(firstChild(div).type).toBe(VNodeType.comment);
    expect(firstChild(div).value).toBe(' c ');
    expect(firstChild(div).parent).toBe(div);
  });

  it('keeps a "<" that appears inside comment content', () => {
    const comment = firstChild(htmlParser('<!-- <b -->'));

    expect(comment.type).toBe(VNodeType.comment);
    expect(comment.value).toBe(' <b ');
  });

  it('parses an unterminated comment up to the end of the source', () => {
    const comment = firstChild(htmlParser('<!-- abc'));

    expect(comment.type).toBe(VNodeType.comment);
    expect(comment.value).toBe(' abc');
  });

  it('needs whitespace around comment markers, otherwise it becomes an element', () => {
    const node = firstChild(htmlParser('<!--c-->'));

    expect(node.type).toBe(VNodeType.element);
    expect(node.value).toBe('!--c--');
  });

  it('ignores a lone "<" that starts nothing', () => {
    expect(htmlParser('<').children).toEqual([]);
  });

  it('turns an orphan end tag into a text node of the leftover tokens', () => {
    const ast = htmlParser('</div>');

    expect(children(ast).map(node => [node.type, node.value])).toEqual([
      [VNodeType.text, 'div>'],
    ]);
  });

  it('parses a hand built token stream through the exported parser', () => {
    const ast = parser([
      t(TokenType.lt, '<'),
      t(TokenType.string, 'span'),
      t(TokenType.string, 'title'),
      t(TokenType.equal, '='),
      t(TokenType.string, 'x'),
      t(TokenType.gt, '>'),
      t(TokenType.string, 'hi'),
      t(TokenType.lt, '<'),
      t(TokenType.slash, '/'),
      t(TokenType.string, 'span'),
      t(TokenType.gt, '>'),
    ]);
    const span = firstChild(ast);

    expect(span.value).toBe('span');
    expect(span.attrs).toEqual([{ name: 'title', value: 'x' }]);
    expect(firstChild(span).value).toBe('hi');
  });

  it('yields every node through the VNode iterator', () => {
    const ast = htmlParser('<ul><li>a</li></ul>');

    expect([...ast].map(node => node.value)).toEqual([
      'template',
      'ul',
      'li',
      'a',
    ]);
  });
});
