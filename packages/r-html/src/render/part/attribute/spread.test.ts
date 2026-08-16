import { describe, expect, it } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { SpreadPart } from '@/render/part/attribute/spread';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string): TAttr => ({
  type: TAttrType.spread,
  name,
});

describe('SpreadPart', () => {
  it('assigns every own key of the committed object to the node', () => {
    const el = document.createElement('div');
    const part = new SpreadPart(el, attr(m0));

    part.commit([{ a: 1, b: 'two' }]);

    expect(Reflect.get(el, 'a')).toBe(1);
    expect(Reflect.get(el, 'b')).toBe('two');
  });

  it('reads the value from the marker index encoded in the name', () => {
    const el = document.createElement('div');
    const part = new SpreadPart(el, attr(m1));

    part.commit([{ a: 1 }, { b: 2 }]);

    expect(Reflect.get(el, 'a')).toBeUndefined();
    expect(Reflect.get(el, 'b')).toBe(2);
  });

  it.each([
    ['null', null],
    ['an array', [1, 2]],
    ['a string', 'nope'],
    ['a number', 1],
    ['undefined', undefined],
  ])('ignores %s', (_label, value) => {
    const el = document.createElement('div');
    const part = new SpreadPart(el, attr(m0));
    const before = Object.keys(el).length;

    part.commit([value]);

    expect(Object.keys(el).length).toBe(before);
  });

  it('skips the assignment when the next object is shallow equal', () => {
    const el = document.createElement('div');
    const part = new SpreadPart(el, attr(m0));

    part.commit([{ a: 1 }]);
    Reflect.set(el, 'a', 'touched');
    part.commit([{ a: 1 }]);

    expect(Reflect.get(el, 'a')).toBe('touched');
  });

  it('re-assigns when the object content changes', () => {
    const el = document.createElement('div');
    const part = new SpreadPart(el, attr(m0));

    part.commit([{ a: 1 }]);
    part.commit([{ a: 2 }]);

    expect(Reflect.get(el, 'a')).toBe(2);
  });

  it('keeps keys that disappear from the next object', () => {
    const el = document.createElement('div');
    const part = new SpreadPart(el, attr(m0));

    part.commit([{ a: 1, b: 2 }]);
    part.commit([{ a: 1 }]);

    expect(Reflect.get(el, 'a')).toBe(1);
    expect(Reflect.get(el, 'b')).toBe(2);
  });

  it('assigns onto a plain object node as well', () => {
    const node: Record<string, any> = {};
    const part = new SpreadPart(node, attr(m0));

    part.commit([{ a: 1 }]);

    expect(node.a).toBe(1);
  });
});
