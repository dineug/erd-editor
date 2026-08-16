import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { parseKeybinding } from '@/utils/keyboard-shortcut/utils';

const device = vi.hoisted(() => ({ apple: false }));

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => device.apple,
}));

describe('parseKeybinding', () => {
  beforeEach(() => {
    device.apple = false;
  });

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
