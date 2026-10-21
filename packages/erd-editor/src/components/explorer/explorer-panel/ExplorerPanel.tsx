import {
  createRef,
  type DOMTemplateLiterals,
  FC,
  observable,
  observer,
  onBeforeMount,
  ref,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import Sash, { SashType } from '@/components/primitives/sash/Sash';
import Tree from '@/components/primitives/tree/Tree';
import {
  flattenTree,
  type TreeRow,
} from '@/components/primitives/tree/treeModel';
import { EXPLORER_WIDTH } from '@/constants/layout';
import {
  isBothNameView,
  isLogicalNameView,
  toNameLabel,
} from '@/engine/modules/editor/utils/nameView';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { PlainMessageKey } from '@/i18n/translate';
import { FindField, type FindMatch, snippetOf } from '@/utils/find-replace';
import { formatCount } from '@/utils/formatCount';
import { forceFocusEvent } from '@/utils/internalEvents';
import {
  isComposing,
  KeyBindingName,
  matchesShortcut,
  stopsAtPanel,
} from '@/utils/keyboard-shortcut';

import ExplorerSearch from '../explorer-search/ExplorerSearch';
import { closeExplorer, setExplorerWidth } from '../explorerCommands';
import { activateNode } from '../explorerNavigation';
import { goToMatch, isSearching } from '../explorerSearch';
import {
  buildExplorerTree,
  buildSearchTree,
  type ExplorerFolder,
  type ExplorerNode,
  type ExplorerTreeNode,
  matchRowId,
  searchExpanded,
} from '../explorerTree';
import { explorerScrollOf, explorerViewOf } from '../explorerView';
import { fieldIcon } from '../fieldIcon';
import * as styles from './ExplorerPanel.styles';

const FOLDER_LABEL: Record<ExplorerFolder, PlainMessageKey> = {
  tables: 'explorer.folder.tables',
  tableGroups: 'explorer.folder.tableGroups',
  memos: 'explorer.folder.memos',
  columns: 'explorer.folder.columns',
  indexes: 'explorer.folder.indexes',
  foreignKeys: 'explorer.folder.foreignKeys',
};

export type ExplorerPanelProps = {
  /** The width the layout gives the panel, which a drag on its edge asks to change. */
  width: number;
  readonly: boolean;
};

type Model = {
  roots: ExplorerTreeNode[];
  /** The rows with children a search shows, open unless folded; none outside a search. */
  branchIds: string[];
  rows: TreeRow<ExplorerNode>[];
};

/** The key colour a glyph takes, as a table's key cell paints a column with those keys. */
const keyClass = (primaryKey: boolean, foreignKey: boolean) => ({
  pk: primaryKey && !foreignKey,
  fk: foreignKey && !primaryKey,
  pfk: primaryKey && foreignKey,
});

/** The match a row of the search's tree goes to: an excerpt's own, or the first in a name. */
function firstMatchOf(node: ExplorerNode): FindMatch | undefined {
  if (node.kind === 'excerpt') return node.match;
  return 'matches' in node ? node.matches?.[0] : undefined;
}

const isLogicalNameMatch = ({ field }: FindMatch) =>
  field === FindField.logicalName;

/** A row's text with the stretches a search found in it marked, while they still fit it. */
function marked(text: string, matches: ReadonlyArray<FindMatch> = []) {
  const found = matches.filter(match => match.text === text);
  if (!found.length) return text;

  let from = 0;
  const parts = found.flatMap(({ start, end }) => {
    const before = text.slice(from, start);
    from = end;
    return [before, <mark class={styles.mark}>{text.slice(start, end)}</mark>];
  });
  return [...parts, text.slice(from)];
}

/**
 * The Explorer docked left of the canvas: a read-only tree of the document
 * that jumps to what a row stands for on a click or Enter. Escape hands the
 * keyboard back to the canvas and leaves the panel open.
 */
const ExplorerPanel: FC<ExplorerPanelProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const root = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();
  const model = observable<Model>(
    { roots: [], branchIds: [], rows: [] },
    { shallow: true }
  );

  // Two observers of their own, so the tree is built again only by a batch
  // that changes what it reads, and laid out again only as that or the
  // folding changes; a scroll, an arrow key or a drag of the edge does neither.
  onBeforeMount(() => {
    const { store } = app.value;
    const view = explorerViewOf(store);
    addUnsubscribe(
      observer(() => {
        if (isSearching(store)) {
          const tree = buildSearchTree(store.state, view.matches);
          model.roots = tree.roots;
          model.branchIds = tree.branchIds;
          return;
        }
        model.roots = buildExplorerTree(store.state);
        model.branchIds = [];
      }),
      observer(() => {
        model.rows = flattenTree(
          model.roots,
          isSearching(store)
            ? searchExpanded(model.branchIds, view.searchCollapsed)
            : view.expanded
        );
      })
    );
  });

  /** Folds or unfolds a row: outside a search for good, in one until the next search. */
  const setExpanded = (id: string, expanded: boolean) => {
    const { store } = app.value;
    const view = explorerViewOf(store);
    const searching = isSearching(store);
    const next = { ...(searching ? view.searchCollapsed : view.expanded) };
    expanded === searching
      ? Reflect.deleteProperty(next, id)
      : (next[id] = true);
    searching ? (view.searchCollapsed = next) : (view.expanded = next);
  };

  /** A row a search found goes to its match, the first of its own; any other goes where it stands for. */
  const handleActivate = (row: TreeRow<ExplorerNode>) => {
    const { store } = app.value;
    const node = row.node.data;
    if (node.kind === 'folder') {
      setExpanded(row.node.id, !row.expanded);
      return;
    }

    const match = firstMatchOf(node);
    if (match && isSearching(store)) {
      goToMatch(store, match);
      return;
    }
    activateNode(store, node);
  };

  /**
   * Folds the deepest level of the open rows shown, so each press folds one
   * level more from the deepest up, and the press that folds the top level
   * folds every row, those hidden under a folded one too.
   */
  const handleCollapseAll = () => {
    const { store } = app.value;
    const view = explorerViewOf(store);
    const searching = isSearching(store);
    const open = model.rows.filter(row => row.expanded);
    const deepest = open.reduce((level, row) => Math.max(level, row.level), 0);
    if (deepest <= 1) {
      searching
        ? (view.searchCollapsed = Object.fromEntries(
            model.branchIds.map(id => [id, true as const])
          ))
        : (view.expanded = {});
      return;
    }

    const next = { ...(searching ? view.searchCollapsed : view.expanded) };
    for (const row of open) {
      if (row.level !== deepest) continue;
      searching
        ? (next[row.node.id] = true)
        : Reflect.deleteProperty(next, row.node.id);
    }
    searching ? (view.searchCollapsed = next) : (view.expanded = next);
  };

  const handleClose = () => {
    closeExplorer(app.value.store);
    ctx.host.dispatchEvent(forceFocusEvent());
  };

  /**
   * Escape hands the keyboard back to the canvas, panel open and selection
   * as they were; the chords the canvas would read as an edit stop here, and
   * every other press goes on to the editor or the host.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    const { keyBindingMap } = app.value;

    if (
      !isComposing(event) &&
      matchesShortcut(event, keyBindingMap[KeyBindingName.stop])
    ) {
      event.preventDefault();
      event.stopPropagation();
      ctx.host.dispatchEvent(forceFocusEvent());
      return;
    }
    if (stopsAtPanel(event, keyBindingMap)) event.stopPropagation();
  };

  const handleMove = ({ x }: { x: number }) => {
    const $root = root.value;
    if (!$root) return;
    setExplorerWidth(app.value.store, x - $root.getBoundingClientRect().left);
  };

  const handleSashDblclick = () => {
    setExplorerWidth(app.value.store, EXPLORER_WIDTH);
  };

  const label = (
    text: string,
    unnamed: string,
    matches?: ReadonlyArray<FindMatch>,
    standIn = false
  ) => {
    const blank = !text.trim();
    return (
      <span
        class={[styles.name, { unnamed: blank, 'stand-in': standIn }]}
        title={blank ? unnamed : text}
      >
        {blank ? unnamed : marked(text, matches)}
      </span>
    );
  };

  /**
   * A table's or column's names as the name view shows them: the logical
   * name, the name dimmed in its place while it is blank, and in the view of
   * both the name after it, muted, each marking the matches found in it alone.
   */
  const nameLabel = (
    node: { name: string; logicalName: string },
    unnamed: string,
    matches: ReadonlyArray<FindMatch> = []
  ) => {
    const { settings } = app.value.store.state;
    const { text, after, standIn } = toNameLabel(settings, node);
    const logicalMatches = matches.filter(isLogicalNameMatch);
    const nameMatches = matches.filter(match => !isLogicalNameMatch(match));
    // A logical name the view draws leads, and the name follows it or stands in.
    const leadsLogical =
      node.logicalName.trim() !== '' &&
      (isLogicalNameView(settings) || isBothNameView(settings));
    const [shownMatches, hiddenMatches] = leadsLogical
      ? [logicalMatches, nameMatches]
      : [nameMatches, logicalMatches];
    // A row found only in the name the view leaves out shows that name after
    // its label, muted as in the view of both, so the row says why it is here.
    const second =
      after ||
      (!shownMatches.length && hiddenMatches.length
        ? leadsLogical
          ? node.name
          : node.logicalName
        : '');

    return (
      <>
        {label(text, unnamed, shownMatches, standIn)}
        {second ? (
          <span class={styles.muted} title={second}>
            {marked(second, hiddenMatches)}
          </span>
        ) : null}
      </>
    );
  };

  const renderRow = (row: TreeRow<ExplorerNode>): DOMTemplateLiterals => {
    const { t } = i18n.value;
    const unnamed = t('common.unnamed');
    const node = row.node.data;

    switch (node.kind) {
      case 'folder':
        return (
          <>
            <span class={styles.rowIcon}>
              {row.expanded ? (
                <Icon name="folder-open" size={14} />
              ) : (
                <Icon name="folder" size={14} />
              )}
            </span>
            {label(t(FOLDER_LABEL[node.folder]), unnamed)}
            <span class={styles.count}>
              {formatCount(i18n.value.locale, node.count)}
            </span>
          </>
        );
      case 'table':
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="table-2" size={14} />
            </span>
            {nameLabel(node, unnamed, node.matches)}
          </>
        );
      case 'groupTable':
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="table-2" size={14} />
            </span>
            {nameLabel(node, unnamed)}
          </>
        );
      case 'column': {
        const detail = [
          node.dataType,
          node.primaryKey ? 'PK' : '',
          node.foreignKey ? 'FK' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <>
            {node.primaryKey || node.foreignKey ? (
              <span
                class={[
                  styles.rowIcon,
                  keyClass(node.primaryKey, node.foreignKey),
                ]}
              >
                <Icon name="key-round" size={14} />
              </span>
            ) : (
              <span class={styles.rowIcon}>
                <Icon name="list" size={14} />
              </span>
            )}
            {nameLabel(node, unnamed, node.matches)}
            <span class={styles.muted} title={detail} prop:dir="ltr">
              {detail}
            </span>
          </>
        );
      }
      case 'index': {
        const detail = `${node.unique ? 'UNIQUE ' : ''}(${node.columns})`;
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="logs" size={14} />
            </span>
            {label(node.name, unnamed, node.matches)}
            <span class={styles.muted} title={detail} prop:dir="ltr">
              {detail}
            </span>
          </>
        );
      }
      case 'foreignKey': {
        const parent = `→ ${node.parent || unnamed}(${node.parentColumns})`;
        return (
          <>
            <span class={[styles.rowIcon, keyClass(node.identification, true)]}>
              <Icon name="key-round" size={14} />
            </span>
            <span
              class={styles.name}
              title={`${node.columns} ${parent}`}
              prop:dir="ltr"
            >
              {node.columns}
            </span>
            <span class={styles.muted} title={parent} prop:dir="ltr">
              {parent}
            </span>
          </>
        );
      }
      case 'tableGroup':
        return (
          <>
            <span
              class={styles.dot}
              style={node.color ? { 'background-color': node.color } : {}}
            ></span>
            {label(node.name, unnamed, node.matches)}
          </>
        );
      case 'memo':
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="sticky-note" size={14} />
            </span>
            {label(node.text, unnamed)}
          </>
        );
      case 'excerpt': {
        const snippet = snippetOf(node.match);
        return (
          <>
            <span class={styles.rowIcon}>{fieldIcon(node.match.field)}</span>
            <span class={styles.name} title={node.match.text} prop:dir="auto">
              {snippet.text.slice(0, snippet.start)}
              <mark class={styles.mark}>
                {snippet.text.slice(snippet.start, snippet.end)}
              </mark>
              {snippet.text.slice(snippet.end)}
            </span>
          </>
        );
      }
    }
  };

  return () => {
    const { store } = app.value;
    const { t, dir } = i18n.value;
    const view = explorerViewOf(store);
    const scroll = explorerScrollOf(store);
    const close = t('common.close');
    const current = isSearching(store) ? view.matches[view.current] : undefined;
    const currentId = current ? matchRowId(current) : null;

    return (
      <div
        class={['explorer', styles.root]}
        use:ref={ref(root)}
        prop:dir={dir}
        style={{ width: `${props.width}px` }}
        on:keydown={handleKeydown}
      >
        <div class={styles.header}>
          <div class={styles.title}>{t('explorer.title')}</div>
          <button
            class={['explorer-collapse-all', styles.tool]}
            type="button"
            title={t('explorer.collapseAll')}
            aria-label={t('explorer.collapseAll')}
            on:click={handleCollapseAll}
          >
            <Icon name="chevrons-down-up" size={14} />
          </button>
          <button
            class={['explorer-close', styles.tool]}
            type="button"
            aria-label={close}
            title={close}
            on:click={handleClose}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <ExplorerSearch readonly={props.readonly} />
        <div class={styles.body}>
          <Tree
            rows={model.rows}
            activeId={view.activeId}
            currentId={currentId}
            revealId={currentId}
            label={t('explorer.title')}
            dir={dir}
            getScrollTop={() => scroll.top}
            onScroll={(top: number) => {
              scroll.top = top;
            }}
            onToggle={setExpanded}
            onActivate={handleActivate}
            onActiveChange={(id: string) => {
              view.activeId = id;
            }}
            renderRow={renderRow}
          />
        </div>
        <div class={['explorer-sash', styles.sash]}>
          <Sash
            type={SashType.vertical}
            onMove={handleMove}
            onDblclick={handleSashDblclick}
          />
        </div>
      </div>
    );
  };
};

export default ExplorerPanel;
