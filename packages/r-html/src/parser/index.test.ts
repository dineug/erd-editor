import { describe, expect, it } from 'vitest';

import { htmlParser } from '@/parser';
import { VNodeType } from '@/parser/vNode';

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
