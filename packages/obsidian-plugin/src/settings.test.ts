import { AccentColor, GrayColor } from '@dineug/erd-editor-webview-bridge';
import { describe, expect, it } from 'vite-plus/test';

import {
  ACCENT_COLORS,
  APPEARANCES,
  DEFAULT_SETTINGS,
  editorTheme,
  GRAY_COLORS,
  readSettings,
  readTheme,
  themeFromBuilder,
  type ThemeSettings,
} from '@/settings';

const DEFAULTS = {
  agentHub: true,
  appearance: 'auto',
  grayColor: 'slate',
  accentColor: 'indigo',
};

describe('readSettings', () => {
  it('turns coding agents on and follows Obsidian in slate and indigo when nothing was saved', () => {
    expect(DEFAULT_SETTINGS).toEqual(DEFAULTS);
    expect(readSettings(null)).toEqual(DEFAULTS);
    expect(readSettings(undefined)).toEqual(DEFAULTS);
    expect(readSettings('text')).toEqual(DEFAULTS);
  });

  it('keeps what was saved', () => {
    const saved = {
      agentHub: false,
      appearance: 'light',
      grayColor: 'sand',
      accentColor: 'crimson',
    };
    expect(readSettings(saved)).toEqual(saved);
    expect(readSettings({ appearance: 'dark' })).toEqual({
      ...DEFAULTS,
      appearance: 'dark',
    });
  });

  it('takes the default for each field that is missing, unknown or of another type', () => {
    expect(
      readSettings({
        agentHub: 'no',
        appearance: 'system',
        grayColor: 'indigo',
        accentColor: 7,
        other: 1,
      })
    ).toEqual(DEFAULTS);
    // An accent that is no gray, and a name the prototype carries.
    expect(readSettings({ grayColor: 'toString' }).grayColor).toBe('slate');
    expect(readSettings({ accentColor: 'constructor' }).accentColor).toBe(
      'indigo'
    );
  });

  it('allows the values webview-bridge names and auto, nothing else', () => {
    expect(APPEARANCES).toEqual(['auto', 'light', 'dark']);
    expect(GRAY_COLORS).toEqual(Object.values(GrayColor));
    expect(GRAY_COLORS).toHaveLength(6);
    expect(ACCENT_COLORS).toEqual(Object.values(AccentColor));
    expect(ACCENT_COLORS).toHaveLength(26);
    for (const accentColor of ACCENT_COLORS) {
      expect(readSettings({ accentColor }).accentColor).toBe(accentColor);
    }
  });
});

describe('readTheme', () => {
  it('falls back field by field to the theme it is given', () => {
    const fallback: ThemeSettings = {
      appearance: 'dark',
      grayColor: 'olive',
      accentColor: 'teal',
    };
    expect(readTheme({ accentColor: 'ruby' }, fallback)).toEqual({
      ...fallback,
      accentColor: 'ruby',
    });
    expect(readTheme(null, fallback)).toEqual(fallback);
  });
});

describe('editorTheme', () => {
  const theme: ThemeSettings = {
    appearance: 'auto',
    grayColor: 'sage',
    accentColor: 'jade',
  };

  it('hands auto over as system, beside the light or dark Obsidian shows', () => {
    expect(editorTheme(theme, true)).toEqual({
      appearance: 'system',
      grayColor: 'sage',
      accentColor: 'jade',
      systemAppearance: 'dark',
    });
    expect(editorTheme(theme, false).systemAppearance).toBe('light');
  });

  it('keeps light and dark whatever Obsidian shows', () => {
    expect(editorTheme({ ...theme, appearance: 'light' }, true)).toEqual({
      appearance: 'light',
      grayColor: 'sage',
      accentColor: 'jade',
      systemAppearance: 'dark',
    });
    expect(
      editorTheme({ ...theme, appearance: 'dark' }, false).appearance
    ).toBe('dark');
  });
});

describe('themeFromBuilder', () => {
  const auto: ThemeSettings = {
    appearance: 'auto',
    grayColor: 'slate',
    accentColor: 'indigo',
  };

  it("keeps the builder's system as auto", () => {
    expect(
      themeFromBuilder(
        { ...auto, appearance: 'light' },
        { appearance: 'system', grayColor: 'slate', accentColor: 'crimson' }
      )
    ).toEqual({
      appearance: 'auto',
      grayColor: 'slate',
      accentColor: 'crimson',
    });
  });

  it('keeps auto while the builder picks a color under system', () => {
    expect(
      themeFromBuilder(auto, {
        appearance: 'system',
        grayColor: 'sand',
        accentColor: 'indigo',
      })
    ).toEqual({ appearance: 'auto', grayColor: 'sand', accentColor: 'indigo' });
  });

  it('takes the light or dark the builder picked over auto', () => {
    expect(
      themeFromBuilder(auto, {
        appearance: 'light',
        grayColor: 'slate',
        accentColor: 'indigo',
      })
    ).toEqual({ ...auto, appearance: 'light' });
    expect(
      themeFromBuilder(auto, {
        appearance: 'dark',
        grayColor: 'mauve',
        accentColor: 'sky',
      })
    ).toEqual({ appearance: 'dark', grayColor: 'mauve', accentColor: 'sky' });
  });

  it('keeps the current value for anything the detail lacks or holds wrong', () => {
    expect(themeFromBuilder(auto, null)).toEqual(auto);
    expect(
      themeFromBuilder(auto, { appearance: 'dim', accentColor: 'plaid' })
    ).toEqual(auto);
  });
});
