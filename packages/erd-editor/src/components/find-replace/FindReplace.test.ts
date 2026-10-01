import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import FindReplace, {
  MATCH_ROW_LIMIT,
  REGEX_INPUT_DELAY,
  rowWindow,
  SEARCH_BUDGET,
} from '@/components/find-replace/FindReplace';
import {
  createFieldActions,
  SCOPED_ACTION_LIMIT,
  TEXT_FIELDS,
} from '@/components/quick-search/scopedActions';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
  changeZenModeAction,
  drawEndRelationshipAction,
  drawStartRelationshipAction,
  editTableAction,
  focusTableAction,
  hoverColumnMapAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';
import { openFindReplaceAction } from '@/utils/emitter';
import {
  FindField,
  FindFieldList,
  findMatchesBefore,
} from '@/utils/find-replace';
import { InternalEventType } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

// The panel's searches of the whole document, counted as they pass through.
vi.mock('@/utils/find-replace', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/find-replace')>();
  return { ...actual, findMatchesBefore: vi.fn(actual.findMatchesBefore) };
});

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

let app: AppContext;
let mounted: Mounted | null = null;
let focusEvents = 0;
/** Every keydown that got past the panel to the element around it. */
let escaped: KeyboardEvent[] = [];

const countFocusEvent = () => {
  focusEvents++;
};

const panel = () =>
  mounted?.container.querySelector<HTMLDivElement>('.find-replace') ?? null;
const findInput = () =>
  panel()?.querySelector<HTMLInputElement>('.find-input') as HTMLInputElement;
const replaceInput = () =>
  panel()?.querySelector<HTMLInputElement>('.replace-input') ?? null;
const button = (name: string) =>
  panel()?.querySelector<HTMLButtonElement>(`.${name}`) as HTMLButtonElement;
const countText = () =>
  (panel()?.querySelector('.find-count')?.textContent ?? '').trim();
const rows = () =>
  Array.from(
    panel()?.querySelectorAll<HTMLDivElement>('.find-replace-match') ?? []
  );
/** Each row as its two lines read: the excerpt, then where it was found. */
const rowTexts = () =>
  rows().map(row =>
    Array.from(row.querySelectorAll('span'))
      .map(span => span.textContent?.trim() ?? '')
      .join(' | ')
  );
const selectedRow = () =>
  rows().findIndex(row => row.classList.contains('selected'));
const isOpen = () => Boolean(app.store.state.editor.openMap[Open.findReplace]);

const texts = () => {
  const { collections } = app.store.state;
  return {
    users: collections.tableEntities.users.name,
    userId: collections.tableColumnEntities.orders_user_id.name,
    comment: collections.tableColumnEntities.users_id.comment,
    memo: collections.memoEntities.note.value,
  };
};

const shortcut = async (type: KeyBindingName) => {
  app.shortcut$.next({ type, event: new KeyboardEvent('keydown') });
  await flush();
};

/** Opens the panel, handed a query searched in every kind of text, or with none. */
const openWith = async (query?: string) => {
  app.emitter.emit(
    openFindReplaceAction(
      query === undefined ? undefined : { query, fields: [...FindFieldList] }
    )
  );
  await flush();
};

const type = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await flush();
};

const keydown = async (
  target: Element,
  init: KeyboardEventInit
): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  await flush();
  return event;
};

const click = async (el: Element) => {
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true })
  );
  await flush();
};

/** Past the debounce the panel waits out before it searches a changed document again. */
const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 150));
  await flush();
};

/** Past the pause the panel waits for before it searches a regular expression typed. */
const pause = async () => {
  await new Promise(resolve => setTimeout(resolve, REGEX_INPUT_DELAY + 50));
  await flush();
};

/** How many times the panel has searched the whole document since the last count was cleared. */
const searches = () => vi.mocked(findMatchesBefore).mock.calls.length;

/** A field that (a+)+$ backtracks over for a while, two to the power of its length. */
const SLOW_TEXT = `${'a'.repeat(22)}b`;

/** Runs a search with a clock that leaps past the budget at each reading, as a slow pattern would. */
async function stalled(run: () => Promise<unknown>) {
  let clock = performance.now();
  const now = vi
    .spyOn(performance, 'now')
    .mockImplementation(() => (clock += SEARCH_BUDGET + 1));
  try {
    await run();
  } finally {
    now.mockRestore();
  }
}

const listen = (event: KeyboardEvent) => {
  escaped.push(event);
};

async function setup(readonly = false) {
  mounted?.unmount();
  app?.store.destroy();
  app = createTestAppContext();
  seedFindDocument(app);
  mounted = mount(html`<${FindReplace} readonly=${readonly} />`, app);
  mounted.container.addEventListener('keydown', listen);
  await flush();
}

beforeEach(async () => {
  vi.mocked(findMatchesBefore).mockClear();
  focusEvents = 0;
  escaped = [];
  document.body.addEventListener(InternalEventType.focus, countFocusEvent);
  await setup();
});

afterEach(() => {
  document.body.removeEventListener(InternalEventType.focus, countFocusEvent);
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('rowWindow', () => {
  it('draws every row of a list that fits', () => {
    expect(rowWindow(-1, 20, 50)).toEqual([0, 20]);
  });

  it('keeps the current match in the middle of a longer list, inside its bounds', () => {
    expect(rowWindow(-1, 500, 100)).toEqual([0, 100]);
    expect(rowWindow(250, 500, 100)).toEqual([200, 300]);
    expect(rowWindow(499, 500, 100)).toEqual([400, 500]);
  });
});

describe('FindReplace opening and closing', () => {
  it('renders nothing while closed', () => {
    expect(panel()).toBeNull();
  });

  it('opens on its shortcut, focused on an empty find field, over the panels it replaces', async () => {
    app.store.dispatchSync(
      changeOpenMapAction({
        [Open.tableProperties]: true,
        [Open.themeBuilder]: true,
      })
    );

    await shortcut(KeyBindingName.findReplace);

    expect(isOpen()).toBe(true);
    expect(panel()?.textContent).toContain('Find and Replace');
    expect(findInput().value).toBe('');
    expect(document.activeElement).toBe(findInput());
    expect(countText()).toBe('');
    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
  });

  it('opens with the query it is handed, already searched', async () => {
    await openWith('user');

    expect(findInput().value).toBe('user');
    expect(countText()).toBe('5 matches');
    expect(rows()).toHaveLength(5);
  });

  it('searches a query handed over with the default options and every scope, whatever was left on', async () => {
    await openWith();
    await click(button('find-regex'));
    await click(button('find-match-case'));
    await click(button('find-whole-word'));
    await click(
      panel()?.querySelector('.find-scope[data-field="memo"]') as Element
    );
    await click(button('find-replace-close'));

    await openWith('user(');

    expect(countText()).toBe('No results');
    for (const name of ['find-regex', 'find-match-case', 'find-whole-word']) {
      expect(button(name).getAttribute('aria-pressed')).toBe('false');
    }
    const scopes = panel()?.querySelectorAll('.find-scope') ?? [];
    for (const scope of Array.from(scopes)) {
      expect(scope.getAttribute('aria-pressed')).toBe('true');
    }

    await openWith('user');
    expect(countText()).toBe('5 matches');
  });

  it("opens from the palette's last row on the count that row names", async () => {
    await openWith();
    await click(button('find-regex'));
    await click(
      panel()?.querySelector('.find-scope[data-field="tableName"]') as Element
    );
    await click(button('find-replace-close'));
    for (let index = 0; index <= SCOPED_ACTION_LIMIT; index++) {
      app.store.dispatchSync(
        addMemoAction({ id: `m${index}`, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeMemoValueAction({ id: `m${index}`, value: 'many user' })
      );
    }
    const last = createFieldActions(app, TEXT_FIELDS, 'user').at(-1);

    last?.perform?.(app);
    await flush();

    expect(last?.name).toBe(`Show all ${countText()} in Find and Replace`);
  });

  it('searches a query handed over in the scopes it names, and only those', async () => {
    const pressed = () =>
      Array.from(panel()?.querySelectorAll('.find-scope') ?? [])
        .filter(scope => scope.getAttribute('aria-pressed') === 'true')
        .map(scope => scope.getAttribute('data-field'));

    app.emitter.emit(
      openFindReplaceAction({ query: 'user', fields: [FindField.columnName] })
    );
    await flush();

    expect(pressed()).toEqual([FindField.columnName]);
    expect(countText()).toBe('1 match');

    app.emitter.emit(
      openFindReplaceAction({
        query: 'user',
        fields: [
          FindField.memo,
          FindField.tableComment,
          FindField.columnComment,
        ],
      })
    );
    await flush();

    // In the panel's own order, whatever order they were handed in.
    expect(pressed()).toEqual([
      FindField.tableComment,
      FindField.columnComment,
      FindField.memo,
    ]);
    expect(countText()).toBe('3 matches');

    await openWith('user');
    expect(pressed()).toHaveLength(5);
  });

  it('keeps the options left on when opened with no query', async () => {
    await openWith();
    await click(button('find-regex'));
    await click(button('find-replace-close'));

    await openWith();

    expect(button('find-regex').getAttribute('aria-pressed')).toBe('true');
  });

  it('takes the ERD tab when opened from another', async () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );

    await openWith();

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(panel()).not.toBeNull();
  });

  it('stays open on its shortcut again, the find field focused with its query selected', async () => {
    await shortcut(KeyBindingName.findReplace);
    await type(findInput(), 'user');
    await keydown(findInput(), { key: 'Enter', code: 'Enter' });
    button('find-next').focus();
    focusEvents = 0;

    await shortcut(KeyBindingName.findReplace);

    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(findInput());
    expect(findInput().selectionStart).toBe(0);
    expect(findInput().selectionEnd).toBe('user'.length);
    expect(countText()).toBe('1 of 5');
    expect(focusEvents).toBe(0);
  });

  it('opens in place of the palette, which gives way as its own row does', async () => {
    let toggled = 0;
    app.emitter.on({
      toggleSearch: () => {
        toggled++;
      },
    });

    await shortcut(KeyBindingName.findReplace);
    expect(toggled).toBe(0);

    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: true }));
    await shortcut(KeyBindingName.findReplace);
    expect(toggled).toBe(1);
    expect(document.activeElement).toBe(findInput());

    await click(button('find-replace-close'));
    await shortcut(KeyBindingName.findReplace);

    expect(toggled).toBe(2);
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(findInput());
  });

  it('closes from its close button', async () => {
    await openWith();

    await click(button('find-replace-close'));

    expect(isOpen()).toBe(false);
  });

  it('ignores its shortcut while a cell is being edited', async () => {
    app.store.dispatchSync(
      focusTableAction({ tableId: 'orders' }),
      editTableAction()
    );

    await shortcut(KeyBindingName.findReplace);

    expect(isOpen()).toBe(false);
  });

  it('stays shut under an overlay that takes the canvas over, and hides under the theme builder', async () => {
    let toggled = 0;
    app.emitter.on({
      toggleSearch: () => {
        toggled++;
      },
    });
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.timeTravel]: true, [Open.search]: true })
    );
    await openWith();
    await shortcut(KeyBindingName.findReplace);
    expect(isOpen()).toBe(false);
    // The palette stays too, since nothing would open in its place.
    expect(toggled).toBe(0);

    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: false }));
    await openWith();
    app.store.dispatchSync(changeOpenMapAction({ [Open.themeBuilder]: true }));
    await flush();

    expect(isOpen()).toBe(true);
    expect(panel()).toBeNull();
  });

  it('stands aside, still open, while Table Properties is up over the canvas', async () => {
    await openWith('user');

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );
    await flush();

    expect(isOpen()).toBe(true);
    expect(panel()).toBeNull();

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: false })
    );
    await flush();

    expect(panel()).not.toBeNull();
    expect(findInput().value).toBe('user');
  });

  it('sits under the toolbar, or at the top in zen mode, which takes the toolbar away', async () => {
    await openWith();
    expect(panel()?.style.top).toBe('46px');

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    await flush();

    expect(panel()?.style.top).toBe('16px');
    expect(panel()?.style.getPropertyValue('max-height')).toBe(
      'calc(100% - 32px)'
    );
  });
});

describe('FindReplace searching', () => {
  beforeEach(async () => {
    await openWith();
  });

  it('lists every occurrence as it is typed, with the match marked and where it is', async () => {
    await type(findInput(), 'user');

    expect(countText()).toBe('5 matches');
    expect(rowTexts()).toEqual([
      'user_id | orders.user_id · Column',
      'users | users · Table',
      'user id | users.id · Column comment',
      'Every user_id points at users.id | Memo',
      'Every user_id points at users.id | Memo',
    ]);
    const marks = rows().map(row => row.querySelector('mark')?.textContent);
    expect(marks).toEqual(['user', 'user', 'user', 'user', 'user']);
    expect(rows()[0].title).toBe('user_id');
  });

  it('says so when nothing matches, and nothing at all for an empty query', async () => {
    await type(findInput(), 'nothing like it');
    expect(countText()).toBe('No results');
    expect(rows()).toHaveLength(0);

    await type(findInput(), '');
    expect(countText()).toBe('');
  });

  it('counts a single match in the singular', async () => {
    await type(findInput(), 'login');

    expect(countText()).toBe('1 match');
  });

  it('keeps to the case typed and to whole words when those are pressed', async () => {
    await type(findInput(), 'User');
    await click(button('find-match-case'));
    expect(countText()).toBe('No results');
    expect(button('find-match-case').getAttribute('aria-pressed')).toBe('true');

    await click(button('find-match-case'));
    await type(findInput(), 'id');
    const all = rows().length;
    await click(button('find-whole-word'));

    expect(rows().length).toBeLessThan(all);
    expect(rowTexts()).toContain('id | users.id · Column');
  });

  it('runs a regular expression, and says when it does not parse', async () => {
    await click(button('find-regex'));
    await type(findInput(), '^(order|user)_id$');
    await pause();
    expect(countText()).toBe('2 matches');

    await type(findInput(), 'user(');
    await pause();

    expect(countText()).toBe('Invalid regular expression');
    expect(findInput().classList.contains('invalid')).toBe(true);
    expect(rows()).toHaveLength(0);
  });

  it('searches only the kinds of text left on', async () => {
    await type(findInput(), 'user');
    const memo = panel()?.querySelector<HTMLButtonElement>(
      '.find-scope[data-field="memo"]'
    ) as HTMLButtonElement;

    await click(memo);

    expect(memo.getAttribute('aria-pressed')).toBe('false');
    expect(countText()).toBe('3 matches');

    await click(memo);

    expect(memo.getAttribute('aria-pressed')).toBe('true');
    expect(countText()).toBe('5 matches');
  });

  it('searches again when the document changes under it', async () => {
    await type(findInput(), 'user');

    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'the user email',
      })
    );
    await settle();

    expect(countText()).toBe('6 matches');
  });

  it('draws a window of a long list and says which part it shows', async () => {
    for (let index = 0; index < MATCH_ROW_LIMIT; index++) {
      app.store.dispatchSync(
        addMemoAction({ id: `m${index}`, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeMemoValueAction({ id: `m${index}`, value: 'user' })
      );
    }

    await type(findInput(), 'user');
    expect(rows()).toHaveLength(MATCH_ROW_LIMIT);
    expect(panel()?.textContent).toContain(
      `Showing 1–${MATCH_ROW_LIMIT} of ${MATCH_ROW_LIMIT + 5}`
    );

    await keydown(findInput(), { key: 'Enter', shiftKey: true });

    expect(panel()?.textContent).toContain(
      `Showing 6–${MATCH_ROW_LIMIT + 5} of ${MATCH_ROW_LIMIT + 5}`
    );
    expect(selectedRow()).toBe(MATCH_ROW_LIMIT - 1);
  });
});

describe('FindReplace navigation', () => {
  beforeEach(async () => {
    await openWith('user');
  });

  it('goes to the next match on Enter and stands the reader on its cell', async () => {
    const event = await keydown(findInput(), { key: 'Enter' });

    expect(event.defaultPrevented).toBe(true);
    expect(countText()).toBe('1 of 5');
    expect(selectedRow()).toBe(0);
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
    });

    await keydown(findInput(), { key: 'Enter' });

    expect(countText()).toBe('2 of 5');
    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
  });

  it('goes back on Shift+Enter, wrapping to the last match', async () => {
    await keydown(findInput(), { key: 'Enter', shiftKey: true });

    expect(countText()).toBe('5 of 5');
    expect(app.store.state.editor.selectedMap).toEqual({ note: 'memo' });

    await click(button('find-next'));
    expect(countText()).toBe('1 of 5');

    await click(button('find-previous'));
    expect(countText()).toBe('5 of 5');
  });

  it('goes to the match whose row is clicked', async () => {
    await click(rows()[2]);

    expect(countText()).toBe('3 of 5');
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'users_id',
    });
  });

  it('leaves Enter mid-composition to the input method', async () => {
    const event = await keydown(findInput(), {
      key: 'Enter',
      isComposing: true,
    });

    expect(event.defaultPrevented).toBe(false);
    expect(countText()).toBe('5 matches');
  });

  it('keeps its place when the document changes elsewhere', async () => {
    await keydown(findInput(), { key: 'Enter' });
    await keydown(findInput(), { key: 'Enter' });

    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'no match here',
      })
    );
    await settle();

    expect(countText()).toBe('2 of 5');
  });
});

describe('FindReplace replacing', () => {
  beforeEach(async () => {
    await openWith('user');
    await type(replaceInput() as HTMLInputElement, 'member');
  });

  it('shows the first match on a Replace with none current, replacing nothing', async () => {
    await click(button('find-replace-one'));

    expect(countText()).toBe('1 of 5');
    expect(texts().userId).toBe('user_id');
  });

  it('replaces the current match and goes on to the next', async () => {
    await keydown(findInput(), { key: 'Enter' });

    await keydown(replaceInput() as HTMLInputElement, { key: 'Enter' });

    expect(texts().userId).toBe('member_id');
    expect(countText()).toBe('1 of 4');
    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
  });

  it.each([
    ['on screen', { width: 2000, height: 1200 }, false],
    ['off screen', { width: 400, height: 300 }, true],
  ])(
    'takes back a replacement whose next match is %s in one undo, a scroll to it included',
    async (_, viewport, scrolls) => {
      app.store.dispatchSync(changeViewportAction(viewport));
      await keydown(findInput(), { key: 'Enter' });
      const { originX, originY } = app.store.state.settings;
      const cursor = app.store.history.cursor;

      await keydown(replaceInput() as HTMLInputElement, { key: 'Enter' });

      // The next match is the users table, right of the orders table.
      expect(texts().userId).toBe('member_id');
      expect(countText()).toBe('1 of 4');
      expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
      expect(app.store.state.settings.originX !== originX).toBe(scrolls);
      expect(app.store.history.cursor).toBe(cursor + 1);

      app.store.undo();
      await settle();

      expect(texts().userId).toBe('user_id');
      expect(app.store.state.settings).toMatchObject({ originX, originY });
    }
  );

  it('goes past a replacement that holds the query itself', async () => {
    await type(replaceInput() as HTMLInputElement, 'super_user');
    await keydown(findInput(), { key: 'Enter', shiftKey: true });
    await keydown(findInput(), { key: 'Enter', shiftKey: true });
    expect(countText()).toBe('4 of 5');

    await click(button('find-replace-one'));

    // The user inside super_user is the one just written, so the next is users.
    expect(texts().memo).toBe('Every super_user_id points at users.id');
    expect(countText()).toBe('5 of 5');
  });

  it('wraps to the first match after replacing the last', async () => {
    await keydown(findInput(), { key: 'Enter', shiftKey: true });

    await click(button('find-replace-one'));

    expect(texts().memo).toBe('Every user_id points at members.id');
    expect(countText()).toBe('1 of 4');
  });

  it('replaces every match in one dispatch, which one undo takes back', async () => {
    const before = texts();
    const batches: string[][] = [];
    const unsubscribe = app.store.subscribe(actions => {
      batches.push(actions.map(({ type }) => type));
    });

    await click(button('find-replace-all'));
    unsubscribe();

    expect(texts()).toEqual({
      users: 'members',
      userId: 'member_id',
      comment: 'member id',
      memo: 'Every member_id points at members.id',
    });
    expect(batches[0]).toEqual([
      'column.changeName',
      'table.changeName',
      'column.changeComment',
      'memo.changeValue',
    ]);
    expect(countText()).toBe('Replaced 5 matches');
    expect(app.store.history.size).toBe(1);

    app.store.undo();
    await settle();

    expect(texts()).toEqual(before);
    expect(countText()).toBe('Replaced 5 matches');
    await type(findInput(), 'user');
    expect(countText()).toBe('5 matches');
  });

  it('says there was no change when the replacement writes every match back as it was', async () => {
    const before = texts();
    await type(replaceInput() as HTMLInputElement, 'user');

    await click(button('find-replace-all'));

    expect(countText()).toBe('No changes');
    expect(texts()).toEqual(before);
    expect(app.store.history.size).toBe(0);

    await click(button('find-regex'));
    await type(findInput(), '(user)');
    await type(replaceInput() as HTMLInputElement, '$1');
    await click(button('find-replace-all'));

    expect(countText()).toBe('No changes');
    expect(app.store.history.size).toBe(0);
  });

  it('counts only the matches a regular expression replacement changes', async () => {
    await click(button('find-regex'));
    await type(findInput(), 'users?');
    await type(replaceInput() as HTMLInputElement, 'users');

    await click(button('find-replace-all'));

    expect(countText()).toBe('Replaced 3 matches');
    expect(texts()).toEqual({
      users: 'users',
      userId: 'users_id',
      comment: 'users id',
      memo: 'Every users_id points at users.id',
    });
  });

  it('replaces every match on $mod+Enter in the replace field', async () => {
    await keydown(replaceInput() as HTMLInputElement, {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(texts().users).toBe('members');
  });

  it('reads the text as it stands, not as the last search found it', async () => {
    await keydown(findInput(), { key: 'Enter', shiftKey: true });
    app.store.dispatchSync(
      changeMemoValueAction({ id: 'note', value: 'a user wrote this' })
    );

    await click(button('find-replace-all'));

    expect(texts().memo).toBe('a member wrote this');
  });

  it('disables both replace buttons without a match', async () => {
    await type(findInput(), 'nothing like it');

    expect(button('find-replace-one').disabled).toBe(true);
    expect(button('find-replace-all').disabled).toBe(true);
  });
});

describe('FindReplace searching only when it has to', () => {
  it('searches again on an edit of a text it reads, and never on a hover, a selection, a scroll or a jump', async () => {
    await openWith('user');
    vi.mocked(findMatchesBefore).mockClear();

    app.store.dispatchSync(hoverColumnMapAction({ columnIds: ['email'] }));
    app.store.dispatchSync(selectAction({ users: SelectType.table }));
    app.store.dispatchSync(scrollToAction({ originX: 40, originY: 40 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.8 }));
    await keydown(findInput(), { key: 'Enter' });
    await click(button('find-next'));
    await click(rows()[3]);
    await settle();

    expect(searches()).toBe(0);
    expect(countText()).toBe('4 of 5');

    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'the user email',
      })
    );
    await settle();

    expect(searches()).toBe(1);
    expect(countText()).toBe('5 of 6');
  });

  it('searches once when it opens again, not once more for its own opening', async () => {
    await openWith('user');
    await click(button('find-replace-close'));
    vi.mocked(findMatchesBefore).mockClear();

    await openWith();
    await settle();

    expect(searches()).toBe(1);
    expect(countText()).toBe('5 matches');
  });

  it('searches the document once for a Replace, and lists what a search would find', async () => {
    await openWith('user');
    await type(replaceInput() as HTMLInputElement, 'super_user');
    await keydown(findInput(), { key: 'Enter' });
    vi.mocked(findMatchesBefore).mockClear();

    await click(button('find-replace-one'));
    await settle();

    expect(searches()).toBe(1);
    expect(countText()).toBe('2 of 5');
    const listed = rowTexts();
    await click(button('find-match-case'));
    await click(button('find-match-case'));
    expect(rowTexts()).toEqual(listed);
  });

  it('searches the document twice for a Replace All, before it and after', async () => {
    await openWith('user');
    await type(replaceInput() as HTMLInputElement, 'member');
    vi.mocked(findMatchesBefore).mockClear();

    await click(button('find-replace-all'));
    await settle();

    expect(searches()).toBe(2);
    expect(countText()).toBe('Replaced 5 matches');
  });

  it('searches plain text as it is typed, and a regular expression once typing pauses', async () => {
    await openWith();
    await type(findInput(), 'user');
    expect(countText()).toBe('5 matches');
    expect(searches()).toBe(1);

    await click(button('find-regex'));
    vi.mocked(findMatchesBefore).mockClear();
    for (const typed of ['user', 'user_', 'user_i', 'user_id']) {
      await type(findInput(), typed);
    }

    expect(searches()).toBe(0);
    expect(countText()).toBe('5 matches');

    await pause();

    expect(searches()).toBe(1);
    expect(countText()).toBe('2 matches');
  });

  it('goes through the matches of what is typed on an Enter pressed before the pause', async () => {
    await openWith();
    await click(button('find-regex'));
    await type(findInput(), 'users?');

    await keydown(findInput(), { key: 'Enter' });

    expect(countText()).toBe('1 of 5');
    await pause();
    expect(searches()).toBe(1);
  });

  it('drops a search still waiting for the pause when it unmounts', async () => {
    await openWith();
    await click(button('find-regex'));
    await type(findInput(), 'user');
    vi.mocked(findMatchesBefore).mockClear();

    mounted?.unmount();
    mounted = null;
    await pause();

    expect(searches()).toBe(0);
  });
});

describe('FindReplace with a pattern too slow for the document', () => {
  beforeEach(async () => {
    app.store.dispatchSync(
      changeMemoValueAction({ id: 'note', value: SLOW_TEXT })
    );
    await openWith();
    await click(button('find-regex'));
    await type(findInput(), '(a+)+$');
    await stalled(() => keydown(findInput(), { key: 'Enter' }));
  });

  it('stops it past the budget and says so, with nothing to go to or replace', async () => {
    const before = texts();
    const { cursor } = app.store.history;

    expect(countText()).toBe('Search stopped: pattern too slow');
    expect(panel()?.querySelector('.find-count.invalid')).not.toBeNull();
    expect(findInput().classList.contains('invalid')).toBe(false);
    expect(rows()).toHaveLength(0);
    for (const name of [
      'find-next',
      'find-previous',
      'find-replace-one',
      'find-replace-all',
    ]) {
      expect(button(name).disabled).toBe(true);
    }

    await type(replaceInput() as HTMLInputElement, 'x');
    await keydown(replaceInput() as HTMLInputElement, { key: 'Enter' });
    await keydown(replaceInput() as HTMLInputElement, {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(texts()).toEqual(before);
    expect(app.store.history.cursor).toBe(cursor);
  });

  it('runs it again only once the reader changes the search, not on an edit, an opening or a press', async () => {
    vi.mocked(findMatchesBefore).mockClear();

    app.store.dispatchSync(
      changeColumnCommentAction({ id: 'email', tableId: 'users', value: 'a' })
    );
    await settle();
    await click(button('find-replace-close'));
    await openWith();
    await keydown(replaceInput() as HTMLInputElement, { key: 'Enter' });

    expect(searches()).toBe(0);
    expect(countText()).toBe('Search stopped: pattern too slow');

    // On the real clock the same pattern runs within the budget.
    await click(button('find-match-case'));
    expect(searches()).toBe(1);
    expect(countText()).toBe('1 match');

    await stalled(() => click(button('find-match-case')));
    expect(countText()).toBe('Search stopped: pattern too slow');

    await stalled(() => type(findInput(), '(a+)+b'));
    await stalled(pause);
    expect(searches()).toBe(3);
    expect(countText()).toBe('Search stopped: pattern too slow');
    await type(findInput(), 'a+b');
    await pause();
    expect(countText()).toBe('1 match');
  });
});

describe('FindReplace in a read-only editor', () => {
  beforeEach(async () => {
    await setup(true);
    await openWith('user');
  });

  it('finds without offering to replace', async () => {
    expect(panel()?.textContent).toContain('Find');
    expect(panel()?.textContent).not.toContain('Find and Replace');
    expect(replaceInput()).toBeNull();
    expect(panel()?.querySelector('.find-replace-all')).toBeNull();

    await keydown(findInput(), { key: 'Enter' });

    expect(countText()).toBe('1 of 5');
  });
});

describe('FindReplace keyboard isolation', () => {
  beforeEach(async () => {
    await openWith('user');
  });

  it('keeps from the canvas its shortcuts and the keys that move its focus ring', async () => {
    for (const init of [
      { key: 'Enter', code: 'Enter' },
      { key: 'ArrowDown', code: 'ArrowDown' },
      { key: 'ArrowLeft', code: 'ArrowLeft' },
      { key: 'Tab', code: 'Tab' },
      { key: 'Tab', code: 'Tab', shiftKey: true },
      { key: ' ', code: 'Space' },
      { key: 'a', code: 'KeyA', ctrlKey: true },
      { key: 'n', code: 'KeyN', altKey: true },
      { key: 'ƒ', code: 'KeyF', altKey: true },
      { key: 'Backspace', code: 'Backspace', altKey: true },
      { key: 'Backspace', code: 'Backspace', ctrlKey: true },
    ]) {
      await keydown(findInput(), init);
    }

    expect(escaped).toEqual([]);
  });

  it('lets through the chords that edit no text: undo, redo, search, zoom and its own', async () => {
    const chords = [
      { key: 'z', code: 'KeyZ', ctrlKey: true },
      { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true },
      { key: 'k', code: 'KeyK', ctrlKey: true },
      { key: 'f', code: 'KeyF', ctrlKey: true },
      { key: '=', code: 'Equal', ctrlKey: true },
      { key: '-', code: 'Minus', ctrlKey: true },
      { key: '0', code: 'Digit0', ctrlKey: true },
    ];
    for (const init of chords) {
      await keydown(findInput(), init);
    }

    expect(escaped.map(({ code }) => code)).toEqual([
      'KeyZ',
      'KeyZ',
      'KeyK',
      'KeyF',
      'Equal',
      'Minus',
      'Digit0',
    ]);
  });

  it('lets the host hear every chord and key the editor binds to nothing', async () => {
    const presses = [
      { key: 's', code: 'KeyS', metaKey: true },
      { key: 's', code: 'KeyS', ctrlKey: true },
      { key: 'P', code: 'KeyP', metaKey: true, shiftKey: true },
      { key: 'w', code: 'KeyW', metaKey: true },
      { key: 'F5', code: 'F5' },
      { key: 'a', code: 'KeyA' },
      { key: 'Backspace', code: 'Backspace' },
    ];
    for (const init of presses) {
      await keydown(findInput(), init);
    }
    await keydown(button('find-replace-all'), presses[0]);

    expect(escaped.map(({ code }) => code)).toEqual([
      'KeyS',
      'KeyS',
      'KeyP',
      'KeyW',
      'F5',
      'KeyA',
      'Backspace',
      'KeyS',
    ]);
    expect(escaped.every(event => !event.defaultPrevented)).toBe(true);
  });

  it('follows a host that remaps a shortcut, keeping the new chord off the canvas', async () => {
    app.keyBindingMap.addMemo = [{ shortcut: 'Alt+KeyQ' }];

    await keydown(findInput(), { key: 'q', code: 'KeyQ', altKey: true });
    await keydown(findInput(), { key: 'm', code: 'KeyM', altKey: true });

    expect(escaped.map(({ code }) => code)).toEqual(['KeyM']);
  });

  it('stops even a passing chord mid-composition', async () => {
    await keydown(findInput(), {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      isComposing: true,
    });

    expect(escaped).toEqual([]);
  });

  it('closes on the Escape the canvas hears, pressed anywhere in the editor', async () => {
    focusEvents = 0;

    await shortcut(KeyBindingName.stop);

    expect(isOpen()).toBe(false);
    expect(focusEvents).toBe(1);
  });

  it('leaves that Escape to what takes it first: a cell editor, a draw or the palette', async () => {
    app.store.dispatchSync(
      focusTableAction({ tableId: 'orders' }),
      editTableAction()
    );
    await shortcut(KeyBindingName.stop);
    expect(isOpen()).toBe(true);

    app.store.dispatchSync(
      focusTableAction({ tableId: 'orders' }),
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );
    await shortcut(KeyBindingName.stop);
    expect(isOpen()).toBe(true);

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.search]: true }),
      drawEndRelationshipAction()
    );
    await shortcut(KeyBindingName.stop);
    expect(isOpen()).toBe(true);
  });

  it('closes on Escape, which the canvas never hears', async () => {
    focusEvents = 0;

    const event = await keydown(findInput(), { key: 'Escape', code: 'Escape' });

    expect(event.defaultPrevented).toBe(true);
    expect(escaped).toEqual([]);
    expect(isOpen()).toBe(false);
    expect(focusEvents).toBe(1);
  });
});
