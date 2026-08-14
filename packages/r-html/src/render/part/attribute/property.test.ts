import { describe, expect, it } from 'vitest';

import { TAttrType } from '@/constants';
import { PropertyPart } from '@/render/part/attribute/property';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string, value?: string): TAttr => ({
  type: TAttrType.property,
  name,
  value,
});

describe('PropertyPart', () => {
  it('assigns the committed value as a property of the node', () => {
    const el = document.createElement('input');
    const part = new PropertyPart(el, attr('value', m0));

    part.commit(['hello']);

    expect(el.value).toBe('hello');
  });

  it('assigns non-primitive values by reference', () => {
    const el = document.createElement('div');
    const part = new PropertyPart(el, attr('payload', m0));
    const payload = { a: 1 };

    part.commit([payload]);

    expect(Reflect.get(el, 'payload')).toBe(payload);
  });

  it('uses the last marker when the value holds several', () => {
    const el = document.createElement('div');
    const part = new PropertyPart(el, attr('payload', `${m0}${m1}`));

    part.commit(['a', 'b']);

    expect(Reflect.get(el, 'payload')).toBe('b');
  });

  it('reads the value from the marker index', () => {
    const el = document.createElement('div');
    const part = new PropertyPart(el, attr('payload', m1));

    part.commit(['a', 'b']);

    expect(Reflect.get(el, 'payload')).toBe('b');
  });

  it('skips the assignment when the values did not change', () => {
    const el = document.createElement('div');
    let count = 0;
    Object.defineProperty(el, 'payload', {
      configurable: true,
      get: () => 'stored',
      set: () => {
        count++;
      },
    });
    const part = new PropertyPart(el, attr('payload', m0));

    part.commit(['a']);
    part.commit(['a']);

    expect(count).toBe(1);
  });

  it('re-assigns when the value changes', () => {
    const el = document.createElement('div');
    const part = new PropertyPart(el, attr('payload', m0));

    part.commit(['a']);
    part.commit(['b']);

    expect(Reflect.get(el, 'payload')).toBe('b');
  });

  it('does nothing when the attribute holds no marker', () => {
    const el = document.createElement('div');
    const part = new PropertyPart(el, attr('payload'));

    part.commit(['a']);

    expect(Reflect.get(el, 'payload')).toBeUndefined();
  });
});
