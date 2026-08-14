import { afterEach, describe, expect, it } from 'vitest';

import { NodePart } from '@/render/part/node/text/node';

function setup() {
  const container = document.createElement('div');
  const startNode = document.createComment('start');
  const endNode = document.createComment('end');
  container.append(startNode, endNode);
  document.body.append(container);

  return {
    container,
    startNode,
    endNode,
    part: new NodePart(startNode, endNode),
  };
}

const createSpan = (text: string) => {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('NodePart', () => {
  it('inserts the committed node right before the end node', () => {
    const { container, startNode, endNode, part } = setup();
    const span = createSpan('a');

    part.commit(span);

    expect(Array.from(container.childNodes)).toEqual([
      startNode,
      span,
      endNode,
    ]);
  });

  it('removes the previous node when a new node is committed', () => {
    const { container, startNode, endNode, part } = setup();
    const first = createSpan('first');
    const second = createSpan('second');

    part.commit(first);
    part.commit(second);

    expect(first.parentNode).toBeNull();
    expect(Array.from(container.childNodes)).toEqual([
      startNode,
      second,
      endNode,
    ]);
    expect(container.textContent).toBe('second');
  });

  it('skips the update when the same node is committed twice', () => {
    const { container, part } = setup();
    const span = createSpan('once');

    part.commit(span);
    span.remove();
    part.commit(span);

    expect(span.parentNode).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('ignores the very first null commit because the initial value is null', () => {
    const { container, part } = setup();

    part.commit(null);

    expect(container.childNodes).toHaveLength(2);
  });

  it('supports document fragments and text nodes', () => {
    const { container, part } = setup();
    const fragment = document.createDocumentFragment();
    fragment.append(createSpan('x'), createSpan('y'));

    part.commit(fragment);
    expect(container.textContent).toBe('xy');

    const text = document.createTextNode('z');
    part.commit(text);
    expect(container.textContent).toBe('xyz');
  });

  it('does nothing when the end node has no parent', () => {
    const endNode = document.createComment('end');
    const part = new NodePart(document.createComment('start'), endNode);
    const span = createSpan('detached');

    part.commit(span);

    expect(span.parentNode).toBeNull();
  });

  it('throws when a non node value replaces a previously committed node', () => {
    const { container, part } = setup();
    const span = createSpan('a');

    part.commit(span);
    expect(() => part.commit('not a node')).toThrow();

    expect(span.parentNode).toBeNull();
    expect(container.childNodes).toHaveLength(2);
  });
});
