import { describe, expect, it, vi } from 'vitest';

import {
  isMouseEvent,
  isTouchEvent,
  onNumberOnly,
  onPrevent,
  onStop,
  onStopImmediate,
} from '@/utils/domEvent';

describe('onNumberOnly', () => {
  it('strips every non digit character from the input value', () => {
    const input = document.createElement('input');
    input.value = 'a1b2-3.4';

    onNumberOnly({ target: input } as unknown as InputEvent);

    expect(input.value).toBe('1234');
  });

  it('leaves an all digit value untouched', () => {
    const input = document.createElement('input');
    input.value = '007';

    onNumberOnly({ target: input } as unknown as InputEvent);

    expect(input.value).toBe('007');
  });

  it('does nothing when the event has no target', () => {
    expect(() =>
      onNumberOnly({ target: null } as unknown as InputEvent)
    ).not.toThrow();
  });
});

describe('onPrevent', () => {
  it('prevents the default action of a cancelable event', () => {
    const event = new Event('click', { cancelable: true });

    onPrevent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('calls preventDefault on the given event object', () => {
    const preventDefault = vi.fn();

    onPrevent({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

describe('onStop', () => {
  it('stops the event from reaching an ancestor listener', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.append(child);
    document.body.append(parent);
    const onParent = vi.fn();

    parent.addEventListener('click', onParent);
    child.addEventListener('click', onStop);
    child.dispatchEvent(new Event('click', { bubbles: true }));

    expect(onParent).not.toHaveBeenCalled();
    parent.remove();
  });
});

describe('onStopImmediate', () => {
  it('stops the remaining listeners on the same target', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const next = vi.fn();

    el.addEventListener('click', onStopImmediate);
    el.addEventListener('click', next);
    el.dispatchEvent(new Event('click'));

    expect(next).not.toHaveBeenCalled();
    el.remove();
  });
});

describe('isMouseEvent', () => {
  it('is true for a MouseEvent', () => {
    expect(isMouseEvent(new MouseEvent('mousedown'))).toBe(true);
  });

  it('is false for a plain event and for a TouchEvent', () => {
    expect(isMouseEvent(new Event('mousedown'))).toBe(false);
    expect(isMouseEvent(new TouchEvent('touchstart'))).toBe(false);
  });
});

describe('isTouchEvent', () => {
  it('is true for a TouchEvent', () => {
    expect(isTouchEvent(new TouchEvent('touchstart'))).toBe(true);
  });

  it('is false for a MouseEvent', () => {
    expect(isTouchEvent(new MouseEvent('mousedown'))).toBe(false);
  });
});
