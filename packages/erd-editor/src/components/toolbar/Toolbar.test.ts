import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Toolbar from '@/components/toolbar/Toolbar';
import * as styles from '@/components/toolbar/Toolbar.styles';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { openThemeBuilderAction, toggleSearchAction } from '@/utils/emitter';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

type Options = {
  enableThemeBuilder?: boolean;
  readonly?: boolean;
};

async function setup({
  enableThemeBuilder = false,
  readonly = false,
}: Options = {}) {
  mounted = await mountAndFlush(
    html`<${Toolbar}
      enableThemeBuilder=${enableThemeBuilder}
      readonly=${readonly}
    />`
  );
  return mounted;
}

const root = () =>
  mounted!.container.querySelector('.toolbar') as HTMLDivElement;

const input = (title: string) =>
  root().querySelector(`input[title="${title}"]`) as HTMLInputElement;

const menu = (title: string) =>
  root().querySelector(`div[title="${title}"]`) as HTMLDivElement;

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

    it('binds the three text inputs to the current settings', async () => {
      await setup();

      expect(input('database name').value).toBe('');
      expect(input('canvas size').value).toBe('2000');
      expect(input('zoom level').value).toBe('100%');
    });

    it('sizes the database name input wider than the numeric ones', async () => {
      await setup();

      expect(input('database name').style.width).toBe('150px');
      expect(input('canvas size').style.width).toBe('45px');
      expect(input('zoom level').style.width).toBe('45px');
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

    it('resizes the canvas to a square of the committed size', async () => {
      const { app } = await setup();
      const el = input('canvas size');

      el.value = '3000';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(el.value).toBe('3000');
      expect(app.store.state.settings.width).toBe(3000);
      expect(app.store.state.settings.height).toBe(3000);
    });

    it('clamps an oversized canvas size back into range and rewrites the input', async () => {
      const { app } = await setup();
      const el = input('canvas size');

      el.value = '999999';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(el.value).toBe('20000');
      expect(app.store.state.settings.width).toBe(20000);
    });

    it('strips non digits from the canvas size before clamping', async () => {
      const { app } = await setup();
      const el = input('canvas size');

      el.value = 'abc';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(el.value).toBe('2000');
      expect(app.store.state.settings.width).toBe(2000);
    });

    it('applies a committed zoom level as a percentage', async () => {
      const { app } = await setup();
      const el = input('zoom level');

      el.value = '50';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(el.value).toBe('50%');
      expect(app.store.state.settings.zoomLevel).toBe(0.5);
    });

    it('clamps the zoom level to the maximum of 100%', async () => {
      const { app } = await setup();
      const el = input('zoom level');

      el.value = '500';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(el.value).toBe('100%');
      expect(app.store.state.settings.zoomLevel).toBe(1);
    });

    it('clamps the zoom level to the minimum of 10%', async () => {
      const { app } = await setup();
      const el = input('zoom level');

      el.value = '1';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(el.value).toBe('10%');
      expect(app.store.state.settings.zoomLevel).toBe(0.1);
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

    it('ignores a canvas size change event that carries no target element', async () => {
      const { app } = await setup();
      const el = input('canvas size');
      const before = app.store.state.settings.width;

      el.value = '5000';
      el.dispatchEvent(withNullTarget(new Event('change')));
      await flush();

      expect(el.value).toBe('5000');
      expect(app.store.state.settings.width).toBe(before);
    });

    it('ignores a zoom level change event that carries no target element', async () => {
      const { app } = await setup();
      const el = input('zoom level');
      const before = app.store.state.settings.zoomLevel;

      el.value = '20';
      el.dispatchEvent(withNullTarget(new Event('change')));
      await flush();

      expect(el.value).toBe('20');
      expect(app.store.state.settings.zoomLevel).toBe(before);
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
