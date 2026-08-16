import { get } from 'lodash-es';
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
    expect(theme.tableBorder).toBe('#d9d9d9');
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
    expect(createTheme(lightGrayBlue).minimapBorder).toBe('black');
    expect(createTheme(lightGrayBlue).minimapShadow).toBe('black');
    expect(createTheme(darkGrayBlue).minimapBorder).toBe('black');
    expect(createTheme(darkGrayBlue).minimapShadow).toBe('black');
  });

  it('resolves custom key colors from their own palette, ignoring gray/accent', () => {
    const light = createTheme(lightGrayBlue);
    const dark = createTheme(darkGrayBlue);

    expect(light.keyPK).toBe('#ffc53d');
    expect(light.keyFK).toBe('#e54666');
    expect(light.keyPFK).toBe('#00a2c7');
    // step 9 is the only radix step that is identical in light and dark
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

describe('createTheme with unusual config entries', () => {
  afterEach(() => {
    vi.doUnmock('@/themes/radix-ui-theme.config');
    vi.resetModules();
  });

  const loadWithConfig = async (config: Record<string, string>) => {
    vi.resetModules();
    vi.doMock('@/themes/radix-ui-theme.config', () => ({
      ThemeConfig: config,
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
