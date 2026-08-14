import { afterEach, describe, expect, it } from 'vitest';

import { rangeNodes } from '@/render/helper';
import { ObjectPart } from '@/render/part/node/text/object';
import { html } from '@/template/html';

const containers: HTMLElement[] = [];

function createHost() {
  const container = document.createElement('div');
  const startNode = document.createComment('start');
  const endNode = document.createComment('end');
  container.append(startNode, endNode);
  document.body.append(container);
  containers.push(container);
  return { container, startNode, endNode };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

afterEach(() => {
  let container = containers.pop();
  while (container) {
    container.remove();
    container = containers.pop();
  }
});

describe('render/part/node/text/object ObjectPart', () => {
  it('renders nothing for a plain object', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.commit({ a: 1 });
    await flush();

    expect(container.textContent).toBe('');
    expect(rangeNodes(startNode, endNode)).toEqual([]);
  });

  it('ignores a commit whose value equals the current one', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);
    const promise = Promise.resolve('hello');

    part.commit(promise);
    await flush();
    expect(container.textContent).toBe('hello');

    part.commit(promise);
    await flush();

    expect(container.textContent).toBe('hello');
  });

  it('ignores an initial null commit because null is the initial value', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);
    const marker = document.createTextNode('keep');
    container.insertBefore(marker, endNode);

    part.commit(null);
    await flush();

    expect(container.textContent).toBe('keep');
  });

  it('renders the resolved value of a promise', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.commit(Promise.resolve('hello'));
    expect(container.textContent).toBe('');

    await flush();

    expect(container.textContent).toBe('hello');
  });

  it('renders a promise that resolves to template literals', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.commit(Promise.resolve(html`<strong>hi</strong>`));
    await flush();

    expect(container.querySelectorAll('strong').length).toBe(1);
    expect(container.textContent).toBe('hi');
  });

  it('replaces the previous rendering when a new promise is committed', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.commit(Promise.resolve('first'));
    await flush();
    expect(container.textContent).toBe('first');

    part.commit(Promise.resolve('second'));
    await flush();

    expect(container.textContent).toBe('second');
    expect(rangeNodes(startNode, endNode).length).toBe(1);
  });

  it('clears the rendered nodes when a non promise value follows a promise', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.commit(Promise.resolve('first'));
    await flush();

    part.commit({ a: 1 });
    await flush();

    expect(container.textContent).toBe('');
    expect(rangeNodes(startNode, endNode)).toEqual([]);
  });

  it('partClear removes the rendered nodes without touching the cancel handle', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.partClear();
    expect(container.textContent).toBe('');

    part.commit(Promise.resolve('hello'));
    await flush();
    expect(container.textContent).toBe('hello');

    part.partClear();

    expect(container.textContent).toBe('');
    expect(rangeNodes(startNode, endNode)).toEqual([]);
  });

  it('destroy clears a template literals rendering', async () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    part.commit(Promise.resolve(html`<strong>hi</strong>`));
    await flush();
    expect(container.querySelectorAll('strong').length).toBe(1);

    part.destroy();

    expect(container.querySelectorAll('strong').length).toBe(0);
    expect(rangeNodes(startNode, endNode)).toEqual([]);
  });

  it('destroy is safe before anything was committed', () => {
    const { container, startNode, endNode } = createHost();
    const part = new ObjectPart(startNode, endNode);

    expect(() => part.destroy()).not.toThrow();
    expect(container.textContent).toBe('');
  });
});
