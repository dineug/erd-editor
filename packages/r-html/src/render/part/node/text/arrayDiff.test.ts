import { afterEach, describe, expect, it } from 'vite-plus/test';

import { ItemPart } from '@/render/part/node/text/array';
import {
  Action,
  difference,
  type DiffValue,
  partsToDiffItems,
  valuesToDiffItems,
} from '@/render/part/node/text/arrayDiff';
import { PartType } from '@/render/part/node/text/helper';
import { html } from '@/template/html';

const containers: HTMLElement[] = [];

function createItemParts(values: any[]) {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);

  return values.map(value => {
    const node = document.createComment('');
    container.append(node);
    return new ItemPart(node, value);
  });
}

afterEach(() => {
  let container = containers.pop();
  while (container) {
    container.remove();
    container = containers.pop();
  }
});

const keys = ({ items }: DiffValue) => items.map(item => item.key);
const types = ({ items }: DiffValue) => items.map(item => item.type);

describe('render/part/node/text/arrayDiff partsToDiffItems', () => {
  it('returns an empty diff value for an empty part list', () => {
    const diffValue = partsToDiffItems([]);

    expect(diffValue.items).toEqual([]);
    expect(diffValue.itemToIndex.size).toBe(0);
  });

  it('uses the raw value as the key for non template literal parts', () => {
    const parts = createItemParts(['a', 1, null]);

    const diffValue = partsToDiffItems(parts);

    expect(keys(diffValue)).toEqual(['a', 1, null]);
    expect(types(diffValue)).toEqual([
      PartType.primitive,
      PartType.primitive,
      PartType.primitive,
    ]);
    expect(
      diffValue.items.map(item => diffValue.itemToIndex.get(item))
    ).toEqual([0, 1, 2]);
  });

  it('uses the strings array as the key for template literal parts', () => {
    const a = html`<div>${1}</div>`;
    const parts = createItemParts([a]);

    const diffValue = partsToDiffItems(parts);

    expect(types(diffValue)).toEqual([PartType.templateLiterals]);
    expect(keys(diffValue)).toEqual([a.strings]);
  });
});

describe('render/part/node/text/arrayDiff valuesToDiffItems', () => {
  it('derives the part type from each value', () => {
    const el = document.createElement('span');
    const fn = () => {};
    const obj = {};
    const arr = [1];

    const diffValue = valuesToDiffItems(['a', el, fn, obj, arr]);

    expect(types(diffValue)).toEqual([
      PartType.primitive,
      PartType.node,
      PartType.function,
      PartType.object,
      PartType.array,
    ]);
    expect(keys(diffValue)).toEqual(['a', el, fn, obj, arr]);
  });

  it('keys template literals by their strings array', () => {
    const a = html`<div>${1}</div>`;
    const b = html`<div>${2}</div>`;

    const diffValue = valuesToDiffItems([a, b]);

    expect(keys(diffValue)[0]).toBe(a.strings);
    expect(keys(diffValue)[1]).toBe(b.strings);
  });

  it('maps every item to its index even when values repeat', () => {
    const diffValue = valuesToDiffItems(['a', 'a']);

    expect(diffValue.items.length).toBe(2);
    expect(diffValue.items[0]).not.toBe(diffValue.items[1]);
    expect(diffValue.itemToIndex.get(diffValue.items[0])).toBe(0);
    expect(diffValue.itemToIndex.get(diffValue.items[1])).toBe(1);
  });
});

const diffValues = (oldValues: any[], newValues: any[], strict?: boolean) =>
  difference(
    valuesToDiffItems(oldValues),
    valuesToDiffItems(newValues),
    strict === undefined ? undefined : { strict }
  );

describe('render/part/node/text/arrayDiff difference', () => {
  it('reports identity moves when nothing changed', () => {
    const diff = diffValues(['a', 'b'], ['a', 'b']);

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 0, to: 0 },
        { action: Action.move, from: 1, to: 1 },
      ],
      delete: [],
    });
  });

  it('reports moves sorted by the target index when reordered', () => {
    const diff = diffValues(['a', 'b'], ['b', 'a']);

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 1, to: 0 },
        { action: Action.move, from: 0, to: 1 },
      ],
      delete: [],
    });
  });

  it('creates entries for values that have no old counterpart', () => {
    const diff = diffValues([], ['a']);

    expect(diff).toEqual({
      update: [{ action: Action.create, from: -1, to: 0 }],
      delete: [],
    });
  });

  it('appends creates after the reused moves', () => {
    const diff = diffValues(['a'], ['a', 'b']);

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 0, to: 0 },
        { action: Action.create, from: -1, to: 1 },
      ],
      delete: [],
    });
  });

  it('deletes old items when the new list is empty', () => {
    const diff = diffValues(['a'], []);

    expect(diff).toEqual({ update: [], delete: [{ from: 0 }] });
  });

  it('deletes the surplus old item when the list shrinks', () => {
    const diff = diffValues(['a', 'b'], ['a']);

    expect(diff).toEqual({
      update: [{ action: Action.move, from: 0, to: 0 }],
      delete: [{ from: 1 }],
    });
  });

  it('recycles an old part of the same type for a changed value', () => {
    const diff = diffValues(['a'], ['c']);

    expect(diff).toEqual({
      update: [{ action: Action.move, from: 0, to: 0 }],
      delete: [],
    });
  });

  it('does not recycle across part types', () => {
    const diff = diffValues(['a'], [html`<div></div>`]);

    expect(diff).toEqual({
      update: [{ action: Action.create, from: -1, to: 0 }],
      delete: [{ from: 0 }],
    });
  });

  it('recycles at most one old part per new slot when values repeat', () => {
    const diff = diffValues(['a', 'a'], ['a']);

    expect(diff).toEqual({
      update: [{ action: Action.move, from: 0, to: 0 }],
      delete: [{ from: 1 }],
    });
  });

  it('creates an extra slot when the new list repeats a value', () => {
    const diff = diffValues(['a'], ['a', 'a']);

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 0, to: 0 },
        { action: Action.create, from: -1, to: 1 },
      ],
      delete: [],
    });
  });

  it('recycles a same-type old part into a free trailing slot', () => {
    const diff = diffValues(['a', 'b'], ['b', 'z']);

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 1, to: 0 },
        { action: Action.move, from: 0, to: 1 },
      ],
      delete: [],
    });
  });

  it('reuses template literal parts that share the same strings array', () => {
    const a = (v: number) => html`<div>${v}</div>`;

    const diff = difference(
      valuesToDiffItems([a(1)]),
      valuesToDiffItems([a(2)])
    );

    expect(diff).toEqual({
      update: [{ action: Action.move, from: 0, to: 0 }],
      delete: [],
    });
  });

  it('deletes instead of recycling in strict mode', () => {
    const diff = diffValues(['a'], ['c'], true);

    expect(diff).toEqual({
      update: [{ action: Action.create, from: -1, to: 0 }],
      delete: [{ from: 0 }],
    });
  });

  it('still matches equal values in strict mode', () => {
    const diff = diffValues(['a', 'b'], ['b', 'x'], true);

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 1, to: 0 },
        { action: Action.create, from: -1, to: 1 },
      ],
      delete: [{ from: 0 }],
    });
  });

  it('treats an empty options object as non strict', () => {
    const diff = difference(
      valuesToDiffItems(['a']),
      valuesToDiffItems(['c']),
      {}
    );

    expect(diff).toEqual({
      update: [{ action: Action.move, from: 0, to: 0 }],
      delete: [],
    });
  });

  it('diffs existing parts against new values', () => {
    const parts = createItemParts(['a', 'b']);

    const diff = difference(
      partsToDiffItems(parts),
      valuesToDiffItems(['b', 'a'])
    );

    expect(diff).toEqual({
      update: [
        { action: Action.move, from: 1, to: 0 },
        { action: Action.move, from: 0, to: 1 },
      ],
      delete: [],
    });
  });
});
