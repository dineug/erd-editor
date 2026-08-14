import { describe, expect, it } from 'vitest';

import { cssParser } from '@/parser';
import { VCNode, VCNodeType } from '@/parser/vcNode';
import { css } from '@/template/css';
import { createMarker } from '@/template/helper';
import { RCNode } from '@/template/rcNode';
import { createTCNode, TCNode } from '@/template/tcNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const IDENTIFIER_REGEXP = /^_[0-9a-z_-]{21}$/;

const fromCSS = (source: string, values: any[] = []) =>
  new RCNode(createTCNode(cssParser(source)), null, values);

const fromVCNode = (node: VCNode, values: any[] = []) =>
  new RCNode(createTCNode(node), null, values);

const style = (node: Partial<VCNode> = {}) =>
  new VCNode({ type: VCNodeType.style, ...node });

describe('template/rcNode', () => {
  describe('root node', () => {
    it('flattens the root properties into a style block', () => {
      const node = fromCSS('color: red;\nbackground: blue;');

      expect(node.type).toBe(VCNodeType.style);
      expect(node.value).toBeUndefined();
      expect(node.parent).toBeNull();
      expect(node.isAtRule).toBe(false);
      expect(node.skipParent).toBe(false);
      expect(node.style).toBe('color: red;\nbackground: blue;\n');
    });

    it('names an anonymous root with a generated class identifier', () => {
      const node = fromCSS('color: red;');

      expect(node.toString()).toMatch(IDENTIFIER_REGEXP);
      expect(node.toString(true)).toBe(`.${node.toString()}`);
      expect(node.selector).toBe(`.${node.toString()}`);
    });

    it('reuses the identifier of an identical style and separates different ones', () => {
      const a = fromCSS('color: red;');
      const b = fromCSS('color: red;');
      const c = fromCSS('color: blue;');

      expect(a.toString()).toBe(b.toString());
      expect(a.toString()).not.toBe(c.toString());
    });
  });

  describe('nested selectors', () => {
    it('prefixes a child selector with the generated root selector', () => {
      const root = fromCSS('.child { color: blue; }');
      const child = root.children?.[0] as RCNode;

      expect(root.children).toHaveLength(1);
      expect(child.value).toBe('.child');
      expect(child.parent).toBe(root);
      expect(child.skipParent).toBe(false);
      expect(child.style).toBe('color: blue;\n');
      expect(child.toString()).toBe('.child');
      expect(child.toString(true)).toBe('.child');
      expect(child.selector).toBe(`.${root.toString()} .child`);
    });

    it('resolves `&` against the parent selector and skips it in the chain', () => {
      const root = fromCSS('&:hover { color: green; }');
      const child = root.children?.[0] as RCNode;

      expect(child.value).toBe(`.${root.toString()}:hover`);
      expect(child.skipParent).toBe(true);
      expect(child.selector).toBe(`.${root.toString()}:hover`);
    });

    it('resolves `&` inside a nested selector', () => {
      const root = fromCSS('.a { color: red; &:hover { color: blue; } }');
      const a = root.children?.[0] as RCNode;
      const hover = a.children?.[0] as RCNode;

      expect(hover.value).toBe('.a:hover');
      expect(hover.skipParent).toBe(true);
      expect(hover.selector).toBe(`.${root.toString()} .a:hover`);
    });

    it('ignores comment nodes when collecting children', () => {
      const root = fromCSS(`
        /* block comment */
        color: red;
        // line comment
        .a {
          color: blue;
        }
      `);

      expect(root.children?.map(child => child.value)).toEqual(['.a']);
    });
  });

  describe('at rules', () => {
    it('renders the nested rules of a block at rule into its own style', () => {
      const root = fromCSS('@media screen { .a { color: pink; } }');
      const atRule = root.children?.[0] as RCNode;

      expect(atRule.isAtRule).toBe(true);
      expect(atRule.value).toBe('@media screen');
      expect(atRule.skipParent).toBe(true);
      expect(atRule.selector).toBe('@media screen');
      expect(atRule.style).toBe('.a {\ncolor: pink;\n}\n');
    });

    it('keeps a statement at rule without a style block', () => {
      const root = fromCSS(`@import url('a.css');`);
      const atRule = root.children?.[0] as RCNode;

      expect(atRule.isAtRule).toBe(true);
      expect(atRule.value).toBe(`@import url('a.css');`);
      expect(atRule.style).toBe('');
      expect(atRule.selector).toBe(`@import url('a.css');`);
    });

    it('skips at rule children that have no selector value', () => {
      const root = fromVCNode(
        style({
          children: [
            new VCNode({
              type: VCNodeType.atRule,
              value: '@media print',
              children: [
                style({ properties: [{ name: 'color', value: 'red' }] }),
                style({
                  value: '.b',
                  properties: [{ name: 'color', value: 'blue' }],
                }),
              ],
            }),
          ],
        })
      );

      expect(root.children?.[0].style).toBe('.b {\ncolor: blue;\n}\n');
    });
  });

  describe('markers in selectors', () => {
    const withMarkerSelector = (values: any[]) =>
      fromVCNode(
        style({
          children: [
            style({
              value: `${m0} span`,
              properties: [{ name: 'color', value: 'red' }],
            }),
          ],
        }),
        values
      );

    it('substitutes a primitive value into the selector', () => {
      expect(withMarkerSelector(['.foo']).children?.[0].value).toBe(
        '.foo span'
      );
      expect(withMarkerSelector([42]).children?.[0].value).toBe('42 span');
    });

    it('substitutes an empty string for nullish and non primitive values', () => {
      expect(withMarkerSelector([null]).children?.[0].value).toBe(' span');
      expect(withMarkerSelector([undefined]).children?.[0].value).toBe(' span');
      expect(withMarkerSelector([{ a: 1 }]).children?.[0].value).toBe(' span');
    });

    it('substitutes the generated class selector of a css template literal', () => {
      const other = css`
        color: teal;
      `;
      const root = withMarkerSelector([other]);
      const child = root.children?.[0] as RCNode;

      expect(child.value).toBe(`.${String(other)} span`);
      expect(child.selector).toBe(`.${root.toString()} .${String(other)} span`);
    });
  });

  describe('properties', () => {
    it('formats plain, marker name and marker value properties', () => {
      const root = fromVCNode(
        style({
          properties: [
            { name: `x-${m0}`, value: `${m1}px` },
            { name: `y-${m0}`, value: 'static' },
            { name: 'z', value: `${m1}em` },
            { name: 'w', value: 'plain' },
          ],
        }),
        ['name', 10]
      );

      expect(root.style).toBe(
        'x-name: 10px;\ny-name: static;\nz: 10em;\nw: plain;\n'
      );
    });

    it('inlines a dynamic property holding a raw string', () => {
      const root = fromVCNode(
        style({ properties: [{ name: m0, value: m0 }] }),
        ['padding: 1px;\n']
      );

      expect(root.style).toBe('padding: 1px;\n');
    });

    it('inlines nothing for a dynamic property holding a non primitive', () => {
      const root = fromVCNode(
        style({ properties: [{ name: m0, value: m0 }] }),
        [undefined]
      );

      expect(root.style).toBe('');
    });

    it('inlines a childless dynamic css template literal', () => {
      const inner = css`
        color: teal;
      `;
      const root = fromVCNode(
        style({ properties: [{ name: m0, value: m0 }] }),
        [inner]
      );

      expect(root.style).toBe('color: teal;\n');
      expect(root.children).toEqual([]);
    });

    it('merges the styles and children of a dynamic css template literal', () => {
      const inner = css`
        color: red;
        .inner {
          color: blue;
        }
      `;
      const root = fromVCNode(
        style({ properties: [{ name: m0, value: m0 }] }),
        [inner]
      );

      expect(root.style).toBe('color: red;\n');
      expect(root.children?.map(child => child.value)).toEqual(['.inner']);
      expect(root.children?.[0].style).toBe('color: blue;\n');
      expect(root.children?.[0].parent).toBe(root);
    });
  });

  describe('iteration', () => {
    it('yields the whole tree but never descends into an at rule', () => {
      const root = fromCSS(`
        color: red;
        .a {
          color: blue;
          .b {
            color: green;
          }
        }
        @media screen {
          .c {
            color: pink;
          }
        }
      `);

      expect([...root].map(node => node.value)).toEqual([
        undefined,
        '.a',
        '.b',
        '@media screen',
      ]);
    });

    it('walks up the parent chain through iterParent', () => {
      const root = fromCSS('.a { .b { color: red; } }');
      const b = root.children?.[0].children?.[0] as RCNode;

      expect([...b.iterParent()].map(node => node.value)).toEqual([
        '.b',
        '.a',
        undefined,
      ]);
      expect([...root.iterParent()]).toEqual([root]);
    });
  });

  describe('defaults', () => {
    it('falls back to a comment node with an empty style', () => {
      const node = new RCNode(new TCNode(new VCNode()), null, []);

      expect(node.type).toBe(VCNodeType.comment);
      expect(node.style).toBe('');
      expect(node.children).toEqual([]);
      expect(node.toString()).toMatch(IDENTIFIER_REGEXP);
    });
  });
});
