import { accentColors, grayColors } from '@radix-ui/themes/props';
import { describe, expect, it } from 'vite-plus/test';

import {
  applyEmbedOptions,
  applyPreviewOptions,
  DEFAULT_EMBED_HEIGHT,
  EMBED_DEFAULTS,
  EMBED_GRAY_COLORS,
  embedAppearance,
  type EmbedOptions,
  type EmbedViewerTarget,
  parseEmbedHeight,
  parseEmbedParams,
  toEmbedUrl,
  toIframeSnippet,
} from './embedOptions';

const ORIGIN = 'https://erd-editor.io';
const DOC = 'https://example.com/a.erd.json';
const ENCODED_DOC = 'https%3A%2F%2Fexample.com%2Fa.erd.json';

const NONE: EmbedOptions = {
  src: '',
  theme: null,
  locale: null,
  nameView: null,
  minimap: true,
  controls: true,
  accentColor: null,
  grayColor: null,
};

const options = (patch: Partial<EmbedOptions>): EmbedOptions => ({
  ...NONE,
  src: DOC,
  ...patch,
});

/** What a URL reads back as: an option equal to the viewer's default is left out of it, so absent. */
function normalize(value: EmbedOptions): EmbedOptions {
  const unlessDefault = <T>(option: T | null, fallback: T) =>
    option === fallback ? null : option;

  return {
    ...value,
    theme: unlessDefault(value.theme, EMBED_DEFAULTS.theme),
    locale: unlessDefault(value.locale, EMBED_DEFAULTS.locale),
    accentColor: unlessDefault(value.accentColor, EMBED_DEFAULTS.accentColor),
    grayColor: unlessDefault(value.grayColor, EMBED_DEFAULTS.grayColor),
  };
}

describe('EMBED_DEFAULTS', () => {
  it("copies the viewer's own defaults, not the app's colors", () => {
    expect(EMBED_DEFAULTS).toEqual({
      theme: 'system',
      locale: 'system',
      nameView: null,
      minimap: true,
      controls: true,
      accentColor: 'indigo',
      grayColor: 'slate',
    });
    expect(DEFAULT_EMBED_HEIGHT).toBe(480);
  });

  it("offers Radix's gray colors but auto, in its order", () => {
    expect(EMBED_GRAY_COLORS).toEqual(
      grayColors.filter(color => color !== 'auto')
    );
    expect(EMBED_GRAY_COLORS).toHaveLength(6);
  });
});

describe('parseEmbedParams', () => {
  it('reads each of the eight options', () => {
    expect(
      parseEmbedParams(
        `?src=${ENCODED_DOC}&theme=light&locale=ko-KR&name-view=logical` +
          '&minimap=false&controls=false&accent-color=crimson&gray-color=sand'
      )
    ).toEqual({
      src: DOC,
      theme: 'light',
      locale: 'ko-KR',
      nameView: 'logical',
      minimap: false,
      controls: false,
      accentColor: 'crimson',
      grayColor: 'sand',
    });
  });

  it('leaves every absent option to the viewer', () => {
    expect(parseEmbedParams('')).toEqual(NONE);
    expect(parseEmbedParams('?')).toEqual(NONE);
  });

  it('takes a URLSearchParams as it takes a query', () => {
    expect(
      parseEmbedParams(new URLSearchParams({ src: DOC, theme: 'dark' }))
    ).toEqual(options({ theme: 'dark' }));
  });

  it.each(['light', 'dark', 'system'] as const)('reads theme %s', theme => {
    expect(parseEmbedParams(`?theme=${theme}`).theme).toBe(theme);
  });

  it.each(['system', 'en', 'ko-KR', 'ar-SA', 'zh-TW'] as const)(
    'reads locale %s',
    locale => {
      expect(parseEmbedParams(`?locale=${locale}`).locale).toBe(locale);
    }
  );

  it.each(['physical', 'logical', 'both'] as const)(
    'reads name view %s',
    nameView => {
      expect(parseEmbedParams(`?name-view=${nameView}`).nameView).toBe(
        nameView
      );
    }
  );

  it("takes every accent color and every gray color but auto, Radix's lists", () => {
    for (const color of accentColors) {
      expect(parseEmbedParams(`?accent-color=${color}`).accentColor).toBe(
        color
      );
    }
    for (const color of grayColors) {
      expect(parseEmbedParams(`?gray-color=${color}`).grayColor).toBe(
        color === 'auto' ? null : color
      );
    }
  });

  it.each([
    ['theme', 'blue', 'theme'],
    ['theme', 'LIGHT', 'theme'],
    ['theme', '', 'theme'],
    ['name-view', 'x', 'nameView'],
    ['name-view', 'Logical', 'nameView'],
    ['accent-color', 'auto', 'accentColor'],
    ['accent-color', 'Indigo', 'accentColor'],
    ['gray-color', 'auto', 'grayColor'],
    ['gray-color', 'crimson', 'grayColor'],
    ['locale', 'xx', 'locale'],
    ['locale', 'ko-kr', 'locale'],
    ['locale', 'ko', 'locale'],
    ['locale', '', 'locale'],
  ] as const)('reads %s=%j as absent', (name, value, key) => {
    const query = new URLSearchParams({ src: DOC, [name]: value });
    expect(parseEmbedParams(query)).toEqual(options({}));
    expect(parseEmbedParams(query)[key]).toBeNull();
  });

  it('takes the first of a repeated name, a value it does not know included', () => {
    expect(parseEmbedParams('?theme=dark&theme=light').theme).toBe('dark');
    expect(parseEmbedParams('?theme=blue&theme=light').theme).toBeNull();
    expect(parseEmbedParams('?src=a&src=b').src).toBe('a');
    expect(parseEmbedParams('?src=&src=b').src).toBe('');
    expect(parseEmbedParams('?minimap=false&minimap=true').minimap).toBe(false);
  });

  it.each(['true', '0', 'off', 'no', '', 'False', 'FALSE'])(
    'shows the minimap and the controls for %j',
    value => {
      const read = parseEmbedParams(
        new URLSearchParams({ minimap: value, controls: value })
      );
      expect(read.minimap).toBe(true);
      expect(read.controls).toBe(true);
    }
  );

  it('turns each part off for false alone', () => {
    expect(parseEmbedParams('?minimap=false')).toEqual({
      ...NONE,
      minimap: false,
    });
    expect(parseEmbedParams('?controls=false')).toEqual({
      ...NONE,
      controls: false,
    });
  });

  it.each([
    ['?src=diagram.erd.json', 'diagram.erd.json'],
    ['?src=/schemas/a.erd.json', '/schemas/a.erd.json'],
    [
      '?src=data%3Aapplication%2Fjson%2C%7B%22version%22%3A%223.0.0%22%7D',
      'data:application/json,{"version":"3.0.0"}',
    ],
    ['?src=data:application/json,{}', 'data:application/json,{}'],
    ['?src=a+b.erd.json', 'a b.erd.json'],
    ['?src=a%20b.erd.json', 'a b.erd.json'],
    [
      '?src=%20https://example.com/a.erd.json',
      ' https://example.com/a.erd.json',
    ],
    [
      '?src=https://github.com/o/r/blob/main/a.erd.json',
      'https://github.com/o/r/blob/main/a.erd.json',
    ],
  ])('keeps src %s as the query gives it', (search, src) => {
    expect(parseEmbedParams(search).src).toBe(src);
  });
});

describe('toEmbedUrl', () => {
  it('is empty without a src', () => {
    expect(toEmbedUrl(ORIGIN, NONE)).toBe('');
    expect(toEmbedUrl(ORIGIN, { ...NONE, theme: 'light' })).toBe('');
  });

  it('writes src alone when every option is the default', () => {
    expect(toEmbedUrl(ORIGIN, options({}))).toBe(
      `${ORIGIN}/embed?src=${ENCODED_DOC}`
    );
    expect(
      toEmbedUrl(
        ORIGIN,
        options({
          theme: 'system',
          locale: 'system',
          accentColor: 'indigo',
          grayColor: 'slate',
        })
      )
    ).toBe(`${ORIGIN}/embed?src=${ENCODED_DOC}`);
  });

  it('encodes src', () => {
    expect(
      toEmbedUrl(
        ORIGIN,
        options({ src: 'https://example.com/my "a" <b>.erd.json?x=1&y=2#z' })
      )
    ).toBe(
      `${ORIGIN}/embed?src=https%3A%2F%2Fexample.com%2Fmy+%22a%22+%3Cb%3E.erd.json%3Fx%3D1%26y%3D2%23z`
    );
  });

  it('writes the options in a fixed order whatever order they were set in', () => {
    expect(
      toEmbedUrl(ORIGIN, {
        grayColor: 'sand',
        accentColor: 'crimson',
        controls: false,
        minimap: false,
        nameView: 'both',
        locale: 'ko-KR',
        theme: 'dark',
        src: DOC,
      })
    ).toBe(
      `${ORIGIN}/embed?src=${ENCODED_DOC}&theme=dark&locale=ko-KR&name-view=both` +
        '&minimap=false&controls=false&accent-color=crimson&gray-color=sand'
    );
  });

  it('adds only the options that differ from the default', () => {
    expect(
      toEmbedUrl(ORIGIN, options({ minimap: false, theme: 'light' }))
    ).toBe(`${ORIGIN}/embed?src=${ENCODED_DOC}&theme=light&minimap=false`);
  });

  it('keeps the address a person typed, a GitHub page included', () => {
    expect(
      toEmbedUrl(
        'http://localhost:5175',
        options({ src: 'https://github.com/o/r/blob/main/a.erd.json' })
      )
    ).toBe(
      'http://localhost:5175/embed?src=https%3A%2F%2Fgithub.com%2Fo%2Fr%2Fblob%2Fmain%2Fa.erd.json'
    );
  });

  it.each([
    ['every default', options({})],
    ['the defaults named', options({ theme: 'system', locale: 'system' })],
    [
      'every option set',
      options({
        theme: 'light',
        locale: 'he-IL',
        nameView: 'physical',
        minimap: false,
        controls: false,
        accentColor: 'gray',
        grayColor: 'gray',
      }),
    ],
    [
      'a src with its own query',
      options({ src: 'https://example.com/a.erd.json?x=1&src=y#z' }),
    ],
    ['a relative src with spaces', options({ src: ' my diagram.erd.json ' })],
    ['a data: src', options({ src: 'data:application/json,{"a":"&b"}' })],
    [
      'the default colors with a dark theme',
      options({ theme: 'dark', accentColor: 'indigo', grayColor: 'slate' }),
    ],
  ])('reads back with %s', (_, value) => {
    const url = new URL(toEmbedUrl(ORIGIN, value));

    expect(url.origin + url.pathname).toBe(`${ORIGIN}/embed`);
    expect(parseEmbedParams(url.search)).toEqual(normalize(value));
  });
});

describe('parseEmbedHeight', () => {
  it.each([
    ['480', 480],
    ['320', 320],
    [' 600 ', 600],
    ['0640', 640],
    ['1', 1],
    ['9007199254740991', 9007199254740991],
  ])('takes %j as %d', (input, height) => {
    expect(parseEmbedHeight(input)).toBe(height);
  });

  it.each([
    '',
    ' ',
    '0',
    '00',
    '-5',
    '+5',
    '1.5',
    '1e3',
    '12px',
    'abc',
    '9007199254740992',
  ])('reads %j as the default', input => {
    expect(parseEmbedHeight(input)).toBe(DEFAULT_EMBED_HEIGHT);
  });
});

describe('toIframeSnippet', () => {
  it('writes the one line a page pastes', () => {
    const url = `${ORIGIN}/embed?src=${ENCODED_DOC}&theme=light&minimap=false`;

    expect(toIframeSnippet(url, 480)).toBe(
      `<iframe src="${url}" width="100%" height="480" style="border: 0" loading="lazy" title="ERD Editor"></iframe>`
    );
  });

  it('asks the frame for no sandbox and no permissions', () => {
    const snippet = toIframeSnippet(toEmbedUrl(ORIGIN, options({})), 480);

    expect(snippet).not.toContain('sandbox');
    expect(snippet).not.toContain('allow');
  });

  it('holds the height a typed value reads as', () => {
    const url = toEmbedUrl(ORIGIN, options({}));

    expect(toIframeSnippet(url, parseEmbedHeight('720'))).toContain(
      'height="720"'
    );
    expect(toIframeSnippet(url, parseEmbedHeight('-1'))).toContain(
      'height="480"'
    );
  });

  it('carries no quote or angle bracket of a src into the attribute', () => {
    const url = toEmbedUrl(ORIGIN, options({ src: 'x"><script>' }));
    const src = toIframeSnippet(url, 480).match(/^<iframe src="([^"]*)" /);

    expect(src?.[1]).toBe(url);
    expect(url).not.toMatch(/["<>]/);
  });
});

describe('embedAppearance', () => {
  it.each([
    [null, true, 'dark'],
    [null, false, 'light'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)(
    'shows theme %s with a dark system %s as %s',
    (theme, dark, shown) => {
      expect(embedAppearance(theme, dark)).toBe(shown);
    }
  );
});

type Call = readonly [name: string, value: unknown];

/** A stand-in for the viewer that records, in order, each call and assignment. */
function recordingViewer() {
  const calls: Call[] = [];
  const viewer: EmbedViewerTarget = {
    setPresetTheme: theme => {
      calls.push(['setPresetTheme', theme]);
    },
    setLocale: async locale => {
      calls.push(['setLocale', locale]);
    },
    setSystemLocale: async locale => {
      calls.push(['setSystemLocale', locale]);
    },
    set nameView(value) {
      calls.push(['nameView', value]);
    },
    get nameView() {
      return null;
    },
    set minimap(value) {
      calls.push(['minimap', value]);
    },
    get minimap() {
      return true;
    },
    set controls(value) {
      calls.push(['controls', value]);
    },
    get controls() {
      return true;
    },
  };
  return { viewer, calls };
}

describe('applyEmbedOptions', () => {
  it('hands over the theme, the language, the name view, then the parts, in that order', () => {
    const { viewer, calls } = recordingViewer();

    applyEmbedOptions(
      viewer,
      parseEmbedParams(
        '?src=x&controls=false&minimap=false&name-view=logical&locale=ko-KR' +
          '&gray-color=sand&accent-color=crimson&theme=dark'
      )
    );

    expect(calls).toEqual([
      [
        'setPresetTheme',
        { appearance: 'dark', accentColor: 'crimson', grayColor: 'sand' },
      ],
      ['setLocale', 'ko-KR'],
      ['nameView', 'logical'],
      ['minimap', false],
      ['controls', false],
    ]);
  });

  it('leaves the theme, the language and the name view to the viewer when the URL names none', () => {
    const { viewer, calls } = recordingViewer();

    applyEmbedOptions(viewer, parseEmbedParams('?src=x'));

    expect(calls).toEqual([
      ['minimap', true],
      ['controls', true],
    ]);
  });

  it.each([
    ['theme=light', { appearance: 'light' }],
    ['theme=system', { appearance: 'system' }],
    ['accent-color=crimson', { accentColor: 'crimson' }],
    ['gray-color=sand', { grayColor: 'sand' }],
    ['theme=blue&accent-color=auto&gray-color=auto', null],
  ] as const)('hands over only the theme keys %s names', (query, preset) => {
    const { viewer, calls } = recordingViewer();

    applyEmbedOptions(viewer, parseEmbedParams(`?src=x&${query}`));

    expect(calls.filter(([name]) => name === 'setPresetTheme')).toEqual(
      preset ? [['setPresetTheme', preset]] : []
    );
  });

  it('passes a language the URL names, system included, and never the system language', () => {
    const named = recordingViewer();
    applyEmbedOptions(named.viewer, parseEmbedParams('?src=x&locale=system'));
    const unknown = recordingViewer();
    applyEmbedOptions(unknown.viewer, parseEmbedParams('?src=x&locale=ko-kr'));

    expect(named.calls).toContainEqual(['setLocale', 'system']);
    expect(unknown.calls.map(([name]) => name)).not.toContain('setLocale');
    expect(
      [...named.calls, ...unknown.calls].map(([name]) => name)
    ).not.toContain('setSystemLocale');
  });
});

describe('applyPreviewOptions', () => {
  it('hands over every option, the system language before the language', () => {
    const { viewer, calls } = recordingViewer();

    applyPreviewOptions(
      viewer,
      parseEmbedParams(
        '?src=x&theme=dark&locale=ko-KR&name-view=both&minimap=false' +
          '&controls=false&accent-color=crimson&gray-color=sand'
      ),
      'fr-FR'
    );

    expect(calls).toEqual([
      [
        'setPresetTheme',
        { appearance: 'dark', accentColor: 'crimson', grayColor: 'sand' },
      ],
      ['setSystemLocale', 'fr-FR'],
      ['setLocale', 'ko-KR'],
      ['nameView', 'both'],
      ['minimap', false],
      ['controls', false],
    ]);
  });

  it.each([
    ['a URL naming none', parseEmbedParams('?src=x')],
    ['the defaults written out', { ...EMBED_DEFAULTS, src: 'x' }],
  ])(
    "spells out the viewer's own defaults for %s, the document's name view as null",
    (_, given) => {
      const { viewer, calls } = recordingViewer();

      applyPreviewOptions(viewer, given, 'en');

      expect(calls).toEqual([
        [
          'setPresetTheme',
          { appearance: 'system', accentColor: 'indigo', grayColor: 'slate' },
        ],
        ['setSystemLocale', 'en'],
        ['setLocale', 'system'],
        ['nameView', null],
        ['minimap', true],
        ['controls', true],
      ]);
    }
  );
});
