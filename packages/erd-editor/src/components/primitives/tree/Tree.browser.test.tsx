// The tree laid out and scrolled in a real Chromium: how many rows it renders,
// which DOM it keeps across a scroll, how it answers the tree keys, and what a
// scroll renders, counted by the mutations it makes.

import { addCSSHost, FC, observable } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';
import { cdp, userEvent } from 'vite-plus/test/browser/context';

import { flush, mount, type Mounted } from '@/__test-utils__';

import Tree, { TREE_OVERSCAN, TREE_ROW_HEIGHT } from './Tree';
import {
  type ExpandedIds,
  flattenTree,
  type TreeNode,
  type TreeRow,
} from './treeModel';

const HEIGHT = 220;

/** The one CDP command the spec sends, which the provider's session types only under its own config. */
type MediaSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as MediaSession;

const leaf = (id: string): TreeNode<null> => ({
  id,
  hasChildren: false,
  children: () => [],
  data: null,
});

const branch = (id: string, kids: TreeNode<null>[]): TreeNode<null> => ({
  id,
  hasChildren: true,
  children: () => kids,
  data: null,
});

const flatRows = (count: number, prefix = 'row') =>
  flattenTree(
    Array.from({ length: count }, (_, index) => leaf(`${prefix}-${index}`)),
    {}
  );

type HostState = {
  rows: ReadonlyArray<TreeRow>;
  activeId: string | null;
  currentId: string | null;
  revealId: string | null;
  dir: 'ltr' | 'rtl';
};

let state: HostState;
let scroll: { top: number };
let hostRenders: number;
let mounted: Mounted | null;
let shadowHost: HTMLElement | null;
const onToggle = vi.fn();
const onActivate = vi.fn();
const onActiveChange = vi.fn();

const Host: FC = () => () => {
  hostRenders++;

  return (
    <div style={{ height: `${HEIGHT}px`, width: '240px' }}>
      <Tree
        rows={state.rows}
        activeId={state.activeId}
        currentId={state.currentId}
        revealId={state.revealId}
        label="Objects"
        dir={state.dir}
        getScrollTop={() => scroll.top}
        onScroll={top => {
          scroll.top = top;
        }}
        onToggle={onToggle}
        onActivate={onActivate}
        onActiveChange={(id: string) => {
          onActiveChange(id);
          state.activeId = id;
        }}
        renderRow={(row: TreeRow) => <span class="label">{row.node.id}</span>}
      />
    </div>
  );
};

async function setup(rows: ReadonlyArray<TreeRow>, top = 0) {
  state = observable<HostState>(
    { rows, activeId: null, currentId: null, revealId: null, dir: 'ltr' },
    { shallow: true }
  );
  scroll = { top };
  shadowHost = document.createElement('div');
  document.body.append(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  mounted = mount(<Host />, undefined, shadow);
  await settle();
  return mounted.container.querySelector('[role="tree"]') as HTMLDivElement;
}

/** A frame for the scroll event and the size observer, then the render they schedule. */
async function settle() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await flush();
}

const items = (tree: HTMLElement) =>
  Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'));
const labels = (tree: HTMLElement) =>
  items(tree).map(item => item.querySelector('.label')!.textContent);
const rowOf = (tree: HTMLElement, id: string) =>
  tree.querySelector<HTMLElement>(`[id$=":${id}"]`);
const press = (
  tree: HTMLElement,
  key: string,
  init: KeyboardEventInit = {}
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  tree.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  hostRenders = 0;
  onToggle.mockClear();
  onActivate.mockClear();
  onActiveChange.mockClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await session().send('Emulation.setEmulatedMedia', { features: [] });
  mounted?.unmount();
  mounted = null;
  shadowHost?.remove();
  shadowHost = null;
});

describe('Tree - rendering', () => {
  it('renders the rows in view and the overscan, not all of them (AC-T10)', async () => {
    const tree = await setup(flatRows(500));
    const bound = Math.ceil(HEIGHT / TREE_ROW_HEIGHT) + 2 * TREE_OVERSCAN + 1;

    expect(items(tree).length).toBeGreaterThan(0);
    expect(items(tree).length).toBeLessThanOrEqual(bound);
    expect(labels(tree)[0]).toBe('row-0');
  });

  it('follows a scroll of its own from the first render on', async () => {
    const tree = await setup(flatRows(500));

    tree.scrollTop = TREE_ROW_HEIGHT * 100;
    await settle();

    expect(labels(tree)).toContain('row-100');
    expect(labels(tree)).not.toContain('row-0');
    expect(scroll.top).toBe(TREE_ROW_HEIGHT * 100);
  });

  it('keeps the element of a row that stays in view across a scroll', async () => {
    const tree = await setup(flatRows(500));
    const before = rowOf(tree, 'row-12');

    tree.scrollTop = TREE_ROW_HEIGHT * 2;
    await settle();

    expect(before).not.toBeNull();
    expect(rowOf(tree, 'row-12')).toBe(before);
  });

  it('comes back at the scroll position kept outside it', async () => {
    const tree = await setup(flatRows(500), TREE_ROW_HEIGHT * 200);

    expect(tree.scrollTop).toBe(TREE_ROW_HEIGHT * 200);
    expect(labels(tree)).toContain('row-200');
  });

  it('keeps the active row rendered far out of view and names it to a reader', async () => {
    const tree = await setup(flatRows(500));

    state.activeId = 'row-400';
    await settle();

    const active = rowOf(tree, 'row-400');
    expect(active).not.toBeNull();
    expect(tree.getAttribute('aria-activedescendant')).toBe(active!.id);
  });

  it('marks the tree and each row the way the WAI-ARIA tree pattern reads', async () => {
    const tree = await setup(
      flattenTree(
        [branch('tables', [leaf('users'), leaf('orders')]), leaf('memo')],
        { tables: true } satisfies ExpandedIds
      )
    );
    state.currentId = 'orders';
    await settle();
    const [tables, users, orders, memo] = items(tree);

    expect(tree.getAttribute('aria-label')).toBe('Objects');
    expect(tree.tabIndex).toBe(0);
    expect(tables.getAttribute('aria-expanded')).toBe('true');
    expect(memo.hasAttribute('aria-expanded')).toBe(false);
    expect(users.getAttribute('aria-level')).toBe('2');
    expect(orders.getAttribute('aria-posinset')).toBe('2');
    expect(orders.getAttribute('aria-setsize')).toBe('2');
    expect(orders.getAttribute('aria-current')).toBe('true');
    expect(users.hasAttribute('aria-current')).toBe(false);
  });

  it('scrolls a revealed row into view once', async () => {
    const tree = await setup(flatRows(500));

    state.revealId = 'row-300';
    await settle();

    expect(labels(tree)).toContain('row-300');
    const top = tree.scrollTop;
    tree.scrollTop = 0;
    await settle();
    state.rows = [...state.rows];
    await settle();

    expect(top).toBeGreaterThan(0);
    expect(tree.scrollTop).toBe(0);
  });
});

describe('Tree - scroll and reveal', () => {
  it('scrolls a revealed row into view again after the reveal was cleared', async () => {
    const tree = await setup(flatRows(500));

    state.revealId = 'row-300';
    await settle();
    state.revealId = null;
    await settle();
    tree.scrollTop = 0;
    await settle();
    state.revealId = 'row-300';
    await settle();

    expect(labels(tree)).toContain('row-300');
    expect(tree.scrollTop).toBeGreaterThan(0);
  });

  it('reports the scroll of a key and brings a remounted tree back there', async () => {
    const tree = await setup(flatRows(500));

    press(tree, 'End');
    await settle();

    expect(tree.scrollTop).toBeGreaterThan(0);
    expect(scroll.top).toBe(tree.scrollTop);

    const top = scroll.top;
    mounted!.unmount();
    mounted = null;
    shadowHost!.remove();
    const again = await setup(flatRows(500), top);

    expect(again.scrollTop).toBe(top);
    expect(labels(again)).toContain('row-499');
  });

  it('draws rows at once when they shrink below the scroll offset', async () => {
    const tree = await setup(flatRows(500), TREE_ROW_HEIGHT * 400);

    state.rows = flatRows(30);
    await flush();

    expect(labels(tree)).toContain('row-29');
  });
});

describe('Tree - keys', () => {
  const nested = () =>
    flattenTree(
      [
        branch('tables', [branch('users', [leaf('users.id')]), leaf('orders')]),
        leaf('memo'),
      ],
      { tables: true }
    );

  it('moves the active row on the arrows and the ends, prevented', async () => {
    const tree = await setup(nested());

    expect(press(tree, 'ArrowDown').defaultPrevented).toBe(true);
    expect(onActiveChange).toHaveBeenLastCalledWith('tables');
    await flush();
    press(tree, 'ArrowDown');
    expect(onActiveChange).toHaveBeenLastCalledWith('users');
    await flush();
    press(tree, 'End');
    expect(onActiveChange).toHaveBeenLastCalledWith('memo');
  });

  it('asks its host to unfold, fold and activate', async () => {
    const tree = await setup(nested());
    state.activeId = 'users';
    await flush();

    press(tree, 'ArrowRight');
    expect(onToggle).toHaveBeenLastCalledWith('users', true);
    state.activeId = 'tables';
    await flush();
    press(tree, 'ArrowLeft');
    expect(onToggle).toHaveBeenLastCalledWith('tables', false);
    expect(press(tree, 'Enter').defaultPrevented).toBe(true);
    expect(onActivate.mock.calls.at(-1)![0].node.id).toBe('tables');
    press(tree, ' ');
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('mirrors the inline keys right to left', async () => {
    const tree = await setup(nested());
    state.dir = 'rtl';
    state.activeId = 'users';
    await flush();

    press(tree, 'ArrowLeft');

    expect(tree.getAttribute('dir')).toBe('rtl');
    expect(onToggle).toHaveBeenLastCalledWith('users', true);
  });

  it('leaves Escape, a chord and any other key to its host', async () => {
    const tree = await setup(nested());
    const heard = vi.fn();
    mounted!.container.addEventListener('keydown', heard);

    const escape = press(tree, 'Escape');
    const chord = press(tree, 'ArrowDown', { ctrlKey: true });
    const letter = press(tree, 'a');

    expect(escape.defaultPrevented).toBe(false);
    expect(chord.defaultPrevented).toBe(false);
    expect(letter.defaultPrevented).toBe(false);
    expect(heard).toHaveBeenCalledTimes(3);
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  it('leaves a press an IME still holds alone', async () => {
    const tree = await setup(nested());

    const event = press(tree, 'ArrowDown', { isComposing: true });

    expect(event.defaultPrevented).toBe(false);
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  it('activates nothing on Enter while no row is active', async () => {
    const tree = await setup(nested());

    press(tree, 'Enter');

    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('Tree - pointer', () => {
  it('activates a row on a click and unfolds on its chevron alone', async () => {
    const tree = await setup(
      flattenTree([branch('tables', [leaf('users')]), leaf('memo')], {})
    );
    const [tables, memo] = items(tree);

    memo.click();
    expect(onActiveChange).toHaveBeenLastCalledWith('memo');
    expect(onActivate.mock.calls.at(-1)![0].node.id).toBe('memo');

    (tables.querySelector('.tree-twisty') as HTMLElement).click();
    expect(onToggle).toHaveBeenLastCalledWith('tables', true);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

describe('Tree - the keyboard row', () => {
  it('fills the active row as the pointer fills one while the tree holds the keyboard', async () => {
    const tree = await setup(flatRows(5));
    shadowHost!.style.setProperty('--tree-row-hover', 'rgb(1, 2, 3)');
    shadowHost!.style.setProperty('--tree-row-current', 'rgb(7, 8, 9)');
    shadowHost!.style.setProperty('--active', 'rgb(4, 5, 6)');
    state.activeId = 'row-1';
    await flush();
    const style = (id = 'row-1') => getComputedStyle(rowOf(tree, id)!);

    // The pointer rests where the last spec file in this page left it, which
    // can be over the active row, so the spec puts it on another row first.
    await userEvent.hover(rowOf(tree, 'row-3')!);
    expect(style('row-3').backgroundColor).toBe('rgb(1, 2, 3)');

    expect(style().backgroundColor).toBe('rgba(0, 0, 0, 0)');
    tree.focus();
    expect(style().backgroundColor).toBe('rgb(1, 2, 3)');
    expect(style().color).toBe('rgb(4, 5, 6)');
    expect(style().boxShadow).toBe('none');

    state.currentId = 'row-1';
    await flush();
    expect(style().backgroundColor).toBe('rgb(7, 8, 9)');
  });

  it('lands a keyboard focus on the first row wholly in view while no row is active', async () => {
    // Row 50 starts at 1100, a pixel above the top; row 51 is the first whole one.
    await setup(flatRows(500), 1101);

    await userEvent.tab();

    expect(onActiveChange.mock.calls).toEqual([['row-51']]);
  });

  it('lands a keyboard focus on the current row where one is drawn', async () => {
    const tree = await setup(flatRows(500), 1101);
    state.currentId = 'row-3';
    await flush();

    await userEvent.tab();

    expect(onActiveChange).toHaveBeenLastCalledWith('row-3');
    await settle();
    const top = TREE_ROW_HEIGHT * 3;
    expect(top).toBeGreaterThanOrEqual(tree.scrollTop);
    expect(top + TREE_ROW_HEIGHT).toBeLessThanOrEqual(tree.scrollTop + HEIGHT);
  });

  it('scrolls an active row that is out of view back into view on a keyboard focus', async () => {
    const tree = await setup(flatRows(500), 1101);
    state.activeId = 'row-3';
    await flush();

    await userEvent.tab();
    await settle();

    expect(tree.scrollTop).toBeLessThanOrEqual(TREE_ROW_HEIGHT * 3);
  });

  it("keeps the current row dashed and the focused tree's active row solid under forced colours", async () => {
    await session().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
    const tree = await setup(flatRows(5));
    state.currentId = 'row-1';
    state.activeId = 'row-2';
    await flush();
    const style = (id: string) => getComputedStyle(rowOf(tree, id)!);

    expect(style('row-1').outlineStyle).toBe('dashed');
    expect(style('row-2').outlineStyle).toBe('none');
    tree.focus();
    expect(style('row-2').outlineStyle).toBe('solid');
    const highlight = style('row-2').outlineColor;
    expect(style('row-1').outlineColor).not.toBe(highlight);

    state.activeId = 'row-1';
    await flush();
    expect(style('row-1').outlineStyle).toBe('dashed');
    expect(style('row-1').outlineColor).toBe(highlight);
  });

  it('does not pull a scroll back when the window regains focus on the tree', async () => {
    const tree = await setup(flatRows(500), 1101);
    state.activeId = 'row-3';
    await flush();
    await userEvent.tab();
    await settle();
    tree.scrollTop = 3000;
    await settle();

    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    tree.dispatchEvent(new FocusEvent('blur'));
    vi.restoreAllMocks();
    tree.dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(tree.scrollTop).toBe(3000);

    tree.dispatchEvent(new FocusEvent('blur'));
    tree.dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(tree.scrollTop).toBeLessThanOrEqual(TREE_ROW_HEIGHT * 3);
  });

  it('is not tabbable while it has no rows', async () => {
    const tree = await setup([]);
    expect(tree.tabIndex).toBe(-1);

    state.rows = flatRows(3);
    await flush();
    expect(tree.tabIndex).toBe(0);
  });

  it('keeps the active row on a keyboard focus, and lands nothing on a press', async () => {
    const tree = await setup(flatRows(5));
    state.activeId = 'row-2';
    await flush();

    await userEvent.tab();
    expect(onActiveChange).not.toHaveBeenCalled();

    tree.blur();
    state.activeId = null;
    await flush();
    await userEvent.click(rowOf(tree, 'row-4')!);
    expect(onActiveChange.mock.calls).toEqual([['row-4']]);
  });
});

describe('Tree - what a scroll renders (AC-T15)', () => {
  it('changes no row for a scroll that keeps the range, and renders nothing outside itself', async () => {
    // From 1101 to 1105 the first row in view stays row 50 and the last row 60.
    const tree = await setup(flatRows(500), 1101);
    const space = tree.firstElementChild as HTMLElement;
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver(records =>
      mutations.push(...records)
    );
    observer.observe(space, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    const before = hostRenders;

    tree.scrollTop = 1105;
    await settle();
    observer.disconnect();

    expect(scroll.top).toBe(1105);
    expect(mutations).toEqual([]);
    expect(hostRenders).toBe(before);
  });

  it('keeps the rows drawn across ten steps down the keyboard takes', async () => {
    const tree = await setup(flatRows(500));
    const first = rowOf(tree, 'row-0');

    for (let step = 0; step < 10; step++) {
      press(tree, 'ArrowDown');
      await flush();
    }

    expect(state.activeId).toBe('row-9');
    expect(rowOf(tree, 'row-0')).toBe(first);
  });

  it('keys new rows of the same count by their own ids', async () => {
    const tree = await setup(flatRows(50, 'a'));

    state.rows = flatRows(50, 'b');
    await settle();

    expect(labels(tree)[0]).toBe('b-0');
    expect(items(tree)[0].id).toMatch(/:b-0$/);
    expect(rowOf(tree, 'a-0')).toBeNull();
  });

  it('renders nothing outside itself on a scroll that moves the range', async () => {
    const tree = await setup(flatRows(500));
    const before = hostRenders;

    tree.scrollTop = TREE_ROW_HEIGHT * 40;
    await settle();

    expect(labels(tree)).toContain('row-40');
    expect(hostRenders).toBe(before);
  });
});
