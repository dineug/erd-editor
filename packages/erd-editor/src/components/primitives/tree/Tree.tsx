import {
  createRef,
  DOMTemplateLiterals,
  FC,
  observable,
  onMounted,
  onUpdated,
  ref,
  repeat,
} from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import { useUnmounted } from '@/hooks/useUnmounted';

import * as styles from './Tree.styles';
import { moveFocus, type TreeRow } from './treeModel';

export const TREE_ROW_HEIGHT = 22;
export const TREE_OVERSCAN = 8;
/** How far each level stands in from its parent. */
export const TREE_INDENT = 12;

/** The keys the tree answers itself; it prevents these and passes every other. */
const TREE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  ' ',
]);

let treeCount = 0;

/** The rows a tree renders, first to last, both included; none while last is below first. */
export type TreeRange = { first: number; last: number };

/**
 * The rows the screen shows at a scroll offset, with the overscan either side,
 * so a short scroll finds its rows drawn already.
 */
export function visibleRange(
  count: number,
  scrollTop: number,
  height: number,
  rowHeight: number
): TreeRange {
  if (count === 0) return { first: 0, last: -1 };

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - TREE_OVERSCAN);
  const last = Math.min(
    count - 1,
    Math.ceil((scrollTop + height) / rowHeight) - 1 + TREE_OVERSCAN
  );
  return { first, last: Math.max(first - 1, last) };
}

/**
 * The scroll offset nearest the one given that shows a row whole: the same
 * while it shows, else the row's top or bottom at the edge it is past.
 */
export function offsetToShow(
  index: number,
  scrollTop: number,
  height: number,
  rowHeight: number
): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + height) return Math.max(0, bottom - height);
  return scrollTop;
}

export type TreeProps<T = any> = {
  rows: ReadonlyArray<TreeRow<T>>;
  rowHeight?: number;
  /** The row the keyboard is on, named to a reader by aria-activedescendant. */
  activeId: string | null;
  /** The row a host marks as the current one, such as the match it jumped to. */
  currentId?: string | null;
  /** Scrolls this row into view each time a different id arrives. */
  revealId?: string | null;
  label: string;
  dir?: 'ltr' | 'rtl';
  /** Read once as the tree mounts, so a scroll position kept outside comes back. */
  getScrollTop: () => number;
  onScroll?: (top: number) => void;
  onToggle?: (id: string, expanded: boolean) => void;
  onActivate?: (row: TreeRow<T>) => void;
  onActiveChange?: (id: string) => void;
  renderRow: (row: TreeRow<T>) => DOMTemplateLiterals;
};

/**
 * A virtualized tree with fixed-height rows. It renders the rows in view, the
 * overscan and the active row, answers the tree keys and leaves every policy to
 * its host: what a row shows, what activating one does, Escape and the chords.
 */
const Tree: FC<TreeProps> = props => {
  const prefix = `tree-${++treeCount}`;
  const root = createRef<HTMLDivElement>();
  // Only a new range renders the tree: a scroll within the overscan changes
  // nothing a reader sees, so the offset and the height stay unobserved.
  const view = observable<TreeRange>({ first: 0, last: -1 });
  const measured = { scrollTop: 0, height: 0 };
  const { addUnsubscribe } = useUnmounted();

  let revealed: string | null = null;
  let mounted = false;

  const rowHeight = () => props.rowHeight ?? TREE_ROW_HEIGHT;
  const domId = (id: string) => `${prefix}:${id}`;
  const indexOf = (id: string | null | undefined) =>
    id ? props.rows.findIndex(row => row.node.id === id) : -1;
  const rangeNow = () =>
    visibleRange(
      props.rows.length,
      measured.scrollTop,
      measured.height,
      rowHeight()
    );

  const syncRange = () => {
    const { first, last } = rangeNow();
    if (first !== view.first) view.first = first;
    if (last !== view.last) view.last = last;
  };

  const scrollTo = (top: number) => {
    const $root = root.value;
    if (!$root) return;
    $root.scrollTop = top;
    // The browser may clamp it, and its scroll event comes a frame later.
    measured.scrollTop = $root.scrollTop;
    syncRange();
  };

  const scrollToIndex = (index: number) => {
    scrollTo(
      offsetToShow(index, measured.scrollTop, measured.height, rowHeight())
    );
  };

  const applyReveal = () => {
    const id = props.revealId ?? null;
    if (!mounted || id === null || id === revealed) return;
    const index = indexOf(id);
    if (index === -1) return;
    revealed = id;
    scrollToIndex(index);
  };

  const handleScroll = () => {
    const $root = root.value;
    if (!$root || $root.scrollTop === measured.scrollTop) return;
    measured.scrollTop = $root.scrollTop;
    props.onScroll?.(measured.scrollTop);
    syncRange();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !TREE_KEYS.has(event.key)
    ) {
      return;
    }
    event.preventDefault();

    const { rows, activeId } = props;
    if (event.key === 'Enter' || event.key === ' ') {
      const index = indexOf(activeId);
      if (index !== -1) props.onActivate?.(rows[index]);
      return;
    }

    const move = moveFocus(rows, activeId, event.key, props.dir);
    if (!move) return;
    if (move.type === 'toggle') {
      props.onToggle?.(move.id, move.expanded);
      return;
    }
    scrollToIndex(move.index);
    props.onActiveChange?.(move.id);
  };

  /**
   * A keyboard focus with no row active lands on the current row, or else the
   * first row wholly in view, so the reader sees where the arrows start. A
   * press focuses the tree without it, and its click picks the row.
   */
  const handleFocus = () => {
    const { rows, activeId, currentId } = props;
    if (!rows.length || indexOf(activeId) !== -1) return;
    if (!root.value?.matches(':focus-visible')) return;

    const current = indexOf(currentId);
    const index =
      current !== -1
        ? current
        : Math.min(
            rows.length - 1,
            Math.ceil(measured.scrollTop / rowHeight())
          );
    props.onActiveChange?.(rows[index].node.id);
  };

  const handleRowClick = (row: TreeRow) => {
    props.onActiveChange?.(row.node.id);
    props.onActivate?.(row);
  };

  const handleTwistyClick = (event: MouseEvent, row: TreeRow) => {
    event.stopPropagation();
    props.onActiveChange?.(row.node.id);
    props.onToggle?.(row.node.id, !row.expanded);
  };

  onMounted(() => {
    const $root = root.value;
    mounted = true;
    measured.height = $root.clientHeight;
    scrollTo(props.getScrollTop());
    applyReveal();

    const resizeObserver = new ResizeObserver(() => {
      if ($root.clientHeight === measured.height) return;
      measured.height = $root.clientHeight;
      syncRange();
    });
    resizeObserver.observe($root);
    addUnsubscribe(() => resizeObserver.disconnect());
  });

  onUpdated(applyReveal);

  const renderItem = (row: TreeRow, index: number) => {
    const { node } = row;
    const height = rowHeight();

    return (
      <div
        class={[
          'tree-row',
          styles.row,
          {
            active: node.id === props.activeId,
            current: node.id === props.currentId,
          },
        ]}
        id={domId(node.id)}
        role="treeitem"
        aria-level={row.level}
        aria-setsize={row.setSize}
        aria-posinset={row.posInSet}
        prop:ariaExpanded={node.hasChildren ? String(row.expanded) : null}
        prop:ariaCurrent={node.id === props.currentId ? 'true' : null}
        style={{
          height: `${height}px`,
          transform: `translateY(${index * height}px)`,
          'padding-inline-start': `${(row.level - 1) * TREE_INDENT}px`,
        }}
        on:click={() => handleRowClick(row)}
      >
        {node.hasChildren ? (
          <span
            class={['tree-twisty', styles.twisty, { collapsed: !row.expanded }]}
            on:click={(event: MouseEvent) => handleTwistyClick(event, row)}
          >
            <Icon
              name={row.expanded ? 'chevron-down' : 'chevron-right'}
              size={16}
            />
          </span>
        ) : (
          <span class={styles.twisty}></span>
        )}
        {props.renderRow(row)}
      </div>
    );
  };

  return () => {
    const { rows, activeId } = props;
    // Read so a new range or a new reveal renders the tree; the range itself
    // is worked out here, since rows that arrive move it before a scroll does.
    void view.first;
    void view.last;
    void props.revealId;
    const { first, last } = rangeNow();
    const active = indexOf(activeId);

    const indexes: number[] = [];
    for (let index = first; index <= last; index++) indexes.push(index);
    // The active row stays drawn, so aria-activedescendant names a node that is there.
    if (active !== -1 && (active < first || active > last)) {
      indexes.push(active);
      indexes.sort((a, b) => a - b);
    }

    return (
      <div
        class={['tree', 'scrollbar', styles.root]}
        use:ref={ref(root)}
        role="tree"
        tabindex="0"
        prop:dir={props.dir ?? ''}
        aria-label={props.label}
        aria-activedescendant={active === -1 ? '' : domId(rows[active].node.id)}
        on:keydown={handleKeydown}
        on:focus={handleFocus}
        on:scroll={handleScroll}
      >
        <div
          class={styles.space}
          style={{ height: `${rows.length * rowHeight()}px` }}
        >
          {repeat(
            indexes,
            index => rows[index].node.id,
            index => renderItem(rows[index], index)
          )}
        </div>
      </div>
    );
  };
};

export default Tree;
