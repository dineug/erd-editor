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

import { flush, mount, type Mounted } from '@/__test-utils__';

import Tree, {
  offsetToShow,
  TREE_OVERSCAN,
  TREE_ROW_HEIGHT,
  visibleRange,
} from './Tree';
import {
  type ExpandedIds,
  flattenTree,
  type TreeNode,
  type TreeRow,
} from './treeModel';

const HEIGHT = 220;

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

afterEach(() => {
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
    const before = tree.querySelector('[id$=":row-12"]');

    tree.scrollTop = TREE_ROW_HEIGHT * 2;
    await settle();

    expect(before).not.toBeNull();
    expect(tree.querySelector('[id$=":row-12"]')).toBe(before);
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

    const active = tree.querySelector('[id$=":row-400"]');
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
    const first = tree.querySelector('[id$=":row-0"]');

    for (let step = 0; step < 10; step++) {
      press(tree, 'ArrowDown');
      await flush();
    }

    expect(state.activeId).toBe('row-9');
    expect(tree.querySelector('[id$=":row-0"]')).toBe(first);
  });

  it('keys new rows of the same count by their own ids', async () => {
    const tree = await setup(flatRows(50, 'a'));

    state.rows = flatRows(50, 'b');
    await settle();

    expect(labels(tree)[0]).toBe('b-0');
    expect(items(tree)[0].id).toMatch(/:b-0$/);
    expect(tree.querySelector('[id$=":a-0"]')).toBeNull();
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

describe('visibleRange', () => {
  it('takes the rows in view and the overscan either side, inside the rows there are', () => {
    expect(visibleRange(500, 0, 220, 22)).toEqual({ first: 0, last: 17 });
    expect(visibleRange(500, 2200, 220, 22)).toEqual({
      first: 100 - TREE_OVERSCAN,
      last: 109 + TREE_OVERSCAN,
    });
    expect(visibleRange(5, 0, 220, 22)).toEqual({ first: 0, last: 4 });
    expect(visibleRange(0, 0, 220, 22)).toEqual({ first: 0, last: -1 });
  });

  it('draws no row past the end when the offset stands beyond the rows', () => {
    const { first, last } = visibleRange(5, 2200, 220, 22);

    expect(last).toBeLessThan(first);
  });
});

describe('offsetToShow', () => {
  it('keeps the offset while the row shows, or moves the nearest edge to it', () => {
    expect(offsetToShow(3, 0, 220, 22)).toBe(0);
    expect(offsetToShow(20, 0, 220, 22)).toBe(21 * 22 - 220);
    expect(offsetToShow(2, 220, 220, 22)).toBe(44);
    expect(offsetToShow(0, 0, 10, 22)).toBe(12);
  });
});
