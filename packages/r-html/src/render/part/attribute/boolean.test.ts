import { describe, expect, it, vi } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { BooleanPart } from '@/render/part/attribute/boolean';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string, value?: string): TAttr => ({
  type: TAttrType.boolean,
  name,
  value,
});

describe('BooleanPart', () => {
  it('sets an empty attribute for a truthy value', () => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled', m0));

    part.commit([true]);

    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.getAttribute('disabled')).toBe('');
  });

  it('removes the attribute for a falsy value', () => {
    const el = document.createElement('input');
    el.setAttribute('disabled', '');
    const part = new BooleanPart(el, attr('disabled', m0));

    part.commit([false]);

    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('treats the string "false" as falsy', () => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled', m0));

    part.commit([true]);
    part.commit(['false']);

    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('treats a non-empty string as truthy', () => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled', m0));

    part.commit(['yes']);

    expect(el.hasAttribute('disabled')).toBe(true);
  });

  it.each([
    ['zero', 0, false],
    ['empty string', '', false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['object', {}, true],
    ['one', 1, true],
  ])('resolves %s to %s', (_label, value, expected) => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled', m0));

    part.commit([value]);

    expect(el.hasAttribute('disabled')).toBe(expected);
  });

  it('uses the last marker when the value holds several', () => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled', `${m0}${m1}`));

    part.commit([true, false]);

    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('skips the DOM write when the values did not change', () => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled', m0));
    const setSpy = vi.spyOn(el, 'setAttribute');
    const removeSpy = vi.spyOn(el, 'removeAttribute');

    part.commit([true]);
    part.commit([true]);

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the attribute holds no marker', () => {
    const el = document.createElement('input');
    const part = new BooleanPart(el, attr('disabled'));
    const setSpy = vi.spyOn(el, 'setAttribute');
    const removeSpy = vi.spyOn(el, 'removeAttribute');

    part.commit([true]);

    expect(setSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
