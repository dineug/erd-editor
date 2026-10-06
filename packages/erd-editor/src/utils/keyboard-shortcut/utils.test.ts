import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  isModifierHeld,
  matchesPress,
  parseKeybinding,
} from '@/utils/keyboard-shortcut/utils';

const device = vi.hoisted(() => ({ apple: false, windows: false }));

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => device.apple,
  hasWindows: () => device.windows,
}));

/** A keydown holding exactly the modifiers named, whatever the DOM reports. */
const keydown = (key: string, code: string, held: string[] = []) => {
  const event = new KeyboardEvent('keydown', { key, code });
  Object.defineProperty(event, 'getModifierState', {
    value: (mod: string) => held.includes(mod),
  });
  return event;
};

beforeEach(() => {
  device.apple = false;
  device.windows = false;
});

describe('parseKeybinding', () => {
  it('parses a bare key into an empty modifier list', () => {
    expect(parseKeybinding('Enter')).toEqual([[[], 'Enter']]);
  });

  it('parses a single modifier', () => {
    expect(parseKeybinding('Alt+KeyN')).toEqual([[['Alt'], 'KeyN']]);
  });

  it('parses multiple modifiers in order', () => {
    expect(parseKeybinding('Shift+Alt+KeyZ')).toEqual([
      [['Shift', 'Alt'], 'KeyZ'],
    ]);
  });

  it('resolves $mod to Control on non-apple devices', () => {
    expect(parseKeybinding('$mod+KeyK')).toEqual([[['Control'], 'KeyK']]);
    expect(parseKeybinding('$mod+Shift+KeyZ')).toEqual([
      [['Control', 'Shift'], 'KeyZ'],
    ]);
  });

  it('resolves $mod to Meta on apple devices', () => {
    device.apple = true;
    expect(parseKeybinding('$mod+KeyK')).toEqual([[['Meta'], 'KeyK']]);
    expect(parseKeybinding('$mod+Alt+Digit1')).toEqual([
      [['Meta', 'Alt'], 'Digit1'],
    ]);
  });

  it('splits a space separated sequence into multiple presses', () => {
    expect(parseKeybinding('$mod+KeyK KeyA')).toEqual([
      [['Control'], 'KeyK'],
      [[], 'KeyA'],
    ]);
  });

  it('trims surrounding whitespace', () => {
    expect(parseKeybinding('  Alt+Space  ')).toEqual([[['Alt'], 'Space']]);
  });

  it('keeps a lone plus sign as the key because it has no word boundary', () => {
    expect(parseKeybinding('+')).toEqual([[[], '+']]);
  });

  it('treats a trailing plus as a key after a word boundary split', () => {
    expect(parseKeybinding('Alt++')).toEqual([[['Alt'], '+']]);
  });
});

describe('isModifierHeld', () => {
  it('reads the modifiers the event holds', () => {
    const event = keydown('a', 'KeyA', ['Shift']);

    expect(isModifierHeld(event, 'Shift')).toBe(true);
    expect(isModifierHeld(event, 'Alt')).toBe(false);
  });

  it('reads AltGraph as Control and Alt on windows', () => {
    device.windows = true;
    const event = keydown('@', 'KeyQ', ['AltGraph']);

    expect(isModifierHeld(event, 'Control')).toBe(true);
    expect(isModifierHeld(event, 'Alt')).toBe(true);
    expect(isModifierHeld(event, 'Meta')).toBe(false);
    expect(isModifierHeld(event, 'Shift')).toBe(false);
  });

  it('reads AltGraph as Alt alone on an apple device', () => {
    device.apple = true;
    const event = keydown('@', 'KeyQ', ['AltGraph']);

    expect(isModifierHeld(event, 'Alt')).toBe(true);
    expect(isModifierHeld(event, 'Control')).toBe(false);
  });

  it('reads AltGraph as none of the four anywhere else', () => {
    const event = keydown('@', 'KeyQ', ['AltGraph']);

    expect(
      ['Shift', 'Meta', 'Alt', 'Control'].map(mod => isModifierHeld(event, mod))
    ).toEqual([false, false, false, false]);
    expect(isModifierHeld(event, 'AltGraph')).toBe(true);
  });

  it('holds nothing on a keydown that has no getModifierState', () => {
    const event = new KeyboardEvent('keydown', { key: 'F1', shiftKey: true });
    Object.defineProperty(event, 'getModifierState', { value: undefined });

    expect(isModifierHeld(event, 'Shift')).toBe(false);
  });
});

describe('matchesPress', () => {
  it('matches the key by its value in any case or by its code', () => {
    expect(matchesPress(keydown('k', 'KeyK'), [[], 'K'])).toBe(true);
    expect(matchesPress(keydown('Escape', ''), [[], 'escape'])).toBe(true);
    expect(matchesPress(keydown('ㅏ', 'KeyK'), [[], 'KeyK'])).toBe(true);
    expect(matchesPress(keydown('ㅏ', 'KeyK'), [[], 'keyk'])).toBe(false);
    expect(matchesPress(keydown('j', 'KeyJ'), [[], 'KeyK'])).toBe(false);
  });

  it('needs every modifier the press names', () => {
    const press: [string[], string] = [['Control', 'Shift'], 'KeyZ'];

    expect(
      matchesPress(keydown('Z', 'KeyZ', ['Control', 'Shift']), press)
    ).toBe(true);
    expect(matchesPress(keydown('z', 'KeyZ', ['Control']), press)).toBe(false);
  });

  it('refuses a modifier the press does not name', () => {
    expect(
      matchesPress(keydown('z', 'KeyZ', ['Control', 'Alt']), [
        ['Control'],
        'KeyZ',
      ])
    ).toBe(false);
    expect(
      matchesPress(keydown('Enter', 'Enter', ['Meta']), [[], 'Enter'])
    ).toBe(false);
  });

  it('lets a lock key such as CapsLock be held', () => {
    expect(
      matchesPress(keydown('N', 'KeyN', ['Alt', 'CapsLock']), [['Alt'], 'KeyN'])
    ).toBe(true);
  });

  it('matches a modifier named as the key while it holds itself', () => {
    expect(
      matchesPress(keydown('Shift', 'ShiftLeft', ['Shift']), [[], 'Shift'])
    ).toBe(true);
    expect(
      matchesPress(keydown('Shift', 'ShiftLeft', ['Shift', 'Control']), [
        [],
        'Shift',
      ])
    ).toBe(false);
  });

  it('reads AltGraph on windows as the Control and Alt a chord names', () => {
    device.windows = true;
    const altGr = keydown('¡', 'Digit1', ['AltGraph']);

    expect(matchesPress(altGr, [['Control', 'Alt'], 'Digit1'])).toBe(true);
    expect(matchesPress(altGr, [['Alt'], 'Digit1'])).toBe(false);
    expect(matchesPress(altGr, [[], 'Digit1'])).toBe(false);
  });

  it('reads AltGraph on an apple device as the Alt a chord names', () => {
    device.apple = true;
    const option = keydown('¡', 'Digit1', ['AltGraph']);

    expect(matchesPress(option, [['Alt'], 'Digit1'])).toBe(true);
    expect(matchesPress(option, [[], 'Digit1'])).toBe(false);
  });

  it('leaves AltGraph out of a chord elsewhere', () => {
    const altGr = keydown('¡', 'Digit1', ['AltGraph']);

    expect(matchesPress(altGr, [[], 'Digit1'])).toBe(true);
    expect(matchesPress(altGr, [['Alt'], 'Digit1'])).toBe(false);
  });
});
