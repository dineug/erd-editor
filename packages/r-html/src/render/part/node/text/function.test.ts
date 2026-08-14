import { afterEach, describe, expect, it, vi } from 'vitest';

import { FunctionPart } from '@/render/part/node/text/function';

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
    part: new FunctionPart(startNode, endNode),
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('FunctionPart', () => {
  it('does not touch the dom while being constructed', () => {
    const { container, startNode, endNode } = setup();

    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('never calls the committed function and renders nothing', () => {
    const { container, part } = setup();
    const spy = vi.fn(() => 'value');

    expect(part.commit(spy)).toBeUndefined();

    expect(spy).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
    expect(container.childNodes).toHaveLength(2);
  });

  it('accepts any value without throwing', () => {
    const { part } = setup();

    expect(() => {
      part.commit(undefined);
      part.commit(null);
      part.commit(0);
      part.commit({});
    }).not.toThrow();
  });

  it('exposes no destroy hook', () => {
    const { part } = setup();

    expect((part as { destroy?: () => void }).destroy).toBeUndefined();
  });
});
