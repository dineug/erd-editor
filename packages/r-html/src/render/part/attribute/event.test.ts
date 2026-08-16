import { describe, expect, it, vi } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { EventPart } from '@/render/part/attribute/event';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string, value?: string): TAttr => ({
  type: TAttrType.event,
  name,
  value,
});

describe('EventPart', () => {
  it('binds a function handler to the event name', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const handle = vi.fn();

    part.commit([handle]);
    el.dispatchEvent(new Event('click'));

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('binds a tuple handler together with its listener options', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const handle = vi.fn();

    part.commit([[handle, { once: true }]]);
    el.dispatchEvent(new Event('click'));
    el.dispatchEvent(new Event('click'));

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('binds a tuple handler without options', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const handle = vi.fn();

    part.commit([[handle]]);
    el.dispatchEvent(new Event('click'));

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('binds every valid handler when the value holds several markers', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', `${m0}${m1}`));
    const a = vi.fn();
    const b = vi.fn();

    part.commit([a, b]);
    el.dispatchEvent(new Event('click'));

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('filters out values that are neither a function nor an event tuple', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', `${m0}${m1}`));
    const handle = vi.fn();
    const addSpy = vi.spyOn(el, 'addEventListener');

    part.commit(['nope', handle]);
    el.dispatchEvent(new Event('click'));

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('rejects arrays whose second entry is not a valid listener option', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const handle = vi.fn();
    const addSpy = vi.spyOn(el, 'addEventListener');

    part.commit([[handle, 'nope']]);

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('unbinds the previous handler when a new one is committed', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const first = vi.fn();
    const second = vi.fn();

    part.commit([first]);
    part.commit([second]);
    el.dispatchEvent(new Event('click'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unbinds a previous tuple handler', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const first = vi.fn();
    const second = vi.fn();

    part.commit([[first, { capture: false }]]);
    part.commit([second]);
    el.dispatchEvent(new Event('click'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('skips rebinding when the values did not change', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const handle = vi.fn();
    const addSpy = vi.spyOn(el, 'addEventListener');
    const removeSpy = vi.spyOn(el, 'removeEventListener');

    part.commit([handle]);
    part.commit([handle]);

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('unbinds everything on destroy', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click', m0));
    const handle = vi.fn();

    part.commit([handle]);
    part.destroy();
    el.dispatchEvent(new Event('click'));

    expect(handle).not.toHaveBeenCalled();
  });

  it('does nothing when the attribute holds no marker', () => {
    const el = document.createElement('button');
    const part = new EventPart(el, attr('click'));
    const addSpy = vi.spyOn(el, 'addEventListener');

    part.commit([vi.fn()]);

    expect(addSpy).not.toHaveBeenCalled();
  });
});
