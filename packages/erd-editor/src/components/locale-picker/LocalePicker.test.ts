import { FC, html, observable } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestAppContext,
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import LocalePicker, {
  stepOption,
} from '@/components/locale-picker/LocalePicker';
import * as styles from '@/components/locale-picker/LocalePicker.styles';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { LocaleCode, LocaleOption, LOCALES } from '@/i18n/locales';
import { createI18n } from '@/i18n/translate';
import { openLocalePickerAction, setLocaleOptionAction } from '@/utils/emitter';
import { InternalEventType } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

let mounted: Mounted | null = null;
let app: AppContext;
let focusEvents = 0;
/** Every keydown that got past the panel into the stream the editor root feeds. */
let reached: KeyboardEvent[] = [];
const scrolled: Element[] = [];
const { scrollIntoView } = Element.prototype;

const countFocusEvent = () => {
  focusEvents++;
};

beforeEach(() => {
  focusEvents = 0;
  reached = [];
  scrolled.length = 0;
  document.body.addEventListener(InternalEventType.focus, countFocusEvent);
  // happy-dom lays nothing out, so scrolling a row into view is only recorded.
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this);
  };
});

afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  document.body.removeEventListener(InternalEventType.focus, countFocusEvent);
  mounted?.unmount();
  mounted = null;
});

type Props = { option: LocaleOption; systemLocale: LocaleCode };

async function setup(initial: Partial<Props> = {}) {
  app = createTestAppContext();
  const props = observable<Props>({
    option: 'en',
    systemLocale: 'en',
    ...initial,
  });
  const Host: FC<{}> = () => () =>
    html`<${LocalePicker}
      option=${props.option}
      systemLocale=${props.systemLocale}
    />`;

  mounted = await mountAndFlush(html`<${Host} />`, app);
  // The editor root hands every keydown that reaches it to keydown$.
  mounted.container.addEventListener('keydown', event =>
    app.keydown$.next(event)
  );
  app.keydown$.subscribe(event => reached.push(event));
  return { app, props };
}

const open = async () => {
  app.emitter.emit(openLocalePickerAction());
  await flush();
};

const panel = () =>
  mounted!.container.querySelector<HTMLDivElement>('.locale-picker');
const list = () => panel()!.querySelector('[role="listbox"]') as HTMLElement;
const rows = () =>
  Array.from(
    panel()?.querySelectorAll<HTMLButtonElement>('button[role="option"]') ?? []
  );
const row = (option: LocaleOption) =>
  panel()!.querySelector<HTMLButtonElement>(`button[data-locale="${option}"]`)!;
const hint = () =>
  row('system').querySelector(`.${String(styles.hint)}`) as HTMLElement;
const checkedRows = () =>
  rows()
    .filter(el => el.getAttribute('aria-selected') === 'true')
    .map(el => el.dataset.locale);
const isOpen = () => Boolean(app.store.state.editor.openMap[Open.localePicker]);
const active = () =>
  (mounted!.container.getRootNode() as Document).activeElement;

const keydown = async (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  await flush();
  return event;
};

describe('stepOption', () => {
  it('moves one row either way, round either end, and jumps to either end', () => {
    expect(stepOption(0, 26, 'ArrowDown')).toBe(1);
    expect(stepOption(25, 26, 'ArrowDown')).toBe(0);
    expect(stepOption(0, 26, 'ArrowUp')).toBe(25);
    expect(stepOption(4, 26, 'ArrowUp')).toBe(3);
    expect(stepOption(9, 26, 'Home')).toBe(0);
    expect(stepOption(9, 26, 'End')).toBe(25);
    expect(stepOption(9, 26, 'ArrowLeft')).toBeNull();
    expect(stepOption(9, 26, 'a')).toBeNull();
  });
});

describe('LocalePicker', () => {
  describe('opening and closing', () => {
    it('renders nothing while closed', async () => {
      await setup();

      expect(panel()).toBeNull();
      expect(mounted!.container.textContent).toBe('');
    });

    it('opens on openLocalePicker and closes on the next one', async () => {
      await setup();

      await open();
      expect(isOpen()).toBe(true);
      expect(panel()!.getAttribute('class')).toContain(String(styles.root));

      await open();
      expect(isOpen()).toBe(false);
      expect(panel()).toBeNull();
    });

    it('closes the theme builder and Table Properties as it opens', async () => {
      await setup();
      app.store.dispatchSync(
        changeOpenMapAction({
          [Open.themeBuilder]: true,
          [Open.tableProperties]: true,
        })
      );

      await open();

      expect(app.store.state.editor.openMap).toMatchObject({
        [Open.localePicker]: true,
        [Open.themeBuilder]: false,
        [Open.tableProperties]: false,
      });
    });

    it('closes on the stop shortcut and hands the keyboard back', async () => {
      await setup();
      await open();
      focusEvents = 0;

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      await flush();

      expect(isOpen()).toBe(false);
      expect(panel()).toBeNull();
      expect(focusEvents).toBe(1);
    });

    it('leaves the open map and the focus alone on a stop while closed or another shortcut', async () => {
      await setup();

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      await flush();
      expect(app.store.state.editor.openMap).toEqual({});
      expect(focusEvents).toBe(0);

      await open();
      app.shortcut$.next({
        type: KeyBindingName.selectAllTable,
        event: new KeyboardEvent('keydown'),
      });
      await flush();
      expect(isOpen()).toBe(true);
    });

    it('stops answering the toggle and the stop shortcut once unmounted', async () => {
      await setup();
      await open();
      mounted!.unmount();
      mounted = null;
      await flush();

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      app.emitter.emit(openLocalePickerAction());
      await flush();

      expect(isOpen()).toBe(true);
    });
  });

  describe('rows', () => {
    it('lists System, a separator, then the 25 languages in the picker order', async () => {
      await setup();
      await open();

      expect(rows().map(el => el.dataset.locale)).toEqual([
        'system',
        ...LOCALES.map(({ code }) => code),
      ]);
      expect(rows()[0].nextElementSibling).not.toBe(rows()[1]);
      expect(list().children).toHaveLength(27);
    });

    it('names each language in itself, marked with its own language', async () => {
      await setup();
      await open();

      for (const { code, label } of LOCALES) {
        const name = row(code).querySelector(`.${String(styles.label)}`)!;
        expect(name.textContent).toBe(label);
        expect(name.getAttribute('lang')).toBe(code);
      }
      expect(row('ko-KR').textContent).toBe('한국어');
      expect(row('ar-SA').textContent).toBe('العربية');
    });

    it('titles the panel and its list Display Language and the first row System', async () => {
      await setup();
      await open();

      expect(
        panel()!.querySelector(`.${String(styles.title)}`)!.textContent
      ).toBe('Display Language');
      expect(list().getAttribute('aria-label')).toBe('Display Language');
      expect(
        row('system').querySelector(`.${String(styles.label)}`)!.textContent
      ).toBe('System');
      expect(row('system').querySelector('[lang]')).toBe(hint());
    });

    it('reads its own words in the language shown, following a switch', async () => {
      const i18n = createTestI18n('en');
      const provider = provideI18n(document.body, i18n);

      try {
        await setup();
        await open();
        Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
        await flush();

        expect(
          panel()!.querySelector(`.${String(styles.title)}`)!.textContent
        ).toBe('ko:Display Language');
        expect(row('system').textContent).toBe('ko:SystemEnglish');
        expect(row('ko-KR').textContent).toBe('한국어');
      } finally {
        provider.destroy();
      }
    });

    it('checks the option in force alone, and moves the check when it changes', async () => {
      const { props } = await setup({ option: 'ja-JP' });
      await open();

      expect(checkedRows()).toEqual(['ja-JP']);
      expect(iconNameOf(row('ja-JP'))).toBe('check');
      expect(row('en').querySelector('svg')).toBeNull();

      props.option = 'system';
      await flush();

      expect(checkedRows()).toEqual(['system']);
      expect(iconNameOf(row('system'))).toBe('check');
      expect(row('ja-JP').querySelector('svg')).toBeNull();
    });

    it('names the language System stands for beside it, in that language, following a change', async () => {
      const { props } = await setup({ systemLocale: 'de-DE' });
      await open();

      expect(hint().textContent).toBe('Deutsch');
      expect(hint().getAttribute('lang')).toBe('de-DE');
      expect(hint().getAttribute('dir')).toBe('auto');

      props.systemLocale = 'fa-IR';
      await flush();

      expect(hint().textContent).toBe('فارسی');
      expect(hint().getAttribute('lang')).toBe('fa-IR');
    });
  });

  describe('picking', () => {
    it('emits the language clicked, closes and hands the keyboard back', async () => {
      await setup();
      const setLocaleOption = vi.fn();
      app.emitter.on({ setLocaleOption });
      await open();
      focusEvents = 0;

      row('ko-KR').click();
      await flush();

      expect(setLocaleOption.mock.calls.map(([action]) => action)).toEqual([
        setLocaleOptionAction({ locale: 'ko-KR' }),
      ]);
      expect(isOpen()).toBe(false);
      expect(panel()).toBeNull();
      expect(focusEvents).toBe(1);
    });

    it('emits system for the System row, and again for the option already in force', async () => {
      await setup({ option: 'system' });
      const setLocaleOption = vi.fn();
      app.emitter.on({ setLocaleOption });

      await open();
      row('system').click();
      await flush();

      expect(setLocaleOption.mock.calls[0][0].payload).toEqual({
        locale: 'system',
      });
    });
  });

  describe('keyboard', () => {
    it('puts the keyboard on the checked row as it opens, scrolled into view', async () => {
      await setup({ option: 'zh-TW' });
      await open();

      expect(active()).toBe(row('zh-TW'));
      expect(scrolled).toEqual([row('zh-TW')]);
      expect(row('zh-TW').tabIndex).toBe(0);
      expect(rows().filter(el => el.tabIndex === 0)).toHaveLength(1);
    });

    it('moves through the rows with the arrows, round either end, and jumps with Home and End', async () => {
      await setup({ option: 'en' });
      await open();

      await keydown(row('en'), { key: 'ArrowDown' });
      expect(active()).toBe(row('id-ID'));
      expect(row('id-ID').tabIndex).toBe(0);
      expect(row('en').tabIndex).toBe(-1);

      await keydown(row('id-ID'), { key: 'End' });
      expect(active()).toBe(row('ko-KR'));

      await keydown(row('ko-KR'), { key: 'ArrowDown' });
      expect(active()).toBe(row('system'));

      await keydown(row('system'), { key: 'ArrowUp' });
      expect(active()).toBe(row('ko-KR'));

      await keydown(row('ko-KR'), { key: 'Home' });
      expect(active()).toBe(row('system'));
    });

    it('picks the focused row with Enter, and with Space', async () => {
      await setup();
      const setLocaleOption = vi.fn();
      app.emitter.on({ setLocaleOption });

      await open();
      const enter = await keydown(row('fr-FR'), { key: 'Enter' });
      expect(enter.defaultPrevented).toBe(true);
      expect(setLocaleOption.mock.calls[0][0].payload).toEqual({
        locale: 'fr-FR',
      });
      expect(isOpen()).toBe(false);

      await open();
      await keydown(row('he-IL'), { key: ' ', code: 'Space' });
      expect(setLocaleOption.mock.calls[1][0].payload).toEqual({
        locale: 'he-IL',
      });
      expect(isOpen()).toBe(false);
    });

    it('closes on Escape, which it keeps, handing the keyboard back', async () => {
      await setup();
      await open();
      focusEvents = 0;

      const escape = await keydown(row('en'), {
        key: 'Escape',
        code: 'Escape',
      });

      expect(escape.defaultPrevented).toBe(true);
      expect(isOpen()).toBe(false);
      expect(focusEvents).toBe(1);
      expect(reached).toEqual([]);
    });

    it('keeps Space, Enter and the arrows from the editor, while $mod+F reaches it', async () => {
      await setup();
      await open();
      const target = panel()!.querySelector(`.${String(styles.title)}`)!;

      for (const init of [
        { key: ' ', code: 'Space' },
        { key: 'Enter', code: 'Enter' },
        { key: 'ArrowDown', code: 'ArrowDown' },
        { key: 'ArrowLeft', code: 'ArrowLeft' },
        { key: 'Tab', code: 'Tab' },
      ]) {
        await keydown(target, init);
        await keydown(row('en'), { ...init, altKey: true });
      }
      expect(reached).toEqual([]);
      expect(isOpen()).toBe(true);

      await keydown(row('en'), { key: 'f', code: 'KeyF', ctrlKey: true });
      expect(reached.map(({ code }) => code)).toEqual(['KeyF']);
    });

    it('keeps the canvas chords from the editor and lets an unbound key through', async () => {
      await setup();
      await open();

      await keydown(row('en'), { key: 'n', code: 'KeyN', altKey: true });
      await keydown(row('en'), { key: 'Delete', code: 'Delete' });
      expect(reached).toEqual([]);

      await keydown(row('en'), { key: 's', code: 'KeyS', metaKey: true });
      expect(reached.map(({ code }) => code)).toEqual(['KeyS']);
    });

    it('keeps a key the input method is composing', async () => {
      await setup();
      await open();

      await keydown(row('en'), { key: 'Escape', isComposing: true });

      expect(reached).toEqual([]);
      expect(isOpen()).toBe(true);
    });
  });
});
