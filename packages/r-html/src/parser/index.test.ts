import { describe, expect, it } from 'vitest';

import * as parser from '@/parser';
import { cssParser, htmlParser } from '@/parser';
import { cssParser as cssParserDirect } from '@/parser/css';
import { htmlParser as htmlParserDirect } from '@/parser/html';
import { VCNodeType } from '@/parser/vcNode';
import { VNodeType } from '@/parser/vNode';

describe('parser barrel', () => {
  it('re-exports exactly cssParser and htmlParser', () => {
    expect(Object.keys(parser).sort()).toEqual(['cssParser', 'htmlParser']);
  });

  it('re-exports the same function identities as the feature modules', () => {
    expect(htmlParser).toBe(htmlParserDirect);
    expect(cssParser).toBe(cssParserDirect);
  });
});

describe('htmlParser via the barrel', () => {
  it('returns an empty template root for an empty source', () => {
    const ast = htmlParser('');

    expect(ast.type).toBe(VNodeType.element);
    expect(ast.value).toBe('template');
    expect(ast.children).toEqual([]);
  });

  it('parses elements, attributes, text and comments', () => {
    const ast = htmlParser(
      `<div class="a" id='b' disabled>hello <span>world</span><!-- note --></div>`
    );

    const div = ast.children?.[0];
    expect(div?.type).toBe(VNodeType.element);
    expect(div?.value).toBe('div');
    expect(div?.parent).toBe(ast);
    expect(div?.attrs).toEqual([
      { name: 'class', value: 'a' },
      { name: 'id', value: 'b' },
      { name: 'disabled' },
    ]);

    expect(div?.children?.map(({ type, value }) => ({ type, value }))).toEqual([
      { type: VNodeType.text, value: 'hello' },
      { type: VNodeType.element, value: 'span' },
      { type: VNodeType.comment, value: ' note ' },
    ]);

    expect(div?.children?.[1].children?.[0].value).toBe('world');
  });

  it('lowercases tag names and drops whitespace-only text nodes', () => {
    const ast = htmlParser(`<DIV>   <P>x</P>   </DIV>`);
    const div = ast.children?.[0];

    expect(div?.value).toBe('div');
    expect(div?.children).toHaveLength(1);
    expect(div?.children?.[0].value).toBe('p');
  });

  it('closes self-closing tags written with a leading space', () => {
    const ast = htmlParser(`<div><br /><span>after</span></div>`);
    const div = ast.children?.[0];

    expect(div?.children?.map(node => node.value)).toEqual(['br', 'span']);
    expect(div?.children?.[0].children).toBeUndefined();
  });

  it('produces a traversable tree through the node iterator', () => {
    const ast = htmlParser(`<ul><li>a</li><li>b</li></ul>`);

    expect([...ast].map(node => node.value)).toEqual([
      'template',
      'ul',
      'li',
      'a',
      'li',
      'b',
    ]);
  });
});

describe('cssParser via the barrel', () => {
  it('returns an empty style root for an empty source', () => {
    const ast = cssParser('');

    expect(ast.type).toBe(VCNodeType.style);
    expect(ast.value).toBeUndefined();
    expect(ast.parent).toBeNull();
    expect(ast.children).toBeUndefined();
    expect(ast.properties).toBeUndefined();
  });

  it('parses comments, at-rules, selectors and declarations', () => {
    const ast = cssParser(`
/* c1 */
// c2
@import url(a.css);
.foo {
  color: red;
  @media (min-width: 100px) {
    display: none;
  }
}
`);

    expect(ast.children?.map(({ type, value }) => ({ type, value }))).toEqual([
      { type: VCNodeType.comment, value: '/* c1 */' },
      { type: VCNodeType.comment, value: '// c2' },
      { type: VCNodeType.atRule, value: '@import url(a.css);' },
      { type: VCNodeType.style, value: '.foo' },
    ]);

    const foo = ast.children?.[3];
    expect(foo?.properties).toEqual([{ name: 'color', value: 'red' }]);

    const media = foo?.children?.[0];
    expect(media?.type).toBe(VCNodeType.atRule);
    expect(media?.value).toBe('@media (min-width: 100px)');
    expect(media?.properties).toEqual([{ name: 'display', value: 'none' }]);
    expect(media?.parent).toBe(foo);
  });

  it('produces a traversable tree through the node iterator', () => {
    const ast = cssParser(`.a { color: red; } .b { color: blue; }`);

    expect([...ast].map(node => node.value)).toEqual([undefined, '.a', '.b']);
  });
});
