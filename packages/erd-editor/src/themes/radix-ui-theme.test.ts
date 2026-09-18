import { get } from 'es-toolkit/compat';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  AccentColor,
  AccentColorList,
  Appearance,
  AppearanceList,
  createTheme,
  GrayColor,
  GrayColorList,
  Palette,
  type ThemeOptions,
} from '@/themes/radix-ui-theme';
import { ThemeConfig } from '@/themes/radix-ui-theme.config';
import { ThemeTokens } from '@/themes/tokens';

const lightGrayBlue: ThemeOptions = {
  appearance: Appearance.light,
  grayColor: GrayColor.gray,
  accentColor: AccentColor.blue,
};

const darkGrayBlue: ThemeOptions = {
  appearance: Appearance.dark,
  grayColor: GrayColor.gray,
  accentColor: AccentColor.blue,
};

const everyThemeOptions: ThemeOptions[] = AppearanceList.flatMap(appearance =>
  GrayColorList.flatMap(grayColor =>
    AccentColorList.map(accentColor => ({ appearance, grayColor, accentColor }))
  )
);

const labelOf = ({ appearance, grayColor, accentColor }: ThemeOptions) =>
  `${appearance}/${grayColor}/${accentColor}`;

/** The 0..1 linear-light channels of an opaque #rrggbb radix step. */
function toLinearRgb(hex: string): number[] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  return [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

const luminance = (hex: string) => {
  const [r, g, b] = toLinearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The WCAG contrast ratio between two opaque colours. */
const contrast = (first: string, second: string) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a
  );
  return (lighter + 0.05) / (darker + 0.05);
};

/** CIE Lab under the D65 white point. */
function toLab(hex: string): number[] {
  const [r, g, b] = toLinearRgb(hex);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** The CIE76 colour difference, where about 2.3 is the least an eye tells apart. */
const deltaE = (first: string, second: string) => {
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

describe('enums', () => {
  it('exposes both appearances', () => {
    expect(Appearance).toEqual({ dark: 'dark', light: 'light' });
    expect(AppearanceList).toEqual(['dark', 'light']);
  });

  it('exposes the six radix gray scales', () => {
    expect(GrayColorList).toEqual([
      'gray',
      'mauve',
      'slate',
      'sage',
      'olive',
      'sand',
    ]);
  });

  it('exposes 26 accent colors, all of them present in the palette', () => {
    expect(AccentColorList).toHaveLength(26);
    expect(new Set(AccentColorList).size).toBe(26);
    AccentColorList.forEach(color => {
      expect(Palette, color).toHaveProperty(color);
      expect(Palette, `${color}Dark`).toHaveProperty(`${color}Dark`);
    });
  });

  it('exposes every gray scale together with its alpha and dark variants', () => {
    GrayColorList.forEach(color => {
      expect(Palette).toHaveProperty(color);
      expect(Palette).toHaveProperty(`${color}A`);
      expect(Palette).toHaveProperty(`${color}Dark`);
      expect(Palette).toHaveProperty(`${color}DarkA`);
    });
  });

  it('treats gray as both a gray scale and an accent color', () => {
    expect(GrayColorList).toContain('gray');
    expect(AccentColorList).toContain('gray');
  });
});

describe('createTheme', () => {
  it('resolves the light gray/blue theme to concrete radix hex values', () => {
    const theme = createTheme(lightGrayBlue);

    expect(theme.grayColor1).toBe('#fcfcfc');
    expect(theme.grayColor12).toBe('#202020');
    expect(theme.canvasBackground).toBe('#f0f0f0');
    expect(theme.canvasBoundaryBackground).toBe('#fcfcfc');
    expect(theme.tableBackground).toBe('#ffffff');
    expect(theme.tableBorder).toBe('#bbbbbb');
    expect(theme.minimapBorder).toBe('#cecece');
    expect(theme.foreground).toBe('#646464');
    expect(theme.active).toBe('#202020');
    expect(theme.accentColor4).toBe('#d5efff');
    expect(theme.tableSelect).toBe('#5eb1ef');
    expect(theme.focus).toBe('#5eb1ef');
  });

  it('resolves the dark gray/blue theme to the dark radix hex values', () => {
    const theme = createTheme(darkGrayBlue);

    expect(theme.grayColor1).toBe('#111111');
    expect(theme.grayColor12).toBe('#eeeeee');
    expect(theme.canvasBackground).toBe('#222222');
    expect(theme.canvasBoundaryBackground).toBe('#111111');
    expect(theme.tableBackground).toBe('#191919');
    expect(theme.tableBorder).toBe('#3a3a3a');
    expect(theme.foreground).toBe('#b4b4b4');
    expect(theme.tableSelect).toBe('#2870bd');
  });

  it('uses the alpha scale for grayA tokens', () => {
    expect(createTheme(lightGrayBlue).scrollbarTrack).toBe('#0000000f');
    expect(createTheme(lightGrayBlue).placeholder).toBe('#0000007c');
    expect(createTheme(darkGrayBlue).scrollbarTrack).toBe('#ffffff12');
    expect(createTheme(darkGrayBlue).placeholder).toBe('#ffffff72');
  });

  it('passes override tokens through as the literal color name', () => {
    expect(createTheme(lightGrayBlue).minimapShadow).toBe('black');
    expect(createTheme(darkGrayBlue).minimapBorder).toBe('black');
    expect(createTheme(darkGrayBlue).minimapShadow).toBe('black');
  });

  it('resolves custom key colors from their own palette, ignoring gray/accent', () => {
    const light = createTheme(lightGrayBlue);
    const dark = createTheme(darkGrayBlue);

    expect(light.keyPK).toBe('#ab6400');
    expect(light.keyFK).toBe('#ca244d');
    expect(light.keyPFK).toBe('#107d98');
    expect(dark.keyPK).toBe('#ffc53d');
    expect(dark.keyFK).toBe('#e54666');
    expect(dark.keyPFK).toBe('#00a2c7');

    const mauveSky = createTheme({
      appearance: Appearance.light,
      grayColor: GrayColor.mauve,
      accentColor: AccentColor.sky,
    });
    expect(mauveSky.keyPK).toBe(light.keyPK);
  });

  it('switches the custom diff colors between light and dark appearances', () => {
    const light = createTheme(lightGrayBlue);
    const dark = createTheme(darkGrayBlue);

    expect(light.diffInsertBackground).toBe('#d6f1df');
    expect(light.diffDeleteBackground).toBe('#ffdbdc');
    expect(light.diffCrossBackground).toBe('#d5efff');
    expect(light.diffInsertForeground).toBe('#218358');
    expect(light.diffDeleteForeground).toBe('#ce2c31');
    expect(light.diffCrossForeground).toBe('#0d74ce');

    expect(dark.diffInsertBackground).toBe('#113b29');
    expect(dark.diffDeleteBackground).toBe('#500f1c');
    expect(dark.diffCrossBackground).toBe('#003362');
    expect(dark.diffInsertForeground).toBe('#3dd68c');
    expect(dark.diffDeleteForeground).toBe('#ff9592');
    expect(dark.diffCrossForeground).toBe('#70b8ff');
  });

  it('honours a non-gray gray scale and a non-blue accent', () => {
    const theme = createTheme({
      appearance: Appearance.light,
      grayColor: GrayColor.mauve,
      accentColor: AccentColor.sky,
    });

    expect(theme.grayColor3).toBe('#f2eff3');
    expect(theme.scrollbarTrack).toBe('#30004010');
    expect(theme.accentColor8).toBe('#60b3d7');
    expect(theme.contextMenuHover).toBe('#8dcae3');
    expect(theme.inputActive).toBe('#74daf8');
  });

  it('produces every theme token for all gray x accent x appearance combinations', () => {
    AppearanceList.forEach(appearance => {
      GrayColorList.forEach(grayColor => {
        AccentColorList.forEach(accentColor => {
          const label = `${appearance}/${grayColor}/${accentColor}`;
          const theme = createTheme({
            appearance,
            grayColor,
            accentColor,
          });

          expect(Object.keys(theme).sort(), label).toEqual(
            [...ThemeTokens].sort()
          );
          ThemeTokens.forEach(token => {
            const value = get(theme, token);
            expect(typeof value, `${label} ${token}`).toBe('string');
            expect(value, `${label} ${token}`).not.toBe('');
          });
        });
      });
    });
  });

  it('renders scale tokens straight from the matching radix palette', () => {
    const theme = createTheme({
      appearance: Appearance.dark,
      grayColor: GrayColor.sand,
      accentColor: AccentColor.jade,
    });

    for (let step = 1; step <= 12; step++) {
      expect(get(theme, `grayColor${step}`)).toBe(
        get(Palette, `sandDark.sand${step}`)
      );
      expect(get(theme, `accentColor${step}`)).toBe(
        get(Palette, `jadeDark.jade${step}`)
      );
    }
  });

  it('is a pure function of its options', () => {
    expect(createTheme(lightGrayBlue)).toEqual(createTheme(lightGrayBlue));
    expect(createTheme(lightGrayBlue)).not.toBe(createTheme(lightGrayBlue));
    expect(createTheme(lightGrayBlue)).not.toEqual(createTheme(darkGrayBlue));
  });

  it('keeps gray and accent tokens independent when the accent is also gray', () => {
    const theme = createTheme({
      appearance: Appearance.light,
      grayColor: GrayColor.slate,
      accentColor: AccentColor.gray,
    });

    expect(theme.grayColor9).toBe(get(Palette, 'slate.slate9'));
    expect(theme.accentColor9).toBe(get(Palette, 'gray.gray9'));
    expect(theme.grayColor9).not.toBe(theme.accentColor9);
  });

  it('derives exactly the tokens declared in ThemeConfig', () => {
    expect(Object.keys(createTheme(lightGrayBlue)).sort()).toEqual(
      Object.keys(ThemeConfig).sort()
    );
  });
});

describe('the selected column row fill', () => {
  /** The low steps of these accent scales sit on or beside the gray-4 hover. */
  const neutralAccents: string[] = [
    AccentColor.gray,
    AccentColor.gold,
    AccentColor.bronze,
  ];

  /** Light brown on sand is the nearest pair, at 4.37. The gray-5 fill gray-6 replaced measured 2.5 to 3.4. */
  const MIN_SELECT_HOVER_DELTA_E = 4;

  /** The least CIE76 step an eye tells apart. */
  const MIN_VISIBLE_DELTA_E = 2.3;

  it('takes accent-3, and gray-6 under the gray, gold and bronze accents', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(theme.columnSelect, labelOf(options)).toBe(
        neutralAccents.includes(options.accentColor)
          ? theme.grayColor6
          : theme.accentColor3
      );
    });
  });

  it('lifts a hovered selected row to accent-4, and eases it to gray-5 under a neutral accent', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(theme.columnSelectHover, labelOf(options)).toBe(
        neutralAccents.includes(options.accentColor)
          ? theme.grayColor5
          : theme.accentColor4
      );
    });
  });

  it('shows the pointer on a selected row, apart from both the selection and a plain hover', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(
        deltaE(theme.columnSelectHover, theme.columnSelect),
        labelOf(options)
      ).toBeGreaterThan(MIN_VISIBLE_DELTA_E);
      expect(
        deltaE(theme.columnSelectHover, theme.columnHover),
        labelOf(options)
      ).toBeGreaterThan(MIN_VISIBLE_DELTA_E);
    });
  });

  it('stands apart from the hovered row fill in every theme', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(
        deltaE(theme.columnSelect, theme.columnHover),
        labelOf(options)
      ).toBeGreaterThan(MIN_SELECT_HOVER_DELTA_E);
    });
  });

  /** Radix gray-11 on gray-6 in light measures 4.19 to 4.28, and on gray-5 4.48 at the least, the places short of AA. */
  it('keeps gray-11 text at 4.5:1 on it and under the pointer, save the light gray fallbacks', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);
      const fallbackInLight =
        options.appearance === Appearance.light &&
        neutralAccents.includes(options.accentColor);

      expect(
        contrast(theme.grayColor11, theme.columnSelect),
        labelOf(options)
      ).toBeGreaterThanOrEqual(fallbackInLight ? 4.1 : 4.5);
      expect(
        contrast(theme.grayColor11, theme.columnSelectHover),
        labelOf(options)
      ).toBeGreaterThanOrEqual(fallbackInLight ? 4.4 : 4.5);
    });
  });
});

describe('the table header band', () => {
  /** Twice the least visible CIE76 step. Light sand, the nearest to its canvas, measures 5.32. */
  const MIN_BAND_DELTA_E = 5;

  it('stands apart from both the canvas and the card body in every theme', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(
        deltaE(theme.tableHeaderBackground, theme.canvasBackground),
        labelOf(options)
      ).toBeGreaterThan(MIN_BAND_DELTA_E);
      expect(
        deltaE(theme.tableHeaderBackground, theme.tableBackground),
        labelOf(options)
      ).toBeGreaterThan(MIN_BAND_DELTA_E);
    });
  });

  it('keeps the table name at 7:1 on it', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(
        contrast(theme.active, theme.tableHeaderBackground),
        labelOf(options)
      ).toBeGreaterThanOrEqual(7);
    });
  });
});

describe('the light appearance', () => {
  const lightThemeOptions = everyThemeOptions.filter(
    options => options.appearance === Appearance.light
  );

  /** WCAG 1.4.11 asks this of a graphic that carries meaning, as a key and a line do. */
  const MIN_GRAPHIC_CONTRAST = 3;

  it('keeps every key icon at 3:1 on the table it sits in', () => {
    lightThemeOptions.forEach(options => {
      const theme = createTheme(options);

      [theme.keyPK, theme.keyFK, theme.keyPFK].forEach(key => {
        expect(
          contrast(key, theme.tableBackground),
          labelOf(options)
        ).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
      });
    });
  });

  it('keeps both relationship colours at 3:1 on the canvas', () => {
    lightThemeOptions.forEach(options => {
      const theme = createTheme(options);

      [theme.keyFK, theme.keyPFK].forEach(line => {
        expect(
          contrast(line, theme.canvasBackground),
          labelOf(options)
        ).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
      });
    });
  });

  it('edges a table more sharply against the canvas than the shared gray-6 did', () => {
    lightThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(
        contrast(theme.tableBorder, theme.canvasBackground),
        labelOf(options)
      ).toBeGreaterThan(contrast(theme.grayColor6, theme.canvasBackground));
    });
  });

  it('draws every visualization stroke a gray step darker than dark does', () => {
    lightThemeOptions.forEach(options => {
      const theme = createTheme(options);
      const label = labelOf(options);

      expect(theme.visualizationLink, label).toBe(theme.grayColor8);
      expect(theme.visualizationColumn, label).toBe(theme.grayColor9);
      expect(theme.visualizationRelationship, label).toBe(theme.grayColor9);
    });
  });

  /** These strokes rest dimmed until a hover lights them, so dark sets their bar rather than 3:1. */
  it('holds every visualization stroke level with its dark contrast', () => {
    lightThemeOptions.forEach(options => {
      const light = createTheme(options);
      const dark = createTheme({ ...options, appearance: Appearance.dark });
      const strokes = [
        'visualizationLink',
        'visualizationColumn',
        'visualizationRelationship',
      ] as const;

      strokes.forEach(stroke => {
        expect(
          contrast(light[stroke], light.canvasBackground),
          `${labelOf(options)} ${stroke}`
        ).toBeGreaterThanOrEqual(
          contrast(dark[stroke], dark.canvasBackground) * 0.95
        );
      });
    });
  });

  it('casts a table and memo shadow in a colour konva reads alpha from', () => {
    lightThemeOptions.forEach(options => {
      const theme = createTheme(options);

      expect(theme.tableShadow, labelOf(options)).toBe('rgba(0, 0, 0, 0.18)');
      expect(theme.memoShadow, labelOf(options)).toBe(theme.tableShadow);
    });
  });

  it('leaves every dark theme on the shared config', () => {
    everyThemeOptions
      .filter(options => options.appearance === Appearance.dark)
      .forEach(options => {
        const theme = createTheme(options);
        const label = labelOf(options);

        expect(theme.tableBackground, label).toBe(theme.grayColor2);
        expect(theme.tableBorder, label).toBe(theme.grayColor6);
        expect(theme.memoBackground, label).toBe(theme.grayColor2);
        expect(theme.memoBorder, label).toBe(theme.grayColor6);
        expect(theme.minimapBorder, label).toBe('black');
        expect(theme.tableShadow, label).toBe('transparent');
        expect(theme.memoShadow, label).toBe('transparent');
        expect(theme.keyPK, label).toBe('#ffc53d');
        expect(theme.keyFK, label).toBe('#e54666');
        expect(theme.keyPFK, label).toBe('#00a2c7');
        expect(theme.visualizationLink, label).toBe(theme.grayColor7);
        expect(theme.visualizationColumn, label).toBe(theme.grayColor8);
        expect(theme.visualizationRelationship, label).toBe(theme.grayColor8);
      });
  });
});

describe('the gray-3 hover of a tab, a Settings item and a toolbar tool', () => {
  /** The least CIE76 step an eye tells apart. */
  const MIN_VISIBLE_DELTA_E = 2.3;

  it('shows on its gray-2 surface yet stays under the gray-4 selection in every theme', () => {
    everyThemeOptions.forEach(options => {
      const theme = createTheme(options);

      [theme.contextMenuBackground, theme.toastBackground].forEach(surface => {
        const hover = deltaE(theme.grayColor3, surface);

        expect(hover, labelOf(options)).toBeGreaterThan(MIN_VISIBLE_DELTA_E);
        expect(hover, labelOf(options)).toBeLessThan(
          deltaE(theme.contextMenuSelect, surface)
        );
      });
    });
  });
});

describe('createTheme with unusual config entries', () => {
  afterEach(() => {
    vi.doUnmock('@/themes/radix-ui-theme.config');
    vi.resetModules();
  });

  const loadWithConfig = async (config: Record<string, string>) => {
    vi.resetModules();
    vi.doMock('@/themes/radix-ui-theme.config', () => ({
      ThemeConfig: config,
      LightThemeConfig: {},
      NeutralAccentThemeConfig: {},
    }));
    return await import('@/themes/radix-ui-theme');
  };

  it('supports the accentA prefix and falls back to an empty string for unknown scale steps', async () => {
    const { createTheme: create } = await loadWithConfig({
      foreground: 'accentA-3',
      active: 'gray-99',
      placeholder: 'grayA-99',
      focus: 'accentA-99',
      inputActive: 'accent-99',
    });

    const theme = create(lightGrayBlue) as unknown as Record<string, string>;

    expect(theme.foreground).toBe(get(Palette, 'blueA.blueA3'));
    expect(theme.active).toBe('');
    expect(theme.placeholder).toBe('');
    expect(theme.focus).toBe('');
    expect(theme.inputActive).toBe('');
  });

  it('reads accentA from the dark alpha palette in the dark appearance', async () => {
    const { createTheme: create } = await loadWithConfig({
      foreground: 'accentA-3',
    });

    const theme = create(darkGrayBlue) as unknown as Record<string, string>;
    expect(theme.foreground).toBe(get(Palette, 'blueDarkA.blueA3'));
  });

  it('drops tokens whose prefix is neither gray, accent, custom nor override', async () => {
    const { createTheme: create } = await loadWithConfig({
      foreground: 'unknown-1',
      active: 'gray-11',
    });

    const theme = create(lightGrayBlue) as unknown as Record<string, string>;
    expect(theme).not.toHaveProperty('foreground');
    expect(theme.active).toBe('#646464');
  });

  it('resolves a custom entry that names an alpha palette', async () => {
    const { createTheme: create } = await loadWithConfig({
      foreground: 'custom-blue-A-3',
    });

    const theme = create(lightGrayBlue) as unknown as Record<string, string>;
    expect(theme.foreground).toBe(get(Palette, 'blueA.blueA3'));
  });
});
