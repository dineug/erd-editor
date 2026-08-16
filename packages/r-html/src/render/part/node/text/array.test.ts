import { afterEach, describe, expect, it } from 'vite-plus/test';

import { nextTick } from '@/observable/scheduler';
import { rangeNodes } from '@/render/helper';
import { ArrayPart, ItemPart } from '@/render/part/node/text/array';
import { PartType } from '@/render/part/node/text/helper';
import { html } from '@/template/html';

const containers: HTMLElement[] = [];

const tick = () => nextTick(() => {});

function createHost() {
  const container = document.createElement('div');
  const startNode = document.createComment('start');
  const endNode = document.createComment('end');
  container.append(startNode, endNode);
  document.body.append(container);
  containers.push(container);
  return { container, startNode, endNode };
}

afterEach(() => {
  let container = containers.pop();
  while (container) {
    container.remove();
    container = containers.pop();
  }
});

describe('render/part/node/text/array ArrayPart', () => {
  it('renders every value on the first commit', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);

    part.commit(['a', 'b', 'c']);

    expect(container.textContent).toBe('abc');
  });

  it('renders nothing for an empty array', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);

    part.commit([]);

    expect(container.textContent).toBe('');
  });

  it('reuses parts and reorders nodes when the list is rotated', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a', 'b', 'c']);
    const before = rangeNodes(startNode, endNode);

    part.commit(['c', 'a', 'b']);
    const after = rangeNodes(startNode, endNode);

    expect(container.textContent).toBe('cab');
    expect(after).not.toEqual(before);
    expect(new Set(after)).toEqual(new Set(before));
  });

  it('prepends a created item in front of a reused one', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a']);

    part.commit(['z', 'a']);

    expect(container.textContent).toBe('za');
  });

  it('appends created items after the existing ones', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a']);

    part.commit(['a', 'b', 'c']);

    expect(container.textContent).toBe('abc');
  });

  it('removes the surplus items when the list shrinks', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a', 'b', 'c']);

    part.commit(['a', 'b']);

    expect(container.textContent).toBe('ab');
  });

  it('clears everything when committing an empty array', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a', 'b']);

    part.commit([]);

    expect(container.textContent).toBe('');
    expect(rangeNodes(startNode, endNode)).toEqual([]);
  });

  it('recycles a primitive part when only the value changed', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a', 'b']);
    const before = rangeNodes(startNode, endNode);

    part.commit(['x', 'y']);

    expect(container.textContent).toBe('xy');
    expect(rangeNodes(startNode, endNode)).toEqual(before);
  });

  it('renders template literal items and keeps them in order', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    const row = (v: string) => html`<span>${v}</span>`;

    part.commit([row('a'), row('b')]);
    await tick();

    expect(
      Array.from(container.querySelectorAll('span')).map(el => el.textContent)
    ).toEqual(['a', 'b']);

    part.commit([row('b'), row('a')]);
    await tick();

    expect(
      Array.from(container.querySelectorAll('span')).map(el => el.textContent)
    ).toEqual(['b', 'a']);
  });

  it('destroys template literal items that are removed', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    const row = (v: string) => html`<span>${v}</span>`;

    part.commit([row('a'), row('b')]);
    await tick();
    part.commit([row('a')]);
    await tick();

    expect(container.querySelectorAll('span').length).toBe(1);
    expect(container.textContent).toBe('a');
  });

  it('replaces items whose part type changed', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);

    part.commit(['a']);
    part.commit([html`<b>bold</b>`]);
    await tick();

    expect(container.querySelectorAll('b').length).toBe(1);
    expect(container.textContent).toBe('bold');
  });

  it('destroys all items', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ArrayPart(startNode, endNode);
    part.commit(['a', html`<i>b</i>`]);
    await tick();

    part.destroy();

    expect(container.textContent).toBe('');
    expect(rangeNodes(startNode, endNode)).toEqual([]);
  });
});

describe('render/part/node/text/array ItemPart', () => {
  it('replaces the placeholder node with its own boundary comments', () => {
    const { container, endNode } = createHost();
    const node = document.createComment('placeholder');
    container.insertBefore(node, endNode);

    const item = new ItemPart(node, 'a');

    expect(node.parentNode).toBeNull();
    expect(item.startNode.parentNode).toBe(container);
    expect(item.endNode.parentNode).toBe(container);
    expect(item.type).toBe(PartType.primitive);
    expect(item.value).toBe('a');
  });

  it('commits the value into the boundary range', () => {
    const { container, endNode } = createHost();
    const node = document.createComment('');
    container.insertBefore(node, endNode);
    const item = new ItemPart(node, 'a');

    item.commit('a');

    expect(container.textContent).toBe('a');
    expect(item.value).toBe('a');

    item.commit('b');

    expect(container.textContent).toBe('b');
    expect(item.value).toBe('b');
  });

  it('moves its whole node range before a reference node', () => {
    const { container, startNode, endNode } = createHost();
    const node = document.createComment('');
    container.insertBefore(node, endNode);
    const item = new ItemPart(node, 'a');
    item.commit('a');
    const marker = document.createTextNode('|');
    container.insertBefore(marker, startNode);

    item.insert('before', marker);

    expect(container.textContent).toBe('a|');
    expect(rangeNodes(item.startNode, item.endNode).length).toBe(1);
  });

  it('moves its whole node range after a reference node', () => {
    const { container, endNode } = createHost();
    const node = document.createComment('');
    container.insertBefore(node, endNode);
    const item = new ItemPart(node, 'a');
    item.commit('a');
    const marker = document.createTextNode('|');
    container.append(marker);

    item.insert('after', marker);

    expect(container.textContent).toBe('|a');
    expect(rangeNodes(item.startNode, item.endNode).length).toBe(1);
  });

  it('removes every node it owns on destroy', () => {
    const { container, endNode } = createHost();
    const node = document.createComment('');
    container.insertBefore(node, endNode);
    const item = new ItemPart(node, 'a');
    item.commit('a');

    item.destroy();

    expect(container.textContent).toBe('');
    expect(item.startNode.parentNode).toBeNull();
    expect(item.endNode.parentNode).toBeNull();
  });

  it('calls destroy on parts that implement it', async () => {
    const { container, endNode } = createHost();
    const node = document.createComment('');
    container.insertBefore(node, endNode);
    const item = new ItemPart(node, html`<em>x</em>`);
    item.commit(html`<em>x</em>`);
    await tick();

    expect(item.type).toBe(PartType.templateLiterals);
    expect(container.querySelectorAll('em').length).toBe(1);

    item.destroy();

    expect(container.querySelectorAll('em').length).toBe(0);
    expect(container.textContent).toBe('');
  });
});
