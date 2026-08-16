import { describe, expect, it } from 'vite-plus/test';

import { VAttr, VNode, VNodeType } from '@/parser/vNode';

describe('VNodeType', () => {
  it('maps each member to its own name', () => {
    expect(VNodeType.element).toBe('element');
    expect(VNodeType.text).toBe('text');
    expect(VNodeType.comment).toBe('comment');
  });
});

describe('VNode constructor', () => {
  it('applies comment defaults when no argument is given', () => {
    const node = new VNode();

    expect(node.type).toBe(VNodeType.comment);
    expect(node.value).toBe('');
    expect(node.parent).toBeNull();
    expect(node.attrs).toBeUndefined();
    expect(node.children).toBeUndefined();
  });

  it('assigns every own property of the partial over the defaults', () => {
    const parent = new VNode({ type: VNodeType.element, value: 'template' });
    const attrs: VAttr[] = [{ name: 'class', value: 'a' }, { name: 'hidden' }];
    const node = new VNode({
      type: VNodeType.element,
      value: 'div',
      attrs,
      parent,
    });

    expect(node.type).toBe(VNodeType.element);
    expect(node.value).toBe('div');
    expect(node.attrs).toBe(attrs);
    expect(node.parent).toBe(parent);
    expect(node.children).toBeUndefined();
  });

  it('keeps the default value when the partial omits the key', () => {
    const node = new VNode({ type: VNodeType.text });

    expect(node.type).toBe(VNodeType.text);
    expect(node.value).toBe('');
  });

  it('lets an explicit undefined override a default', () => {
    const node = new VNode({ value: undefined as unknown as string });

    expect('value' in node).toBe(true);
    expect(node.value).toBeUndefined();
  });
});

describe('VNode.iterParent', () => {
  it('yields only itself when it is a root node', () => {
    const root = new VNode({ type: VNodeType.element, value: 'template' });

    expect([...root.iterParent()]).toEqual([root]);
  });

  it('yields itself and then every ancestor up to the root', () => {
    const root = new VNode({ type: VNodeType.element, value: 'template' });
    const div = new VNode({
      type: VNodeType.element,
      value: 'div',
      parent: root,
    });
    const span = new VNode({
      type: VNodeType.element,
      value: 'span',
      parent: div,
    });

    expect([...span.iterParent()].map(node => node.value)).toEqual([
      'span',
      'div',
      'template',
    ]);
  });

  it('completes with an undefined return value', () => {
    const root = new VNode({ value: 'root' });
    const child = new VNode({ value: 'child', parent: root });
    const iterator = child.iterParent();

    expect(iterator.next()).toEqual({ value: child, done: false });
    expect(iterator.next()).toEqual({ value: root, done: false });

    const last = iterator.next();
    expect(last.done).toBe(true);
    expect(last.value).toBeUndefined();
  });

  it('creates an independent generator per call', () => {
    const root = new VNode({ value: 'root' });
    const child = new VNode({ value: 'child', parent: root });

    const first = child.iterParent();
    first.next();

    expect([...child.iterParent()]).toEqual([child, root]);
  });
});

describe('VNode Symbol.iterator', () => {
  it('yields only itself when children is undefined', () => {
    const node = new VNode({ type: VNodeType.text, value: 'text' });

    expect([...node]).toEqual([node]);
  });

  it('yields only itself when children is an empty array', () => {
    const node = new VNode({
      type: VNodeType.element,
      value: 'div',
      children: [],
    });

    expect([...node]).toEqual([node]);
  });

  it('walks the tree depth first, parents before children', () => {
    const leafA = new VNode({ type: VNodeType.text, value: 'a' });
    const leafB = new VNode({ type: VNodeType.text, value: 'b' });
    const span = new VNode({
      type: VNodeType.element,
      value: 'span',
      children: [leafA, leafB],
    });
    const leafC = new VNode({ type: VNodeType.comment, value: 'c' });
    const root = new VNode({
      type: VNodeType.element,
      value: 'div',
      children: [span, leafC],
    });

    expect([...root].map(node => node.value)).toEqual([
      'div',
      'span',
      'a',
      'b',
      'c',
    ]);
  });

  it('completes with an undefined return value after the last child', () => {
    const child = new VNode({ value: 'child' });
    const root = new VNode({ value: 'root', children: [child] });
    const iterator = root[Symbol.iterator]();

    expect(iterator.next().value).toBe(root);
    expect(iterator.next().value).toBe(child);

    const last = iterator.next();
    expect(last.done).toBe(true);
    expect(last.value).toBeUndefined();
  });

  it('supports for..of and Array.from over the same instance', () => {
    const child = new VNode({ value: 'child' });
    const root = new VNode({ value: 'root', children: [child] });
    const values: string[] = [];

    for (const node of root) {
      values.push(node.value);
    }

    expect(values).toEqual(['root', 'child']);
    expect(Array.from(root)).toHaveLength(2);
  });
});
