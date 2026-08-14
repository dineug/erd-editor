import { afterEach, describe, expect, it } from 'vitest';

import { PrimitivePart } from '@/render/part/node/text/primitive';

function setup() {
  const container = document.createElement('div');
  const startNode = document.createComment('start');
  const endNode = document.createComment('end');
  container.append(startNode, endNode);
  document.body.append(container);

  const part = new PrimitivePart(startNode, endNode);
  const textNode = startNode.nextSibling as Text;

  return { container, startNode, endNode, part, textNode };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('PrimitivePart', () => {
  it('inserts an empty text node right after the start node', () => {
    const { container, startNode, endNode, textNode } = setup();

    expect(textNode).toBeInstanceOf(Text);
    expect(textNode.data).toBe('');
    expect(Array.from(container.childNodes)).toEqual([
      startNode,
      textNode,
      endNode,
    ]);
  });

  it('writes the stringified primitive into the text node', () => {
    const { part, textNode } = setup();

    part.commit('a');
    expect(textNode.data).toBe('a');

    part.commit(1);
    expect(textNode.data).toBe('1');

    part.commit(false);
    expect(textNode.data).toBe('false');

    part.commit(10n);
    expect(textNode.data).toBe('10');

    part.commit(Symbol('s'));
    expect(textNode.data).toBe('Symbol(s)');
  });

  it('renders an empty string for null and undefined', () => {
    const { part, textNode } = setup();

    part.commit('value');
    expect(textNode.data).toBe('value');

    part.commit(undefined);
    expect(textNode.data).toBe('');

    part.commit('value');
    part.commit(null);
    expect(textNode.data).toBe('');
  });

  it('stringifies non primitive values as well', () => {
    const { part, textNode } = setup();

    part.commit({ toString: () => 'object!' });
    expect(textNode.data).toBe('object!');

    part.commit(['a', 'b']);
    expect(textNode.data).toBe('a,b');
  });

  it('ignores the very first null commit because the initial value is null', () => {
    const { part, textNode } = setup();

    textNode.data = 'untouched';
    part.commit(null);

    expect(textNode.data).toBe('untouched');
  });

  it('skips the write when the value is unchanged', () => {
    const { part, textNode } = setup();

    part.commit('same');
    expect(textNode.data).toBe('same');

    textNode.data = 'externally changed';
    part.commit('same');
    expect(textNode.data).toBe('externally changed');

    part.commit('other');
    expect(textNode.data).toBe('other');
  });

  it('appends the text node when the start node is the last child', () => {
    const container = document.createElement('div');
    const startNode = document.createComment('start');
    const endNode = document.createComment('end');
    container.append(startNode);
    document.body.append(container);

    const part = new PrimitivePart(startNode, endNode);
    part.commit('tail');

    expect(container.textContent).toBe('tail');
    expect(startNode.nextSibling).toBeInstanceOf(Text);
  });

  it('still commits when the start node is detached from the document', () => {
    const startNode = document.createComment('start');
    const endNode = document.createComment('end');

    const part = new PrimitivePart(startNode, endNode);

    expect(startNode.nextSibling).toBeNull();
    expect(() => part.commit('detached')).not.toThrow();
  });
});
