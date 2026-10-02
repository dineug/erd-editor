import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as tabStyles from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs.styles';
import TableProperties from '@/components/erd/table-properties/TableProperties';
import * as styles from '@/components/erd/table-properties/TableProperties.styles';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { InternalEventType } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const TABLE_A = 't1';
const TABLE_B = 't2';

const rootOf = (mounted: Mounted) =>
  mounted.container.querySelector(`.${String(styles.root)}`) as HTMLElement;

const dialogOf = (mounted: Mounted) =>
  mounted.container.querySelector('.table-properties') as HTMLElement;

const tableTabsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(
      `.${String(styles.header)} > .${String(styles.tables)} > .${String(styles.tableChip)}`
    )
  ) as HTMLElement[];

const headerOf = (mounted: Mounted) =>
  mounted.container.querySelector(`.${String(styles.header)}`) as HTMLElement;

const closeButtonOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    '.table-properties-close'
  ) as HTMLButtonElement;

const propertyTabsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(`.${String(tabStyles.tab)}`)
  ) as HTMLElement[];

const scopeOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.scope)}`
  ) as HTMLElement | null;

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

function template(
  tableId = TABLE_A,
  tableIds = [TABLE_A, TABLE_B],
  onChange = vi.fn(),
  isDarkMode = false
) {
  return html`
    <${TableProperties}
      isDarkMode=${isDarkMode}
      tableId=${tableId}
      tableIds=${tableIds}
      .onChange=${onChange}
    />
  `;
}

function seed(app: AppContext) {
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: TABLE_A, ui: { x: 0, y: 0, zIndex: 2 } }),
    addTableAction({ id: TABLE_B, ui: { x: 0, y: 0, zIndex: 3 } })
  );
  store.dispatchSync(
    changeTableNameAction({ id: TABLE_A, value: 'users' }),
    addColumnAction({ id: 'c1', tableId: TABLE_A })
  );
  store.dispatchSync(changeOpenMapAction({ [Open.tableProperties]: true }));
}

let app: AppContext;
let mounted: Mounted | null = null;
let focusEvents = 0;

const countFocusEvent = () => {
  focusEvents++;
};

beforeEach(() => {
  app = createTestAppContext();
  seed(app);
  focusEvents = 0;
  document.body.addEventListener(InternalEventType.focus, countFocusEvent);
});

afterEach(() => {
  document.body.removeEventListener(InternalEventType.focus, countFocusEvent);
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('TableProperties', () => {
  describe('frame', () => {
    it('announces itself as a dialog named Table Properties', async () => {
      mounted = await mountAndFlush(template(), app);
      const dialog = dialogOf(mounted);

      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.getAttribute('aria-label')).toBe('Table Properties');
      expect(dialog.hasAttribute('aria-modal')).toBe(false);
    });

    it('heads the dialog with its title, the table chips and a close button, in that order', async () => {
      mounted = await mountAndFlush(template(), app);
      const header = headerOf(mounted);
      const [title, tables, close] = Array.from(
        header.children
      ) as HTMLElement[];

      expect(header.children).toHaveLength(3);
      expect(title.textContent).toBe('Table Properties');
      expect(title.classList.contains(String(styles.title))).toBe(true);
      expect(tables.classList.contains(String(styles.tables))).toBe(true);
      expect(tables.classList.contains('scrollbar')).toBe(true);
      expect(close).toBe(closeButtonOf(mounted));
    });

    it('stands the header, the section tabs and the body one above the other', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(
        Array.from(dialogOf(mounted).children).map(child =>
          child.classList.contains(String(styles.header))
            ? 'header'
            : child.classList.contains(String(tabStyles.tabs))
              ? 'tabs'
              : child.classList.contains(String(styles.scrollbarArea))
                ? 'body'
                : 'other'
        )
      ).toEqual(['header', 'tabs', 'body']);
    });

    it('names the close button and the chord that also closes the dialog', async () => {
      mounted = await mountAndFlush(template(), app);
      const close = closeButtonOf(mounted);

      expect(close.tagName).toBe('BUTTON');
      expect(close.getAttribute('type')).toBe('button');
      expect(close.classList.contains(String(styles.close))).toBe(true);
      expect(close.getAttribute('title')).toBe('Close (ESC)');
      expect(close.querySelector('.icon svg')).toBeTruthy();
    });

    it('names the close button alone when no chord stops the editor', async () => {
      app.keyBindingMap[KeyBindingName.stop] = [];
      mounted = await mountAndFlush(template(), app);

      expect(closeButtonOf(mounted).getAttribute('title')).toBe('Close');
    });

    it('puts no title on the frame that an e2e locator reads as a row', async () => {
      mounted = await mountAndFlush(template(), app);
      const titles = Array.from(
        dialogOf(mounted).querySelectorAll('[title]')
      ).map(el => el.getAttribute('title'));

      expect(titles).not.toContain('Read Only');
      expect(titles).not.toContain('Unique');
      expect(titles.filter(title => title === 'Add Index')).toHaveLength(1);
    });
  });

  describe('table tabs', () => {
    it('renders one header tab per requested table id', async () => {
      mounted = await mountAndFlush(template(), app);

      const tabs = tableTabsOf(mounted);
      expect(tabs).toHaveLength(2);
      expect(tabs[0].getAttribute('title')).toBe('users');
      expect(tabs[0].textContent?.trim()).toBe('users');
    });

    it('falls back to `unnamed` for a table with a blank name', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(tableTabsOf(mounted)[1].textContent?.trim()).toBe('unnamed');
    });

    it('marks only the active table id as selected', async () => {
      mounted = await mountAndFlush(template(TABLE_B), app);

      expect(
        tableTabsOf(mounted).map(el => el.classList.contains('selected'))
      ).toEqual([false, true]);
    });

    it('reports the clicked table through onChange', async () => {
      const onChange = vi.fn();
      mounted = await mountAndFlush(
        template(TABLE_A, [TABLE_A, TABLE_B], onChange),
        app
      );

      click(tableTabsOf(mounted)[1]);
      await flush();

      expect(onChange).toHaveBeenCalledExactlyOnceWith(TABLE_B);
    });

    it('skips table ids that do not resolve to an entity', async () => {
      mounted = await mountAndFlush(
        template(TABLE_A, [TABLE_A, 'missing']),
        app
      );

      expect(tableTabsOf(mounted)).toHaveLength(1);
    });
  });

  describe('property tabs', () => {
    it('opens on the Indexes tab', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(
        propertyTabsOf(mounted).map(el => el.classList.contains('selected'))
      ).toEqual([true, false, false]);
      expect(scopeOf(mounted)).toBeTruthy();
      expect(scopeOf(mounted)?.classList.contains('code')).toBe(false);
      expect(
        mounted.container.querySelector('input[type="checkbox"]')
      ).toBeTruthy();
    });

    it('switches to the Schema SQL tab and renders the DDL of the table', async () => {
      mounted = await mountAndFlush(template(), app);

      click(propertyTabsOf(mounted)[1]);
      await flush();

      expect(
        propertyTabsOf(mounted).map(el => el.classList.contains('selected'))
      ).toEqual([false, true, false]);
      expect(mounted.container.querySelector('input[type="checkbox"]')).toBe(
        null
      );
      expect(scopeOf(mounted)?.textContent).toContain('users');
      expect(scopeOf(mounted)?.classList.contains('code')).toBe(true);
    });

    it('switches to the Code Generator tab', async () => {
      mounted = await mountAndFlush(template(), app);

      click(propertyTabsOf(mounted)[2]);
      await flush();

      expect(
        propertyTabsOf(mounted).map(el => el.classList.contains('selected'))
      ).toEqual([false, false, true]);
      expect(mounted.container.querySelector('input[type="checkbox"]')).toBe(
        null
      );
      expect(scopeOf(mounted)?.textContent).toContain('type Users {');
      expect(scopeOf(mounted)?.classList.contains('code')).toBe(true);
    });

    it('returns to the Indexes tab', async () => {
      mounted = await mountAndFlush(template(), app);

      click(propertyTabsOf(mounted)[2]);
      await flush();
      click(propertyTabsOf(mounted)[0]);
      await flush();

      expect(
        mounted.container.querySelector('input[type="checkbox"]')
      ).toBeTruthy();
    });
  });

  describe('closing', () => {
    it('closes on the close button and hands the keyboard back to the editor', async () => {
      mounted = await mountAndFlush(template(), app);

      click(closeButtonOf(mounted));
      expect(focusEvents).toBe(0);
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
      expect(focusEvents).toBe(1);
    });

    it('hands the keyboard back on no other way out', async () => {
      mounted = await mountAndFlush(template(), app);

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      click(rootOf(mounted));
      await flush();

      expect(focusEvents).toBe(0);
    });

    it('closes when the backdrop outside the dialog is clicked', async () => {
      mounted = await mountAndFlush(template(), app);

      click(rootOf(mounted));
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
    });

    it('stays open when the click lands inside the dialog', async () => {
      mounted = await mountAndFlush(template(), app);

      click(dialogOf(mounted));
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
    });

    it('ignores a click event without a target element', async () => {
      mounted = await mountAndFlush(template(), app);

      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', {
        configurable: true,
        get: () => null,
      });
      rootOf(mounted).dispatchEvent(event);
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
    });

    it('closes on the stop shortcut', async () => {
      mounted = await mountAndFlush(template(), app);

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
    });

    it('ignores every other shortcut', async () => {
      mounted = await mountAndFlush(template(), app);

      app.shortcut$.next({
        type: KeyBindingName.selectAllTable,
        event: new KeyboardEvent('keydown'),
      });
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
    });

    it('unsubscribes from the shortcut stream on unmount', async () => {
      mounted = await mountAndFlush(template(), app);

      mounted.unmount();
      mounted = null;
      await flush();

      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      await flush();

      expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
    });
  });

  describe('event isolation', () => {
    it.each(['contextmenu', 'mousedown', 'touchstart', 'wheel'])(
      'stops %s from escaping the dialog',
      async type => {
        mounted = await mountAndFlush(template(), app);
        const outside = vi.fn();
        mounted.container.addEventListener(type, outside);

        dialogOf(mounted).dispatchEvent(new Event(type, { bubbles: true }));

        expect(outside).not.toHaveBeenCalled();
        mounted.container.removeEventListener(type, outside);
      }
    );

    it('lets a click reach the root handler', async () => {
      mounted = await mountAndFlush(template(), app);
      const outside = vi.fn();
      mounted.container.addEventListener('click', outside);

      click(dialogOf(mounted));

      expect(outside).toHaveBeenCalledTimes(1);
      mounted.container.removeEventListener('click', outside);
    });
  });
});
