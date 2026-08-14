import { describe, expect, it, vi } from 'vitest';

import { TAttrType } from '@/constants';
import {
  createDirectiveTuple,
  DirectiveCreator,
  DirectiveFunction,
  DirectiveType,
} from '@/render/directives';
import { AttributeDirectiveProps } from '@/render/directives/attributeDirective';
import { DirectivePart } from '@/render/part/attribute/directive';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string): TAttr => ({
  type: TAttrType.directive,
  name,
});

type Creator = DirectiveCreator<AttributeDirectiveProps, DirectiveFunction>;

const tuple = (value: any, creator: Creator, type = DirectiveType.attribute) =>
  createDirectiveTuple<AttributeDirectiveProps, DirectiveFunction, Creator>(
    type,
    [value, creator]
  );

describe('DirectivePart', () => {
  it('creates the directive with the node and runs it with the value', () => {
    const el = document.createElement('div');
    const directive = vi.fn();
    const creator: Creator = vi.fn(() => directive);
    const part = new DirectivePart(el, attr(m0));

    part.commit([tuple('value', creator)]);

    expect(creator).toHaveBeenCalledTimes(1);
    expect(creator).toHaveBeenCalledWith({ node: el });
    expect(directive).toHaveBeenCalledWith('value');
  });

  it('reads the value from the marker index encoded in the name', () => {
    const el = document.createElement('div');
    const directive = vi.fn();
    const creator: Creator = vi.fn(() => directive);
    const part = new DirectivePart(el, attr(m1));

    part.commit(['ignored', tuple('value', creator)]);

    expect(directive).toHaveBeenCalledWith('value');
  });

  it('ignores values that are not attribute directive tuples', () => {
    const el = document.createElement('div');
    const directive = vi.fn();
    const creator: Creator = vi.fn(() => directive);
    const part = new DirectivePart(el, attr(m0));

    part.commit(['plain']);
    part.commit([['a', creator]]);
    part.commit([tuple('value', creator, DirectiveType.node)]);

    expect(creator).not.toHaveBeenCalled();
    expect(directive).not.toHaveBeenCalled();
  });

  it('reuses the directive instance while the creator stays the same', () => {
    const el = document.createElement('div');
    const directive = vi.fn();
    const creator: Creator = vi.fn(() => directive);
    const part = new DirectivePart(el, attr(m0));

    part.commit([tuple('a', creator)]);
    part.commit([tuple('b', creator)]);

    expect(creator).toHaveBeenCalledTimes(1);
    expect(directive).toHaveBeenNthCalledWith(1, 'a');
    expect(directive).toHaveBeenNthCalledWith(2, 'b');
  });

  it('destroys the previous directive when the creator changes', () => {
    const el = document.createElement('div');
    const destroyA = vi.fn();
    const creatorA: Creator = vi.fn(() => () => destroyA);
    const directiveB = vi.fn();
    const creatorB: Creator = vi.fn(() => directiveB);
    const part = new DirectivePart(el, attr(m0));

    part.commit([tuple('a', creatorA)]);
    expect(destroyA).not.toHaveBeenCalled();

    part.commit([tuple('b', creatorB)]);

    expect(destroyA).toHaveBeenCalledTimes(1);
    expect(creatorB).toHaveBeenCalledTimes(1);
    expect(directiveB).toHaveBeenCalledWith('b');
  });

  it('runs the previous cleanup when the directive returns a new one', () => {
    const el = document.createElement('div');
    const cleanups: Array<ReturnType<typeof vi.fn>> = [];
    const creator: Creator = () => () => {
      const cleanup = vi.fn();
      cleanups.push(cleanup);
      return cleanup;
    };
    const part = new DirectivePart(el, attr(m0));

    part.commit([tuple('a', creator)]);
    part.commit([tuple('b', creator)]);

    expect(cleanups).toHaveLength(2);
    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(cleanups[1]).not.toHaveBeenCalled();
  });

  it('keeps the cleanup when the directive returns the same one', () => {
    const el = document.createElement('div');
    const cleanup = vi.fn();
    const creator: Creator = () => () => cleanup;
    const part = new DirectivePart(el, attr(m0));

    part.commit([tuple('a', creator)]);
    part.commit([tuple('b', creator)]);

    expect(cleanup).not.toHaveBeenCalled();

    part.destroy();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('tolerates a creator that produces no directive', () => {
    const el = document.createElement('div');
    const creator: Creator = vi.fn(() => undefined as any);
    const part = new DirectivePart(el, attr(m0));

    expect(() => part.commit([tuple('a', creator)])).not.toThrow();
    expect(() => part.commit([tuple('b', creator)])).not.toThrow();
  });

  it('runs the stored cleanup on destroy', () => {
    const el = document.createElement('div');
    const cleanup = vi.fn();
    const creator: Creator = () => () => cleanup;
    const part = new DirectivePart(el, attr(m0));

    part.commit([tuple('a', creator)]);
    part.destroy();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does nothing on destroy when no directive was committed', () => {
    const el = document.createElement('div');
    const part = new DirectivePart(el, attr(m0));

    expect(() => part.destroy()).not.toThrow();
  });
});
