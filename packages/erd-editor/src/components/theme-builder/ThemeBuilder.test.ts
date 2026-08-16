import { html } from '@dineug/r-html';
import { get } from 'lodash-es';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import ThemeBuilder from '@/components/theme-builder/ThemeBuilder';
import * as styles from '@/components/theme-builder/ThemeBuilder.styles';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  GrayColor,
  GrayColorList,
  Palette,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { openThemeBuilderAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const defaultTheme: ThemeOptions = {
  appearance: Appearance.dark,
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
};

type Options = {
  theme?: Partial<ThemeOptions>;
  open?: boolean;
};

async function setup({ theme, open = true }: Options = {}) {
  const app = createTestAppContext();
  if (open) {
    app.store.dispatchSync(changeOpenMapAction({ [Open.themeBuilder]: true }));
  }

  mounted = await mountAndFlush(
    html`<${ThemeBuilder} theme=${{ ...defaultTheme, ...theme }} />`,
    app
  );
  return mounted;
}

const root = () =>
  mounted!.container.querySelector('.theme-builder') as HTMLDivElement;

const byStyle = (className: string) =>
  Array.from(root().querySelectorAll<HTMLElement>('div, span')).filter(el =>
    el.classList.contains(className)
  );

const palettes = () => byStyle(String(styles.palette));
const swatches = (index: number) =>
  Array.from(palettes()[index].querySelectorAll<HTMLElement>('span'));
const appearanceButtons = () => byStyle(String(styles.lightDarkButton));

/** Normalizes a CSS color the way the DOM would after assignment. */
const asCssColor = (value: string) => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = value;
  return probe.style.backgroundColor;
};

describe('ThemeBuilder', () => {
  describe('open state', () => {
    it('renders nothing while the theme builder is closed', async () => {
      await setup({ open: false });

      expect(root()).toBeNull();
      expect(mounted!.container.textContent).not.toContain('Theme');
    });

    it('renders the panel once the open map turns it on', async () => {
      const { app } = await setup({ open: false });

      app.store.dispatchSync(
        changeOpenMapAction({ [Open.themeBuilder]: true })
      );
      await flush();

      expect(root()).toBeTruthy();
      expect(root().getAttribute('class')).toContain(String(styles.root));
    });

    it('unrenders the panel when the open map turns it off again', async () => {
      const { app } = await setup();
      expect(root()).toBeTruthy();

      app.store.dispatchSync(
        changeOpenMapAction({ [Open.themeBuilder]: false })
      );
      await flush();

      expect(root()).toBeNull();
    });
  });

  describe('rendering', () => {
    it('renders the heading and the three section subtitles', async () => {
      await setup();
      const subTitles = byStyle(String(styles.subTitle)).map(
        el => el.textContent
      );

      expect(byStyle(String(styles.title))[0].textContent).toBe('Theme');
      expect(subTitles).toEqual(['Accent color', 'Gray color', 'Appearance']);
    });

    it('renders one swatch per accent color and one per gray color', async () => {
      await setup();

      expect(palettes()).toHaveLength(2);
      expect(swatches(0)).toHaveLength(AccentColorList.length);
      expect(swatches(1)).toHaveLength(GrayColorList.length);
    });

    it('titles every swatch with its palette key', async () => {
      await setup();

      expect(swatches(0).map(el => el.getAttribute('title'))).toEqual(
        AccentColorList
      );
      expect(swatches(1).map(el => el.getAttribute('title'))).toEqual(
        GrayColorList
      );
    });

    it('paints each swatch with the step 9 color of its scale', async () => {
      await setup();
      const accent = swatches(0);

      accent.forEach((el, index) => {
        const key = AccentColorList[index];
        const expected = get(Palette, [key, `${key}9`]) as string;

        expect(expected).toBeTruthy();
        expect(el.style.backgroundColor).toBe(asCssColor(expected));
      });
      expect(swatches(1)[0].style.backgroundColor).toBe(
        asCssColor(get(Palette, ['gray', 'gray9']) as string)
      );
    });

    it('marks only the current accent and gray swatches as selected', async () => {
      await setup({
        theme: { accentColor: AccentColor.tomato, grayColor: GrayColor.sand },
      });

      const selectedAccent = swatches(0).filter(el =>
        el.classList.contains('selected')
      );
      const selectedGray = swatches(1).filter(el =>
        el.classList.contains('selected')
      );

      expect(selectedAccent.map(el => el.getAttribute('title'))).toEqual([
        AccentColor.tomato,
      ]);
      expect(selectedGray.map(el => el.getAttribute('title'))).toEqual([
        GrayColor.sand,
      ]);
    });

    it('renders the light and dark buttons with their icons and labels', async () => {
      await setup();
      const [light, dark] = appearanceButtons();

      expect(appearanceButtons()).toHaveLength(2);
      expect(light.textContent).toContain('Light');
      expect(dark.textContent).toContain('Dark');
      expect(light.querySelector('.icon svg')).toBeTruthy();
      expect(dark.querySelector('.icon svg')).toBeTruthy();
      expect(byStyle(String(styles.vertical))).toHaveLength(2);
    });

    it('selects the dark button for a dark appearance', async () => {
      await setup({ theme: { appearance: Appearance.dark } });
      const [light, dark] = appearanceButtons();

      expect(light.classList.contains('selected')).toBe(false);
      expect(dark.classList.contains('selected')).toBe(true);
    });

    it('selects the light button for a light appearance', async () => {
      await setup({ theme: { appearance: Appearance.light } });
      const [light, dark] = appearanceButtons();

      expect(light.classList.contains('selected')).toBe(true);
      expect(dark.classList.contains('selected')).toBe(false);
    });
  });

  describe('emitting theme options', () => {
    it('emits the clicked accent color', async () => {
      const { app } = await setup();
      const setThemeOptions = vi.fn();
      app.emitter.on({ setThemeOptions });

      swatches(0)[AccentColorList.indexOf(AccentColor.jade)].click();

      expect(setThemeOptions).toHaveBeenCalledTimes(1);
      expect(setThemeOptions.mock.calls[0][0]).toEqual({
        type: 'setThemeOptions',
        payload: { accentColor: AccentColor.jade },
      });
    });

    it('emits the clicked gray color', async () => {
      const { app } = await setup();
      const setThemeOptions = vi.fn();
      app.emitter.on({ setThemeOptions });

      swatches(1)[GrayColorList.indexOf(GrayColor.olive)].click();

      expect(setThemeOptions.mock.calls[0][0].payload).toEqual({
        grayColor: GrayColor.olive,
      });
    });

    it('emits the light appearance when the light button is clicked', async () => {
      const { app } = await setup({ theme: { appearance: Appearance.dark } });
      const setThemeOptions = vi.fn();
      app.emitter.on({ setThemeOptions });

      appearanceButtons()[0].click();

      expect(setThemeOptions.mock.calls[0][0].payload).toEqual({
        appearance: Appearance.light,
      });
    });

    it('emits the dark appearance when the dark button is clicked', async () => {
      const { app } = await setup({ theme: { appearance: Appearance.light } });
      const setThemeOptions = vi.fn();
      app.emitter.on({ setThemeOptions });

      appearanceButtons()[1].click();

      expect(setThemeOptions.mock.calls[0][0].payload).toEqual({
        appearance: Appearance.dark,
      });
    });

    it('leaves the store untouched when only a theme option changes', async () => {
      const { app } = await setup();

      appearanceButtons()[0].click();
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);
    });
  });

  describe('shortcut handling', () => {
    it('closes the panel on the stop shortcut', async () => {
      const { app } = await setup();

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
      expect(root()).toBeNull();
    });

    it('ignores shortcuts other than stop', async () => {
      const { app } = await setup();

      app.shortcut$.next({
        type: KeyBindingName.selectAllTable,
        event: new KeyboardEvent('keydown'),
      });
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);
      expect(root()).toBeTruthy();
    });
  });

  describe('openThemeBuilder toggling', () => {
    it('opens the panel and closes table properties', async () => {
      const { app } = await setup({ open: false });
      app.store.dispatchSync(
        changeOpenMapAction({ [Open.tableProperties]: true })
      );

      app.emitter.emit(openThemeBuilderAction());
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);
      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
      expect(root()).toBeTruthy();
    });

    it('closes the panel and leaves table properties alone', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        changeOpenMapAction({ [Open.tableProperties]: true })
      );

      app.emitter.emit(openThemeBuilderAction());
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
      expect(root()).toBeNull();
    });

    it('stops reacting to the toggle after unmount', async () => {
      const { app } = await setup({ open: false });
      mounted!.unmount();
      mounted = null;
      await flush();

      app.emitter.emit(openThemeBuilderAction());
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBeUndefined();
    });

    it('stops reacting to the stop shortcut after unmount', async () => {
      const { app } = await setup();
      mounted!.unmount();
      mounted = null;
      await flush();

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown'),
      });
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);
    });
  });
});
