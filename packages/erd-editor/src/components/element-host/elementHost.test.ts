import { FC, html, observable, render } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { flush, pseudoMessages } from '@/__test-utils__/index';
import {
  LocaleHostOptions,
  useLocaleHost,
} from '@/components/element-host/localeHost';
import { useThemeHost } from '@/components/element-host/themeHost';
import type { LocaleCode, LocaleOption } from '@/i18n/locales';
import { messagesOf } from '@/i18n/messages/index';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
  SYSTEM_APPEARANCE,
} from '@/themes/radix-ui-theme';

type MediaListener = (event: { matches: boolean }) => void;

let mediaListeners: MediaListener[] = [];
let mediaMatches = false;

function fireMediaChange(matches: boolean) {
  mediaMatches = matches;
  mediaListeners.forEach(listener => listener({ matches }));
}

let unmounts: Array<() => void> = [];

/** Runs a host hook at a component's setup, as an element's root does, and mounts it. */
async function mountHost<T>(use: () => T) {
  let api!: T;
  const Host: FC<{}, HTMLElement> = () => {
    api = use();
    return () => html`<div></div>`;
  };

  const container = document.createElement('div');
  document.body.append(container);
  render(container, html`<${Host} />`);
  await flush();

  const unmount = () => {
    render(container, null);
    container.remove();
  };
  unmounts.push(unmount);
  return { api, unmount };
}

beforeEach(() => {
  mediaListeners = [];
  mediaMatches = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return mediaMatches;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: MediaListener) => {
      mediaListeners.push(listener);
    },
    removeEventListener: (_type: string, listener: MediaListener) => {
      mediaListeners = mediaListeners.filter(item => item !== listener);
    },
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  unmounts.forEach(unmount => unmount());
  unmounts = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useThemeHost', () => {
  const darkPreset = createTheme({
    grayColor: GrayColor.slate,
    accentColor: AccentColor.indigo,
    appearance: Appearance.dark,
  });

  it('starts from the slate, indigo and dark preset', async () => {
    const { api } = await mountHost(useThemeHost);

    expect(api.themeState.options).toEqual({
      grayColor: 'slate',
      accentColor: 'indigo',
      appearance: 'dark',
    });
    expect(api.themeState.systemAppearance).toBeNull();
    expect(api.followsSystem()).toBe(false);
    expect(api.hasDarkMode()).toBe(true);
    expect({ ...api.theme }).toEqual(darkPreset);
  });

  it('takes only the preset options it knows and repaints the theme', async () => {
    const { api } = await mountHost(useThemeHost);

    api.setPresetTheme({
      grayColor: GrayColor.sage,
      accentColor: 'not-a-color' as any,
      appearance: 42 as any,
    });
    await flush();

    expect(api.themeState.options).toEqual({
      grayColor: 'sage',
      accentColor: 'indigo',
      appearance: 'dark',
    });
    expect({ ...api.theme }).toEqual(
      createTheme({
        grayColor: GrayColor.sage,
        accentColor: AccentColor.indigo,
        appearance: Appearance.dark,
      })
    );

    api.setPresetTheme({
      grayColor: 'not-a-gray' as any,
      accentColor: AccentColor.tomato,
      appearance: Appearance.light,
    });
    await flush();

    expect(api.themeState.options).toEqual({
      grayColor: 'sage',
      accentColor: 'tomato',
      appearance: 'light',
    });
    expect(api.hasDarkMode()).toBe(false);
  });

  it('shows the OS color scheme under system until a host names what system shows', async () => {
    const { api } = await mountHost(useThemeHost);

    api.setPresetTheme({ appearance: SYSTEM_APPEARANCE });
    await flush();
    expect(api.followsSystem()).toBe(true);
    expect(api.resolveAppearance()).toBe('light');
    expect(api.theme.canvasBackground).not.toBe(darkPreset.canvasBackground);

    fireMediaChange(true);
    await flush();
    expect(api.resolveAppearance()).toBe('dark');
    expect(api.theme.canvasBackground).toBe(darkPreset.canvasBackground);

    fireMediaChange(false);
    api.setSystemAppearance(Appearance.dark);
    await flush();
    expect(api.themeState.systemAppearance).toBe('dark');
    expect(api.hasDarkMode()).toBe(true);
    expect(api.theme.canvasBackground).toBe(darkPreset.canvasBackground);

    fireMediaChange(true);
    await flush();
    fireMediaChange(false);
    await flush();
    expect(api.hasDarkMode()).toBe(true);
    expect(api.theme.canvasBackground).toBe(darkPreset.canvasBackground);

    api.setSystemAppearance('dim' as any);
    await flush();
    expect(api.themeState.systemAppearance).toBeNull();
    expect(api.hasDarkMode()).toBe(false);
    expect(api.theme.canvasBackground).not.toBe(darkPreset.canvasBackground);
  });

  it('leaves a light or dark as it is when the OS or a host names what system shows', async () => {
    const { api } = await mountHost(useThemeHost);

    fireMediaChange(true);
    api.setSystemAppearance(Appearance.light);
    await flush();

    expect(api.themeState.options.appearance).toBe('dark');
    expect(api.hasDarkMode()).toBe(true);
    expect({ ...api.theme }).toEqual(darkPreset);
  });

  it('keeps only string tokens it knows from setTheme, over a later preset too', async () => {
    const { api } = await mountHost(useThemeHost);

    api.setTheme({
      canvasBackground: '#123456',
      tableBackground: 999 as any,
      notAToken: '#ffffff',
    } as any);
    await flush();

    expect(api.themeState.custom).toEqual({ canvasBackground: '#123456' });
    expect(api.theme.canvasBackground).toBe('#123456');
    expect(api.theme.tableBackground).toBe(darkPreset.tableBackground);
    expect(Reflect.has(api.theme, 'notAToken')).toBe(false);

    api.setPresetTheme({ appearance: Appearance.light });
    await flush();

    expect(api.theme.canvasBackground).toBe('#123456');
    expect(api.theme.tableBackground).not.toBe(darkPreset.tableBackground);
  });

  it('starts on the options an element hands in, system on the OS color scheme from the first frame', async () => {
    mediaMatches = false;
    const light = await mountHost(() =>
      useThemeHost({ appearance: SYSTEM_APPEARANCE })
    );

    expect(light.api.themeState.options.appearance).toBe('system');
    expect(light.api.followsSystem()).toBe(true);
    expect(light.api.hasDarkMode()).toBe(false);
    expect(light.api.theme.canvasBackground).not.toBe(
      darkPreset.canvasBackground
    );

    mediaMatches = true;
    let firstFrame = '';
    const dark = await mountHost(() => {
      const host = useThemeHost({ appearance: SYSTEM_APPEARANCE });
      firstFrame = host.theme.canvasBackground;
      return host;
    });

    expect(firstFrame).toBe(darkPreset.canvasBackground);
    expect(dark.api.hasDarkMode()).toBe(true);
  });

  it('lets the OS color scheme go on destroy while mounted, and takes it up on no later mount', async () => {
    const { api, unmount } = await mountHost(() =>
      useThemeHost({ appearance: SYSTEM_APPEARANCE })
    );
    expect(mediaListeners).toHaveLength(1);

    api.destroy();
    expect(mediaListeners).toHaveLength(0);

    unmount();
    expect(mediaListeners).toHaveLength(0);
  });

  it('stops repainting once destroyed and lets the OS color scheme go on unmount', async () => {
    const { api, unmount } = await mountHost(useThemeHost);
    expect(mediaListeners).toHaveLength(1);

    api.destroy();
    api.setPresetTheme({ appearance: Appearance.light });
    api.setTheme({ canvasBackground: '#123456' });
    await flush();

    expect(api.themeState.options.appearance).toBe('light');
    expect({ ...api.theme }).toEqual(darkPreset);

    unmount();
    expect(mediaListeners).toHaveLength(0);
  });
});

describe('useLocaleHost', () => {
  /** A language source a spec changes, as useNavigatorLanguages copies the browser's. */
  const createLanguages = (initial: string[]) =>
    observable({ languages: initial }, { shallow: true });

  const mountLocaleHost = (options: Partial<LocaleHostOptions> = {}) =>
    mountHost(() =>
      useLocaleHost({
        messagesOf,
        languages: { state: createLanguages(['en-US']) },
        fallbackOption: () => 'en',
        ...options,
      })
    );

  it('shows the fallback option with nothing set, and reads system from the tags handed in', async () => {
    const { api } = await mountLocaleHost({
      languages: { state: createLanguages(['ko-KR']) },
    });

    expect(api.localeState).toEqual({ option: null, systemTag: null });
    expect(api.resolveLocaleOption()).toBe('en');
    expect(api.resolveSystemLocale()).toBe('ko-KR');
    expect(api.i18n.locale).toBe('en');
    expect(api.i18n.t('common.close')).toBe('Close');
  });

  it('takes each language from the dictionary source, into the one I18n object', async () => {
    const source = vi.fn((code: LocaleCode) => pseudoMessages(code));
    const { api } = await mountLocaleHost({ messagesOf: source });
    const i18n = api.i18n;

    expect(source).toHaveBeenCalledWith('en');
    expect(api.i18n.t('common.close')).toBe('en:Close');

    api.setLocale('ja-JP');

    expect(source).toHaveBeenLastCalledWith('ja-JP');
    expect(api.i18n).toBe(i18n);
    expect(api.i18n.locale).toBe('ja-JP');
    expect(api.i18n.t('common.close')).toBe('ja-JP:Close');
  });

  it('applies a language before setLocale returns, asks for no dictionary it shows, and ignores a non-option', async () => {
    const source = vi.fn(messagesOf);
    const { api } = await mountLocaleHost({ messagesOf: source });

    api.setLocale('ar-SA');
    expect(api.i18n.locale).toBe('ar-SA');
    expect(api.i18n.dir).toBe('rtl');

    source.mockClear();
    api.setLocale('ar-SA');
    api.setLocale('ko' as any);
    api.setLocale(7 as any);
    await flush();

    expect(api.localeState.option).toBe('ar-SA');
    expect(api.i18n.locale).toBe('ar-SA');
    expect(source).not.toHaveBeenCalled();
  });

  it('follows the tags handed in under system, a tag a host names standing over them', async () => {
    const languages = createLanguages(['en-US']);
    const { api } = await mountLocaleHost({
      languages: { state: languages },
      fallbackOption: () => 'system',
    });
    expect(api.i18n.locale).toBe('en');

    languages.languages = ['pl-PL', 'en'];
    await flush();
    expect(api.i18n.locale).toBe('pl-PL');

    api.setSystemLocale('  tr ');
    expect(api.localeState.systemTag).toBe('tr');
    expect(api.i18n.locale).toBe('tr-TR');

    languages.languages = ['sv-SE'];
    await flush();
    expect(api.i18n.locale).toBe('tr-TR');

    api.setSystemLocale('   ');
    expect(api.localeState.systemTag).toBeNull();
    expect(api.i18n.locale).toBe('sv-SE');

    api.setSystemLocale(42 as any);
    expect(api.localeState.systemTag).toBeNull();
    expect(api.i18n.locale).toBe('sv-SE');
  });

  it('resolves again before mount, so a fallback changed at setup is in the first render', async () => {
    let fallback: LocaleOption = 'en';
    const locales: string[] = [];
    const Host: FC<{}, HTMLElement> = () => {
      const { i18n } = useLocaleHost({
        messagesOf,
        languages: { state: createLanguages(['en-US']) },
        fallbackOption: () => fallback,
      });
      fallback = 'de-DE';

      return () => {
        locales.push(i18n.locale);
        return html`<div></div>`;
      };
    };

    const container = document.createElement('div');
    document.body.append(container);
    render(container, html`<${Host} />`);
    unmounts.push(() => {
      render(container, null);
      container.remove();
    });
    await flush();

    expect(locales[0]).toBe('de-DE');
  });

  it('stops following the option, the tag and the tags handed in once destroyed', async () => {
    const languages = createLanguages(['en-US']);
    const { api } = await mountLocaleHost({
      languages: { state: languages },
      fallbackOption: () => 'system',
    });

    api.destroy();
    languages.languages = ['pl-PL'];
    api.localeState.option = 'ko-KR';
    await flush();

    expect(api.i18n.locale).toBe('en');
  });
});

describe('useLocaleHost with a dictionary that loads', () => {
  type Loading = {
    code: LocaleCode;
    resolve: () => void;
    reject: () => void;
  };

  /** A source that hands English over at once and holds every other language until the spec lets it land. */
  function createLoadingSource() {
    const loads: Loading[] = [];
    const messagesOf = vi.fn((code: LocaleCode) => {
      if (code === 'en') return pseudoMessages('en');

      return new Promise<ReturnType<typeof pseudoMessages>>(
        (resolve, reject) => {
          loads.push({
            code,
            resolve: () => resolve(pseudoMessages(code)),
            reject: () => reject(new Error('offline')),
          });
        }
      );
    });
    const loadOf = (code: LocaleCode) => {
      const load = loads.find(item => item.code === code);
      if (!load) throw new Error(`no load of ${code}`);
      return load;
    };
    return { messagesOf, loadOf, loads };
  }

  const mountLoading = (
    source: ReturnType<typeof createLoadingSource>,
    languages: string[] = ['en-US']
  ) =>
    mountHost(() =>
      useLocaleHost({
        messagesOf: source.messagesOf,
        languages: { state: observable({ languages }, { shallow: true }) },
        fallbackOption: () => 'system',
      })
    );

  it('shows English while a language loads, then that language, and resolves once it is in force', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source);

    const switched = api.setLocale('ko-KR');
    let done = false;
    void switched.then(() => (done = true));
    await flush();

    expect(api.i18n.locale).toBe('en');
    expect(api.i18n.t('common.close')).toBe('en:Close');
    expect(done).toBe(false);

    source.loadOf('ko-KR').resolve();
    await switched;

    expect(api.i18n.locale).toBe('ko-KR');
    expect(api.i18n.t('common.close')).toBe('ko-KR:Close');
    await expect(api.setLocale('ko-KR')).resolves.toBeUndefined();
    expect(source.loads).toHaveLength(1);
  });

  it('keeps the language asked for last when an earlier one lands after it', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source);

    const first = api.setLocale('ja-JP');
    const second = api.setLocale('de-DE');
    source.loadOf('de-DE').resolve();
    await second;
    source.loadOf('ja-JP').resolve();
    await first;

    expect(api.i18n.locale).toBe('de-DE');
  });

  it('falls back to English for a language whose load fails', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source);

    api.setLocale('ar-SA');
    source.loadOf('ar-SA').resolve();
    await api.setLocale('ar-SA');
    expect(api.i18n.dir).toBe('rtl');

    await api.setSystemLocale('fr');
    expect(api.i18n.locale).toBe('ar-SA');

    const failing = api.setLocale('system');
    source.loadOf('fr-FR').reject();
    await failing;

    expect(api.i18n.locale).toBe('en');
    expect(api.i18n.dir).toBe('ltr');
    expect(api.i18n.t('common.close')).toBe('en:Close');
  });

  it('loads a language again when it is asked for after its load failed', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source);

    const failing = api.setLocale('ko-KR');
    source.loadOf('ko-KR').reject();
    await failing;
    expect(api.i18n.locale).toBe('en');

    const retried = api.setLocale('ko-KR');
    expect(source.loads).toHaveLength(2);
    source.loads[1].resolve();
    await retried;

    expect(api.i18n.locale).toBe('ko-KR');
  });

  it('starts in English when the language resolved at setup still loads, and shows it once it lands', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source, ['pl-PL']);

    expect(api.i18n.locale).toBe('en');

    source.loadOf('pl-PL').resolve();
    await api.applyLocale();

    expect(api.i18n.locale).toBe('pl-PL');
  });

  it('drops a dictionary that lands once the host is destroyed', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source);

    const switched = api.setLocale('sv-SE');
    api.destroy();
    source.loadOf('sv-SE').resolve();
    await switched;

    expect(api.i18n.locale).toBe('en');
  });

  it('asks for no dictionary and changes no language once destroyed', async () => {
    const source = createLoadingSource();
    const { api } = await mountLoading(source);

    api.destroy();
    await api.setLocale('ko-KR');
    await api.setSystemLocale('ja');
    await api.applyLocale();

    expect(source.loads).toEqual([]);
    expect(api.i18n.locale).toBe('en');
  });

  it('refuses a source that does not hand English over at once', async () => {
    const messagesOf = () => Promise.resolve(pseudoMessages('en'));
    let thrown: unknown = null;

    await mountHost(() => {
      try {
        return useLocaleHost({
          messagesOf,
          languages: { state: createLanguagesOf(['ko-KR']) },
          fallbackOption: () => 'system',
        });
      } catch (error) {
        thrown = error;
        return null;
      }
    });

    expect(String(thrown)).toContain('hands English over at once');
  });
});

function createLanguagesOf(languages: string[]) {
  return observable({ languages }, { shallow: true });
}
