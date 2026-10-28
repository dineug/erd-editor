/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { embedAppearance, parseEmbedParams } from './embedOptions';
import { isEmbedViewerUrl } from './embedPath';
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

  it('defaults to system, as the display language does', () => {
    expect(DEFAULT_THEME.appearance).toBe('system');
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

  it('keeps system when the builder picks colors under it', () => {
    expect(
      applyPresetTheme(system, {
        appearance: 'system',
        accentColor: 'tomato',
        grayColor: 'sand',
      })
    ).toEqual({
      appearance: 'system',
      accentColor: 'tomato',
      grayColor: 'sand',
    });
  });

  it('takes the light or dark the builder picked over system', () => {
    expect(
      applyPresetTheme(system, {
        appearance: 'dark',
        accentColor: 'jade',
        grayColor: 'olive',
      })
    ).toEqual({ ...system, appearance: 'dark' });
    expect(applyPresetTheme(system, { appearance: 'light' }).appearance).toBe(
      'light'
    );
  });

  it('takes system the builder picked over light or dark', () => {
    const light: ThemeState = { ...system, appearance: 'light' };

    expect(applyPresetTheme(light, { appearance: 'system' }).appearance).toBe(
      'system'
    );
    expect(applyPresetTheme(light, { appearance: 'dark' }).appearance).toBe(
      'dark'
    );
  });

  it('ignores what the builder never emits and keeps the current values', () => {
    expect(
      applyPresetTheme(system, {
        appearance: 'inherit',
        accentColor: 'beige',
        grayColor: 3,
      })
    ).toEqual(system);
    expect(applyPresetTheme(system, null)).toEqual(system);
    expect(applyPresetTheme(system, 'dark')).toEqual(system);
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

  function runScript(
    stored: string | null | Error,
    systemDark: boolean,
    url = 'https://erd-editor.io/'
  ) {
    const root = document.createElement('html');
    root.className = 'dark-theme';
    root.style.colorScheme = 'dark';
    const getItem = vi.fn((key: string) => {
      if (stored instanceof Error) throw stored;
      return key === THEME_STORAGE_KEY ? stored : null;
    });
    const matchMedia = (query: string) => ({
      matches: query === SYSTEM_DARK_QUERY && systemDark,
    });

    new Function('localStorage', 'matchMedia', 'document', 'location', script)(
      { getItem },
      matchMedia,
      { documentElement: root },
      new URL(url)
    );
    return Object.assign(root, { getItem });
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

  it.each([
    [true, 'dark'],
    [false, 'light'],
  ])(
    'follows a dark system %s when storage is blocked',
    (systemDark, appearance) => {
      const root = runScript(new Error('SecurityError'), systemDark);

      expect([...root.classList]).toEqual([`${appearance}-theme`]);
      expect(root.style.colorScheme).toBe(appearance);
    }
  );

  const STORED_LIGHT = JSON.stringify({
    ...DEFAULT_THEME,
    appearance: 'light',
  });
  const STORED_DARK = JSON.stringify({ ...DEFAULT_THEME, appearance: 'dark' });

  it.each([
    ['/embed?src=x', 'dark'],
    ['/embed', 'light'],
    ['/', 'light'],
    ['/embed?src=x&theme=light', 'light'],
    ['/embed?src=x&theme=LIGHT', 'dark'],
  ])(
    'paints %s as %s from a stored light theme on a dark system',
    (path, appearance) => {
      const root = runScript(
        STORED_LIGHT,
        true,
        `https://erd-editor.io${path}`
      );

      expect([...root.classList]).toEqual([`${appearance}-theme`]);
      expect(root.style.colorScheme).toBe(appearance);
    }
  );

  // Whether each URL is an embedded viewer, as the router and main.tsx judge it.
  const URLS = [
    ['/embed?src=x', true],
    ['/embed?src=x&theme=light', true],
    ['/embed?src=x&theme=dark', true],
    ['/embed?src=x&theme=system', true],
    ['/embed?src=x&theme=LIGHT', true],
    ['/embed?theme=dark&src=x&theme=light', true],
    ['/EMBED?src=x', true],
    ['/%65mbed?src=x', true],
    ['/embed/?src=x', true],
    ['/embed//?src=x&theme=light', true],
    ['/', false],
    ['/?schema=x', false],
    ['/embed', false],
    ['/embedx?src=x', false],
    ['/embed/x?src=x', false],
    ['/embed%2F?src=x', false],
    ['/embed%?src=x', false],
    ['/embed?src=', false],
    ['/embed?src=&src=x', false],
    ['/embed?theme=light', false],
    ['/embed?theme=light&src=', false],
    ['/live/#room,key', false],
  ] as const;

  it.each(
    URLS.flatMap(([path, viewer]) =>
      [STORED_LIGHT, STORED_DARK].flatMap(stored => [
        [path, viewer, stored, true] as const,
        [path, viewer, stored, false] as const,
      ])
    )
  )(
    'agrees with isEmbedViewerUrl on %s (%s) with %s stored and a dark system %s',
    (path, viewer, stored, systemDark) => {
      const url = new URL(`https://erd-editor.io${path}`);
      const root = runScript(stored, systemDark, url.href);
      const appearance = isEmbedViewerUrl(url)
        ? embedAppearance(parseEmbedParams(url.search).theme, systemDark)
        : expectedAppearance(stored, systemDark);

      expect(isEmbedViewerUrl(url)).toBe(viewer);
      expect([...root.classList]).toEqual([`${appearance}-theme`]);
      expect(root.style.colorScheme).toBe(appearance);
      expect(root.getItem).toHaveBeenCalledTimes(viewer ? 0 : 1);
    }
  );
});
