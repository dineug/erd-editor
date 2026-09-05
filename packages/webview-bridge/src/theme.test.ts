import { describe, expect, it } from 'vite-plus/test';

import { AccentColor, Appearance, GrayColor } from '@/theme';

describe('Appearance', () => {
  it('exposes exactly the dark and light entries', () => {
    expect(Appearance).toEqual({ dark: 'dark', light: 'light' });
  });

  it('maps every key onto an identical value', () => {
    for (const [key, value] of Object.entries(Appearance)) {
      expect(value).toBe(key);
    }
  });
});

describe('GrayColor', () => {
  it('lists the six radix gray scales in declaration order', () => {
    expect(Object.keys(GrayColor)).toEqual([
      'gray',
      'mauve',
      'slate',
      'sage',
      'olive',
      'sand',
    ]);
  });

  it('maps every key onto an identical value', () => {
    for (const [key, value] of Object.entries(GrayColor)) {
      expect(value).toBe(key);
    }
  });
});

describe('AccentColor', () => {
  it('lists the accent scales in declaration order', () => {
    expect(Object.keys(AccentColor)).toEqual([
      'gray',
      'gold',
      'bronze',
      'brown',
      'yellow',
      'amber',
      'orange',
      'tomato',
      'red',
      'ruby',
      'crimson',
      'pink',
      'plum',
      'purple',
      'violet',
      'iris',
      'indigo',
      'blue',
      'cyan',
      'teal',
      'jade',
      'green',
      'grass',
      'lime',
      'mint',
      'sky',
    ]);
  });

  it('maps every key onto an identical value', () => {
    for (const [key, value] of Object.entries(AccentColor)) {
      expect(value).toBe(key);
    }
  });

  it('shares only the gray entry with GrayColor', () => {
    const shared = Object.keys(GrayColor).filter(key => key in AccentColor);

    expect(shared).toEqual(['gray']);
  });

  it('does not include appearance values as accent colors', () => {
    expect(AccentColor).not.toHaveProperty('dark');
    expect(AccentColor).not.toHaveProperty('light');
  });
});
