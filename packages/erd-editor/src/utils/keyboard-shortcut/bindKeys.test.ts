import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { bindKeys } from '@/utils/keyboard-shortcut';

const device = vi.hoisted(() => ({ apple: false, windows: false }));

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => device.apple,
  hasWindows: () => device.windows,
}));

/** A keydown holding exactly the modifiers named, whatever the DOM reports. */
const keydown = (key: string, code: string, held: string[] = []) => {
  const event = new KeyboardEvent('keydown', { key, code, cancelable: true });
  Object.defineProperty(event, 'getModifierState', {
    value: (mod: string) => held.includes(mod),
  });
  return event;
};

let target: HTMLDivElement;
let unbind: () => void;
let calls: string[];

const bind = (...shortcuts: string[]) => {
  unbind = bindKeys(
    target,
    Object.fromEntries(
      shortcuts.map(shortcut => [shortcut, () => calls.push(shortcut)])
    )
  );
};

const press = (key: string, code: string, held: string[] = []) => {
  const event = keydown(key, code, held);
  target.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  device.apple = false;
  device.windows = false;
  target = document.createElement('div');
  unbind = () => {};
  calls = [];
});

afterEach(() => {
  unbind();
  vi.useRealTimers();
});

describe('bindKeys', () => {
  it('hands the keydown to the handler of the chord it completes', () => {
    const handler = vi.fn();
    unbind = bindKeys(target, { 'Alt+KeyN': handler, Enter: vi.fn() });

    const event = press('n', 'KeyN', ['Alt']);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('calls nothing for a press no chord names', () => {
    bind('Alt+KeyN', 'Enter');

    press('n', 'KeyN');
    press('Enter', 'Enter', ['Shift']);

    expect(calls).toEqual([]);
  });

  it('calls every chord a press completes, in the order they were given', () => {
    bind('KeyA', 'a', 'Alt+KeyA');

    press('a', 'KeyA');

    expect(calls).toEqual(['KeyA', 'a']);
  });

  it('ignores a keydown that is no KeyboardEvent, as Chrome autofill sends', () => {
    bind('Enter');

    target.dispatchEvent(new Event('keydown'));

    expect(calls).toEqual([]);
  });

  it('reads $mod as Control off an apple device and Meta on one', () => {
    bind('$mod+KeyK');
    press('k', 'KeyK', ['Meta']);
    expect(calls).toEqual([]);
    press('k', 'KeyK', ['Control']);
    expect(calls).toEqual(['$mod+KeyK']);
    unbind();

    device.apple = true;
    calls = [];
    bind('$mod+KeyK');
    press('k', 'KeyK', ['Control']);
    expect(calls).toEqual([]);
    press('k', 'KeyK', ['Meta']);
    expect(calls).toEqual(['$mod+KeyK']);
  });

  it('reads AltGraph on windows as the Control and Alt of $mod+Alt', () => {
    device.windows = true;
    bind('$mod+Alt+Digit1', 'Digit1');

    press('¡', 'Digit1', ['AltGraph']);

    expect(calls).toEqual(['$mod+Alt+Digit1']);
  });

  it('fires a sequence on its last press alone', () => {
    bind('KeyG KeyH');

    press('g', 'KeyG');
    expect(calls).toEqual([]);

    press('h', 'KeyH');
    expect(calls).toEqual(['KeyG KeyH']);

    press('h', 'KeyH');
    expect(calls).toEqual(['KeyG KeyH']);
  });

  it('sends a sequence back to its first press on any other key', () => {
    bind('KeyG KeyH');

    press('g', 'KeyG');
    press('x', 'KeyX');
    press('h', 'KeyH');
    expect(calls).toEqual([]);

    press('g', 'KeyG');
    press('h', 'KeyH');
    expect(calls).toEqual(['KeyG KeyH']);
  });

  it('starts no sequence on the press that sends one back, its first press included', () => {
    bind('KeyG KeyH');

    press('g', 'KeyG');
    press('g', 'KeyG');
    press('h', 'KeyH');
    expect(calls).toEqual([]);

    press('g', 'KeyG');
    press('h', 'KeyH');
    expect(calls).toEqual(['KeyG KeyH']);
  });

  it('keeps a sequence going through the keydown of a modifier it then holds', () => {
    bind('KeyG Shift+KeyH');

    press('g', 'KeyG');
    press('Shift', 'ShiftLeft', ['Shift']);
    press('H', 'KeyH', ['Shift']);

    expect(calls).toEqual(['KeyG Shift+KeyH']);
  });

  it('keeps a sequence going through an AltGraph or CapsLock keydown that holds it', () => {
    device.windows = true;
    bind('KeyG KeyH');

    press('g', 'KeyG');
    press('AltGraph', 'AltRight', ['AltGraph']);
    press('h', 'KeyH');
    expect(calls).toEqual(['KeyG KeyH']);

    press('g', 'KeyG');
    press('CapsLock', 'CapsLock', ['CapsLock']);
    press('H', 'KeyH', ['CapsLock']);
    expect(calls).toEqual(['KeyG KeyH', 'KeyG KeyH']);
  });

  it('fires a chord whose key is a modifier on that key alone', () => {
    bind('Shift', 'KeyG Shift');

    press('g', 'KeyG');
    press('Shift', 'ShiftLeft', ['Shift']);

    expect(calls).toEqual(['Shift', 'KeyG Shift']);
  });

  it('drops a sequence a second after the last keydown, any keydown', () => {
    vi.useFakeTimers();
    bind('KeyG KeyH', 'KeyA KeyB');

    press('g', 'KeyG');
    vi.advanceTimersByTime(600);
    press('a', 'KeyA');
    vi.advanceTimersByTime(600);
    press('h', 'KeyH');
    expect(calls).toEqual([]);

    press('a', 'KeyA');
    vi.advanceTimersByTime(999);
    press('b', 'KeyB');
    expect(calls).toEqual(['KeyA KeyB']);

    press('g', 'KeyG');
    vi.advanceTimersByTime(1000);
    press('h', 'KeyH');
    expect(calls).toEqual(['KeyA KeyB']);
  });

  it('times a sequence from the keydown of a modifier too', () => {
    vi.useFakeTimers();
    bind('KeyG Shift+KeyH');

    press('g', 'KeyG');
    vi.advanceTimersByTime(600);
    press('Shift', 'ShiftLeft', ['Shift']);
    vi.advanceTimersByTime(600);
    press('H', 'KeyH', ['Shift']);

    expect(calls).toEqual(['KeyG Shift+KeyH']);
  });

  it('stops listening and leaves no timer once unbound', () => {
    vi.useFakeTimers();
    bind('KeyG KeyH', 'Enter');

    press('g', 'KeyG');
    expect(vi.getTimerCount()).toBe(1);

    unbind();
    expect(vi.getTimerCount()).toBe(0);

    press('h', 'KeyH');
    press('Enter', 'Enter');
    expect(calls).toEqual([]);
  });

  it('keeps its own sequences apart from another binding on the same target', () => {
    bind('KeyG KeyH');
    const other = vi.fn();
    const unbindOther = bindKeys(target, { 'KeyH KeyG': other });

    press('g', 'KeyG');
    press('h', 'KeyH');
    press('g', 'KeyG');

    expect(calls).toEqual(['KeyG KeyH']);
    expect(other).toHaveBeenCalledTimes(1);
    unbindOther();
  });
});
