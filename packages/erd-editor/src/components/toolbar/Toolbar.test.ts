import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { TAKEOVERS } from '@/components/find-replace/panelLayout';
import Toolbar from '@/components/toolbar/Toolbar';
import * as styles from '@/components/toolbar/Toolbar.styles';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import {
  SelectType,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeZoomLevelAction,
  viewCloseAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createI18n } from '@/i18n/translate';
import {
  openFindReplaceAction,
  openLocalePickerAction,
  openThemeBuilderAction,
  toggleSearchAction,
} from '@/utils/emitter';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

type Options = {
  enableThemeBuilder?: boolean;
  enableLocalePicker?: boolean;
  readonly?: boolean;
};

async function setup({
  enableThemeBuilder = false,
  enableLocalePicker,
  readonly = false,
}: Options = {}) {
  mounted = await mountAndFlush(
    html`<${Toolbar}
      enableThemeBuilder=${enableThemeBuilder}
      enableLocalePicker=${enableLocalePicker}
      readonly=${readonly}
    />`
  );
  return mounted;
}

const root = () =>
  mounted!.container.querySelector('.toolbar') as HTMLDivElement;

const input = (title: string) =>
  root().querySelector(`input[title="${title}"]`) as HTMLInputElement;

// Matched on the name the title opens with, since a title carries the chord
// the command answers after it.
const menu = (title: string) =>
  root().querySelector(`div[title^="${title}"]`) as HTMLDivElement;

const withNullTarget = <T extends Event>(event: T): T => {
  Object.defineProperty(event, 'target', {
    configurable: true,
    get: () => null,
  });
  return event;
};

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } });

describe('Toolbar', () => {
  describe('rendering', () => {
    it('renders the bar with the toolbar hook class and the root style', async () => {
      await setup();
      const el = root();

      expect(el).toBeTruthy();
      expect(el.getAttribute('class')).toContain(String(styles.root));
    });

    it('binds the database name input to the current settings', async () => {
      await setup();

      expect(input('database name').value).toBe('');
    });

    it('offers no canvas size box, the document having no edge to size', async () => {
      await setup();

      expect(input('canvas size')).toBeNull();
    });

    /* The zoom that stood beside it drives the canvas, and is on the floating toolbar over it now. */
    it('carries the database name as its one text input', async () => {
      await setup();

      expect(input('database name').style.width).toBe('150px');
      expect(input('zoom level')).toBeNull();
    });

    it('reflects seeded settings in the inputs', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.settings })
      );
      await flush();

      expect(menu('Settings').getAttribute('class')).toContain('active');
    });

    it('renders one separator per group', async () => {
      await setup();

      expect(
        root().querySelectorAll(`.${String(styles.vertical)}`)
      ).toHaveLength(3);
    });

    it('counts the tables in the document', async () => {
      const { app } = await setup();
      expect(
        root().querySelector(`.${String(styles.tableCount)}`)?.textContent
      ).toContain('Table: 0');

      app.store.dispatchSync(addTable('t1'), addTable('t2'));
      await flush();

      expect(
        root().querySelector(`.${String(styles.tableCount)}`)?.textContent
      ).toContain('Table: 2');
    });
  });

  describe('canvas type menu', () => {
    const cases: Array<[string, string]> = [
      ['Entity Relationship Diagram', CanvasType.ERD],
      ['Visualization', CanvasType.visualization],
      ['Schema SQL', CanvasType.schemaSQL],
      ['Code Generator', CanvasType.generatorCode],
      ['Settings', CanvasType.settings],
    ];

    it('marks only the current canvas type as active', async () => {
      await setup();

      const actives = cases.filter(([title]) =>
        menu(title).getAttribute('class')?.includes('active')
      );
      expect(actives.map(([title]) => title)).toEqual([
        'Entity Relationship Diagram',
      ]);
    });

    for (const [title, value] of cases) {
      it(`switches the canvas type to ${value} when "${title}" is clicked`, async () => {
        const { app } = await setup();

        menu(title).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flush();

        expect(app.store.state.settings.canvasType).toBe(value);
        expect(menu(title).getAttribute('class')).toContain('active');
      });
    }
  });

  describe('text inputs', () => {
    it('writes the typed database name into the store', async () => {
      const { app } = await setup();
      const el = input('database name');

      el.value = 'sakila';
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      expect(app.store.state.settings.databaseName).toBe('sakila');
    });

    it('ignores an input event that carries no target element', async () => {
      const { app } = await setup();
      const el = input('database name');
      const before = app.store.state.settings.databaseName;

      el.value = 'ignored';
      el.dispatchEvent(withNullTarget(new InputEvent('input')));
      await flush();

      expect(app.store.state.settings.databaseName).toBe(before);
    });
  });

  describe('emitter driven menus', () => {
    it('toggles search through the emitter', async () => {
      const { app } = await setup();
      const toggleSearch = vi.fn();
      app.emitter.on({ toggleSearch });

      menu('Search').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(toggleSearch).toHaveBeenCalledTimes(1);
      expect(toggleSearch.mock.calls[0][0].type).toBe(
        toggleSearchAction().type
      );
    });

    it('hides the theme menu unless the theme builder is enabled', async () => {
      await setup({ enableThemeBuilder: false });

      expect(menu('Theme')).toBeNull();
    });

    it('opens the theme builder through the emitter when enabled', async () => {
      const { app } = await setup({ enableThemeBuilder: true });
      const openThemeBuilder = vi.fn();
      app.emitter.on({ openThemeBuilder });

      menu('Theme').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(openThemeBuilder).toHaveBeenCalledTimes(1);
      expect(openThemeBuilder.mock.calls[0][0].type).toBe(
        openThemeBuilderAction().type
      );
    });
  });

  describe('language menu', () => {
    const language = () =>
      root().querySelector('.toolbar-locale') as HTMLDivElement | null;

    it('hides the language menu unless the locale picker is enabled', async () => {
      await setup();
      expect(language()).toBeNull();

      mounted?.unmount();
      await setup({ enableLocalePicker: false });
      expect(language()).toBeNull();
    });

    it('opens the locale picker through the emitter when enabled', async () => {
      const { app } = await setup({ enableLocalePicker: true });
      const openLocalePicker = vi.fn();
      app.emitter.on({ openLocalePicker });

      language()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(openLocalePicker).toHaveBeenCalledTimes(1);
      expect(openLocalePicker.mock.calls[0][0]).toEqual(
        openLocalePickerAction()
      );
    });

    it('stands after the theme menu, drawing the languages glyph under its own title', async () => {
      await setup({ enableThemeBuilder: true, enableLocalePicker: true });

      expect(menu('Theme').nextElementSibling).toBe(language());
      expect(iconNameOf(language())).toBe('languages');
      expect(language()!.title).toBe('Display Language');
      expect(language()!.getAttribute('class')).toContain(String(styles.menu));
    });

    it('reads its title in the language the element shows, following a switch', async () => {
      const i18n = createTestI18n('en');
      const provider = provideI18n(document.body, i18n);

      try {
        await setup({ enableLocalePicker: true });
        expect(language()!.title).toBe('Display Language');

        Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
        await flush();

        expect(language()!.title).toBe('ko:Display Language');
      } finally {
        provider.destroy();
      }
    });
  });

  describe('toolbar anchors', () => {
    it('marks Search, Theme and the language menu with the classes a hint is placed by', async () => {
      await setup({ enableThemeBuilder: true, enableLocalePicker: true });

      expect(root().querySelector('.toolbar-search')).toBe(menu('Search'));
      expect(root().querySelector('.toolbar-theme')).toBe(menu('Theme'));
      expect(iconNameOf(root().querySelector('.toolbar-locale'))).toBe(
        'languages'
      );
    });

    it('drops the Theme and language anchors with their menus', async () => {
      await setup();

      expect(root().querySelector('.toolbar-search')).toBe(menu('Search'));
      expect(root().querySelector('.toolbar-theme')).toBeNull();
      expect(root().querySelector('.toolbar-locale')).toBeNull();
    });
  });

  describe('find and replace menu', () => {
    const findReplace = () => menu('Find and Replace');

    it('opens Find and Replace through the emitter', async () => {
      const { app } = await setup();
      const openFindReplace = vi.fn();
      app.emitter.on({ openFindReplace });

      findReplace().dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(openFindReplace).toHaveBeenCalledTimes(1);
      expect(openFindReplace.mock.calls[0][0]).toEqual(openFindReplaceAction());
    });

    it('stands right after Search, enabled, and names its chord on the ERD tab', async () => {
      const { app } = await setup();

      expect(menu('Search').nextElementSibling).toBe(findReplace());
      expect(iconNameOf(findReplace())).toBe('text-search');
      expect(findReplace().getAttribute('class')).not.toContain('disabled');
      expect(findReplace().title).toBe(
        toShortcutTitle(
          app.keyBindingMap,
          'Find and Replace',
          KeyBindingName.findReplace
        )
      );
      expect(findReplace().title).not.toBe('Find and Replace');
    });

    for (const canvasType of [
      CanvasType.visualization,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
      CanvasType.settings,
    ]) {
      it(`keeps its place and its chord on the ${canvasType} tab`, async () => {
        const { app } = await setup();
        app.store.dispatchSync(changeCanvasTypeAction({ value: canvasType }));
        await flush();

        expect(menu('Search').nextElementSibling).toBe(findReplace());
        expect(findReplace().getAttribute('class')).not.toContain('disabled');
        expect(findReplace().title).toBe(
          toShortcutTitle(
            app.keyBindingMap,
            'Find and Replace',
            KeyBindingName.findReplace
          )
        );
      });
    }

    it('reads Find in a read-only editor, which offers no replace', async () => {
      const { app } = await setup({ readonly: true });

      expect(findReplace()).toBeNull();
      expect(menu('Search').nextElementSibling).toBe(menu('Find'));
      expect(menu('Find').title).toBe(
        toShortcutTitle(app.keyBindingMap, 'Find', KeyBindingName.findReplace)
      );
    });

    for (const open of TAKEOVERS) {
      it(`keeps its place but shows disabled while ${open} takes the canvas over`, async () => {
        const { app } = await setup();
        app.store.dispatchSync(changeOpenMapAction({ [open]: true }));
        await flush();

        expect(menu('Search').nextElementSibling).toBe(findReplace());
        expect(findReplace().getAttribute('class')).toContain('disabled');
      });
    }

    it('shows disabled on another tab too while a takeover stays open', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        changeOpenMapAction({ [Open.timeTravel]: true }),
        changeCanvasTypeAction({ value: CanvasType.settings })
      );
      await flush();

      expect(findReplace().getAttribute('class')).toContain('disabled');
    });

    it('spares the selection a press anywhere else in the bar clears, as the chord does', async () => {
      const { app } = await setup();
      app.store.dispatchSync(selectAction({ t1: SelectType.table }));

      findReplace().dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true })
      );
      findReplace().dispatchEvent(
        new TouchEvent('touchstart', { bubbles: true })
      );
      await flush();

      expect(app.store.state.editor.selectedMap).toEqual({
        t1: SelectType.table,
      });
    });

    it('stays enabled under table properties, which opening the panel closes', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        changeOpenMapAction({ [Open.tableProperties]: true })
      );
      await flush();

      expect(findReplace().getAttribute('class')).not.toContain('disabled');
    });
  });

  describe('unselect all', () => {
    it('clears the selection on mousedown anywhere in the bar', async () => {
      const { app } = await setup();
      app.store.dispatchSync(selectAction({ t1: SelectType.table }));
      expect(app.store.state.editor.selectedMap).toEqual({
        t1: SelectType.table,
      });

      root().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await flush();

      expect(app.store.state.editor.selectedMap).toEqual({});
    });

    it('clears the selection on touchstart as well', async () => {
      const { app } = await setup();
      app.store.dispatchSync(selectAction({ t1: SelectType.table }));

      root().dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      await flush();

      expect(app.store.state.editor.selectedMap).toEqual({});
    });
  });

  describe('undo / redo group', () => {
    it('renders undo, redo and time travel on the ERD canvas', async () => {
      await setup();

      expect(root().querySelectorAll('.undo-redo')).toHaveLength(3);
      expect(menu('Undo')).toBeTruthy();
      expect(menu('Redo')).toBeTruthy();
      expect(menu('Time Travel')).toBeTruthy();
    });

    it('hides the group in readonly mode', async () => {
      await setup({ readonly: true });

      expect(root().querySelectorAll('.undo-redo')).toHaveLength(0);
    });

    it('hides the group on a non ERD canvas', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.schemaSQL })
      );
      await flush();

      expect(root().querySelectorAll('.undo-redo')).toHaveLength(0);
    });

    for (const open of [
      Open.automaticTablePlacement,
      Open.tableProperties,
      Open.diffViewer,
      Open.timeTravel,
    ]) {
      it(`hides the group while ${open} is open`, async () => {
        const { app } = await setup();
        app.store.dispatchSync(changeOpenMapAction({ [open]: true }));
        await flush();

        expect(root().querySelectorAll('.undo-redo')).toHaveLength(0);
      });
    }

    it('keeps the group inactive while there is no history', async () => {
      await setup();

      expect(menu('Undo').getAttribute('class')).not.toContain('active');
      expect(menu('Redo').getAttribute('class')).not.toContain('active');
      expect(menu('Time Travel').getAttribute('class')).not.toContain('active');
    });

    it('activates undo and time travel once something is undoable', async () => {
      const { app } = await setup();
      app.store.dispatchSync(addTable('t1'));
      await flush();

      expect(menu('Undo').getAttribute('class')).toContain('active');
      expect(menu('Redo').getAttribute('class')).not.toContain('active');
      expect(menu('Time Travel').getAttribute('class')).toContain('active');
    });

    it('reverts the document when undo is clicked', async () => {
      const { app } = await setup();
      app.store.dispatchSync(addTable('t1'));
      await flush();

      menu('Undo').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();

      expect(app.store.state.doc.tableIds).toEqual([]);
      expect(menu('Redo').getAttribute('class')).toContain('active');
    });

    it('reapplies the document when redo is clicked', async () => {
      const { app } = await setup();
      app.store.dispatchSync(addTable('t1'));
      await flush();
      menu('Undo').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();

      menu('Redo').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();

      expect(app.store.state.doc.tableIds).toEqual(['t1']);
    });
  });

  describe('time travel', () => {
    it('does nothing when there is no history to travel', async () => {
      const { app } = await setup();

      menu('Time Travel').dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      await flush();

      expect(app.store.state.editor.openMap).toEqual({});
    });

    it('opens the time travel panel once history exists', async () => {
      const { app } = await setup();
      app.store.dispatchSync(addTable('t1'));
      await flush();

      menu('Time Travel').dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      await flush();

      expect(app.store.state.editor.openMap[Open.timeTravel]).toBe(true);
    });

    it('caps the time travel icon width so it matches the other menus', async () => {
      await setup();

      expect(menu('Time Travel').style.maxWidth).toBe('26px');
    });
  });
});
