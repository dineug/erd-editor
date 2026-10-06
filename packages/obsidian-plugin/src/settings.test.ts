import {
  AccentColor,
  GrayColor,
  LocaleLabel,
} from '@dineug/erd-editor-webview-bridge';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  ACCENT_COLORS,
  APPEARANCES,
  DEFAULT_SETTINGS,
  editorLocale,
  editorTheme,
  GRAY_COLORS,
  LOCALE_NAMES,
  localeFromPicker,
  LOCALES,
  obsidianLanguage,
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
  locale: 'auto',
};

describe('readSettings', () => {
  it("turns coding agents on and follows Obsidian's theme and language, in slate and indigo, when nothing was saved", () => {
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
      locale: 'ko-KR',
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
        locale: 'system',
        other: 1,
      })
    ).toEqual(DEFAULTS);
    // The editor's own spelling, a bare language and another case are no setting.
    for (const locale of ['system', 'ko', 'KO-KR', 'pt', null, 1]) {
      expect(readSettings({ locale }).locale).toBe('auto');
    }
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

describe('LOCALES', () => {
  it('lists auto, then every language webview-bridge names, in its order', () => {
    expect(LOCALES).toEqual(['auto', ...Object.keys(LocaleLabel)]);
    expect(LOCALES).toHaveLength(26);
    expect(LOCALES.slice(0, 3)).toEqual(['auto', 'en', 'id-ID']);
    expect(LOCALES.at(-1)).toBe('ko-KR');
    for (const locale of LOCALES) {
      expect(readSettings({ locale }).locale).toBe(locale);
    }
  });

  it('names Auto, then each language by its own name, in the same order', () => {
    expect(Object.keys(LOCALE_NAMES)).toEqual(LOCALES);
    expect(Object.values(LOCALE_NAMES)).toEqual([
      'Auto',
      ...Object.values(LocaleLabel),
    ]);
    expect(LOCALE_NAMES['ko-KR']).toBe('한국어');
    expect(LOCALE_NAMES['pt-PT']).toBe('Português');
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

describe('editorLocale', () => {
  it("hands auto over as system, beside Obsidian's language", () => {
    expect(editorLocale('auto', 'ja')).toEqual({
      locale: 'system',
      systemLocale: 'ja',
    });
    expect(editorLocale('auto', null)).toEqual({
      locale: 'system',
      systemLocale: null,
    });
  });

  it("keeps a named language whatever Obsidian's is", () => {
    expect(editorLocale('fa-IR', 'de')).toEqual({
      locale: 'fa-IR',
      systemLocale: 'de',
    });
  });
});

describe('localeFromPicker', () => {
  it("keeps the picker's system as auto", () => {
    expect(localeFromPicker('ko-KR', { locale: 'system' })).toBe('auto');
  });

  it('takes the language the picker picked, the current one too', () => {
    expect(localeFromPicker('auto', { locale: 'he-IL' })).toBe('he-IL');
    expect(localeFromPicker('he-IL', { locale: 'he-IL' })).toBe('he-IL');
  });

  it('keeps the current value for a detail that is missing or names no language', () => {
    expect(localeFromPicker('de-DE', null)).toBe('de-DE');
    expect(localeFromPicker('de-DE', {})).toBe('de-DE');
    expect(localeFromPicker('auto', { locale: 'ko' })).toBe('auto');
    expect(localeFromPicker('auto', { locale: 'toString' })).toBe('auto');
  });
});

describe('obsidianLanguage', () => {
  const storageOf = (language: string | null) => ({
    getItem: vi.fn((key: string) => (key === 'language' ? language : null)),
  });

  it('reads getLanguage where Obsidian has it, never the storage', () => {
    const storage = storageOf('fr');
    expect(obsidianLanguage(() => 'ja', storage)).toBe('ja');
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('reads the language Obsidian keeps in localStorage where getLanguage is missing', () => {
    const storage = storageOf('zh-TW');
    expect(obsidianLanguage(undefined, storage)).toBe('zh-TW');
    expect(storage.getItem).toHaveBeenCalledWith('language');
  });

  it("is null where neither names one, which leaves the editor to the browser's languages", () => {
    expect(obsidianLanguage(undefined, storageOf(null))).toBeNull();
    expect(obsidianLanguage(() => '', storageOf('fr'))).toBeNull();
  });

  it("reads Obsidian's pt as European Portuguese, from either source", () => {
    expect(obsidianLanguage(() => 'pt', storageOf(null))).toBe('pt-PT');
    expect(obsidianLanguage(undefined, storageOf('pt'))).toBe('pt-PT');
  });

  it('hands every other language over as Obsidian names it', () => {
    expect(obsidianLanguage(() => 'pt-BR', storageOf(null))).toBe('pt-BR');
    expect(obsidianLanguage(() => 'zh', storageOf(null))).toBe('zh');
    expect(obsidianLanguage(undefined, storageOf('en-GB'))).toBe('en-GB');
  });
});
