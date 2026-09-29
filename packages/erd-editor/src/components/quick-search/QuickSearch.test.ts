import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import {
  IME_CHOSEONG,
  IME_CLUSTERS,
  IME_SAYONG,
  seedClusterTables,
  seedHangulDocument,
} from '@/__test-utils__/hangulSeed';
import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as highlightStyles from '@/components/primitives/highlighted-text/HighlightedText.styles';
import { hangulFormsOf } from '@/components/quick-search/hangul';
import QuickSearch from '@/components/quick-search/QuickSearch';
import * as styles from '@/components/quick-search/QuickSearch.styles';
import {
  SCOPED_ACTION_LIMIT,
  TEXT_FIELDS,
} from '@/components/quick-search/scopedActions';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  editMemoAction,
  editTableAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { openFindReplaceAction, toggleSearchAction } from '@/utils/emitter';
import { InternalEventType } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

let app: AppContext;
let mounted: Mounted | null = null;
let focusEvents = 0;
let openedFindReplace = 0;
let handedOver: unknown[] = [];

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

const keydown = async (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
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
  openedFindReplace = 0;
  handedOver = [];
  app.emitter.on({
    openFindReplace: action => {
      openedFindReplace++;
      handedOver.push(action);
    },
  });
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
      'Auto Layout',
      'Find and Replace',
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

  it('ignores the toggle while a memo body is being edited', async () => {
    app.store.dispatchSync(addMemoAction$());
    const [memoId] = app.store.state.doc.memoIds;
    app.store.dispatchSync(editMemoAction({ id: memoId }));

    await open();

    expect(isOpen()).toBe(false);
  });

  // The state a $mod click leaves: a memo editor open over a table that still
  // holds the focus ring, which the old focusTable-only test could not see.
  it('ignores the toggle while a memo is open over a focused table', async () => {
    app.store.dispatchSync(addTableAction$());
    const tableId = app.store.state.doc.tableIds[0];
    app.store.dispatchSync(addMemoAction$());
    const [memoId] = app.store.state.doc.memoIds;
    app.store.dispatchSync(focusTableAction({ tableId }));
    app.store.dispatchSync(editMemoAction({ id: memoId }));
    expect(app.store.state.editor.focusTable?.edit).toBe(false);

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
    expect(rowNames().length).toBeLessThan(12);
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

    expect(rowNames()).toHaveLength(12);
    expect(rowNames()[0]).toBe('Tab');
  });

  it('treats a whitespace-only keyword as empty', async () => {
    await open();
    await type('Memo');

    await type('   ');

    expect(rowNames()).toHaveLength(12);
  });

  it('lists no command when nothing matches, only the prefixes to search the document by', async () => {
    await open();

    await type('qqqqqqqqqq');

    expect(rowNames()).toEqual([
      'Search tables for "qqqqqqqqqq"',
      'Search columns for "qqqqqqqqqq"',
      'Search comments & memos for "qqqqqqqqqq"',
    ]);
  });

  it('searches inside the already narrowed list rather than the full scope', async () => {
    await open();
    await type('Memo');
    const narrowed = rowNames();

    await type('Auto Layout');

    expect(narrowed).not.toContain('Auto Layout');
    expect(rowNames()).not.toContain('Auto Layout');
    // The level still holds it, so the list never says no command matches.
    expect(mounted?.container.querySelector('.quick-search-empty')).toBeNull();
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

    for (let i = 0; i < 11; i++) {
      await keydown('ArrowDown');
    }
    expect(selectedIndex()).toBe(11);

    await keydown('ArrowDown');
    expect(selectedIndex()).toBe(0);
  });

  it('moves the selection up from nothing to the last row', async () => {
    await open();

    const event = await keydown('ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(selectedIndex()).toBe(11);
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
    await type('#qqqqqqqqqq');

    expect((await keydown('ArrowDown')).defaultPrevented).toBe(false);
    expect((await keydown('ArrowUp')).defaultPrevented).toBe(false);
    expect(selectedIndex()).toBe(-1);
  });

  it('does nothing on Enter while no row is selected', async () => {
    await open();

    const event = await keydown('Enter');

    expect(event.cancelBubble).toBe(false);
    expect(isOpen()).toBe(true);
    expect(rowNames()).toHaveLength(12);
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
    expect(selectedIndex()).toBe(11);

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    await flush();
    expect(rowNames()).toEqual(['Tab', 'Find and Replace']);

    await keydown('Enter');

    expect(isOpen()).toBe(true);
    expect(rowNames()).toEqual(['Tab', 'Find and Replace']);
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
  it('lists no table without the # prefix', async () => {
    app.store.dispatchSync(addTableAction$());
    await open();

    expect(rowNames()).not.toContain('unnamed');

    await type('unnamed');

    expect(rowNames()).not.toContain('unnamed');
  });

  it('scrolls to and selects a table picked from the palette', async () => {
    app.store.dispatchSync(addTableAction$());
    const tableId = app.store.state.doc.tableIds[0];
    await open();

    await type('#unnamed');
    expect(rowNames()).toContain('unnamed');

    const row = rows()[rowNames().indexOf('unnamed')];
    await click(row);

    expect(app.store.state.editor.selectedMap[tableId]).toBeTruthy();
    expect(isOpen()).toBe(false);
  });
});

describe('QuickSearch column, comment and memo matches', () => {
  const keywordOf = (row: HTMLDivElement) =>
    (row.querySelector(`.${styles.keyword}`)?.textContent ?? '').trim();

  /** Whether a row is the document's: a table, or a field saying where it is. */
  const isDocumentRow = (row: HTMLDivElement) =>
    keywordOf(row) === 'Table' || keywordOf(row).includes('·');

  beforeEach(() => {
    seedFindDocument(app);
  });

  it('lists no table, column, comment or memo without a prefix, for no keyword or any', async () => {
    await open();
    expect(rows().some(isDocumentRow)).toBe(false);

    for (const keyword of ['u', 'user', 'login', 'Every', 'orders']) {
      await type('');
      await type(keyword);
      expect(rows().some(isDocumentRow)).toBe(false);
      expect(rowNames().some(name => name.startsWith('Show all'))).toBe(false);
    }
  });

  it('looks the fields up afresh on each keystroke rather than inside the last list', async () => {
    await open();
    await type('"login');
    expect(rowNames()).toContain('login email');

    await type('"primary');

    expect(rowNames()).toContain('primary id');
    expect(rowNames()).not.toContain('login email');
  });

  it('stands the reader on the column cell picked and closes', async () => {
    await open();
    await type('@user_id');
    const index = rowNames().indexOf('user_id');

    await click(rows()[index]);

    expect(isOpen()).toBe(false);
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
    });
  });

  it('switches to the ERD first when a match is picked on another tab', async () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    await open();
    await type('"login');

    await click(rows()[rowNames().indexOf('login email')]);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(app.store.state.editor.focusTable?.columnId).toBe('email');
  });

  it('lists no field inside a submenu', async () => {
    await open();
    await keydown('ArrowDown');
    await keydown('Enter');

    await type('user');

    expect(rowNames()).not.toContain('user_id');
  });

  it('opens Find and Replace from its own row', async () => {
    await open();
    await type('Find and Replace');
    const index = rowNames().indexOf('Find and Replace');

    await click(rows()[index]);

    expect(isOpen()).toBe(false);
    expect(app.store.state.editor.openMap[Open.findReplace]).toBeFalsy();
    expect(openedFindReplace).toBe(1);
  });
});

describe('QuickSearch with no command matching', () => {
  const empty = () =>
    mounted?.container.querySelector('.quick-search-empty') ?? null;

  const scopeLabel = () =>
    mounted?.container.querySelector('.quick-search-scope')?.textContent ??
    null;

  /** The rows offering a word to the prefixes that search the document. */
  const offered = (word: string) => [
    `Search tables for "${word}"`,
    `Search columns for "${word}"`,
    `Search comments & memos for "${word}"`,
  ];

  beforeEach(() => {
    seedFindDocument(app);
  });

  it('says so, and offers what is typed to the prefixes that search the document', async () => {
    await open();

    await type('orders');

    expect(empty()?.textContent?.trim()).toBe('No commands match');
    expect(rowNames()).toEqual(offered('orders'));
    expect(
      rows().map(row => row.querySelector(`.${styles.prefix}`)?.textContent)
    ).toEqual(['#', '@', '"']);
    expect(scopeLabel()).toBeNull();
    expect(mounted?.container.querySelector('.quick-search-hint')).toBeNull();
  });

  it('types the prefix of the row clicked before what is typed, the palette left open', async () => {
    await open();
    await type('orders');

    await click(rows()[0]);

    expect(isOpen()).toBe(true);
    expect(input().value).toBe('#orders');
    expect(rowNames()[0]).toBe('orders');
    expect(scopeLabel()).toBe('Tables');
    expect(empty()).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it('reaches those rows by the arrows and Enter', async () => {
    await open();
    await type('email');
    expect(empty()).not.toBeNull();

    await keydown('ArrowUp');
    await keydown('Enter');

    expect(input().value).toBe('"email');
    expect(scopeLabel()).toBe('Comments & memos');
    expect(rowNames()).toEqual(['login email']);
    expect(selectedIndex()).toBe(-1);

    await keydown('ArrowDown');
    await keydown('Enter');

    expect(isOpen()).toBe(false);
    expect(app.store.state.editor.focusTable).toMatchObject({
      columnId: 'email',
      focusType: 'columnComment',
    });
  });

  it('says nothing while a command holds the keyword, under a prefix or in a submenu', async () => {
    await open();

    await type('auto');
    expect(empty()).toBeNull();
    expect(rowNames()[0]).toBe('Auto Layout');

    await type('');
    await type('#qqqq');
    expect(empty()).toBeNull();
    expect(rows()).toHaveLength(0);

    await type('>orders');
    expect(empty()).toBeNull();
    expect(rows()).toHaveLength(0);

    await type('   ');
    expect(empty()).toBeNull();

    await type('');
    await keydown('ArrowDown');
    await keydown('Enter');
    await type('orders');
    expect(empty()).toBeNull();
    expect(rows()).toHaveLength(0);
  });

  it('lists the commands a word only fuzzes to, and offers the word below them', async () => {
    await open();

    await type('posts');

    expect(empty()).toBeNull();
    expect(rowNames()).toEqual(['Import', 'Export', ...offered('posts')]);

    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'Enter']) {
      await keydown(key);
    }

    expect(input().value).toBe('#posts');
    expect(scopeLabel()).toBe('Tables');
  });

  it('offers a table name pasted in, or left once its # is deleted, below the commands it fuzzes to', async () => {
    await open();

    await type('users');
    const pasted = rowNames();
    await type('#users');
    expect(rowNames()[0]).toBe('users');
    await type('users');

    expect(rowNames()).toEqual(pasted);
    expect(pasted.slice(0, -3)).toEqual(['Zero One', 'Zero N']);
    expect(pasted.slice(-3)).toEqual(offered('users'));
    expect(empty()).toBeNull();
  });

  it('says no command matches only when the level fuzzes to none, however far the list narrowed', async () => {
    await open();

    for (const value of ['u', 'us', 'use', 'user', 'users']) {
      await type(value);
    }
    // The narrowing left no command, though users typed afresh fuzzes to two.
    expect(rowNames()).toEqual(offered('users'));
    expect(empty()).toBeNull();

    for (const value of ['user', 'use', 'us', 'u']) {
      await type(value);
      expect(rowNames()).toEqual(offered(value));
      expect(empty()).toBeNull();
    }

    await type('qqqq');
    expect(empty()?.textContent?.trim()).toBe('No commands match');

    await type('auto');
    expect(rowNames()).toEqual(offered('auto'));
    expect(empty()).toBeNull();
  });

  it('offers the prefixes once the narrowing leaves no command, and the commands again once cleared', async () => {
    await open();

    for (const value of ['u', 'us', 'use', 'user', 'users']) {
      await type(value);
    }
    expect(rowNames()).toEqual(offered('users'));

    await type('');

    expect(empty()).toBeNull();
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
      'Auto Layout',
      'Find and Replace',
    ]);
  });

  it('lights what is typed in the rows it offers', async () => {
    await open();
    await type('orders');

    const marks = rows().map(row =>
      Array.from(row.querySelectorAll(`.${highlightStyles.highlighted}`)).map(
        mark => mark.textContent
      )
    );

    expect(marks).toEqual([['orders'], ['orders'], ['orders']]);
  });
});

describe('QuickSearch prefixes', () => {
  const COMMANDS = [
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
    'Auto Layout',
    'Find and Replace',
  ];

  const hint = () =>
    mounted?.container.querySelector<HTMLDivElement>('.quick-search-hint') ??
    null;

  const hintItems = () =>
    Array.from(hint()?.querySelectorAll('button') ?? []).map(item =>
      (item.textContent ?? '').trim()
    );

  const scopeLabel = () =>
    mounted?.container.querySelector('.quick-search-scope')?.textContent ??
    null;

  const highlighted = (row: HTMLDivElement) =>
    Array.from(row.querySelectorAll(`.${highlightStyles.highlighted}`)).map(
      mark => mark.textContent
    );

  const isTableRow = (row: HTMLDivElement) =>
    row.querySelector(`.${styles.keyword}`)?.textContent?.trim() === 'Table';

  beforeEach(() => {
    seedFindDocument(app);
  });

  it('hints at the prefixes while the input is empty, with no scope named', async () => {
    await open();

    expect(hintItems()).toEqual([
      '>Commands',
      '#Tables',
      '@Columns',
      '"Comments & memos',
      '?Help',
    ]);
    expect(scopeLabel()).toBeNull();

    await type('u');
    expect(hint()).toBeNull();

    await type('');
    expect(hint()).not.toBeNull();
  });

  it('hints nothing inside a submenu, where a prefix is plain text', async () => {
    await open();
    await keydown('ArrowDown');
    await keydown('Enter');

    expect(hint()).toBeNull();

    await type('>');

    expect(scopeLabel()).toBeNull();
    for (const name of rowNames()) {
      expect([
        'Visualization',
        'Schema SQL',
        'Generator Code',
        'Settings',
      ]).toContain(name);
    }
  });

  it('lists the commands alone after >, a space after it or not, and names the scope', async () => {
    await open();

    await type('>');

    expect(rowNames()).toEqual(COMMANDS);
    expect(scopeLabel()).toBe('Commands');
    expect(hint()).toBeNull();

    await type('> auto');
    expect(rowNames()[0]).toBe('Auto Layout');
    expect(rowNames()).not.toContain('orders');
  });

  it('lists the tables alone after #, and goes to the one picked', async () => {
    await open();

    await type('#');
    expect(rowNames()).toEqual(['orders', 'users']);
    expect(scopeLabel()).toBe('Tables');

    await type('#us');
    expect(rows().every(isTableRow)).toBe(true);
    expect(highlighted(rows()[0])).toEqual(['us']);

    await click(rows()[rowNames().indexOf('users')]);

    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
    expect(isOpen()).toBe(false);
  });

  it('lists the commands alone again once the prefix is taken away', async () => {
    await open();
    await type('#us');
    expect(rows().every(isTableRow)).toBe(true);

    await type('us');

    expect(rows().some(isTableRow)).toBe(false);
    expect(rowNames()).not.toContain('user_id');
    expect(rowNames()).toContain('Auto Layout');
    expect(scopeLabel()).toBeNull();
  });

  it('searches the whole scope on each keystroke, while the list with no prefix still narrows', async () => {
    await open();
    await type('>Memo');
    await type('>Auto Layout');
    expect(rowNames()).toContain('Auto Layout');

    await type('#Memo');
    expect(scopeLabel()).toBe('Tables');
    await type('>Auto Layout');
    expect(rowNames()).toContain('Auto Layout');

    await type('Memo');
    await type('Auto Layout');

    expect(scopeLabel()).toBeNull();
    expect(rowNames()).not.toContain('Auto Layout');
  });

  it('finds a Hangul table name an IME composes one jamo at a time', async () => {
    app.store.dispatchSync(
      addTableAction({ id: 'ko', ui: { x: 0, y: 0, zIndex: 1 } }),
      changeTableNameAction({ id: 'ko', value: '사용자' })
    );
    await open();

    // The values a Korean IME hands the input while it composes the word.
    for (const value of ['#', '#ㅅ', '#사', '#상', '#사요', '#사용']) {
      await type(value);
    }

    expect(rowNames()).toEqual(['사용자']);
  });

  it('reads the full-width prefixes a Japanese or Chinese IME types as their own', async () => {
    await open();

    await type('＃us');
    expect(rows().every(isTableRow)).toBe(true);
    expect(scopeLabel()).toBe('Tables');

    await type('＠users。em');
    expect(rowNames()).toEqual(['email']);
    expect(highlighted(rows()[0])).toEqual(['em', 'users', 'em']);

    await type('“user id”');
    expect(rowNames()).toEqual(['user id']);

    await type('》auto');
    expect(rowNames()[0]).toBe('Auto Layout');
    expect(scopeLabel()).toBe('Commands');

    await type('？');
    expect(scopeLabel()).toBe('Help');
  });

  it('lists the columns alone after @, narrowed by the table before a dot', async () => {
    await open();

    await type('@em');
    expect(rowNames()).toEqual(['email']);
    expect(scopeLabel()).toBe('Columns');

    await type('@users.');
    expect(rowNames()).toEqual(['id', 'email']);

    await type('@users.em');
    expect(rowNames()).toEqual(['email']);
    // The column part lit in the name, both parts in where it is.
    expect(highlighted(rows()[0])).toEqual(['em', 'users', 'em']);

    await click(rows()[0]);

    expect(isOpen()).toBe(false);
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'email',
      focusType: 'columnName',
    });
  });

  it('lists the comments and memos alone after a double quote', async () => {
    await open();

    await type('"user');

    expect(rowNames()).toEqual(['user id', 'Every user_id points at users.id']);
    expect(scopeLabel()).toBe('Comments & memos');

    await type('"user id"');

    expect(rowNames()).toEqual(['user id']);
    expect(highlighted(rows()[0])).toEqual(['user id']);
  });

  it('hands a scoped search to Find and Replace with its scopes set', async () => {
    for (let index = 0; index <= SCOPED_ACTION_LIMIT; index++) {
      app.store.dispatchSync(
        addMemoAction({ id: `m${index}`, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeMemoValueAction({ id: `m${index}`, value: 'many user' })
      );
    }
    await open();
    await type('" user');
    const last = rows().at(-1) as HTMLDivElement;
    expect(rowNames().at(-1)).toBe(
      `Show all ${SCOPED_ACTION_LIMIT + 4} matches in Find and Replace`
    );

    await click(last);

    expect(isOpen()).toBe(false);
    expect(handedOver).toEqual([
      openFindReplaceAction({ query: 'user', fields: TEXT_FIELDS }),
    ]);
  });

  it('lists the prefixes after ?, and a chosen one is typed in with the palette left open', async () => {
    await open();

    await type('?');
    expect(rowNames()).toEqual([
      'Commands',
      'Tables',
      'Columns',
      'Comments & memos',
    ]);
    expect(scopeLabel()).toBe('Help');

    await click(rows()[1]);

    expect(isOpen()).toBe(true);
    expect(input().value).toBe('#');
    expect(rowNames()).toEqual(['orders', 'users']);
    expect(scopeLabel()).toBe('Tables');
    expect(document.activeElement).toBe(input());
  });

  it('types the prefix of the help row chosen with Enter', async () => {
    await open();
    await type('?');

    await keydown('ArrowDown');
    await keydown('Enter');

    expect(isOpen()).toBe(true);
    expect(input().value).toBe('>');
    expect(rowNames()).toEqual(COMMANDS);
    expect(selectedIndex()).toBe(-1);
  });

  it('types the prefix of a hint clicked', async () => {
    await open();
    const [, , columns] = Array.from(hint()?.querySelectorAll('button') ?? []);

    await click(columns);

    expect(isOpen()).toBe(true);
    expect(input().value).toBe('@');
    expect(rowNames()).toEqual(['order_id', 'user_id', 'total', 'id', 'email']);
  });

  it('keeps the scopes on the other tabs, their commands the tab offers', async () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    await open();

    await type('>');
    expect(rowNames()).toEqual(['Tab', 'Find and Replace']);

    await type('#');
    expect(rowNames()).toEqual(['orders', 'users']);

    await type('@users.em');
    await click(rows()[0]);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(app.store.state.editor.focusTable?.columnId).toBe('email');
  });
});

describe('QuickSearch Hangul', () => {
  const highlighted = (row: HTMLDivElement | undefined) =>
    Array.from(
      row?.querySelectorAll(`.${highlightStyles.highlighted}`) ?? []
    ).map(mark => mark.textContent);

  const rowNamed = (name: string, kind?: string) =>
    rows().find(
      row =>
        (row.querySelector(`.${styles.name}`)?.textContent ?? '').trim() ===
          name &&
        (kind === undefined ||
          (
            row.querySelector(`.${styles.keyword}`)?.textContent ?? ''
          ).trim() === kind)
    );

  /** Types the values an IME hands the input one after another, as it does while composing. */
  const compose = async (prefix: string, steps: ReadonlyArray<string>) => {
    const seen: string[][] = [];
    for (const step of steps) {
      await type(`${prefix}${step}`);
      seen.push(rowNames());
    }
    return seen;
  };

  beforeEach(() => {
    seedHangulDocument(app);
  });

  it('offers each step a Korean IME hands over to the prefixes, and # goes on to the table 사용자', async () => {
    for (const steps of [IME_SAYONG, IME_CHOSEONG]) {
      await open();

      for (const step of steps) {
        await type(step);
        expect(rowNames()).toEqual([
          `Search tables for "${step}"`,
          `Search columns for "${step}"`,
          `Search comments & memos for "${step}"`,
        ]);
      }
      await keydown('ArrowDown');
      await keydown('Enter');

      expect(input().value).toBe(`#${steps.at(-1)}`);
      expect(rows()[0]).toBe(rowNamed('사용자', 'Table'));
      await open();
    }
  });

  it('keeps such a name at each of those steps inside the #, @ and " scopes', async () => {
    seedClusterTables(app);
    await open();

    for (const [name, steps] of IME_CLUSTERS) {
      for (const prefix of ['#', '@', '"']) {
        for (const names of await compose(prefix, steps)) {
          expect(names).toContain(name);
        }
      }
    }
  });

  it('keeps 사용자 at every step inside the #, @ and " scopes', async () => {
    const targets: Array<[string, string]> = [
      ['#', '사용자'],
      ['@', '사용자'],
      ['"', '주문한 사용자'],
    ];
    await open();

    for (const [prefix, target] of targets) {
      for (const steps of [IME_SAYONG, IME_CHOSEONG]) {
        const seen = await compose(prefix, steps);
        for (const names of seen) {
          expect(names).toContain(target);
        }
      }
    }
  });

  it('lights the syllables a Hangul keyword spells, in the name and in where it is', async () => {
    await open();

    await type('#상');
    expect(highlighted(rowNamed('사용자'))).toEqual(['사용']);

    await type('#ㅅㅇㅈ');
    expect(highlighted(rowNamed('사용자', 'Table'))).toEqual(['사용자']);
    await type('@ㅅㅇㅈ');
    expect(
      highlighted(rowNamed('사용자', '주문 내역.사용자 · Column'))
    ).toEqual(['사용자', '사용자']);

    await type('#ㅈㅁ');
    expect(rowNames()).toEqual(['주문 내역']);
    expect(highlighted(rows()[0])).toEqual(['주문']);
  });

  it('leaves a key pressed mid-syllable to the IME, and acts on the one sent once it is done', async () => {
    await open();
    await type('#ㅅㅇㅈ');

    // Chrome marks a key the IME holds isComposing; Safari sends keyCode 229.
    for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
      await keydown('ArrowDown', init);
      expect(selectedIndex()).toBe(-1);
    }
    await keydown('ArrowDown');
    expect(selectedIndex()).toBe(0);

    for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
      const event = await keydown('Enter', init);
      expect(isOpen()).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    }
    await keydown('Enter');

    expect(isOpen()).toBe(false);
    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
  });

  it('spells each text once while the palette is open, and lets the forms go as it closes', async () => {
    await open();
    await type('@ㅅㅇㅈ');
    const kept = hangulFormsOf('사용자');

    await type('@ㅅㅇ');
    expect(hangulFormsOf('사용자')).toBe(kept);

    await shortcut(KeyBindingName.stop);
    expect(isOpen()).toBe(false);
    const afterStop = hangulFormsOf('사용자');
    expect(afterStop).not.toBe(kept);
    expect(afterStop).toEqual(kept);

    await open();
    const afterOpen = hangulFormsOf('사용자');
    expect(afterOpen).not.toBe(afterStop);

    await open();
    expect(isOpen()).toBe(false);
    const afterToggle = hangulFormsOf('사용자');
    expect(afterToggle).not.toBe(afterOpen);

    mounted?.unmount();
    mounted = null;
    expect(hangulFormsOf('사용자')).not.toBe(afterToggle);
  });

  it('goes to the column a Hangul search found', async () => {
    await open();
    await type('@사');
    expect(rowNames()).toEqual(['사용자', '상품명']);

    await click(rows()[1]);

    expect(isOpen()).toBe(false);
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'products',
      columnId: 'products_name',
      focusType: 'columnName',
    });
  });
});
