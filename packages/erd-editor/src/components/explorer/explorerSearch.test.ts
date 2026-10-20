import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { openSearchOn } from '@/__test-utils__/explorerSearch';
import { seedFindDocument } from '@/__test-utils__/findSeed';
import {
  createTestAppContext,
  createTestI18n,
  flush,
  mount,
  Mounted,
  pseudoMessages,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  measureRoot,
  observeViewport,
} from '@/components/erd-editor/viewportLayout';
import { flattenTree } from '@/components/primitives/tree/treeModel';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
  changeZenModeAction,
  hoverColumnMapAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addIndexAction,
  changeIndexNameAction,
} from '@/engine/modules/index/atom.actions';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableCommentAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  changeColumnCommentAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';
import type { Unsubscribe } from '@/internal-types';
import {
  DEFAULT_FIND_FIELDS,
  FindField,
  FindFieldList,
  findMatches,
  treeOrderOf,
} from '@/utils/find-replace';

import ExplorerController from './explorer-controller/ExplorerController';
import { closeExplorer, isExplorerShown } from './explorerCommands';
import {
  countText,
  goToMatch,
  goToNext,
  goToPrevious,
  REGEX_INPUT_DELAY,
  replaceAll,
  replaceOne,
  searchRuntimeOf,
  setQuery,
  setReplacement,
  toggleField,
  toggleOption,
} from './explorerSearch';
import { buildSearchTree, searchExpanded } from './explorerTree';
import { explorerViewOf } from './explorerView';

// The searches of the whole document, counted as they pass through.
vi.mock('@/utils/find-replace', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/find-replace')>();
  return { ...actual, findMatches: vi.fn(actual.findMatches) };
});

const ROOMY = { width: 1200, height: 800 };

let app: AppContext;
let mounted: Mounted | null = null;
let stopViewport: Unsubscribe | null = null;
let toasts: string[] = [];
const i18n = createTestI18n('en');

const view = () => explorerViewOf(app.store);
const count = () => countText(app.store, i18n);
const searches = () => vi.mocked(findMatches).mock.calls.length;
const at = () => view().matches.map(({ field, id }) => `${field}:${id}`);

const texts = () => {
  const { collections } = app.store.state;
  return {
    users: collections.tableEntities.users.name,
    userId: collections.tableColumnEntities.orders_user_id.name,
    comment: collections.tableColumnEntities.users_id.comment,
    memo: collections.memoEntities.note.value,
  };
};

/** Opens the search as the palette row does, then searches a query in the scopes given, or none. */
const open = async (query?: string, fields?: FindField[]) => {
  openSearchOn(app, query, fields);
  await flush();
};

/** Past the debounce an edit of a searched text waits out. */
const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 150));
  await flush();
};

/** Past the pause a regular expression typed waits for. */
const pause = async () => {
  await new Promise(resolve => setTimeout(resolve, REGEX_INPUT_DELAY + 50));
  await flush();
};

async function setup() {
  mounted?.unmount();
  stopViewport?.();
  app?.store.destroy();
  app = createTestAppContext();
  seedFindDocument(app);
  stopViewport = observeViewport(app.store);
  measureRoot(app.store, ROOMY);
  app.emitter.on({
    openToast: ({ payload }) => {
      toasts.push(payload.key ?? '');
    },
  });
  mounted = mount(html`<${ExplorerController} />`, app);
  await flush();
}

beforeEach(async () => {
  vi.mocked(findMatches).mockClear();
  toasts = [];
  await setup();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  stopViewport?.();
  stopViewport = null;
  app.store.destroy();
});

describe('explorer search opening', () => {
  it('opens the Explorer on its search, trading the five dialogs for it and asking for the keyboard', async () => {
    app.store.dispatchSync(
      changeOpenMapAction({
        [Open.tableProperties]: true,
        [Open.themeBuilder]: true,
        [Open.exportImage]: true,
        [Open.localePicker]: true,
        [Open.mapColumns]: true,
      })
    );

    await open();

    const { openMap } = app.store.state.editor;
    expect(view().open).toBe(true);
    expect(isExplorerShown(app.store)).toBe(true);
    expect(view().query).toBe('');
    expect(count()).toBe('');
    expect(view().focusRequest).toBe(1);
    for (const name of [
      Open.tableProperties,
      Open.themeBuilder,
      Open.exportImage,
      Open.localePicker,
      Open.mapColumns,
    ]) {
      expect(openMap[name]).toBe(false);
    }
  });

  /** An owner decision: a comment or memo is prose, which a rename across the names would rewrite too. */
  it('searches first the names and logical names of tables, columns, indexes and table groups alone (AC-Q2)', async () => {
    await open();
    setQuery(app.store, 'user');

    expect(view().fields).toEqual(DEFAULT_FIND_FIELDS);
    expect(Object.isFrozen(view().fields)).toBe(false);
    expect(count()).toBe('2 matches');
    expect(at()).toEqual(['columnName:orders_user_id', 'tableName:users']);
  });

  it('keeps the scopes set for as long as the element lives, and a new one starts on the names alone (AC-Q2)', async () => {
    await open();
    toggleField(app.store, FindField.memo);
    toggleField(app.store, FindField.tableComment);
    toggleField(app.store, FindField.tableName);
    closeExplorer(app.store);

    await open();

    expect(view().fields).toEqual([
      FindField.tableComment,
      FindField.columnName,
      FindField.memo,
      FindField.indexName,
      FindField.tableGroupName,
      FindField.logicalName,
    ]);

    await setup();
    await open();
    expect(view().fields).toEqual(DEFAULT_FIND_FIELDS);
  });

  it('keeps the options left on when opened with no query', async () => {
    await open();
    toggleOption(app.store, 'regex');
    closeExplorer(app.store);

    await open();

    expect(view().regex).toBe(true);
  });

  it('takes the ERD tab when opened from another', async () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );

    await open();

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(isExplorerShown(app.store)).toBe(true);
  });

  /** An owner decision of 2026-10-13: a window too narrow says so, and the panel waits open. */
  it('says the window is too narrow rather than show nothing, and keeps the panel open with its search', async () => {
    measureRoot(app.store, { width: 500, height: 800 });

    await open('user');

    expect(toasts).toEqual(['explorer.tooNarrow']);
    expect(view().open).toBe(true);
    expect(isExplorerShown(app.store)).toBe(false);
    expect(view().focusRequest).toBe(0);
    expect(count()).toBe('5 matches');
  });

  it('opens nothing under an overlay that takes the canvas over', async () => {
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));

    await open('user');

    expect(view().open).toBe(false);
    expect(view().query).toBe('');
  });

  /** An owner decision of 2026-10-13: an opening under zen mode shows the panel and leaves zen on. */
  it('shows the panel under zen mode and leaves zen on (AC-S21)', async () => {
    app.store.dispatchSync(changeZenModeAction({ value: true }));

    await open('user');

    expect(app.store.state.editor.zenMode).toBe(true);
    expect(isExplorerShown(app.store)).toBe(true);
  });
});

describe('explorer search searching', () => {
  beforeEach(async () => {
    await open('', [...FindFieldList]);
  });

  it('finds every occurrence as it is typed, in the order of the tree', () => {
    setQuery(app.store, 'user');

    expect(count()).toBe('5 matches');
    expect(at()).toEqual([
      'columnName:orders_user_id',
      'tableName:users',
      'columnComment:users_id',
      'memo:note',
      'memo:note',
    ]);
  });

  it('says so when nothing matches, and nothing at all for an empty query', () => {
    setQuery(app.store, 'nothing like it');
    expect(count()).toBe('No results');
    expect(view().matches).toEqual([]);

    setQuery(app.store, '');
    expect(count()).toBe('');
  });

  it('counts a single match in the singular', () => {
    setQuery(app.store, 'login');

    expect(count()).toBe('1 match');
  });

  it('keeps to the case typed and to whole words when those are pressed', () => {
    setQuery(app.store, 'User');
    toggleOption(app.store, 'matchCase');
    expect(count()).toBe('No results');

    toggleOption(app.store, 'matchCase');
    setQuery(app.store, 'id');
    const all = view().matches.length;
    toggleOption(app.store, 'wholeWord');

    expect(view().matches.length).toBeLessThan(all);
    expect(at()).toContain('columnName:users_id');
  });

  it('runs a regular expression once typing pauses, and says when it does not parse', async () => {
    toggleOption(app.store, 'regex');
    setQuery(app.store, '^(order|user)_id$');
    await pause();
    expect(count()).toBe('2 matches');

    setQuery(app.store, 'user(');
    await pause();

    expect(count()).toBe('Invalid regular expression');
    expect(view().error).toBe('invalid');
    expect(view().matches).toEqual([]);
  });

  it('searches only the kinds of text left on', () => {
    setQuery(app.store, 'user');

    toggleField(app.store, FindField.memo);
    expect(count()).toBe('3 matches');

    toggleField(app.store, FindField.memo);
    expect(count()).toBe('5 matches');
  });

  it('puts every match in the tree, however many (AC-Q7)', () => {
    for (let index = 0; index < 200; index++) {
      app.store.dispatchSync(
        addMemoAction({ id: `m${index}`, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeMemoValueAction({ id: `m${index}`, value: 'user' })
      );
    }

    setQuery(app.store, 'user');

    expect(count()).toBe('205 matches');
    const tree = buildSearchTree(app.store.state, view().matches);
    const rows = flattenTree(tree.roots, searchExpanded(tree.branchIds, {}));
    expect(
      rows.filter(({ node }) => node.data.kind === 'excerpt')
    ).toHaveLength(203);
  });

  it('shows every row a new search finds open, and leaves the folding outside a search as it was (AC-Q10)', () => {
    const expanded = view().expanded;
    setQuery(app.store, 'user');
    view().searchCollapsed = { 't:orders': true };

    setQuery(app.store, 'users');
    expect(view().searchCollapsed).toEqual({});

    view().searchCollapsed = { 't:users': true };
    setQuery(app.store, '');
    expect(view().expanded).toBe(expanded);
  });
});

describe('explorer search navigation', () => {
  beforeEach(async () => {
    await open('user');
  });

  it('goes to the next match, standing the reader and the tree on it', () => {
    goToNext(app.store);

    expect(count()).toBe('1 of 5');
    expect(view().activeId).toBe('c:orders_user_id');
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
    });

    goToNext(app.store);

    expect(count()).toBe('2 of 5');
    expect(view().activeId).toBe('t:users');
    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
  });

  it('goes back, wrapping to the last match', () => {
    goToPrevious(app.store);

    expect(count()).toBe('5 of 5');
    expect(view().activeId).toBe('m:note/x:memo:24');
    expect(app.store.state.editor.selectedMap).toEqual({ note: 'memo' });

    goToNext(app.store);
    expect(count()).toBe('1 of 5');

    goToPrevious(app.store);
    expect(count()).toBe('5 of 5');
  });

  it('goes to the match a row names', () => {
    goToMatch(app.store, view().matches[2]);

    expect(count()).toBe('3 of 5');
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'users_id',
    });
  });

  it('closes Table Properties before it jumps, as a row of the tree does', () => {
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );

    goToNext(app.store);

    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
  });

  it('keeps its place when the document changes elsewhere', async () => {
    goToNext(app.store);
    goToNext(app.store);

    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'no match here',
      })
    );
    await settle();

    expect(count()).toBe('2 of 5');
  });
});

describe('explorer search revealing a match', () => {
  const drawn = () => {
    const tree = buildSearchTree(app.store.state, view().matches);
    return flattenTree(
      tree.roots,
      searchExpanded(tree.branchIds, view().searchCollapsed)
    ).map(({ node }) => node.id);
  };

  beforeEach(async () => {
    app.store.dispatchSync(
      changeTableCommentAction({ id: 'orders', value: 'the user orders' }),
      addIndexAction({ id: 'i_orders', tableId: 'orders' }),
      changeIndexNameAction({
        id: 'i_orders',
        tableId: 'orders',
        value: 'idx_user',
      }),
      addTableGroupAction({
        id: 'g_users',
        ui: { x: 0, y: 0, width: 100, height: 100, zIndex: 1 },
      }),
      changeTableGroupNameAction({ id: 'g_users', value: 'user accounts' }),
      changeColumnLogicalNameAction({
        id: 'total',
        tableId: 'orders',
        value: 'User Total',
      })
    );
    await open('user');
  });

  it.each(FindFieldList.map(field => [field]))(
    'unfolds the rows above a %s match inside a folded branch, so the current row is drawn',
    field => {
      const match = view().matches.find(found => found.field === field)!;
      expect(match).toBeDefined();
      const { branchIds } = buildSearchTree(app.store.state, view().matches);
      view().searchCollapsed = Object.fromEntries(
        branchIds.map(id => [id, true as const])
      );

      goToMatch(app.store, match);

      expect(drawn()).toContain(view().activeId);
    }
  );
});

describe('explorer search replacing', () => {
  beforeEach(async () => {
    await open('user');
    setReplacement(app.store, 'member');
  });

  it('shows the first match on a Replace with none current, replacing nothing', () => {
    replaceOne(app.store);

    expect(count()).toBe('1 of 5');
    expect(texts().userId).toBe('user_id');
  });

  it('unfolds the rows above the next match a Replace goes to', () => {
    goToNext(app.store);
    const tree = buildSearchTree(app.store.state, view().matches);
    view().searchCollapsed = Object.fromEntries(
      tree.branchIds.map(id => [id, true as const])
    );

    replaceOne(app.store);

    const next = buildSearchTree(app.store.state, view().matches);
    const rows = flattenTree(
      next.roots,
      searchExpanded(next.branchIds, view().searchCollapsed)
    );
    expect(rows.map(({ node }) => node.id)).toContain(view().activeId);
  });

  it('replaces the current match and goes on to the next', () => {
    goToNext(app.store);

    replaceOne(app.store);

    expect(texts().userId).toBe('member_id');
    expect(count()).toBe('1 of 4');
    expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
    expect(view().activeId).toBe('t:users');
  });

  it.each([
    ['inside the middle of the canvas', { width: 2000, height: 1200 }, false],
    ['outside it', { width: 400, height: 300 }, true],
  ])(
    'takes back a replacement whose next match is %s in one undo, a scroll to it included (AC-R2)',
    async (_, viewport, scrolls) => {
      app.store.dispatchSync(changeViewportAction(viewport));
      goToNext(app.store);
      const { originX, originY } = app.store.state.settings;
      const cursor = app.store.history.cursor;

      replaceOne(app.store);

      // The next match is the users table, right of the orders table.
      expect(texts().userId).toBe('member_id');
      expect(app.store.state.editor.selectedMap).toEqual({ users: 'table' });
      expect(app.store.state.settings.originX !== originX).toBe(scrolls);
      expect(app.store.history.cursor).toBe(cursor + 1);

      app.store.undo();
      await settle();

      expect(texts().userId).toBe('user_id');
      expect(app.store.state.settings).toMatchObject({ originX, originY });
    }
  );

  it('goes past a replacement that holds the query itself', () => {
    setReplacement(app.store, 'super_user');
    goToPrevious(app.store);
    goToPrevious(app.store);
    expect(count()).toBe('4 of 5');

    replaceOne(app.store);

    expect(texts().memo).toBe('Every super_user_id points at users.id');
    expect(count()).toBe('5 of 5');
  });

  it('replaces each match once on its way round, a replacement holding the query included', () => {
    setReplacement(app.store, 'super_user');
    goToNext(app.store);
    const counts: string[] = [];

    for (let pressed = 0; pressed < 5; pressed++) {
      replaceOne(app.store);
      counts.push(count());
    }

    expect(counts).toEqual([
      '2 of 5',
      '3 of 5',
      '4 of 5',
      '5 of 5',
      'No more matches',
    ]);
    expect(texts()).toEqual({
      users: 'super_users',
      userId: 'super_user_id',
      comment: 'super_user id',
      memo: 'Every super_user_id points at super_users.id',
    });
  });

  it('stops where a run of Replace began, holding there until a jump starts a new one (AC-R4)', async () => {
    const comment = () =>
      app.store.state.collections.tableEntities.orders.comment;
    setQuery(app.store, 'Customer');
    setReplacement(app.store, 'Big Customer');
    goToNext(app.store);

    replaceOne(app.store);

    expect(comment()).toBe('Big Customer orders');
    expect(count()).toBe('No more matches');

    // A press past the stop neither replaces nor goes round to what it wrote.
    replaceOne(app.store);
    expect(comment()).toBe('Big Customer orders');
    expect(count()).toBe('No more matches');

    goToNext(app.store);
    expect(count()).toBe('1 of 1');

    replaceOne(app.store);
    expect(comment()).toBe('Big Big Customer orders');
    expect(count()).toBe('No more matches');

    // An undo gives the run's field back, and the press after it shows a new run's first match.
    app.store.undo();
    await settle();
    expect(count()).toBe('1 match');

    replaceOne(app.store);
    expect(comment()).toBe('Big Customer orders');
    expect(count()).toBe('1 of 1');
  });

  it('keeps a run going when only its replacement changes, stopping where it began', () => {
    goToNext(app.store);
    replaceOne(app.store);
    setReplacement(app.store, 'super_user');
    const counts: string[] = [];

    for (let pressed = 0; pressed < 5; pressed++) {
      replaceOne(app.store);
      counts.push(count());
    }

    expect(counts).toEqual([
      '2 of 4',
      '3 of 4',
      '4 of 4',
      'No more matches',
      'No more matches',
    ]);
    expect(texts()).toEqual({
      users: 'super_users',
      userId: 'member_id',
      comment: 'super_user id',
      memo: 'Every super_user_id points at super_users.id',
    });
  });

  it('stops where a run began though a table walked before it went away mid-run', async () => {
    const comment = () =>
      app.store.state.collections.tableEntities.orders.comment;
    app.store.dispatchSync(
      changeMemoValueAction({ id: 'note', value: 'Customer notes' })
    );
    await settle();
    setQuery(app.store, 'Customer');
    setReplacement(app.store, 'Big Customer');
    goToPrevious(app.store);
    expect(count()).toBe('2 of 2');

    replaceOne(app.store);
    expect(texts().memo).toBe('Big Customer notes');
    expect(count()).toBe('1 of 2');

    // A peer removes a table the walk reads before the memo the run began in.
    app.store.dispatchSync(removeTableAction({ id: 'users' }));
    await settle();
    replaceOne(app.store);

    expect(comment()).toBe('Big Customer orders');
    expect(texts().memo).toBe('Big Customer notes');
    expect(count()).toBe('No more matches');
  });

  it('starts a new run once an undo gives back the text the run began in', async () => {
    goToNext(app.store);
    replaceOne(app.store);
    replaceOne(app.store);
    expect(count()).toBe('1 of 3');

    app.store.undo();
    app.store.undo();
    await settle();
    expect(count()).toBe('3 of 5');

    const counts: string[] = [];
    for (let pressed = 0; pressed < 5; pressed++) {
      replaceOne(app.store);
      counts.push(count());
    }

    expect(counts).toEqual([
      '3 of 4',
      '3 of 3',
      '1 of 2',
      '1 of 1',
      'No results',
    ]);
    expect(texts()).toEqual({
      users: 'members',
      userId: 'member_id',
      comment: 'member id',
      memo: 'Every member_id points at members.id',
    });
  });

  it('wraps to the first match after replacing the last', () => {
    goToPrevious(app.store);

    replaceOne(app.store);

    expect(texts().memo).toBe('Every user_id points at members.id');
    expect(count()).toBe('1 of 4');
  });

  it('replaces every match in one dispatch, which one undo takes back (AC-R3)', async () => {
    const before = texts();
    const batches: string[][] = [];
    const unsubscribe = app.store.subscribe(actions => {
      batches.push(actions.map(({ type }) => type));
    });

    replaceAll(app.store);
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
    expect(count()).toBe('Replaced 5 matches');
    expect(app.store.history.size).toBe(1);

    // The search the undo runs counts what it gave back, over what the press said.
    app.store.undo();
    await settle();

    expect(texts()).toEqual(before);
    expect(count()).toBe('5 matches');
  });

  it('says there was no change when the replacement writes every match back as it was', async () => {
    const before = texts();
    setReplacement(app.store, 'user');

    replaceAll(app.store);

    expect(count()).toBe('No changes');
    expect(texts()).toEqual(before);
    expect(app.store.history.size).toBe(0);

    toggleOption(app.store, 'regex');
    setQuery(app.store, '(user)');
    setReplacement(app.store, '$1');
    replaceAll(app.store);

    expect(count()).toBe('No changes');
    expect(app.store.history.size).toBe(0);

    // A peer's edit searches again, and the count speaks for what it found.
    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'the user email',
      })
    );
    await settle();
    expect(count()).toBe('6 matches');
  });

  it('counts only the matches a regular expression replacement changes', () => {
    toggleOption(app.store, 'regex');
    setQuery(app.store, 'users?');
    setReplacement(app.store, 'users');

    replaceAll(app.store);

    expect(count()).toBe('Replaced 3 matches');
    expect(texts()).toEqual({
      users: 'users',
      userId: 'users_id',
      comment: 'users id',
      memo: 'Every users_id points at users.id',
    });
  });

  it('reads the text as it stands, not as the last search found it', () => {
    goToPrevious(app.store);
    app.store.dispatchSync(
      changeMemoValueAction({ id: 'note', value: 'a user wrote this' })
    );

    replaceAll(app.store);

    expect(texts().memo).toBe('a member wrote this');
  });

  it('writes the replacement in the case it replaces once Preserve Case is on, which does not search (AC-Q15)', () => {
    const comment = () =>
      app.store.state.collections.tableEntities.orders.comment;
    setQuery(app.store, 'customer');
    setReplacement(app.store, 'client');
    goToNext(app.store);
    vi.mocked(findMatches).mockClear();

    toggleOption(app.store, 'preserveCase');

    expect(searches()).toBe(0);
    expect(count()).toBe('1 of 1');

    replaceOne(app.store);
    expect(comment()).toBe('Client orders');
  });

  it('leaves a run in progress as it is when Preserve Case is toggled (AC-Q15)', () => {
    goToNext(app.store);
    replaceOne(app.store);
    const { run } = searchRuntimeOf(app.store);
    const { order } = view();
    expect(run).not.toBeNull();

    toggleOption(app.store, 'preserveCase');

    expect(searchRuntimeOf(app.store).run).toBe(run);
    expect(view().order).toBe(order);
  });

  const customers = () => {
    app.store.dispatchSync(
      changeTableNameAction({ id: 'orders', value: 'Customer' }),
      changeTableNameAction({ id: 'users', value: 'Customer Log' })
    );
    setQuery(app.store, 'Customer');
    toggleField(app.store, FindField.tableComment);
    setReplacement(app.store, 'Zed Customer');
    goToNext(app.store);
  };

  it('keeps the walk in the order a run began with, a renamed table included, and stops after the two (AC-Q14)', () => {
    customers();
    expect(view().order?.tableIds).toEqual(['orders', 'users']);

    replaceOne(app.store);

    // Zed Customer now sorts after Customer Log, yet the run keeps its order.
    expect(treeOrderOf(app.store.state).tableIds).toEqual(['users', 'orders']);
    expect(view().order?.tableIds).toEqual(['orders', 'users']);

    replaceOne(app.store);
    expect(count()).toBe('No more matches');
    replaceOne(app.store);
    expect(count()).toBe('No more matches');
    expect(app.store.state.collections.tableEntities.users.name).toBe(
      'Zed Customer Log'
    );
  });

  it('goes back to the name order, tree and matches, in the step a jump ends the run with (AC-Q16)', () => {
    customers();
    replaceOne(app.store);
    const frozen = view().order;
    vi.mocked(findMatches).mockClear();

    goToNext(app.store);

    expect(searches()).toBe(0);
    expect(view().order).not.toBe(frozen);
    expect(view().order).toEqual(treeOrderOf(app.store.state));
    expect(at()).toEqual(['tableName:users', 'tableName:orders']);
    // The jump went round to the Customer in Zed Customer, now second by name.
    expect(count()).toBe('2 of 2');
    expect(view().activeId).toBe('t:orders');
    const tree = buildSearchTree(app.store.state, view().matches);
    expect(tree.roots[0].children().map(node => node.id)).toEqual([
      't:users',
      't:orders',
    ]);
  });
});

describe('explorer search searching only when it has to', () => {
  it('searches again on an edit of a text it reads, and never on a hover, a selection, a scroll or a jump (AC-Q9)', async () => {
    await open('user');
    vi.mocked(findMatches).mockClear();

    app.store.dispatchSync(hoverColumnMapAction({ columnIds: ['email'] }));
    app.store.dispatchSync(selectAction({ users: SelectType.table }));
    app.store.dispatchSync(scrollToAction({ originX: 40, originY: 40 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.8 }));
    goToNext(app.store);
    goToNext(app.store);
    goToMatch(app.store, view().matches[3]);
    await settle();

    expect(searches()).toBe(0);
    expect(count()).toBe('4 of 5');

    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'the user email',
      })
    );
    await settle();

    expect(searches()).toBe(1);
    expect(count()).toBe('5 of 6');
  });

  it('searches once when it opens again', async () => {
    await open('user');
    closeExplorer(app.store);
    vi.mocked(findMatches).mockClear();

    await open();
    await settle();

    expect(searches()).toBe(1);
    expect(count()).toBe('5 matches');
  });

  it('searches as it comes back for an edit made while it stood aside, and only then (AC-S19)', async () => {
    await open('user');
    vi.mocked(findMatches).mockClear();

    // Another tab is up while a column the search found is renamed.
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    app.store.dispatchSync(
      changeColumnNameAction({
        id: 'orders_user_id',
        tableId: 'orders',
        value: 'buyer_id',
      })
    );
    await settle();
    expect(searches()).toBe(0);

    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await flush();

    expect(searches()).toBe(1);
    expect(count()).toBe('4 matches');

    // A table goes away under an overlay that takes the canvas over.
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    app.store.dispatchSync(removeTableAction({ id: 'users' }));
    await settle();
    expect(searches()).toBe(1);

    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: false }));
    await flush();

    expect(searches()).toBe(2);
    expect(count()).toBe('2 matches');

    // Back with nothing edited, it shows what it found.
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await settle();

    expect(searches()).toBe(2);
  });

  it('searches the document once for a Replace, and twice for a Replace All', async () => {
    await open('user');
    setReplacement(app.store, 'super_user');
    goToNext(app.store);
    vi.mocked(findMatches).mockClear();

    replaceOne(app.store);
    await settle();

    expect(searches()).toBe(1);
    expect(count()).toBe('2 of 5');

    vi.mocked(findMatches).mockClear();
    replaceAll(app.store);
    await settle();

    expect(searches()).toBe(2);
  });

  it('searches plain text as it is typed, and a regular expression once typing pauses (AC-Q8)', async () => {
    await open();
    vi.mocked(findMatches).mockClear();
    setQuery(app.store, 'user');
    expect(count()).toBe('2 matches');
    expect(searches()).toBe(1);

    toggleOption(app.store, 'regex');
    vi.mocked(findMatches).mockClear();
    for (const typed of ['user', 'user_', 'user_i', 'user_id']) {
      setQuery(app.store, typed);
    }

    expect(searches()).toBe(0);
    expect(count()).toBe('2 matches');

    await pause();

    expect(searches()).toBe(1);
    expect(count()).toBe('1 match');
  });

  it('goes through the matches of what is typed on a press made before the pause', async () => {
    await open();
    toggleOption(app.store, 'regex');
    setQuery(app.store, 'users?');

    goToNext(app.store);
    expect(count()).toBe('1 of 2');

    setReplacement(app.store, 'X');
    setQuery(app.store, 'user_');
    replaceOne(app.store);
    // The first press on a search shows what it would replace, as in plain text.
    expect(texts().userId).toBe('user_id');
    expect(count()).toBe('1 of 1');

    setQuery(app.store, 'users?');
    goToPrevious(app.store);
    expect(count()).toBe('2 of 2');

    setQuery(app.store, 'user_');
    replaceAll(app.store);
    expect(texts().userId).toBe('Xid');
    expect(count()).toBe('Replaced 1 match');
    await pause();
    expect(count()).toBe('Replaced 1 match');
  });

  it('looks a row picked before the pause up among the matches of what is typed', async () => {
    await open();
    toggleOption(app.store, 'regex');
    setQuery(app.store, 'user');
    await pause();
    const [column, table] = view().matches;

    setQuery(app.store, 'users?');
    goToMatch(app.store, column);

    expect(count()).toBe('1 of 2');
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
    });

    // The users table, which user_ does not find, is gone to by no one.
    const { selectedMap } = app.store.state.editor;
    setQuery(app.store, 'user_');
    goToMatch(app.store, table);

    expect(count()).toBe('1 match');
    expect(app.store.state.editor.selectedMap).toEqual(selectedMap);
  });

  it('searches nothing for a pause it stands aside at, and what is typed as it shows', async () => {
    await open();
    toggleOption(app.store, 'regex');
    vi.mocked(findMatches).mockClear();

    setQuery(app.store, 'user');
    closeExplorer(app.store);
    await pause();
    expect(searches()).toBe(0);

    await open();
    expect(searches()).toBe(1);
    expect(count()).toBe('2 matches');

    setQuery(app.store, 'user_');
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    await pause();
    expect(searches()).toBe(1);

    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await flush();
    expect(searches()).toBe(2);
    expect(count()).toBe('1 match');
  });

  it('drops a search still waiting for the pause as the editor goes', async () => {
    await open();
    toggleOption(app.store, 'regex');
    setQuery(app.store, 'user');
    vi.mocked(findMatches).mockClear();

    mounted?.unmount();
    mounted = null;
    await pause();

    expect(searches()).toBe(0);
  });
});

describe('explorer search in the language the editor shows', () => {
  it('counts and reports a press as its meaning, which another language reads again', async () => {
    const german = createTestI18n('de-DE', pseudoMessages('de'));
    await open('user');
    expect(countText(app.store, german)).toBe('de:5 matches');

    goToNext(app.store);
    expect(countText(app.store, german)).toBe('de:1 of 5');

    setReplacement(app.store, 'member');
    replaceAll(app.store);
    expect(count()).toBe('Replaced 5 matches');
    expect(countText(app.store, german)).toBe('de:Replaced 5 matches');

    setQuery(app.store, 'user(');
    toggleOption(app.store, 'regex');
    expect(countText(app.store, german)).toBe('de:Invalid regular expression');
  });
});
