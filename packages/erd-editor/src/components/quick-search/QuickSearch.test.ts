import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as highlightStyles from '@/components/primitives/highlighted-text/HighlightedText.styles';
import QuickSearch from '@/components/quick-search/QuickSearch';
import * as styles from '@/components/quick-search/QuickSearch.styles';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  editTableAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { toggleSearchAction } from '@/utils/emitter';
import { InternalEventType } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

let app: AppContext;
let mounted: Mounted | null = null;
let focusEvents = 0;

const countFocusEvent = () => {
  focusEvents++;
};

const rows = () =>
  Array.from(
    mounted?.container.querySelectorAll<HTMLDivElement>(`.${styles.action}`) ??
      []
  );

const rowNames = () =>
  rows().map(row =>
    (row.querySelector(`.${styles.name}`)?.textContent ?? '').trim()
  );

const input = () =>
  mounted?.container.querySelector('input') as HTMLInputElement;

const selectedIndex = () =>
  rows().findIndex(row => row.classList.contains('selected'));

const shortcut = async (type: KeyBindingName) => {
  app.shortcut$.next({ type, event: new KeyboardEvent('keydown') });
  await flush();
};

const open = () => shortcut(KeyBindingName.search);

const keydown = async (key: string) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  input().dispatchEvent(event);
  await flush();
  return event;
};

const type = async (value: string) => {
  const el = input();
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await flush();
};

const click = async (el: Element) => {
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true })
  );
  await flush();
};

const isOpen = () => Boolean(app.store.state.editor.openMap[Open.search]);

async function setup(canvasType: string = CanvasType.ERD) {
  app = createTestAppContext();
  app.store.dispatchSync(changeCanvasTypeAction({ value: canvasType }));
  focusEvents = 0;
  document.body.addEventListener(InternalEventType.focus, countFocusEvent);
  mounted = mount(html`<${QuickSearch} />`, app);
  await flush();
}

beforeEach(async () => {
  await setup();
});

afterEach(() => {
  document.body.removeEventListener(InternalEventType.focus, countFocusEvent);
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('QuickSearch', () => {
  it('renders nothing while the search palette is closed', () => {
    expect(mounted?.container.querySelector(`.${styles.root}`)).toBeNull();
    expect(mounted?.container.textContent).toBe('');
  });

  it('opens on the search shortcut and lists the ERD scope actions', async () => {
    await open();

    expect(isOpen()).toBe(true);
    expect(mounted?.container.querySelector('.quick-search')).toBeTruthy();
    expect(input().getAttribute('placeholder')).toBe('Search');
    expect(rowNames()).toEqual([
      'Tab',
      'Database',
      'Import',
      'Export',
      'New Table',
      'New Memo',
      'Zero One',
      'Zero N',
      'One Only',
      'One N',
      'Automatic Table Placement',
    ]);
  });

  it('opens on the toggleSearch emitter action too', async () => {
    app.emitter.emit(toggleSearchAction());
    await flush();

    expect(isOpen()).toBe(true);
  });

  it('closes the table properties and theme builder panels when it opens', async () => {
    app.store.dispatchSync(
      changeOpenMapAction({
        [Open.tableProperties]: true,
        [Open.themeBuilder]: true,
      })
    );

    await open();

    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
  });

  it('toggles closed on a second search shortcut and re-emits focus', async () => {
    await open();
    focusEvents = 0;

    await open();

    expect(isOpen()).toBe(false);
    expect(mounted?.container.querySelector('.quick-search')).toBeNull();
    expect(focusEvents).toBe(1);
  });

  it('closes on the stop shortcut', async () => {
    await open();
    focusEvents = 0;

    await shortcut(KeyBindingName.stop);

    expect(isOpen()).toBe(false);
    expect(focusEvents).toBe(1);
  });

  it('ignores the toggle while a table cell is being edited', async () => {
    app.store.dispatchSync(addTableAction$());
    const tableId = app.store.state.doc.tableIds[0];
    app.store.dispatchSync(focusTableAction({ tableId }), editTableAction());
    expect(app.store.state.editor.focusTable?.edit).toBe(true);

    await open();

    expect(isOpen()).toBe(false);
  });

  it('still toggles while a table is focused but not being edited', async () => {
    app.store.dispatchSync(addTableAction$());
    const tableId = app.store.state.doc.tableIds[0];
    app.store.dispatchSync(focusTableAction({ tableId }));

    await open();

    expect(isOpen()).toBe(true);
  });

  it('renders an icon, keyword column and shortcut only when the action has them', async () => {
    await open();
    const [tab] = rows();
    const newTable = rows()[4];
    const zeroOne = rows()[6];

    expect(tab.querySelector(`.${styles.icon}`)).toBeNull();
    expect(tab.querySelector(`.${styles.keyword}`)).toBeNull();
    expect(tab.querySelector('.kbd')).toBeNull();

    expect(newTable.querySelector(`.${styles.icon}`)).toBeTruthy();
    expect(newTable.querySelector(`.${styles.keyword}`)).toBeNull();
    expect(newTable.querySelector('.kbd')?.textContent).toContain('Alt');

    expect(zeroOne.querySelector(`.${styles.icon}`)).toBeTruthy();
    expect(
      zeroOne.querySelector(`.${styles.keyword}`)?.textContent?.trim()
    ).toBe('Relationship');
    expect(zeroOne.querySelector(`.${styles.vertical}`)).toBeTruthy();
    expect(zeroOne.querySelector('.kbd')).toBeTruthy();
  });
});

describe('QuickSearch keyword filtering', () => {
  it('narrows the list to the fuzzy matches of the typed keyword', async () => {
    await open();

    await type('New Memo');

    expect(rowNames()).toContain('New Memo');
    expect(rowNames().length).toBeLessThan(11);
    expect(input().value).toBe('New Memo');
  });

  it('highlights the matched substring inside the row name', async () => {
    await open();

    await type('Memo');

    const marks = mounted?.container.querySelectorAll(
      `.${highlightStyles.highlighted}`
    );
    expect(marks?.length).toBeGreaterThan(0);
  });

  it('restores the full list when the keyword is cleared', async () => {
    await open();
    await type('Memo');

    await type('');

    expect(rowNames()).toHaveLength(11);
    expect(rowNames()[0]).toBe('Tab');
  });

  it('treats a whitespace-only keyword as empty', async () => {
    await open();
    await type('Memo');

    await type('   ');

    expect(rowNames()).toHaveLength(11);
  });

  it('renders an empty list when nothing matches', async () => {
    await open();

    await type('qqqqqqqqqq');

    expect(rows()).toHaveLength(0);
  });

  it('searches inside the already narrowed list rather than the full scope', async () => {
    await open();
    await type('Memo');
    const narrowed = rowNames();

    await type('Automatic Table Placement');

    expect(narrowed).not.toContain('Automatic Table Placement');
    expect(rowNames()).not.toContain('Automatic Table Placement');
  });

  it('resets the selection when the keyword changes', async () => {
    await open();
    await keydown('ArrowDown');
    expect(selectedIndex()).toBe(0);

    await type('New');

    expect(selectedIndex()).toBe(-1);
  });
});

describe('QuickSearch keyboard navigation', () => {
  it('ignores keys that are not part of the autocomplete set', async () => {
    await open();

    const event = await keydown('KeyA');

    expect(event.defaultPrevented).toBe(false);
    expect(selectedIndex()).toBe(-1);
  });

  it('moves the selection down and wraps back to the first row', async () => {
    await open();

    const event = await keydown('ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(selectedIndex()).toBe(0);

    for (let i = 0; i < 10; i++) {
      await keydown('ArrowDown');
    }
    expect(selectedIndex()).toBe(10);

    await keydown('ArrowDown');
    expect(selectedIndex()).toBe(0);
  });

  it('moves the selection up from nothing to the last row', async () => {
    await open();

    const event = await keydown('ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(selectedIndex()).toBe(10);
  });

  it('clears the selection on the horizontal arrows', async () => {
    await open();
    await keydown('ArrowDown');
    await keydown('ArrowLeft');
    expect(selectedIndex()).toBe(-1);

    await keydown('ArrowDown');
    await keydown('ArrowRight');
    expect(selectedIndex()).toBe(-1);
  });

  it('does not preventDefault on the arrows when the list is empty', async () => {
    await open();
    await type('qqqqqqqqqq');

    expect((await keydown('ArrowDown')).defaultPrevented).toBe(false);
    expect((await keydown('ArrowUp')).defaultPrevented).toBe(false);
    expect(selectedIndex()).toBe(-1);
  });

  it('does nothing on Enter while no row is selected', async () => {
    await open();

    const event = await keydown('Enter');

    expect(event.cancelBubble).toBe(false);
    expect(isOpen()).toBe(true);
    expect(rowNames()).toHaveLength(11);
  });

  it('performs the selected action on Enter and closes the palette', async () => {
    await open();
    for (let i = 0; i < 6; i++) {
      await keydown('ArrowDown');
    }
    expect(rowNames()[5]).toBe('New Memo');

    await keydown('Enter');

    expect(app.store.state.doc.memoIds).toHaveLength(1);
    expect(isOpen()).toBe(false);
  });

  it('descends into a submenu on Enter without closing the palette', async () => {
    await open();
    await keydown('ArrowDown');

    await keydown('Enter');

    expect(isOpen()).toBe(true);
    expect(rowNames()).toEqual([
      'Visualization',
      'Schema SQL',
      'Generator Code',
      'Settings',
    ]);
    expect(selectedIndex()).toBe(-1);
    expect(input().value).toBe('');
  });

  it('keeps the submenu as the restore point for a cleared keyword', async () => {
    await open();
    await keydown('ArrowDown');
    await keydown('Enter');

    await type('Settings');
    expect(rowNames()).toContain('Settings');

    await type('');

    expect(rowNames()).toEqual([
      'Visualization',
      'Schema SQL',
      'Generator Code',
      'Settings',
    ]);
  });

  it('ignores Enter when the selected index no longer exists', async () => {
    await open();
    await keydown('ArrowUp');
    expect(selectedIndex()).toBe(10);

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    await flush();
    expect(rowNames()).toEqual(['Tab']);

    await keydown('Enter');

    expect(isOpen()).toBe(true);
    expect(rowNames()).toEqual(['Tab']);
  });
});

describe('QuickSearch mouse interaction', () => {
  it('performs the clicked action and closes the palette', async () => {
    await open();
    focusEvents = 0;

    await click(rows()[4]);

    expect(app.store.state.doc.tableIds).toHaveLength(1);
    expect(isOpen()).toBe(false);
    expect(focusEvents).toBe(1);
  });

  it('opens a submenu on click without closing or bubbling to the overlay', async () => {
    await open();

    await click(rows()[0]);

    expect(isOpen()).toBe(true);
    expect(rowNames()).toEqual([
      'Visualization',
      'Schema SQL',
      'Generator Code',
      'Settings',
    ]);
  });

  it('switches the canvas type from a submenu row', async () => {
    await open();
    await click(rows()[0]);

    await click(rows()[1]);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.schemaSQL);
    expect(isOpen()).toBe(false);
  });

  it('closes when the backdrop outside the palette is clicked', async () => {
    await open();
    const root = mounted?.container.querySelector(
      `.${styles.root}`
    ) as HTMLDivElement;
    focusEvents = 0;

    await click(root);

    expect(isOpen()).toBe(false);
    expect(focusEvents).toBe(1);
  });

  it('stays open when the palette body itself is clicked', async () => {
    await open();
    const panel = mounted?.container.querySelector(
      '.quick-search'
    ) as HTMLDivElement;

    await click(panel);

    expect(isOpen()).toBe(true);
  });

  it('stays open when the search input is clicked', async () => {
    await open();

    await click(input());

    expect(isOpen()).toBe(true);
  });
});

describe('QuickSearch table actions', () => {
  it('scrolls to and selects a table picked from the palette', async () => {
    app.store.dispatchSync(addTableAction$());
    const tableId = app.store.state.doc.tableIds[0];
    await open();

    await type('unnamed');
    expect(rowNames()).toContain('unnamed');

    const row = rows()[rowNames().indexOf('unnamed')];
    await click(row);

    expect(app.store.state.editor.selectedMap[tableId]).toBeTruthy();
    expect(isOpen()).toBe(false);
  });
});
