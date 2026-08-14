import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDirectiveTuple,
  DirectiveCreator,
  DirectiveType,
} from '@/render/directives';
import { NodeDirectiveProps } from '@/render/directives/nodeDirective';
import { DirectivePart } from '@/render/part/node/text/directive';

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
    part: new DirectivePart(startNode, endNode),
  };
}

type Creator = DirectiveCreator<NodeDirectiveProps, (value: any) => any>;

const tuple = (value: any, creator: Creator) =>
  createDirectiveTuple<NodeDirectiveProps, (value: any) => any, Creator>(
    DirectiveType.node,
    [value, creator]
  );

const appendText = (endNode: Comment, value: string) => {
  const parent = endNode.parentNode;
  parent?.insertBefore(document.createTextNode(value), endNode);
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('DirectivePart', () => {
  it('ignores values that are not node directive tuples', () => {
    const { container, startNode, endNode, part } = setup();
    const creator = vi.fn(() => vi.fn());

    part.commit('text');
    part.commit(null);
    part.commit(['plain', creator]);
    part.commit(
      createDirectiveTuple<NodeDirectiveProps, (value: any) => any, Creator>(
        DirectiveType.attribute,
        ['x', creator as unknown as Creator]
      )
    );

    expect(creator).not.toHaveBeenCalled();
    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('creates the directive once with the boundary nodes and runs it with the value', () => {
    const { container, startNode, endNode, part } = setup();
    const directive = vi.fn((value: string) => appendText(endNode, value));
    const creator = vi.fn(() => directive) as unknown as Creator;

    part.commit(tuple('a', creator));

    expect(creator).toHaveBeenCalledTimes(1);
    expect(creator).toHaveBeenCalledWith({ startNode, endNode });
    expect(directive).toHaveBeenCalledWith('a');
    expect(container.textContent).toBe('a');
  });

  it('keeps the previous output when the directive returns no destroy function', () => {
    const { container, part, endNode } = setup();
    const directive = vi.fn((value: string) => appendText(endNode, value));
    const creator = vi.fn(() => directive) as unknown as Creator;

    part.commit(tuple('a', creator));
    part.commit(tuple('b', creator));

    expect(creator).toHaveBeenCalledTimes(1);
    expect(directive).toHaveBeenNthCalledWith(2, 'b');
    expect(container.textContent).toBe('ab');
  });

  it('keeps the previous output when the destroy function identity is stable', () => {
    const { container, part, endNode } = setup();
    const destroy = vi.fn();
    const creator = vi.fn(() => (value: string) => {
      appendText(endNode, value);
      return destroy;
    }) as unknown as Creator;

    part.commit(tuple('a', creator));
    part.commit(tuple('b', creator));

    expect(destroy).not.toHaveBeenCalled();
    expect(container.textContent).toBe('ab');
  });

  it('clears everything in range when the directive returns a new destroy function', () => {
    const { container, startNode, endNode, part } = setup();
    const destroyed: string[] = [];
    const creator = vi.fn(() => (value: string) => {
      appendText(endNode, value);
      return () => destroyed.push(value);
    }) as unknown as Creator;

    part.commit(tuple('a', creator));
    expect(container.textContent).toBe('a');

    part.commit(tuple('b', creator));

    expect(destroyed).toEqual(['a']);
    expect(container.textContent).toBe('');
    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('clears the previous directive when the creator changes', () => {
    const { container, part, endNode } = setup();
    const destroyA = vi.fn();
    const creatorA = vi.fn(() => (value: string) => {
      appendText(endNode, `A:${value}`);
      return destroyA;
    }) as unknown as Creator;
    const creatorB = vi.fn(() => (value: string) => {
      appendText(endNode, `B:${value}`);
    }) as unknown as Creator;

    part.commit(tuple('1', creatorA));
    expect(container.textContent).toBe('A:1');

    part.commit(tuple('2', creatorB));

    expect(destroyA).toHaveBeenCalledTimes(1);
    expect(creatorB).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('B:2');
  });

  it('survives a creator that returns no directive', () => {
    const { container, startNode, endNode, part } = setup();
    const creator = vi.fn(() => undefined) as unknown as Creator;

    expect(() => {
      part.commit(tuple('a', creator));
      part.commit(tuple('b', creator));
    }).not.toThrow();

    expect(creator).toHaveBeenCalledTimes(1);
    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('destroy runs the last destroy function and empties the range', () => {
    const { container, startNode, endNode, part } = setup();
    const destroy = vi.fn();
    const creator = vi.fn(() => (value: string) => {
      appendText(endNode, value);
      return destroy;
    }) as unknown as Creator;

    part.commit(tuple('a', creator));
    part.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(Array.from(container.childNodes)).toEqual([startNode, endNode]);
  });

  it('destroy without any commit does not throw', () => {
    const { part } = setup();

    expect(() => part.destroy()).not.toThrow();
  });
});
