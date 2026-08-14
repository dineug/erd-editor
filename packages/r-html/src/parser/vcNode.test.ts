import { describe, expect, it } from 'vitest';

import { VCNode, VCNodeType, VCProperty } from '@/parser/vcNode';

describe('VCNodeType', () => {
  it('maps each member to its own name', () => {
    expect(VCNodeType.style).toBe('style');
    expect(VCNodeType.comment).toBe('comment');
    expect(VCNodeType.atRule).toBe('atRule');
  });
});

describe('VCNode constructor', () => {
  it('applies comment defaults when no argument is given', () => {
    const node = new VCNode();

    expect(node.type).toBe(VCNodeType.comment);
    expect(node.value).toBeUndefined();
    expect(node.parent).toBeNull();
    expect(node.properties).toBeUndefined();
    expect(node.children).toBeUndefined();
  });

  it('assigns every own property of the partial over the defaults', () => {
    const parent = new VCNode({ type: VCNodeType.style });
    const properties: VCProperty[] = [{ name: 'color', value: 'red' }];
    const node = new VCNode({
      type: VCNodeType.style,
      value: '.foo',
      properties,
      parent,
    });

    expect(node.type).toBe(VCNodeType.style);
    expect(node.value).toBe('.foo');
    expect(node.properties).toBe(properties);
    expect(node.parent).toBe(parent);
    expect(node.children).toBeUndefined();
  });

  it('keeps the default type when the partial omits it', () => {
    const node = new VCNode({ value: '/* hello */' });

    expect(node.type).toBe(VCNodeType.comment);
    expect(node.value).toBe('/* hello */');
  });

  it('accepts an explicit null parent for a root node', () => {
    const node = new VCNode({ type: VCNodeType.style, parent: null });

    expect(node.parent).toBeNull();
  });
});

describe('VCNode.iterParent', () => {
  it('yields only itself when it is a root node', () => {
    const root = new VCNode({ type: VCNodeType.style });

    expect([...root.iterParent()]).toEqual([root]);
  });

  it('yields itself and then every ancestor up to the root', () => {
    const root = new VCNode({ type: VCNodeType.style, value: 'root' });
    const media = new VCNode({
      type: VCNodeType.atRule,
      value: '@media screen',
      parent: root,
    });
    const rule = new VCNode({
      type: VCNodeType.style,
      value: '.foo',
      parent: media,
    });

    expect([...rule.iterParent()].map(node => node.value)).toEqual([
      '.foo',
      '@media screen',
      'root',
    ]);
  });

  it('completes with an undefined return value', () => {
    const root = new VCNode({ value: 'root' });
    const child = new VCNode({ value: 'child', parent: root });
    const iterator = child.iterParent();

    expect(iterator.next()).toEqual({ value: child, done: false });
    expect(iterator.next()).toEqual({ value: root, done: false });

    const last = iterator.next();
    expect(last.done).toBe(true);
    expect(last.value).toBeUndefined();
  });
});

describe('VCNode Symbol.iterator', () => {
  it('yields only itself when children is undefined', () => {
    const node = new VCNode({ type: VCNodeType.comment, value: '// x' });

    expect([...node]).toEqual([node]);
  });

  it('yields only itself when children is an empty array', () => {
    const node = new VCNode({ type: VCNodeType.style, children: [] });

    expect([...node]).toEqual([node]);
  });

  it('walks the tree depth first, parents before children', () => {
    const comment = new VCNode({ type: VCNodeType.comment, value: '/* c */' });
    const nested = new VCNode({ type: VCNodeType.style, value: '.bar' });
    const media = new VCNode({
      type: VCNodeType.atRule,
      value: '@media screen',
      children: [nested],
    });
    const root = new VCNode({
      type: VCNodeType.style,
      value: 'root',
      children: [comment, media],
    });

    expect([...root].map(node => node.value)).toEqual([
      'root',
      '/* c */',
      '@media screen',
      '.bar',
    ]);
  });

  it('completes with an undefined return value after the last child', () => {
    const child = new VCNode({ value: 'child' });
    const root = new VCNode({ value: 'root', children: [child] });
    const iterator = root[Symbol.iterator]();

    expect(iterator.next().value).toBe(root);
    expect(iterator.next().value).toBe(child);

    const last = iterator.next();
    expect(last.done).toBe(true);
    expect(last.value).toBeUndefined();
  });

  it('supports for..of over the same instance', () => {
    const child = new VCNode({ value: 'child' });
    const root = new VCNode({ value: 'root', children: [child] });
    const values: Array<string | undefined> = [];

    for (const node of root) {
      values.push(node.value);
    }

    expect(values).toEqual(['root', 'child']);
  });
});
