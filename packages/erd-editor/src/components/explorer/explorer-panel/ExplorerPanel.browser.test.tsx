// The Explorer docked in a real Chromium: what its rows draw, where a click or
// Enter takes the reader, the keys it keeps, its edge, and how often the tree
// is built and laid out, counted through the two modules it builds them with.

import { addCSSHost } from '@dineug/r-html';
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
  mount,
  type Mounted,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import { seedExplorerDocument } from '@/__test-utils__/explorerSeed';
import { iconNameOf } from '@/__test-utils__/icon';
import type { AppContext } from '@/components/appContext';
import {
  layoutOf,
  measureRoot,
  observeViewport,
} from '@/components/erd-editor/viewportLayout';
import Explorer from '@/components/explorer/Explorer';
import {
  closeExplorer,
  openExplorer,
} from '@/components/explorer/explorerCommands';
import { explorerViewOf } from '@/components/explorer/explorerView';
import {
  TREE_OVERSCAN,
  TREE_ROW_HEIGHT,
} from '@/components/primitives/tree/Tree';
import { CanvasType } from '@/constants/schema';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { InternalEventType } from '@/utils/internalEvents';

const counts = vi.hoisted(() => ({ builds: 0, layouts: 0 }));

vi.mock('@/components/explorer/explorerTree', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/components/explorer/explorerTree')>();
  return {
    ...actual,
    buildExplorerTree: (
      ...args: Parameters<typeof actual.buildExplorerTree>
    ) => {
      counts.builds++;
      return actual.buildExplorerTree(...args);
    },
  };
});

vi.mock('@/components/primitives/tree/treeModel', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/components/primitives/tree/treeModel')
    >();
  return {
    ...actual,
    flattenTree: (...args: Parameters<typeof actual.flattenTree>) => {
      counts.layouts++;
      return actual.flattenTree(...args);
    },
  };
});

const HEIGHT = 600;

let app: AppContext;
let mounted: Mounted | null;
let shadowHost: HTMLElement | null;
let stopObserving = () => {};
const focusBacks = { focus: 0, force: 0 };

async function setup(seed: (app: AppContext) => void = seedExplorerDocument) {
  app = createTestAppContext();
  seed(app);
  stopObserving = observeViewport(app.store);
  measureRoot(app.store, { width: 1200, height: HEIGHT });
  openExplorer(app.store);

  shadowHost = document.createElement('div');
  document.body.append(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  shadowHost.addEventListener(
    InternalEventType.focus,
    () => focusBacks.focus++
  );
  shadowHost.addEventListener(
    InternalEventType.forceFocus,
    () => focusBacks.force++
  );
  mounted = mount(
    <div class="frame" style={{ display: 'flex', height: `${HEIGHT}px` }}>
      <Explorer readonly={false} />
    </div>,
    app,
    shadow
  );
  await settle();
}

async function settle() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await flush();
}

const panel = () =>
  mounted!.container.querySelector('.explorer') as HTMLElement | null;
const tree = () => panel()!.querySelector('[role="tree"]') as HTMLElement;
const rows = () =>
  Array.from(panel()!.querySelectorAll<HTMLElement>('[role="treeitem"]'));
const rowOf = (nodeId: string) =>
  rows().find(row => row.id.endsWith(`:${nodeId}`)) as HTMLElement;
const textOf = (row: HTMLElement) => row.textContent?.trim();
/** Dispatches a keydown, returning false when something prevented its default. */
const press = (
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {}
) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: key === ' ' ? 'Space' : key,
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    })
  );

beforeEach(() => {
  counts.builds = 0;
  counts.layouts = 0;
  focusBacks.focus = 0;
  focusBacks.force = 0;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  shadowHost?.remove();
  shadowHost = null;
  stopObserving();
  app.store.destroy();
});

describe('ExplorerPanel - rows', () => {
  it('draws the folders with their counts, the Tables folder open on its tables (AC-T2, AC-T8)', async () => {
    await setup();

    expect(rows().map(textOf)).toEqual([
      'Tables3',
      'Apple',
      'orders',
      'users',
      'Table Groups2',
      'Memos1',
    ]);
    expect(
      iconNameOf(
        rowOf('f:tables').querySelector('.tree-row > span:nth-child(2)')!
      )
    ).toBe('folder-open');
    expect(
      iconNameOf(
        rowOf('f:memos').querySelector('.tree-row > span:nth-child(2)')!
      )
    ).toBe('folder');
  });

  it('draws a key column by the key a table draws, in its key colour, any other by a list glyph, with its type after it (AC-T3)', async () => {
    await setup();
    explorerViewOf(app.store).expanded = {
      'f:tables': true,
      't:orders': true,
      't:orders/f:columns': true,
    };
    await settle();

    const glyphOf = (nodeId: string) =>
      iconNameOf(rowOf(nodeId).querySelector('.tree-row > span:nth-child(2)')!);
    const keyOf = (nodeId: string) =>
      rowOf(nodeId).querySelector('.tree-row > span:nth-child(2)')!.classList;
    expect(glyphOf('c:orders.id')).toBe('key-round');
    expect(glyphOf('c:orders.user_id')).toBe('key-round');
    expect(glyphOf('c:orders.total')).toBe('list');
    expect(keyOf('c:orders.id').contains('pk')).toBe(true);
    expect(keyOf('c:orders.user_id').contains('fk')).toBe(true);
    expect(keyOf('c:orders.total').contains('fk')).toBe(false);
    expect(textOf(rowOf('c:orders.id'))).toBe('idBIGINT PK');
    expect(textOf(rowOf('c:orders.user_id'))).toBe('user_idBIGINT FK');
  });

  it('writes an index, a foreign key, a group with its colour and its tables, and a memo (AC-T4, AC-T5)', async () => {
    await setup();
    explorerViewOf(app.store).expanded = {
      'f:tables': true,
      't:orders': true,
      't:orders/f:indexes': true,
      't:orders/f:foreignKeys': true,
      'f:tableGroups': true,
      'g:billing': true,
      'f:memos': true,
    };
    await settle();

    expect(textOf(rowOf('i:idx'))).toBe(
      'orders_user_idxUNIQUE (user_id DESC, total)'
    );
    expect(
      iconNameOf(rowOf('i:idx').querySelector('.tree-row > span:nth-child(2)')!)
    ).toBe('logs');
    expect(textOf(rowOf('r:rel'))).toBe('user_id→ users(id)');
    const fk = rowOf('r:rel').querySelector('.tree-row > span:nth-child(2)')!;
    expect(iconNameOf(fk)).toBe('key-round');
    expect(fk.classList.contains('fk')).toBe(true);
    expect(textOf(rowOf('g:billing/t:orders'))).toBe('orders');
    expect(textOf(rowOf('m:note'))).toBe('Order states');
    const dot = rowOf('g:billing').querySelector(
      '.tree-row > span:nth-child(2)'
    ) as HTMLElement;
    expect(getComputedStyle(dot).backgroundColor).toBe('rgb(255, 0, 0)');
    expect(rowOf('g:empty').getAttribute('aria-expanded')).toBeNull();
  });

  it('writes an unnamed table as such, with the name in its tooltip (AC-T5)', async () => {
    await setup(store => {
      seedExplorerDocument(store);
      store.store.dispatchSync(
        changeTableNameAction({ id: 'apple', value: '' })
      );
    });

    const unnamed = rows().find(row => textOf(row) === 'unnamed');
    expect(unnamed).toBeDefined();
    expect(unnamed!.querySelector('[title]')?.getAttribute('title')).toBe(
      'unnamed'
    );
  });
});

describe('ExplorerPanel - presses', () => {
  it('jumps on a click, selecting the table alone (AC-N1)', async () => {
    await setup();

    rowOf('t:users').click();
    await settle();

    expect(app.store.state.editor.selectedMap).toEqual({
      users: SelectType.table,
    });
    expect(explorerViewOf(app.store).activeId).toBe('t:users');
  });

  it('folds and unfolds a folder on a click, and jumps nowhere (AC-N4)', async () => {
    await setup();

    rowOf('f:tables').click();
    await settle();

    expect(rows().map(textOf)).toEqual(['Tables3', 'Table Groups2', 'Memos1']);
    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('jumps on Enter and leaves the keyboard in the tree (AC-N9)', async () => {
    await setup();
    tree().focus();

    press(tree(), 'ArrowDown');
    await settle();
    press(tree(), 'ArrowDown');
    await settle();
    press(tree(), 'Enter');
    await settle();

    expect(app.store.state.editor.selectedMap).toEqual({
      apple: SelectType.table,
    });
    expect(shadowHost!.shadowRoot!.activeElement).toBe(tree());
  });

  it('keeps Enter, Space, Delete and the arrows from the editor, and changes nothing (AC-N9, AC-T11)', async () => {
    await setup();
    const frame = mounted!.container.querySelector('.frame') as HTMLElement;
    const heard: string[] = [];
    frame.addEventListener('keydown', event => heard.push(event.key));
    explorerViewOf(app.store).activeId = 't:orders';
    await settle();
    const before = JSON.stringify(app.store.state.doc);

    for (const key of [
      'ArrowDown',
      'Enter',
      'Delete',
      'Backspace',
      'F2',
      ' ',
    ]) {
      press(tree(), key);
    }
    await settle();

    expect(heard).toEqual(['F2']);
    expect(JSON.stringify(app.store.state.doc)).toBe(before);
  });

  it('hands the keyboard back on Escape and stays open (AC-S11)', async () => {
    await setup();
    app.store.dispatchSync(selectAction({ users: SelectType.table }));

    press(tree(), 'Escape');
    await settle();

    expect(focusBacks.force).toBe(1);
    expect(panel()).not.toBeNull();
    expect(app.store.state.editor.selectedMap).toEqual({
      users: SelectType.table,
    });
  });

  it('leaves an Escape that ends an IME composition to the input (AC-S11)', async () => {
    await setup();
    const heard: string[] = [];
    mounted!.container
      .querySelector('.frame')!
      .addEventListener('keydown', event =>
        heard.push((event as KeyboardEvent).key)
      );

    const input = panel()!.querySelector('.find-input') as HTMLElement;

    const ended = [
      press(input, 'Escape', { isComposing: true }),
      press(input, 'Escape', { keyCode: 229 }),
    ];
    await settle();

    expect(ended).toEqual([true, true]);
    expect(focusBacks.force).toBe(0);
    expect(heard).toEqual([]);
  });

  /** The owner's request of 2026-10-14: each press folds the deepest open level, from the bottom up. */
  it('folds one level a press from the deepest open, the top one last, and closes from its header', async () => {
    await setup();
    const view = explorerViewOf(app.store);
    view.expanded = {
      'f:tables': true,
      't:orders': true,
      't:orders/f:columns': true,
      't:users': true,
      't:users/f:indexes': true,
      'f:memos': true,
    };
    await settle();
    const collapse = async () => {
      (panel()!.querySelector('.explorer-collapse-all') as HTMLElement).click();
      await settle();
    };

    await collapse();
    expect(Object.keys(view.expanded).sort()).toEqual([
      'f:memos',
      'f:tables',
      't:orders',
      't:users',
      't:users/f:indexes',
    ]);

    await collapse();
    expect(Object.keys(view.expanded).sort()).toEqual([
      'f:memos',
      'f:tables',
      't:users/f:indexes',
    ]);

    await collapse();
    expect(view.expanded).toEqual({});
    expect(rows().map(textOf)).toEqual(['Tables3', 'Table Groups2', 'Memos1']);

    const close = panel()!.querySelector('.explorer-close') as HTMLElement;
    // Escape hands the keyboard back rather than close it, so its title names no key.
    expect(close.title).toBe('Close');
    close.click();
    await settle();
    expect(explorerViewOf(app.store).open).toBe(false);
    expect(panel()).toBeNull();
  });
});

describe('ExplorerPanel - its edge (AC-S5)', () => {
  const drag = (to: number) => {
    const sash = panel()!.querySelector('.explorer-sash .sash') as HTMLElement;
    sash.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 10 })
    );
    movePointer(to, 10);
    releasePointer(to, 10);
  };

  it('sizes by where the pointer stands, held between 200 and 480, with no drift past either end', async () => {
    await setup();
    const left = panel()!.getBoundingClientRect().left;

    drag(left + 320);
    await settle();
    expect(layoutOf(app.store).reach).toBe(320);
    expect(panel()!.getBoundingClientRect().width).toBe(320);

    drag(left + 900);
    await settle();
    expect(layoutOf(app.store).reach).toBe(480);

    drag(left + 300);
    await settle();
    expect(layoutOf(app.store).reach).toBe(300);

    drag(left + 50);
    await settle();
    expect(layoutOf(app.store).reach).toBe(200);
  });

  it('gives back 260 on a double press', async () => {
    await setup();
    const left = panel()!.getBoundingClientRect().left;
    drag(left + 400);
    await settle();

    const sash = panel()!.querySelector('.explorer-sash .sash') as HTMLElement;
    sash.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();

    expect(layoutOf(app.store).reach).toBe(260);
  });
});

describe('ExplorerPanel - what it costs (AC-T10)', () => {
  it('builds the tree again for an edit of what it shows, and never for a move or a selection', async () => {
    await setup();
    const builds = counts.builds;

    app.store.dispatchSync(
      moveTableAction({ ids: ['users'], movementX: 40, movementY: 40 }),
      selectAction({ users: SelectType.table })
    );
    await settle();
    expect(counts.builds).toBe(builds);

    app.store.dispatchSync(
      changeTableNameAction({ id: 'apple', value: 'kiwi' })
    );
    await settle();
    expect(counts.builds).toBe(builds + 1);
    expect(rows().map(textOf)).toContain('kiwi');
  });

  it('neither builds nor lays out the tree for ten steps of the keyboard or a scroll', async () => {
    await setup(manyTables);
    explorerViewOf(app.store).activeId = 'f:tables';
    await settle();
    const before = { ...counts };

    for (let step = 0; step < 10; step++) {
      press(tree(), 'ArrowDown');
      await flush();
    }
    tree().scrollTop = TREE_ROW_HEIGHT * 50;
    await settle();

    expect(explorerViewOf(app.store).activeId).toBe('t:t009');
    expect(counts).toEqual(before);
  });

  it('draws the rows in view and the overscan alone, every node expanded', async () => {
    await setup(manyTables);
    const expanded: Record<string, true> = { 'f:tables': true };
    for (let index = 0; index < 200; index++) {
      const id = `t${String(index).padStart(3, '0')}`;
      expanded[`t:${id}`] = true;
      expanded[`t:${id}/f:columns`] = true;
    }
    explorerViewOf(app.store).expanded = expanded;
    await settle();

    const height = tree().clientHeight;
    expect(rows().length).toBeLessThanOrEqual(
      Math.ceil(height / TREE_ROW_HEIGHT) + 2 * TREE_OVERSCAN + 1
    );
  });
});

describe('ExplorerPanel - coming and going', () => {
  it('hands the keyboard back when it goes away with the keyboard in it (AC-S18)', async () => {
    await setup();
    tree().focus();
    tree().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    closeExplorer(app.store);
    await settle();

    expect(panel()).toBeNull();
    expect(focusBacks.focus).toBe(1);
  });

  it('leaves the keyboard alone when it goes away without it', async () => {
    await setup();

    closeExplorer(app.store);
    await settle();

    expect(focusBacks.focus).toBe(0);
  });

  it('comes back at its scroll position after a tab away and back (AC-S8)', async () => {
    await setup(manyTables);
    tree().scrollTop = TREE_ROW_HEIGHT * 40;
    await settle();

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    await settle();
    expect(panel()).toBeNull();

    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await settle();

    expect(tree().scrollTop).toBe(TREE_ROW_HEIGHT * 40);
  });
});

/** Two hundred tables of ten columns each, named t000 to t199. */
function manyTables(target: AppContext) {
  target.store.dispatchSync(
    ...Array.from({ length: 200 }, (_, index) => {
      const id = `t${String(index).padStart(3, '0')}`;
      return [
        addTableAction({ id, ui: { x: 0, y: index * 100, zIndex: index } }),
        changeTableNameAction({ id, value: id }),
        ...Array.from({ length: 10 }, (_, column) =>
          addColumnAction({ id: `${id}.c${column}`, tableId: id })
        ),
      ];
    }).flat()
  );
}
