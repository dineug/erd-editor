import { describe, expect, it } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { htmlParser } from '@/parser';
import { VNode, VNodeType } from '@/parser/vNode';
import { createMarker } from '@/template/helper';
import { createTNode, TNode } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const element = (value: string, node: Partial<VNode> = {}) =>
  new VNode({ type: VNodeType.element, value, ...node });

const text = (value: string) => new VNode({ type: VNodeType.text, value });

const firstElement = (source: string) =>
  createTNode(htmlParser(source)).children?.[0] as TNode;

describe('template/tNode', () => {
  describe('TNode', () => {
    it('defaults to a comment node without parent', () => {
      const node = new TNode(new VNode());

      expect(node.type).toBe(VNodeType.comment);
      expect(node.value).toBe('');
      expect(node.parent).toBeNull();
      expect(node.staticAttrs).toBeUndefined();
      expect(node.attrs).toBeUndefined();
      expect(node.children).toBeUndefined();
    });

    it('detects markers inside the node value', () => {
      expect(new TNode(text(`a${m0}b`)).isMarker).toBe(true);
      expect(new TNode(text(`a${m0}b`)).isMarkerOnly).toBe(false);
      expect(new TNode(text(m0)).isMarkerOnly).toBe(true);
      expect(new TNode(text('a')).isMarker).toBe(false);
    });

    it('detects svg elements case insensitively', () => {
      expect(new TNode(element('svg')).isSvg).toBe(true);
      expect(new TNode(element('SVG')).isSvg).toBe(true);
      expect(new TNode(element('div')).isSvg).toBe(false);
      expect(new TNode(text('svg')).isSvg).toBe(false);
    });

    it('treats a marker only element as a component', () => {
      expect(new TNode(element(m0)).isComponent).toBe(true);
      expect(new TNode(element(`a${m0}`)).isComponent).toBe(false);
      expect(new TNode(text(m0)).isComponent).toBe(false);
    });

    it('links children to their parent recursively', () => {
      const node = new TNode(
        element('ul', { children: [element('li', { children: [text('a')] })] })
      );
      const li = node.children?.[0] as TNode;

      expect(li).toBeInstanceOf(TNode);
      expect(li.parent).toBe(node);
      expect(li.children?.[0].parent).toBe(li);
    });

    it('leaves both attribute buckets empty for an empty attrs list', () => {
      const node = new TNode(element('div', { attrs: [] }));

      expect(node.staticAttrs).toBeUndefined();
      expect(node.attrs).toBeUndefined();
    });
  });

  describe('TNode.insert', () => {
    it('inserts before and after an existing child', () => {
      const node = new TNode(element('div', { children: [text('a')] }));
      const ref = node.children?.[0] as TNode;
      const before = new TNode(text('b'));
      const after = new TNode(text('c'));

      node.insert('before', before, ref);
      node.insert('after', after, ref);

      expect(node.children?.map(child => child.value)).toEqual(['b', 'a', 'c']);
    });

    it('does nothing when the reference child is unknown', () => {
      const node = new TNode(element('div', { children: [text('a')] }));

      node.insert('after', new TNode(text('b')), new TNode(text('a')));

      expect(node.children?.map(child => child.value)).toEqual(['a']);
    });

    it('creates the children list when the node has none', () => {
      const node = new TNode(element('div'));
      const child = new TNode(text('a'));

      node.insert('after', child, new TNode(text('ref')));

      expect(node.children).toEqual([child]);
    });
  });

  describe('TNode iteration', () => {
    it('walks up to the root through iterParent', () => {
      const root = new TNode(
        element('ul', { children: [element('li', { children: [text('a')] })] })
      );
      const a = root.children?.[0].children?.[0] as TNode;

      expect([...a.iterParent()].map(node => node.value)).toEqual([
        'a',
        'li',
        'ul',
      ]);
      expect([...root.iterParent()]).toEqual([root]);
    });

    it('walks the whole subtree depth first', () => {
      const root = new TNode(
        element('ul', {
          children: [
            element('li', { children: [text('a')] }),
            element('li', { children: [text('b')] }),
          ],
        })
      );

      expect([...root].map(node => node.value)).toEqual([
        'ul',
        'li',
        'a',
        'li',
        'b',
      ]);
    });
  });

  describe('createTNode text splitting', () => {
    it('splits a text node into static and marker parts', () => {
      const div = firstElement(`<div>hello ${m0} world ${m1}</div>`);

      expect(div.children?.map(child => [child.type, child.value])).toEqual([
        [VNodeType.text, 'hello '],
        [VNodeType.text, m0],
        [VNodeType.text, ' world '],
        [VNodeType.text, m1],
      ]);
    });

    it('leaves a marker only text node untouched', () => {
      const div = firstElement(`<div>${m0}</div>`);

      expect(div.children?.map(child => child.value)).toEqual([m0]);
    });

    it('drops empty and newline only fragments', () => {
      const root = createTNode(
        element('div', { children: [text(`${m0}\n  ${m1}`)] })
      );

      expect(root.children?.map(child => child.value)).toEqual([m0, m1]);
    });

    it('keeps a fragment whose newline is followed by real text', () => {
      const root = createTNode(
        element('div', { children: [text(`a\n  ${m0}`)] })
      );

      expect(root.children?.map(child => child.value)).toEqual(['a\n  ', m0]);
    });

    it('only rewrites the node value when it has no parent', () => {
      const root = createTNode(text(`a${m0}b`));

      expect(root.value).toBe('a');
      expect(root.children).toBeUndefined();
    });
  });

  describe('createTNode attributes', () => {
    it('merges repeated static attributes with a space', () => {
      const div = firstElement(`<div class="a" class="b" id="x"></div>`);

      expect(div.staticAttrs).toEqual([
        { type: TAttrType.attribute, name: 'class', value: 'a b' },
        { type: TAttrType.attribute, name: 'id', value: 'x' },
      ]);
      expect(div.attrs).toBeUndefined();
    });

    it('moves attributes holding a marker into the part bucket', () => {
      const div = firstElement(`<div class="a ${m0}"></div>`);

      expect(div.attrs).toEqual([
        { type: TAttrType.attribute, name: 'class', value: `a ${m0}` },
      ]);
      expect(div.staticAttrs).toBeUndefined();
    });

    it('drops the value of a valueless static attribute', () => {
      const div = firstElement(`<div class id="x"></div>`);

      expect(div.staticAttrs).toEqual([
        { type: TAttrType.attribute, name: 'class' },
        { type: TAttrType.attribute, name: 'id', value: 'x' },
      ]);
    });

    it('resolves property, boolean and event attributes', () => {
      const div = firstElement(
        `<div .value="${m0}" ?disabled="${m0}" @click="${m0}" onclick="${m1}"></div>`
      );

      expect(div.attrs).toEqual([
        { type: TAttrType.property, name: 'value', value: m0 },
        { type: TAttrType.boolean, name: 'disabled', value: m0 },
        { type: TAttrType.event, name: 'click', value: m0 },
        { type: TAttrType.event, name: 'click', value: m1 },
      ]);
      expect(div.staticAttrs).toBeUndefined();
    });

    it('drops event attributes without a value', () => {
      const div = firstElement(`<div @click ?disabled></div>`);

      expect(div.attrs).toBeUndefined();
      expect(div.staticAttrs).toEqual([
        { type: TAttrType.boolean, name: 'disabled' },
      ]);
    });

    it('resolves spread and directive attributes', () => {
      expect(firstElement(`<div ...${m0}></div>`).attrs).toEqual([
        { type: TAttrType.spread, name: m0 },
      ]);
      expect(firstElement(`<div ${m0}></div>`).attrs).toEqual([
        { type: TAttrType.directive, name: m0 },
      ]);
    });
  });
});
