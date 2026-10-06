import { FC, html, observable, render, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { AppContext, appContext } from '@/components/appContext';
import { ARROW_UP } from '@/components/erd/welcome-screen/welcome-hints/hintArrows';
import { ARROW_UP_BOX } from '@/components/erd/welcome-screen/welcomeLayout';
import WelcomeScreen, {
  rowIcon,
} from '@/components/erd/welcome-screen/WelcomeScreen';
import { coveredWidth } from '@/components/find-replace/panelLayout';
import { iconMap } from '@/components/primitives/icon/icons';
import { Lnb } from '@/components/settings/settings-lnb/SettingsLnb';
import { takeSettingsPage } from '@/components/settings/settingsPage';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { createI18n, type I18n } from '@/i18n/translate';
import { setImportFileCallback } from '@/utils/file/importFile';
import { InternalEventType } from '@/utils/internalEvents';
import { shortcutToTuple } from '@/utils/keyboard-shortcut';

type Size = { width: number; height: number };

type SetupOptions = {
  app?: AppContext;
  i18n?: I18n;
  viewport?: Size;
  enableThemeBuilder?: boolean;
  enableLocalePicker?: boolean;
  /** The left edge of each toolbar button, 26 px wide; null lays it out at no size. */
  buttons?: Record<string, number | null>;
};

/** Where the fake toolbar lays its buttons out, as the real one does at its start. */
const BUTTONS: Record<string, number | null> = {
  'toolbar-search': 330,
  'toolbar-theme': 382,
  'toolbar-locale': 408,
};

const BUTTON_WIDTH = 26;

const ROOMY: Size = { width: 1200, height: 800 };

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
  vi.restoreAllMocks();
  setImportFileCallback(null);
});

const rect = (left: number, width: number) =>
  ({
    left,
    width,
    right: left + width,
    x: left,
    top: 0,
    y: 0,
    height: 30,
    bottom: 30,
  }) as DOMRect;

/**
 * A welcome screen under a toolbar of the three buttons its hints point at,
 * in an editor root that forwards its keys to keydown$ as the element's does.
 */
async function setup(options: SetupOptions = {}) {
  const app = options.app ?? createTestAppContext();
  const viewport = options.viewport ?? ROOMY;
  const buttons = { ...BUTTONS, ...options.buttons };
  app.store.dispatchSync(changeViewportAction(viewport));

  const props = observable({
    enableThemeBuilder: options.enableThemeBuilder ?? false,
    enableLocalePicker: options.enableLocalePicker ?? false,
    // Whether the screen is mounted, which Erd's show rule decides.
    shown: true,
  });

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      if (this.classList.contains('welcome-screen')) {
        return rect(0, app.store.state.editor.viewport.width);
      }
      const name = Object.keys(buttons).find(key =>
        this.classList.contains(key)
      );
      const left = name === undefined ? null : buttons[name];
      return left === null ? rect(0, 0) : rect(left, BUTTON_WIDTH);
    }
  );

  const root = document.createElement('div');
  root.className = 'root';
  document.body.append(root);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(root as any, appContext, app);
  const i18nProvider = options.i18n ? provideI18n(root, options.i18n) : null;

  const keydowns: KeyboardEvent[] = [];
  const forward = (event: KeyboardEvent) => app.keydown$.next(event);
  root.addEventListener('keydown', forward);
  const subscription = app.keydown$.subscribe(event => keydowns.push(event));

  // The theme and language buttons stand on the toolbar only while their prop
  // is on, as the real toolbar's do, so a prop turned on after the first
  // measure finds its anchor only by measuring again.
  const Harness: FC = () => () =>
    html`<div class="toolbar">
        <div class="toolbar-search"></div>
        ${
          props.enableThemeBuilder
            ? html`<div class="toolbar-theme"></div>`
            : null
        }
        ${
          props.enableLocalePicker
            ? html`<div class="toolbar-locale"></div>`
            : null
        }
      </div>
      ${
        props.shown
          ? html`<${WelcomeScreen}
              enableThemeBuilder=${props.enableThemeBuilder}
              enableLocalePicker=${props.enableLocalePicker}
            />`
          : null
      }`;

  render(root, html`<${Harness} />`);
  await flush();

  teardowns.push(() => {
    render(root, null);
    root.removeEventListener('keydown', forward);
    subscription.unsubscribe();
    appProvider.destroy();
    i18nProvider?.destroy();
    root.remove();
  });

  const screen = () => root.querySelector<HTMLElement>('.welcome-screen');
  const rows = () =>
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('.welcome-screen-item')
    );

  return {
    app,
    root,
    props,
    buttons,
    keydowns,
    screen,
    rows,
    labels: () =>
      rows().map(row => row.querySelector('span')?.textContent?.trim()),
    chords: () =>
      rows().map(row => row.querySelector('.kbd')?.textContent ?? null),
    row: (label: string) =>
      rows().find(
        row => row.querySelector('span')?.textContent?.trim() === label
      ) as HTMLButtonElement,
    hint: (name: string) =>
      root.querySelector<HTMLElement>(`.welcome-screen-hint-${name}`),
  };
}

/** What Kbd prints for a chord, the way it prints it. */
const chordText = (shortcut: string) =>
  shortcutToTuple(shortcut)
    .map(([mods, key]) => [...mods, key].join(' + '))
    .join('');

const pathsOf = (el: Element | null | undefined) =>
  Array.from(el?.querySelectorAll('path') ?? []).map(path =>
    path.getAttribute('d')
  );

const iconPaths = (name: keyof typeof iconMap) =>
  iconMap[name].node.map(([, attrs]) => attrs.d);

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

/** Listens for the focus the editor is asked to take back, which is dispatched on the host. */
function listenForFocus() {
  const onFocus = vi.fn();
  document.body.addEventListener(InternalEventType.focus, onFocus);
  teardowns.push(() =>
    document.body.removeEventListener(InternalEventType.focus, onFocus)
  );
  return onFocus;
}

describe('WelcomeScreen menu', () => {
  it('lists the five ways to start, each with the first chord bound to it', async () => {
    const { app, labels, chords } = await setup();
    const { keyBindingMap } = app;

    expect(labels()).toEqual([
      'New Table',
      'New Memo',
      'Import',
      'Command Palette',
      'Shortcuts',
    ]);
    expect(chords()).toEqual([
      chordText(keyBindingMap.addTable[0].shortcut),
      chordText(keyBindingMap.addMemo[0].shortcut),
      null,
      chordText(keyBindingMap.search[0].shortcut),
      null,
    ]);
  });

  it('shows the chord a remapped binding names', async () => {
    const { app, chords } = await setup();

    app.keyBindingMap.addTable = [{ shortcut: 'Alt+KeyT' }];
    await flush();

    expect(chords()[0]).toBe(chordText('Alt+KeyT'));
  });

  it('shows no chord for a binding left empty', async () => {
    const { app, chords } = await setup();

    app.keyBindingMap.addMemo = [];
    await flush();

    expect(chords()[1]).toBeNull();
  });

  it('names the rows as one group', async () => {
    const { root } = await setup();
    const menu = root.querySelector('.welcome-screen-menu');

    expect(menu?.getAttribute('role')).toBe('group');
    expect(menu?.getAttribute('aria-label')).toBe('Get started');
    expect(
      Array.from(menu?.querySelectorAll('button') ?? []).every(
        button => button.getAttribute('type') === 'button'
      )
    ).toBe(true);
  });

  it('adds a table where Alt+N would, and hands the keyboard back to the editor', async () => {
    const { app, row } = await setup();
    const onFocus = listenForFocus();

    row('New Table').click();
    await flush();

    const twin = createTestAppContext();
    twin.store.dispatchSync(changeViewportAction(ROOMY));
    twin.store.dispatchSync(addTableAction$());
    const [id] = app.store.state.doc.tableIds;
    const [twinId] = twin.store.state.doc.tableIds;
    const { x, y } = app.store.state.collections.tableEntities[id].ui;
    const placed = twin.store.state.collections.tableEntities[twinId].ui;

    expect(app.store.state.doc.tableIds).toHaveLength(1);
    expect({ x, y }).toEqual({ x: placed.x, y: placed.y });
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('adds a memo and hands the keyboard back', async () => {
    const { app, row } = await setup();
    const onFocus = listenForFocus();

    row('New Memo').click();
    await flush();

    expect(app.store.state.doc.memoIds).toHaveLength(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('opens the command palette', async () => {
    const { app, row } = await setup();
    const toggleSearch = vi.fn();
    app.emitter.on({ toggleSearch });

    row('Command Palette').click();
    await flush();

    expect(toggleSearch).toHaveBeenCalledTimes(1);
  });

  it('takes the reader to the Shortcuts page of the Settings tab', async () => {
    const { app, row } = await setup();
    const onFocus = listenForFocus();

    row('Shortcuts').click();
    await flush();

    expect(app.store.state.settings.canvasType).toBe(CanvasType.settings);
    expect(takeSettingsPage(app.store)).toBe(Lnb.shortcuts);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('hands the keyboard back once when a row it already handed it back from goes with the screen', async () => {
    const { props, row } = await setup();
    const onFocus = listenForFocus();

    row('New Table').focus();
    row('New Table').click();
    props.shown = false;
    await flush();

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('hands the keyboard back when the screen goes while a row holds it', async () => {
    const { props, rows } = await setup();
    const onFocus = listenForFocus();

    rows()[1].focus();
    props.shown = false;
    await flush();

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('hands the keyboard back when an import from the formats takes the screen away', async () => {
    setImportFileCallback(vi.fn());
    const { props, row, rows } = await setup();
    const onFocus = listenForFocus();

    row('Import').click();
    await flush();
    row('json').focus();
    row('json').click();
    await flush();
    expect(document.activeElement).toBe(rows()[2]);
    expect(onFocus).not.toHaveBeenCalled();

    props.shown = false;
    await flush();

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('still counts a row the window took the focus from, which stays the active one', async () => {
    const { props, rows } = await setup();
    const onFocus = listenForFocus();

    rows()[0].focus();
    rows()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await flush();
    props.shown = false;
    await flush();

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('leaves the keyboard where it is when the screen goes without it', async () => {
    const { props, rows } = await setup();
    const onFocus = listenForFocus();
    const outside = document.createElement('input');
    document.body.append(outside);
    teardowns.push(() => outside.remove());

    rows()[0].focus();
    outside.focus();
    await flush();
    props.shown = false;
    await flush();

    expect(document.activeElement).toBe(outside);
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('swaps Import in place for the formats, and Back returns with the keyboard on Import', async () => {
    const { row, labels, rows } = await setup();

    row('Import').click();
    await flush();

    expect(labels()).toEqual([
      'Back',
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);
    expect(document.activeElement).toBe(rows()[0]);
    expect(pathsOf(rows()[0])).toEqual(iconPaths('arrow-left'));

    row('Back').click();
    await flush();

    expect(labels()[2]).toBe('Import');
    expect(labels()).toHaveLength(5);
    expect(document.activeElement).toBe(rows()[2]);
  });

  it('asks the host for a json file to set in place of the document, then goes back', async () => {
    const callback = vi.fn();
    setImportFileCallback(callback);
    const { row, labels } = await setup();

    row('Import').click();
    await flush();
    row('json').click();
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({
      type: 'json',
      op: 'set',
    });
    expect(callback.mock.calls[0][0]).not.toHaveProperty('mode');
    expect(labels()[2]).toBe('Import');
  });

  it('goes back on Escape among the formats, which never reaches the editor', async () => {
    const { row, rows, labels, keydowns } = await setup();

    row('Import').click();
    await flush();
    const event = keydown(rows()[3], { key: 'Escape', code: 'Escape' });
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(keydowns).toEqual([]);
    expect(labels()).toHaveLength(5);
    expect(document.activeElement).toBe(rows()[2]);
  });

  it('lets Escape on the top level through to the editor', async () => {
    const { rows, keydowns } = await setup();

    const event = keydown(rows()[0], { key: 'Escape', code: 'Escape' });

    expect(event.defaultPrevented).toBe(false);
    expect(keydowns).toEqual([event]);
  });

  it('walks the rows round with the arrows, Home and End, which stay in the menu', async () => {
    const { rows, keydowns } = await setup();
    const [first] = rows();
    const last = rows()[4];
    first.focus();

    const up = keydown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(last);
    expect(up.defaultPrevented).toBe(true);

    keydown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);

    keydown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows()[1]);

    keydown(rows()[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);

    keydown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);

    keydown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);

    expect(keydowns).toEqual([]);
  });

  it('starts the walk from the first row when the press lands on the menu itself', async () => {
    const { root, rows } = await setup();

    keydown(root.querySelector('.welcome-screen-menu')!, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(rows()[0]);
  });

  it('keeps Enter and Space for the row, and lets every other chord through', async () => {
    const { rows, keydowns } = await setup();

    const enter = keydown(rows()[0], { key: 'Enter', code: 'Enter' });
    const space = keydown(rows()[0], { key: ' ', code: 'Space' });
    const addTable = keydown(rows()[0], {
      key: 'n',
      code: 'KeyN',
      altKey: true,
    });

    expect(enter.defaultPrevented).toBe(false);
    expect(space.defaultPrevented).toBe(false);
    expect(keydowns).toEqual([addTable]);
  });
});

describe('WelcomeScreen layout', () => {
  it('shows the heading and the menu alone on a roomy canvas, with no logo and no name', async () => {
    const { root } = await setup();
    const heading = root.querySelector('.welcome-screen-heading');

    expect(heading?.textContent?.trim()).toBe(
      'Right-click the canvas for every action.'
    );
    expect(
      Array.from(heading?.parentElement?.children ?? []).map(
        child => child.classList[0]
      )
    ).toEqual(['welcome-screen-heading', 'welcome-screen-menu']);
  });

  it('keeps the menu alone on a low canvas, drops the chords on a narrow one, and shows nothing on a tiny one', async () => {
    const low = await setup({ viewport: { width: 1200, height: 300 } });

    expect(low.root.querySelector('.welcome-screen-heading')).toBeNull();
    expect(low.rows()).toHaveLength(5);
    expect(low.chords()[0]).not.toBeNull();

    low.app.store.dispatchSync(
      changeViewportAction({ width: 400, height: 800 })
    );
    await flush();

    expect(low.chords()).toEqual([null, null, null, null, null]);
    expect(low.root.querySelector('.welcome-screen-hint')).toBeNull();

    low.app.store.dispatchSync(
      changeViewportAction({ width: 300, height: 800 })
    );
    await flush();

    expect(low.screen()).not.toBeNull();
    expect(low.root.querySelector('.welcome-screen-menu')).toBeNull();
  });

  it('reads the heading and the rows in the language it mounts in', async () => {
    const { root, labels } = await setup({
      i18n: createTestI18n('ko-KR', pseudoMessages('ko')),
    });

    expect(
      root.querySelector('.welcome-screen-heading')?.textContent?.trim()
    ).toBe('ko:Right-click the canvas for every action.');
    expect(labels()[3]).toBe('ko:Command Palette');
  });

  it('stands clear of an open Find and Replace panel', async () => {
    const { app, screen, hint } = await setup();
    expect(screen()?.style.left).toBe('0px');

    app.store.dispatchSync(changeOpenMapAction({ [Open.findReplace]: true }));
    await flush();

    const covered = coveredWidth(app.store.state);
    expect(covered).toBeGreaterThan(0);
    expect(screen()?.style.left).toBe(`${covered}px`);
    expect(hint('tools')).toBeNull();
  });
});

describe('WelcomeScreen hints', () => {
  it('points the palette hint at Search and the tools hint at the floating toolbar', async () => {
    const { hint } = await setup();
    const search = 330 + BUTTON_WIDTH / 2;
    const reach = ARROW_UP_BOX.width - ARROW_UP_BOX.tipX;

    expect(hint('palette')?.textContent?.trim()).toBe(
      'Search commands and tables'
    );
    expect(hint('palette')?.style.right).toBe(
      `${ROOMY.width - search - reach}px`
    );
    expect(hint('tools')?.textContent?.trim()).toBe(
      'Pan, zoom and draw relationships'
    );
  });

  it('shows the preferences hint only while a prop puts its button on the toolbar', async () => {
    const { props, hint } = await setup();
    expect(hint('preferences')).toBeNull();

    props.enableThemeBuilder = true;
    await flush();
    expect(hint('preferences')?.textContent?.trim()).toBe('Pick a theme');

    props.enableLocalePicker = true;
    await flush();
    expect(hint('preferences')?.textContent?.trim()).toBe(
      'Pick a theme and a language'
    );

    props.enableThemeBuilder = false;
    await flush();
    expect(hint('preferences')?.textContent?.trim()).toBe('Pick a language');
  });

  it('shows no preferences hint while neither button has been laid out', async () => {
    const { hint } = await setup({
      enableThemeBuilder: true,
      buttons: { 'toolbar-theme': null, 'toolbar-locale': null },
    });

    expect(hint('palette')).not.toBeNull();
    expect(hint('preferences')).toBeNull();
  });

  it.each([Open.findReplace, Open.themeBuilder, Open.localePicker])(
    'steps every hint aside while %s is up',
    async open => {
      const { app, root } = await setup({ enableThemeBuilder: true });
      expect(root.querySelectorAll('.welcome-screen-hint')).toHaveLength(3);

      app.store.dispatchSync(changeOpenMapAction({ [open]: true }));
      await flush();

      expect(root.querySelector('.welcome-screen-hint')).toBeNull();
      expect(root.querySelector('.welcome-screen-menu')).not.toBeNull();
    }
  );

  it('measures again as the canvas, the tab and the language change', async () => {
    const i18n = createTestI18n('en');
    const { app, buttons, hint } = await setup({ i18n });
    const reach = ARROW_UP_BOX.width - ARROW_UP_BOX.tipX;

    buttons['toolbar-search'] = 500;
    app.store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
    await flush();
    expect(hint('palette')?.style.right).toBe(`${1000 - 513 - reach}px`);

    buttons['toolbar-search'] = 520;
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await flush();
    expect(hint('palette')?.style.right).toBe(`${1000 - 533 - reach}px`);

    // A right-to-left language turns the toolbar round, Search to the right.
    buttons['toolbar-search'] = 600;
    Object.assign(i18n, createI18n('ar-SA', pseudoMessages('ar')));
    await flush();
    expect(hint('palette')?.style.left).toBe(`${613 - reach}px`);
  });

  it('turns every word to a language switched to while it is up', async () => {
    const i18n = createTestI18n('en');
    const { root, labels, hint } = await setup({
      i18n,
      enableThemeBuilder: true,
    });
    expect(labels()[0]).toBe('New Table');

    Object.assign(i18n, createI18n('ar-SA', pseudoMessages('ar')));
    await flush();

    expect(labels()).toEqual([
      'ar:New Table',
      'ar:New Memo',
      'ar:Import',
      'ar:Command Palette',
      'ar:Shortcuts',
    ]);
    expect(
      root.querySelector('.welcome-screen-heading')?.textContent?.trim()
    ).toBe('ar:Right-click the canvas for every action.');
    expect(
      root.querySelector('.welcome-screen-menu')?.getAttribute('aria-label')
    ).toBe('ar:Get started');
    expect(hint('palette')?.textContent?.trim()).toBe(
      'ar:Search commands and tables'
    );
    expect(hint('preferences')?.textContent?.trim()).toBe('ar:Pick a theme');
    expect(hint('tools')?.textContent?.trim()).toBe(
      'ar:Pan, zoom and draw relationships'
    );
  });

  it('mirrors the hints and the Back arrow in a right-to-left language', async () => {
    const { hint, row, rows } = await setup({
      i18n: createTestI18n('ar-SA', pseudoMessages('ar')),
      enableLocalePicker: true,
      buttons: {
        'toolbar-search': 844,
        'toolbar-theme': null,
        'toolbar-locale': 792,
      },
    });
    const reach = ARROW_UP_BOX.width - ARROW_UP_BOX.tipX;
    const palette = hint('palette')!;
    const preferences = hint('preferences')!;

    expect(palette.style.left).toBe(`${857 - reach}px`);
    expect(palette.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(palette.querySelector('g')?.getAttribute('transform')).toBe(
      `matrix(-1 0 0 1 ${ARROW_UP_BOX.width} 0)`
    );
    expect(palette.querySelector('span')?.getAttribute('dir')).toBe('rtl');

    expect(preferences.style.right).toBe(`${ROOMY.width - 805 - reach}px`);
    expect(preferences.firstElementChild?.tagName.toLowerCase()).toBe('span');
    expect(preferences.querySelector('g')?.getAttribute('transform')).toBe('');
    expect(preferences.textContent?.trim()).toBe('ar:Pick a language');

    row('ar:Import').click();
    await flush();
    expect(pathsOf(rows()[0])).toEqual(iconPaths('arrow-right'));
  });

  it('turns the Back arrow alone round, and only in a right-to-left language', () => {
    expect(rowIcon('arrow-left', 'rtl')).toBe('arrow-right');
    expect(rowIcon('arrow-left', 'ltr')).toBe('arrow-left');
    expect(rowIcon('search', 'rtl')).toBe('search');
  });

  it('strokes every arrow from currentColor and fills none', async () => {
    const { root } = await setup({ enableThemeBuilder: true });
    const paths = Array.from(
      root.querySelectorAll('.welcome-screen-arrow path')
    );

    expect(paths.length).toBeGreaterThanOrEqual(6);
    for (const path of paths) {
      expect(path.getAttribute('fill')).toBe('none');
      expect(path.getAttribute('stroke')).toBe('currentColor');
      expect(path.getAttribute('stroke-width')).toBe('2');
    }
    expect(pathsOf(root.querySelector('.welcome-screen-hint-palette'))).toEqual(
      [...ARROW_UP]
    );
  });
});
