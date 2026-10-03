// Find and replace and the palette's field matches on a real keyboard, over
// the scene they drive: the chords reach the panel through the element's own
// bindings, and what is typed into the panel has to stop there.

import {
  addCSSHost,
  createRef,
  FC,
  ref,
  render,
  useProvider,
} from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import { seedFindDocument } from '@/__test-utils__/findSeed';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import FindReplace from '@/components/find-replace/FindReplace';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import QuickSearch from '@/components/quick-search/QuickSearch';
import * as quickSearchStyles from '@/components/quick-search/QuickSearch.styles';
import { SCOPED_ACTION_LIMIT } from '@/components/quick-search/scopedActions';
import { themeContext } from '@/components/themeContext';
import { Open } from '@/constants/open';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { whenDrawn } from '@/konva/batchDraw';
import { toScreenPoint } from '@/konva/scene/viewport';
import { hasAppleDevice } from '@/utils/device-detect';
import { forceFocusEvent } from '@/utils/internalEvents';

/** The key $mod names in the browser the spec runs in, which is what the bindings read too. */
const MOD = hasAppleDevice() ? 'Meta' : 'Control';

/** The part of ErdEditor that reads the keyboard, around the scene and the two panels. */
const Editor: FC = (_, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const handleKeydown = (event: KeyboardEvent) => {
    app.value.keydown$.next(event);
  };

  return () => (
    <div
      class="root"
      use:ref={ref(root)}
      tabindex="-1"
      style={{ width: '100%', height: '100%', position: 'relative' }}
      on:keydown={handleKeydown}
    >
      <Erd isDarkMode={false} mouseTracking={false} readonly={false} />
      <FindReplace readonly={false} />
      <QuickSearch />
    </div>
  );
};

type Fixture = {
  mounted: Mounted;
  root: HTMLDivElement;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/**
 * Mounts the editor where its stylesheets are live, in a shadow root as the
 * element has one: a bare div adopts no css template, so nothing in it is laid
 * out by the rules a measurement is about.
 */
function mountStyled(app: AppContext): Mounted {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const container = document.createElement('div');
  shadow.append(globals, container);

  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(container as any, appContext, app);
  render(globals, <GlobalStyles />);
  render(container, <Editor />);

  return {
    container,
    app,
    unmount: () => {
      render(container, null);
      render(globals, null);
      provider.destroy();
      host.remove();
    },
  };
}

type SetupOptions = { width?: number; height?: number; styled?: boolean };

async function setup({
  width = 900,
  height = 640,
  styled = false,
}: SetupOptions = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const mounted = styled ? mountStyled(app) : mount(<Editor />, app);
  mounted.container.setAttribute(
    'style',
    `width: ${width}px; height: ${height}px; position: relative;`
  );

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  const root = mounted.container.querySelector('.root') as HTMLDivElement;
  const focusRoot = () => root.focus();
  document.body.addEventListener(forceFocusEvent.type, focusRoot);

  app.store.dispatchSync(changeViewportAction({ width, height }));
  seedFindDocument(app);
  await flush();
  await whenDrawn();
  root.focus();

  teardowns.push(() => {
    document.body.removeEventListener(forceFocusEvent.type, focusRoot);
    mounted.unmount();
    themeProvider.destroy();
  });

  return { mounted, root };
}

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await flush();
};

const OPEN_FIND = `{${MOD}>}f{/${MOD}}`;

const panelOf = ({ mounted }: Fixture) =>
  mounted.container.querySelector<HTMLDivElement>('.find-replace');
const inputOf = (fixture: Fixture, name: string) =>
  panelOf(fixture)?.querySelector<HTMLInputElement>(`.${name}`) ?? null;
const countOf = (fixture: Fixture) =>
  (panelOf(fixture)?.querySelector('.find-count')?.textContent ?? '').trim();
const stateOf = ({ mounted }: Fixture) => mounted.app.store.state;

/** Every keydown the page sees, caught before the editor, whose defaultPrevented is read once the press is over. */
function recordPresses(): KeyboardEvent[] {
  const presses: KeyboardEvent[] = [];
  const listen = (event: KeyboardEvent) => {
    event.code === 'KeyF' && presses.push(event);
  };
  window.addEventListener('keydown', listen, true);
  teardowns.push(() => window.removeEventListener('keydown', listen, true));
  return presses;
}

describe('Find and Replace on a real keyboard', () => {
  it('opens on its chord with the caret in the find field, the browser find kept shut', async () => {
    const fixture = await setup();
    const presses = recordPresses();

    await press(OPEN_FIND);

    expect(panelOf(fixture)).not.toBeNull();
    expect(document.activeElement).toBe(inputOf(fixture, 'find-input'));
    expect(presses).toHaveLength(1);
    expect(presses[0].defaultPrevented).toBe(true);
  });

  it('brings the caret back to the find field on its chord, as every host find does', async () => {
    const fixture = await setup();
    await press(OPEN_FIND);
    await press('user{Enter}');
    fixture.root.focus();

    await press(OPEN_FIND);

    const input = inputOf(fixture, 'find-input');
    expect(panelOf(fixture)).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect([input?.selectionStart, input?.selectionEnd]).toEqual([0, 4]);
    expect(countOf(fixture)).toBe('1 of 2');

    inputOf(fixture, 'replace-input')?.focus();
    await press(OPEN_FIND);

    expect(document.activeElement).toBe(input);
    expect(stateOf(fixture).editor.openMap[Open.findReplace]).toBe(true);
  });

  it('opens in place of the palette its chord is pressed in', async () => {
    const fixture = await setup();
    const presses = recordPresses();
    await press(`{${MOD}>}k{/${MOD}}`);
    await press('users');

    await press(OPEN_FIND);

    const { openMap } = stateOf(fixture).editor;
    expect(openMap[Open.search]).toBe(false);
    expect(fixture.mounted.container.querySelector('.quick-search')).toBeNull();
    expect(panelOf(fixture)).not.toBeNull();
    expect(document.activeElement).toBe(inputOf(fixture, 'find-input'));
    expect(presses[0].defaultPrevented).toBe(true);
  });

  it('keeps what is typed off the canvas while Enter walks the matches', async () => {
    const fixture = await setup();
    await press(OPEN_FIND);

    await press('user');
    expect(countOf(fixture)).toBe('2 matches');

    // On the canvas Alt+N adds a table and the arrows move the focus ring.
    await press('{Alt>}n{/Alt}');
    await press('{ArrowDown}');
    await press('{Enter}');

    expect(stateOf(fixture).doc.tableIds).toEqual(['orders', 'users']);
    expect(countOf(fixture)).toBe('1 of 2');
    expect(stateOf(fixture).editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
      edit: false,
    });
    expect(document.activeElement).toBe(inputOf(fixture, 'find-input'));

    // With that cell ringed, Alt+Backspace would remove its column.
    await press('{Alt>}{Backspace}{/Alt}');
    expect(
      stateOf(fixture).collections.tableEntities.orders.columnIds
    ).toHaveLength(3);

    await press(`{${MOD}>}a{/${MOD}}user`);
    await press('{Shift>}{Enter}{/Shift}');

    expect(countOf(fixture)).toBe('2 of 2');
    expect(stateOf(fixture).editor.selectedMap).toEqual({ users: 'table' });
  });

  it('searches a regular expression typed at once when Enter comes before the pause', async () => {
    const fixture = await setup();
    await press(OPEN_FIND);
    panelOf(fixture)?.querySelector<HTMLButtonElement>('.find-regex')?.click();
    await flush();
    inputOf(fixture, 'find-input')?.focus();

    await press('^(order|user)_id${Enter}');

    expect(countOf(fixture)).toBe('1 of 2');
    expect(stateOf(fixture).editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'order_id',
    });
  });

  it('replaces every match in one step that one undo takes back', async () => {
    const fixture = await setup();
    await press(OPEN_FIND);
    // A first opening searches the names alone, so the memo is let in.
    panelOf(fixture)
      ?.querySelector<HTMLButtonElement>('.find-scope[data-field="memo"]')
      ?.click();
    await flush();
    inputOf(fixture, 'find-input')?.focus();
    await press('user');
    // Focused rather than clicked: the runner's frame can scroll a click away.
    inputOf(fixture, 'replace-input')?.focus();
    await press('member');

    await press(`{${MOD}>}{Enter}{/${MOD}}`);

    const replaced = stateOf(fixture).collections;
    expect(replaced.tableEntities.users.name).toBe('members');
    expect(replaced.tableColumnEntities.orders_user_id.name).toBe('member_id');
    expect(replaced.memoEntities.note.value).toBe(
      'Every member_id points at members.id'
    );

    await press(`{${MOD}>}z{/${MOD}}`);

    const restored = stateOf(fixture).collections;
    expect(restored.tableEntities.users.name).toBe('users');
    expect(restored.tableColumnEntities.orders_user_id.name).toBe('user_id');
    expect(restored.memoEntities.note.value).toBe(
      'Every user_id points at users.id'
    );
    expect(document.activeElement).toBe(inputOf(fixture, 'replace-input'));
  });

  it('closes on Escape and leaves the selection the canvas would have dropped', async () => {
    const fixture = await setup();
    await press(OPEN_FIND);
    await press('email');
    await press('{Enter}');
    expect(stateOf(fixture).editor.focusTable?.columnId).toBe('email');

    await press('{Escape}');

    expect(panelOf(fixture)).toBeNull();
    expect(stateOf(fixture).editor.selectedMap).toEqual({ users: 'table' });
    expect(stateOf(fixture).editor.focusTable?.columnId).toBe('email');
  });

  it('closes on an Escape pressed on the canvas too', async () => {
    const fixture = await setup();
    await press(OPEN_FIND);
    fixture.root.focus();

    await press('{Escape}');

    expect(panelOf(fixture)).toBeNull();
  });

  it('lets a chord the editor leaves alone reach the host, and zooms the canvas', async () => {
    const fixture = await setup();
    const heard: string[] = [];
    const modifiers = ['Alt', 'Control', 'Meta', 'Shift'];
    const listen = (event: KeyboardEvent) => {
      modifiers.includes(event.key) || heard.push(event.code);
    };
    window.addEventListener('keydown', listen);
    teardowns.push(() => window.removeEventListener('keydown', listen));
    await press(OPEN_FIND);
    heard.length = 0;

    // A webview host hears its save and command palette through the window.
    await press(`{${MOD}>}s{/${MOD}}`);
    await press(`{${MOD}>}{Shift>}P{/Shift}{/${MOD}}`);
    await press('{ArrowDown}');
    await press(`{${MOD}>}={/${MOD}}`);

    expect(heard).toEqual(['KeyS', 'KeyP']);
    expect(stateOf(fixture).settings.zoomLevel).toBeGreaterThan(1);
    expect(document.activeElement).toBe(inputOf(fixture, 'find-input'));
  });
});

describe('Find and Replace over the canvas', () => {
  it('ends above the floating toolbar on a short canvas, however long its list', async () => {
    const fixture = await setup({ width: 820, height: 560, styled: true });
    fixture.mounted.app.store.dispatchSync(
      Array.from({ length: 60 }, (_, index) => [
        addColumnAction({ id: `long${index}`, tableId: 'orders' }),
        changeColumnNameAction({
          id: `long${index}`,
          tableId: 'orders',
          value: `user_${index}`,
        }),
      ]).flat()
    );
    await flush();

    await press(OPEN_FIND);
    await press('user');

    const toolbar = fixture.mounted.container
      .querySelector('.floating-toolbar')
      ?.getBoundingClientRect();
    const panel = panelOf(fixture)?.getBoundingClientRect();
    expect(countOf(fixture)).toBe('62 matches');
    expect(toolbar?.height).toBeGreaterThan(0);
    expect(panel?.bottom).toBeLessThanOrEqual(toolbar?.top ?? 0);
  });

  it.each([
    ['wide, the toolbar far from it', 1400, 300],
    ['narrow, the toolbar under it', 820, 300],
  ])(
    'keeps its count and its navigation whole on a canvas this short and %s',
    async (_, width, height) => {
      const fixture = await setup({ width, height, styled: true });

      await press(OPEN_FIND);
      await press('user');

      const panel = panelOf(fixture)?.getBoundingClientRect();
      const next = panelOf(fixture)
        ?.querySelector('.find-next')
        ?.getBoundingClientRect();
      const count = panelOf(fixture)
        ?.querySelector('.find-count')
        ?.getBoundingClientRect();
      expect(countOf(fixture)).toBe('2 matches');
      expect(next?.height).toBeGreaterThan(0);
      expect(next?.bottom).toBeLessThanOrEqual(panel?.bottom ?? 0);
      expect(count?.bottom).toBeLessThanOrEqual(panel?.bottom ?? 0);
    }
  );

  it('lands a table picked in the palette clear of the open panel', async () => {
    const fixture = await setup({ width: 1200, height: 640, styled: true });
    await press(OPEN_FIND);
    await press('user');

    await press(`{${MOD}>}k{/${MOD}}`);
    await press('#orders');
    await press('{ArrowDown}{Enter}');

    const { settings, collections } = stateOf(fixture);
    const table = toScreenPoint(settings, collections.tableEntities.orders.ui);
    const container = fixture.mounted.container.getBoundingClientRect();
    const panel = panelOf(fixture)?.getBoundingClientRect();
    expect(stateOf(fixture).editor.selectedMap).toEqual({ orders: 'table' });
    expect(table.x).toBeGreaterThan((panel?.right ?? 0) - container.left);
  });
});

describe('quick search over the fields on a real keyboard', () => {
  it('finds a column by its comment and rings its cell', async () => {
    const fixture = await setup();
    const selected = () =>
      fixture.mounted.container.querySelector<HTMLElement>(
        `.quick-search .${quickSearchStyles.action}.selected`
      );

    await press(`{${MOD}>}k{/${MOD}}`);
    await press(':login');
    for (let step = 0; step < 20; step++) {
      await press('{ArrowDown}');
      if (selected()?.textContent?.includes('login email')) break;
    }
    expect(selected()?.textContent).toContain('users.email · Column comment');

    await press('{Enter}');

    expect(stateOf(fixture).editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'email',
      focusType: 'columnComment',
    });
    expect(fixture.mounted.container.querySelector('.quick-search')).toBeNull();
  });
});

describe('quick search prefixes on a real keyboard', () => {
  const OPEN_SEARCH = `{${MOD}>}k{/${MOD}}`;

  const paletteOf = ({ mounted }: Fixture) =>
    mounted.container.querySelector<HTMLDivElement>('.quick-search');
  const searchInput = (fixture: Fixture) =>
    paletteOf(fixture)?.querySelector<HTMLInputElement>('input') ?? null;
  const rowNames = (fixture: Fixture) =>
    Array.from(
      paletteOf(fixture)?.querySelectorAll(`.${quickSearchStyles.name}`) ?? []
    ).map(name => (name.textContent ?? '').trim());
  const rowKinds = (fixture: Fixture) =>
    Array.from(
      paletteOf(fixture)?.querySelectorAll(`.${quickSearchStyles.action}`) ?? []
    ).map(row =>
      (
        row.querySelector(`.${quickSearchStyles.keyword}`)?.textContent ?? ''
      ).trim()
    );
  const scopeOf = (fixture: Fixture) =>
    paletteOf(fixture)?.querySelector('.quick-search-scope')?.textContent ??
    null;

  it('goes to a column named by table and column', async () => {
    const fixture = await setup();

    await press(OPEN_SEARCH);
    await press('@users.em');

    expect(scopeOf(fixture)).toBe('Columns');
    expect(rowNames(fixture)).toEqual(['email']);

    await press('{ArrowDown}{Enter}');

    expect(paletteOf(fixture)).toBeNull();
    expect(stateOf(fixture).editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'email',
      focusType: 'columnName',
    });
  });

  it('types the prefix a help row stands for and keeps the caret in the input', async () => {
    const fixture = await setup();

    await press(OPEN_SEARCH);
    expect(
      paletteOf(fixture)?.querySelector('.quick-search-hint')
    ).not.toBeNull();
    await press('?');
    expect(rowNames(fixture)).toEqual([
      'Tables',
      'Columns',
      'Comments & memos',
    ]);

    await press('{ArrowDown}{Enter}');

    expect(searchInput(fixture)?.value).toBe('#');
    expect(document.activeElement).toBe(searchInput(fixture));
    expect(scopeOf(fixture)).toBe('Tables');

    await press('us');

    expect(searchInput(fixture)?.value).toBe('#us');
    expect(rowNames(fixture)[0]).toBe('users');
    expect(rowKinds(fixture).every(kind => kind === 'Table')).toBe(true);
  });

  it('lists the commands and no table or field once the prefix is deleted, the word offered below', async () => {
    const fixture = await setup();

    await press(OPEN_SEARCH);
    await press('#use');
    expect(rowNames(fixture)).toEqual(['users']);
    expect(rowKinds(fixture).every(kind => kind === 'Table')).toBe(true);

    await press('{ArrowLeft}{ArrowLeft}{ArrowLeft}{Backspace}');

    expect(searchInput(fixture)?.value).toBe('use');
    expect(scopeOf(fixture)).toBeNull();
    expect(rowKinds(fixture)).not.toContain('Table');
    expect(rowKinds(fixture).some(kind => kind.includes('·'))).toBe(false);
    // No command holds use, so the prefixes follow the one it fuzzes to.
    expect(rowNames(fixture)).toContain('Database');
    expect(rowNames(fixture).slice(-3)).toEqual([
      'Search tables for "use"',
      'Search columns for "use"',
      'Search comments & memos for "use"',
    ]);
  });

  it('types a prefix picked by the keys before a word no command holds', async () => {
    const fixture = await setup();

    await press(OPEN_SEARCH);
    await press('email');
    expect(
      paletteOf(fixture)?.querySelector('.quick-search-empty')?.textContent
    ).toContain('No commands match');

    await press('{ArrowDown}{ArrowDown}{Enter}');

    expect(searchInput(fixture)?.value).toBe('@email');
    expect(document.activeElement).toBe(searchInput(fixture));
    expect(scopeOf(fixture)).toBe('Columns');
    expect(rowNames(fixture)).toEqual(['email']);

    await press('{ArrowDown}{Enter}');

    expect(paletteOf(fixture)).toBeNull();
    expect(stateOf(fixture).editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'email',
      focusType: 'columnName',
    });
  });

  it('opens Find and Replace on column names alone from a column search past its limit', async () => {
    const fixture = await setup();
    const { store } = fixture.mounted.app;
    store.dispatchSync(
      Array.from({ length: SCOPED_ACTION_LIMIT + 1 }, (_, index) => [
        addColumnAction({ id: `col${index}`, tableId: 'orders' }),
        changeColumnNameAction({
          id: `col${index}`,
          tableId: 'orders',
          value: `col_${index}`,
        }),
      ]).flat()
    );
    await flush();

    await press(OPEN_SEARCH);
    await press('@orders.col');
    await press('{ArrowUp}{Enter}');

    expect(paletteOf(fixture)).toBeNull();
    expect(inputOf(fixture, 'find-input')?.value).toBe('col');
    expect(countOf(fixture)).toBe(`${SCOPED_ACTION_LIMIT + 1} matches`);
    const pressed = Array.from(
      panelOf(fixture)?.querySelectorAll('.find-scope[aria-pressed="true"]') ??
        []
    ).map(scope => scope.getAttribute('data-field'));
    expect(pressed).toEqual(['columnName']);
  });
});
