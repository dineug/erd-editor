import { describe, expect, it, vi } from 'vitest';

import { DIRECTIVE } from '@/constants';
import {
  createDirectiveTuple,
  DirectiveCreator,
  DirectiveType,
} from '@/render/directives';

type Props = { node: HTMLElement };
type Fn = (value: string) => string;

const createCreator = (): DirectiveCreator<Props, Fn> => () => () => {};

describe('DirectiveType', () => {
  it('maps each member to its own string tag', () => {
    expect(DirectiveType.node).toBe('node');
    expect(DirectiveType.attribute).toBe('attribute');
  });
});

describe('createDirectiveTuple', () => {
  it('stamps the DIRECTIVE symbol with the given type', () => {
    const creator = createCreator();
    const tuple = createDirectiveTuple<Props, Fn, typeof creator>(
      DirectiveType.node,
      ['hello', creator]
    );

    expect(Reflect.get(tuple, DIRECTIVE)).toBe(DirectiveType.node);
  });

  it('stamps the attribute type just as well', () => {
    const creator = createCreator();
    const tuple = createDirectiveTuple<Props, Fn, typeof creator>(
      DirectiveType.attribute,
      ['hello', creator]
    );

    expect(Reflect.get(tuple, DIRECTIVE)).toBe(DirectiveType.attribute);
  });

  it('mutates and returns the very array it was handed', () => {
    const creator = createCreator();
    const input: [string, typeof creator] = ['hello', creator];
    const tuple = createDirectiveTuple<Props, Fn, typeof creator>(
      DirectiveType.node,
      input
    );

    expect(tuple).toBe(input as unknown as typeof tuple);
    expect(Reflect.get(input, DIRECTIVE)).toBe(DirectiveType.node);
  });

  it('keeps the value at index 0 and the creator at index 1', () => {
    const creator = createCreator();
    const tuple = createDirectiveTuple<Props, Fn, typeof creator>(
      DirectiveType.node,
      ['hello', creator]
    );

    expect(tuple[0]).toBe('hello');
    expect(tuple[1]).toBe(creator);
    expect(tuple).toHaveLength(2);
  });

  it('keeps the marker off the indexed elements so spreading yields two items', () => {
    const creator = createCreator();
    const tuple = createDirectiveTuple<Props, Fn, typeof creator>(
      DirectiveType.node,
      ['hello', creator]
    );

    expect([...tuple]).toEqual(['hello', creator]);
    expect(Object.keys(tuple)).toEqual(['0', '1']);
  });

  it('produces a creator that is still callable through the tuple', () => {
    const directive = vi.fn(() => {});
    const creator = vi.fn(() => directive) as unknown as DirectiveCreator<
      Props,
      Fn
    >;
    const node = document.createElement('div');
    const tuple = createDirectiveTuple<Props, Fn, typeof creator>(
      DirectiveType.attribute,
      ['hello', creator]
    );

    tuple[1]({ node })('hello');

    expect(creator).toHaveBeenCalledWith({ node });
    expect(directive).toHaveBeenCalledWith('hello');
  });
});
