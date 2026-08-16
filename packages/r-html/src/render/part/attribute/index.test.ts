import { describe, expect, it, vi } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { AttributePart } from '@/render/part/attribute/attribute';
import { BooleanPart } from '@/render/part/attribute/boolean';
import { DirectivePart } from '@/render/part/attribute/directive';
import { EventPart } from '@/render/part/attribute/event';
import { createAttrPart } from '@/render/part/attribute/index';
import { PropertyPart } from '@/render/part/attribute/property';
import { SpreadPart } from '@/render/part/attribute/spread';
import { createMarker } from '@/template/helper';

const m0 = createMarker(0);

describe('createAttrPart', () => {
  it.each([
    [TAttrType.attribute, AttributePart],
    [TAttrType.boolean, BooleanPart],
    [TAttrType.event, EventPart],
    [TAttrType.property, PropertyPart],
    [TAttrType.spread, SpreadPart],
    [TAttrType.directive, DirectivePart],
  ])('creates the part matching the %s attribute type', (type, Ctor) => {
    const el = document.createElement('div');

    const part = createAttrPart(el, { type, name: m0, value: m0 });

    expect(part).toBeInstanceOf(Ctor);
  });

  it('falls back to a directive part for an unknown attribute type', () => {
    const el = document.createElement('div');

    const part = createAttrPart(el, {
      type: 'unknown' as TAttrType,
      name: m0,
      value: m0,
    });

    expect(part).toBeInstanceOf(DirectivePart);
  });

  it('returns a working attribute part', () => {
    const el = document.createElement('div');

    const part = createAttrPart(el, {
      type: TAttrType.attribute,
      name: 'id',
      value: m0,
    });
    part.commit(['foo']);

    expect(el.getAttribute('id')).toBe('foo');
  });

  it('returns a working event part', () => {
    const el = document.createElement('div');
    const handle = vi.fn();

    const part = createAttrPart(el, {
      type: TAttrType.event,
      name: 'click',
      value: m0,
    });
    part.commit([handle]);
    el.dispatchEvent(new Event('click'));

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('returns a working spread part', () => {
    const el = document.createElement('div');

    const part = createAttrPart(el, { type: TAttrType.spread, name: m0 });
    part.commit([{ a: 1 }]);

    expect(Reflect.get(el, 'a')).toBe(1);
  });
});
