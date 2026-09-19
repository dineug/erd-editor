/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  applyDocumentAppearance,
  applyPresetTheme,
  DEFAULT_THEME,
  isSystemDark,
  parseThemeState,
  resolveAppearance,
  resolveTheme,
  SYSTEM_DARK_QUERY,
  THEME_STORAGE_KEY,
  ThemeState,
  watchSystemDark,
} from './theme';

type Listener = () => void;

function createMediaQueryList(matches: boolean) {
  const listeners = new Set<Listener>();

  return {
    matches,
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.delete(listener);
    }),
    change(next: boolean) {
      this.matches = next;
      listeners.forEach(listener => listener());
    },
    listeners,
  };
}

function stubMatchMedia(matches: boolean) {
  const query = createMediaQueryList(matches);
  const matchMedia = vi.fn(() => query);
  vi.stubGlobal('matchMedia', matchMedia);
  return { query, matchMedia };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseThemeState', () => {
  it('keeps a value stored before system existed', () => {
    const legacy = {
      appearance: 'light',
      accentColor: 'jade',
      grayColor: 'olive',
    };

    expect(parseThemeState(legacy)).toEqual(legacy);
  });

  it('keeps a system preference and every Radix color', () => {
    expect(
      parseThemeState({
        appearance: 'system',
        accentColor: 'crimson',
        grayColor: 'auto',
      })
    ).toEqual({
      appearance: 'system',
      accentColor: 'crimson',
      grayColor: 'auto',
    });
  });

  it.each([null, undefined, 'light', 42, true, ['light'], {}])(
    'falls back to the defaults for %j',
    value => {
      expect(parseThemeState(value)).toEqual(DEFAULT_THEME);
    }
  );

  it('falls back field by field, keeping the valid ones', () => {
    expect(
      parseThemeState({
        appearance: 'inherit',
        accentColor: 'crimson',
        grayColor: 'beige',
      })
    ).toEqual({ ...DEFAULT_THEME, accentColor: 'crimson' });
    expect(
      parseThemeState({
        appearance: 'LIGHT',
        accentColor: 7,
        grayColor: 'sand',
      })
    ).toEqual({ ...DEFAULT_THEME, grayColor: 'sand' });
  });

  it('defaults to dark, the look every existing user has', () => {
    expect(DEFAULT_THEME.appearance).toBe('dark');
  });
});

describe('resolveAppearance', () => {
  it.each([
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ] as const)(
    'resolves %s with a dark system %s to %s',
    (preference, dark, expected) => {
      expect(resolveAppearance(preference, dark)).toBe(expected);
    }
  );

  it('resolves only the appearance of a whole theme', () => {
    const state: ThemeState = {
      appearance: 'system',
      accentColor: 'sky',
      grayColor: 'slate',
    };

    expect(resolveTheme(state, false)).toEqual({
      ...state,
      appearance: 'light',
    });
    expect(state.appearance).toBe('system');
  });
});

describe('applyPresetTheme', () => {
  const system: ThemeState = {
    appearance: 'system',
    accentColor: 'jade',
    grayColor: 'olive',
  };

  it('keeps system when the builder only changed colors', () => {
    expect(
      applyPresetTheme(
        system,
        { appearance: 'light', accentColor: 'tomato', grayColor: 'sand' },
        'light'
      )
    ).toEqual({
      appearance: 'system',
      accentColor: 'tomato',
      grayColor: 'sand',
    });
  });

  it('leaves system for the appearance the builder switched to', () => {
    expect(
      applyPresetTheme(
        system,
        { appearance: 'dark', accentColor: 'jade', grayColor: 'olive' },
        'light'
      )
    ).toEqual({ ...system, appearance: 'dark' });
  });

  it('switches an explicit preference the same way', () => {
    const light: ThemeState = { ...system, appearance: 'light' };

    expect(
      applyPresetTheme(light, { appearance: 'dark' }, 'light').appearance
    ).toBe('dark');
    expect(
      applyPresetTheme(light, { appearance: 'light' }, 'light').appearance
    ).toBe('light');
  });

  it('ignores what the builder never emits and keeps the current values', () => {
    expect(
      applyPresetTheme(
        system,
        { appearance: 'system', accentColor: 'beige', grayColor: 3 },
        'dark'
      )
    ).toEqual(system);
    expect(applyPresetTheme(system, null, 'dark')).toEqual(system);
    expect(applyPresetTheme(system, 'dark', 'light')).toEqual(system);
  });
});

describe('isSystemDark', () => {
  it('asks matchMedia for a dark color scheme', () => {
    const { matchMedia } = stubMatchMedia(false);

    expect(isSystemDark()).toBe(false);
    expect(matchMedia).toHaveBeenCalledWith(SYSTEM_DARK_QUERY);
  });

  it('reads as dark without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(isSystemDark()).toBe(true);
  });
});

describe('watchSystemDark', () => {
  it('reports every change until unsubscribed', () => {
    const { query } = stubMatchMedia(true);
    const callback = vi.fn();

    const unsubscribe = watchSystemDark(callback);
    query.change(false);
    query.change(true);
    unsubscribe();
    query.change(false);

    expect(callback.mock.calls).toEqual([[false], [true]]);
    expect(query.listeners.size).toBe(0);
  });

  it('does nothing without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const callback = vi.fn();

    watchSystemDark(callback)();

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('applyDocumentAppearance', () => {
  it('swaps the Radix class and the color scheme', () => {
    const root = document.createElement('html');
    root.className = 'dark-theme other';
    root.style.colorScheme = 'dark';

    applyDocumentAppearance(root, 'light');
    expect([...root.classList].sort()).toEqual(['light-theme', 'other']);
    expect(root.style.colorScheme).toBe('light');

    applyDocumentAppearance(root, 'dark');
    expect([...root.classList].sort()).toEqual(['dark-theme', 'other']);
    expect(root.style.colorScheme).toBe('dark');
  });
});

describe('index.html pre-paint script', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

  function runScript(stored: string | null | Error, systemDark: boolean) {
    const root = document.createElement('html');
    root.className = 'dark-theme';
    root.style.colorScheme = 'dark';
    const localStorage = {
      getItem: (key: string) => {
        if (stored instanceof Error) throw stored;
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    };
    const matchMedia = (query: string) => ({
      matches: query === SYSTEM_DARK_QUERY && systemDark,
    });

    new Function('localStorage', 'matchMedia', 'document', script)(
      localStorage,
      matchMedia,
      { documentElement: root }
    );
    return root;
  }

  function expectedAppearance(stored: string | null, systemDark: boolean) {
    let value: unknown = null;
    try {
      value = JSON.parse(stored ?? '');
    } catch {
      value = null;
    }
    return resolveAppearance(parseThemeState(value).appearance, systemDark);
  }

  it('ships dark markup for no-JS and runs before any stylesheet', () => {
    expect(html).toMatch(
      /<html class="dark-theme" style="color-scheme: dark">/
    );
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<link'));
  });

  const storedValues = [
    null,
    '',
    'not json',
    'null',
    '"light"',
    '[]',
    '{}',
    JSON.stringify(DEFAULT_THEME),
    JSON.stringify({ ...DEFAULT_THEME, appearance: 'light' }),
    JSON.stringify({ ...DEFAULT_THEME, appearance: 'system' }),
    JSON.stringify({ appearance: 'inherit' }),
    JSON.stringify({ appearance: 'LIGHT' }),
  ];

  it.each(
    storedValues.flatMap(stored => [
      [stored, true] as const,
      [stored, false] as const,
    ])
  )(
    'agrees with parseThemeState for %j with a dark system %s',
    (stored, systemDark) => {
      const root = runScript(stored, systemDark);
      const appearance = expectedAppearance(stored, systemDark);

      expect([...root.classList]).toEqual([`${appearance}-theme`]);
      expect(root.style.colorScheme).toBe(appearance);
    }
  );

  it('keeps dark when storage is blocked', () => {
    const root = runScript(new Error('SecurityError'), false);

    expect([...root.classList]).toEqual(['dark-theme']);
    expect(root.style.colorScheme).toBe('dark');
  });
});
