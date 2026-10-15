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
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  measureRoot,
  observeViewport,
} from '@/components/erd-editor/viewportLayout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeZenModeAction,
  editTableAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';
import type { Unsubscribe } from '@/internal-types';
import { findMatches } from '@/utils/find-replace';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import {
  closeExplorer,
  isExplorerPressed,
  isExplorerShown,
} from '../explorerCommands';
import { countText, goToNext } from '../explorerSearch';
import { explorerViewOf } from '../explorerView';
import ExplorerController, { EDIT_SEARCH_DELAY } from './ExplorerController';

vi.mock('@/utils/find-replace', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/find-replace')>();
  return { ...actual, findMatches: vi.fn(actual.findMatches) };
});

let app: AppContext;
let mounted: Mounted | null = null;
let stopViewport: Unsubscribe | null = null;
let toggled = 0;
const i18n = createTestI18n('en');

const view = () => explorerViewOf(app.store);
const count = () => countText(app.store, i18n);
const searches = () => vi.mocked(findMatches).mock.calls.length;

const chord = async () => {
  app.shortcut$.next({
    type: KeyBindingName.findReplace,
    event: new KeyboardEvent('keydown'),
  });
  await flush();
};

const open = async (query?: string) => {
  openSearchOn(app, query);
  await flush();
};

const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, EDIT_SEARCH_DELAY + 50));
  await flush();
};

beforeEach(async () => {
  vi.mocked(findMatches).mockClear();
  toggled = 0;
  app = createTestAppContext();
  seedFindDocument(app);
  stopViewport = observeViewport(app.store);
  measureRoot(app.store, { width: 1200, height: 800 });
  app.emitter.on({
    toggleSearch: () => {
      toggled++;
    },
  });
  mounted = mount(html`<${ExplorerController} />`, app);
  await flush();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  stopViewport?.();
  app.store.destroy();
});

describe('ExplorerController', () => {
  it('renders nothing of its own', () => {
    expect(mounted?.container.childElementCount).toBe(0);
  });

  /** The owner's request of 2026-10-14: the chord toggles the panel, as the toolbar button does. */
  it('opens the search on the find chord, closes the panel on the next and opens it on the one after', async () => {
    await chord();
    expect(view().open).toBe(true);
    expect(view().focusRequest).toBe(1);

    await chord();
    expect(view().open).toBe(false);
    expect(view().focusRequest).toBe(1);

    await chord();
    expect(view().open).toBe(true);
    expect(view().focusRequest).toBe(2);
  });

  it('closes a panel the button shows pressed while a narrow root stands it aside', async () => {
    await chord();
    measureRoot(app.store, { width: 400, height: 800 });
    expect(isExplorerShown(app.store)).toBe(false);
    expect(isExplorerPressed(app.store)).toBe(true);

    await chord();

    expect(view().open).toBe(false);
  });

  /** An owner decision: the dialogs close once the search opens, open already under it or not. */
  it('trades a dialog up beside it for the search, on its chord and on an opening with no query', async () => {
    await open('user');
    const exportImageOpen = () =>
      app.store.state.editor.openMap[Open.exportImage];

    app.store.dispatchSync(changeOpenMapAction({ [Open.exportImage]: true }));
    await chord();
    expect(exportImageOpen()).toBe(false);
    expect(view().open).toBe(true);
    expect(view().query).toBe('user');

    closeExplorer(app.store);
    app.store.dispatchSync(changeOpenMapAction({ [Open.mapColumns]: true }));
    await chord();
    expect(app.store.state.editor.openMap[Open.mapColumns]).toBe(false);
    expect(view().open).toBe(true);

    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );
    await open();
    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
  });

  it('keeps its current match on an opening with no query while shown, searching nothing', async () => {
    await open('user');
    goToNext(app.store);
    vi.mocked(findMatches).mockClear();

    await open();

    expect(count()).toBe('1 of 5');
    expect(searches()).toBe(0);
  });

  it('opens in place of the palette, which gives way as its own row does', async () => {
    await chord();
    expect(toggled).toBe(0);

    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: true }));
    await chord();

    expect(toggled).toBe(1);
    expect(view().focusRequest).toBe(2);
  });

  it('leaves the chord to a cell being edited', async () => {
    app.store.dispatchSync(
      focusTableAction({ tableId: 'orders' }),
      editTableAction()
    );

    await chord();

    expect(view().open).toBe(false);
  });

  it('opens nothing under an overlay that takes the canvas over, and leaves the palette be', async () => {
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.timeTravel]: true, [Open.search]: true })
    );

    await chord();

    expect(view().open).toBe(false);
    expect(toggled).toBe(0);
  });

  /** An owner decision of 2026-10-13: the chord under zen mode shows the panel and leaves zen on. */
  it('shows the panel on the chord under zen mode, leaving zen on (AC-S21)', async () => {
    app.store.dispatchSync(changeZenModeAction({ value: true }));

    await chord();

    expect(app.store.state.editor.zenMode).toBe(true);
    expect(isExplorerShown(app.store)).toBe(true);
  });

  it('searches once as its chord brings it back from another tab, edited meanwhile', async () => {
    await open('user');
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    app.store.dispatchSync(
      changeColumnCommentAction({
        id: 'email',
        tableId: 'users',
        value: 'the user email',
      })
    );
    await settle();
    vi.mocked(findMatches).mockClear();

    await chord();
    await settle();

    expect(searches()).toBe(1);
    expect(count()).toBe('6 matches');
  });

  it('searches an edit once the edits pause', async () => {
    await open('user');
    vi.mocked(findMatches).mockClear();

    for (const value of ['a user', 'the user', 'the user email']) {
      app.store.dispatchSync(
        changeColumnCommentAction({ id: 'email', tableId: 'users', value })
      );
    }
    await flush();
    expect(searches()).toBe(0);

    await settle();
    expect(searches()).toBe(1);
    expect(count()).toBe('6 matches');
  });

  it('hears nothing once the editor goes', async () => {
    mounted?.unmount();
    mounted = null;

    await chord();
    await open('user');

    expect(view().open).toBe(false);
  });
});
