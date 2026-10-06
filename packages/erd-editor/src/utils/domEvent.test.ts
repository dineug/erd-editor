import { describe, expect, it, vi } from 'vite-plus/test';

import {
  editorRootOf,
  isMainButtonPress,
  isMiddleButtonPress,
  isMouseEvent,
  isSecondaryButtonPress,
  isTouchEvent,
  isTouchPress,
  onNumberOnly,
  onPrevent,
  onStop,
  onStopImmediate,
  preventMiddleLift,
  suppressSelection,
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

describe('isSecondaryButtonPress', () => {
  it('is true for the secondary mouse button alone', () => {
    expect(
      isSecondaryButtonPress(new MouseEvent('mousedown', { button: 2 }))
    ).toBe(true);
    expect(
      isSecondaryButtonPress(new MouseEvent('mousedown', { button: 0 }))
    ).toBe(false);
    expect(
      isSecondaryButtonPress(new MouseEvent('mousedown', { button: 1 }))
    ).toBe(false);
  });

  it('is false for a macOS Ctrl+click and for a touch', () => {
    expect(
      isSecondaryButtonPress(
        new MouseEvent('mousedown', { button: 0, ctrlKey: true })
      )
    ).toBe(false);
    expect(isSecondaryButtonPress(new TouchEvent('touchstart'))).toBe(false);
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

describe('isTouchPress', () => {
  it('reads a touch by its type, whatever constructed it', () => {
    expect(isTouchPress(new Event('touchstart'))).toBe(true);
    expect(isTouchPress(new MouseEvent('mousedown'))).toBe(false);
  });
});

/** A press of one mouse button, built and not dispatched. */
const pressOf = (button: number) => new MouseEvent('mousedown', { button });

describe('isMainButtonPress', () => {
  it('is true for the main mouse button and for a touch', () => {
    expect(isMainButtonPress(pressOf(0))).toBe(true);
    expect(isMainButtonPress(new TouchEvent('touchstart'))).toBe(true);
  });

  it('is false for the middle and the right button', () => {
    expect(isMainButtonPress(pressOf(1))).toBe(false);
    expect(isMainButtonPress(pressOf(2))).toBe(false);
  });
});

describe('isMiddleButtonPress', () => {
  it('is true for the middle mouse button alone', () => {
    expect(isMiddleButtonPress(pressOf(1))).toBe(true);
    expect(isMiddleButtonPress(pressOf(0))).toBe(false);
    expect(isMiddleButtonPress(pressOf(2))).toBe(false);
  });

  it('is false for a touch, which has no button', () => {
    expect(isMiddleButtonPress(new TouchEvent('touchstart'))).toBe(false);
  });
});

/** A lift of one button, dispatched on an element so it reaches the window. */
const liftOf = (button: number) => {
  const lift = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    button,
  });
  document.body.dispatchEvent(lift);
  return lift;
};

describe('preventMiddleLift', () => {
  it('prevents the next middle lift alone, passing over the lift of another button', () => {
    const release = preventMiddleLift();

    try {
      expect(liftOf(0).defaultPrevented).toBe(false);
      expect(liftOf(1).defaultPrevented).toBe(true);
      expect(liftOf(1).defaultPrevented).toBe(false);
    } finally {
      release();
    }
  });

  it('prevents nothing once released before the lift', () => {
    preventMiddleLift()();

    expect(liftOf(1).defaultPrevented).toBe(false);
  });

  it('prevents the lift ahead of a listener that ends the gesture on the window', () => {
    const release = preventMiddleLift();
    const end = vi.fn(release);
    window.addEventListener('mouseup', end, { once: true });

    const lift = liftOf(1);

    expect(end).toHaveBeenCalledOnce();
    expect(lift.defaultPrevented).toBe(true);
  });
});

describe('suppressSelection', () => {
  it('takes selection off the element until the undo is called', () => {
    const el = document.createElement('div');

    const restore = suppressSelection(el);
    expect(el.style.userSelect).toBe('none');

    restore();
    expect(el.style.userSelect).toBe('');
  });

  it('puts back whatever the element declared inline before', () => {
    const el = document.createElement('div');
    el.style.userSelect = 'text';

    suppressSelection(el)();

    expect(el.style.userSelect).toBe('text');
  });
});

describe('editorRootOf', () => {
  it('is the nearest editor root above the element', () => {
    const root = document.createElement('div');
    root.className = 'root';
    const scene = document.createElement('div');
    const inner = document.createElement('div');
    root.append(scene);
    scene.append(inner);

    expect(editorRootOf(inner)).toBe(root);
    expect(editorRootOf(root)).toBe(root);
  });

  it('is the element itself where no root holds it', () => {
    const el = document.createElement('div');

    expect(editorRootOf(el)).toBe(el);
  });
});
