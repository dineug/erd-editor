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
import { useUnmounted } from '@/hooks/useUnmounted';
import type { PlainMessageKey } from '@/i18n/translate';
import { forceFocusEvent } from '@/utils/internalEvents';
import {
  KeyBindingName,
  matchesShortcut,
  stopsAtPanel,
  toShortcutTitle,
} from '@/utils/keyboard-shortcut';

import { closeExplorer, setExplorerWidth } from '../explorerCommands';
import { activateNode } from '../explorerNavigation';
import {
  buildExplorerTree,
  type ExplorerFolder,
  type ExplorerNode,
  type ExplorerTreeNode,
} from '../explorerTree';
import { explorerScrollOf, explorerViewOf } from '../explorerView';
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
};

type Model = {
  roots: ExplorerTreeNode[];
  rows: TreeRow<ExplorerNode>[];
};

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
  const model = observable<Model>({ roots: [], rows: [] }, { shallow: true });

  // Two observers of their own, so the tree is built again only by a batch
  // that changes what it reads, and laid out again only as that or the
  // folding changes; a scroll, an arrow key or a drag of the edge does neither.
  onBeforeMount(() => {
    const { store } = app.value;
    const view = explorerViewOf(store);
    addUnsubscribe(
      observer(() => {
        model.roots = buildExplorerTree(store.state);
      }),
      observer(() => {
        model.rows = flattenTree(model.roots, view.expanded);
      })
    );
  });

  const setExpanded = (id: string, expanded: boolean) => {
    const view = explorerViewOf(app.value.store);
    const next = { ...view.expanded };
    expanded ? (next[id] = true) : Reflect.deleteProperty(next, id);
    view.expanded = next;
  };

  const handleActivate = (row: TreeRow<ExplorerNode>) => {
    if (row.node.data.kind === 'folder') {
      setExpanded(row.node.id, !row.expanded);
      return;
    }
    activateNode(app.value.store, row.node.data);
  };

  const handleCollapseAll = () => {
    explorerViewOf(app.value.store).expanded = {};
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

    if (matchesShortcut(event, keyBindingMap[KeyBindingName.stop])) {
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

  const label = (text: string, unnamed: string) => {
    const blank = !text.trim();
    return (
      <span
        class={[styles.name, { unnamed: blank }]}
        title={blank ? unnamed : text}
      >
        {blank ? unnamed : text}
      </span>
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
            <span class={styles.count}>{node.count}</span>
          </>
        );
      case 'table':
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="table-2" size={14} />
            </span>
            {label(node.name, unnamed)}
          </>
        );
      case 'groupTable':
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="table-2" size={14} />
            </span>
            {label(node.name, unnamed)}
          </>
        );
      case 'column':
        return (
          <>
            {node.primaryKey ? (
              <span class={[styles.rowIcon, 'primary-key']}>
                <Icon name="key-round" size={14} />
              </span>
            ) : node.foreignKey ? (
              <span class={[styles.rowIcon, 'foreign-key']}>
                <Icon name="link" size={14} />
              </span>
            ) : (
              <span class={styles.rowIcon}>
                <Icon name="list" size={14} />
              </span>
            )}
            {label(node.name, unnamed)}
            <span class={styles.muted} prop:dir="ltr">
              {[
                node.dataType,
                node.primaryKey ? 'PK' : '',
                node.foreignKey ? 'FK' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            </span>
          </>
        );
      case 'index':
        return (
          <>
            <span class={styles.rowIcon}>
              <Icon name="list-tree" size={14} />
            </span>
            {label(node.name, unnamed)}
            <span class={styles.muted} prop:dir="ltr">
              {`${node.unique ? 'UNIQUE ' : ''}(${node.columns})`}
            </span>
          </>
        );
      case 'foreignKey':
        return (
          <>
            <span class={[styles.rowIcon, 'foreign-key']}>
              <Icon name="link" size={14} />
            </span>
            <span class={styles.name} prop:dir="ltr">
              {`${node.columns} → ${node.parent || unnamed}(${node.parentColumns})`}
            </span>
          </>
        );
      case 'tableGroup':
        return (
          <>
            <span
              class={styles.dot}
              style={node.color ? { 'background-color': node.color } : {}}
            ></span>
            {label(node.name, unnamed)}
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
    }
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { t, dir } = i18n.value;
    const view = explorerViewOf(store);
    const scroll = explorerScrollOf(store);
    const close = t('common.close');

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
            title={toShortcutTitle(keyBindingMap, close, KeyBindingName.stop)}
            on:click={handleClose}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div class={styles.body}>
          <Tree
            rows={model.rows}
            activeId={view.activeId}
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
