import {
  createRef,
  type DOMTemplateLiterals,
  FC,
  observable,
  observer,
  onBeforeMount,
  ref,
} from '@dineug/r-html';

import { type AppContext, useAppContext } from '@/components/appContext';
import {
  type ErdTarget,
  showErdTargetAction$,
} from '@/components/erd/goToErdTarget';
import {
  clearRelationshipHighlight,
  setRelationshipHighlight,
} from '@/components/erd/relationshipHighlight';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import Sash, { SashType } from '@/components/primitives/sash/Sash';
import TextInput from '@/components/primitives/text-input/TextInput';
import Tree from '@/components/primitives/tree/Tree';
import {
  flattenTree,
  type TreeRow,
} from '@/components/primitives/tree/treeModel';
import { EXPLORER_WIDTH } from '@/constants/layout';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { PlainMessageKey } from '@/i18n/translate';
import { type DiffEntries, DiffKind } from '@/utils/diff';
import {
  KeyBindingName,
  PANEL_PASSING_BINDINGS,
  stopsAtPanel,
} from '@/utils/keyboard-shortcut';

import * as styles from './DiffTree.styles';
import {
  buildDiffTree,
  describeEntry,
  type DiffFolder,
  diffTargets,
  type DiffTreeItem,
  type DiffTreeNode,
  statusLabel,
  statusLetter,
} from './diffTreeModel';

const FOLDER_LABEL: Record<DiffFolder, PlainMessageKey> = {
  tables: 'explorer.folder.tables',
  tableGroups: 'explorer.folder.tableGroups',
  memos: 'explorer.folder.memos',
  columns: 'explorer.folder.columns',
  indexes: 'explorer.folder.indexes',
  foreignKeys: 'explorer.folder.foreignKeys',
};

/** The keys the tree lets past besides the panel's: Escape, which closes the diff. */
const PASSING = [...PANEL_PASSING_BINDINGS, KeyBindingName.stop];

export type DiffTreeProps = {
  prevApp: AppContext;
  app: AppContext;
  entries: DiffEntries;
  /** The width the diff gives the tree, which a drag on its edge asks to change. */
  width: number;
  onResize: (width: number) => void;
};

type Model = {
  filter: string;
  roots: DiffTreeNode[];
  branchIds: string[];
  rows: TreeRow<DiffTreeItem>[];
  collapsed: Record<string, true>;
  activeId: string | null;
};

/**
 * What a diff found, on the tree the Explorer draws: the changed entities and
 * the tables they are in, each named in the colour of what happened to it and
 * ending on its status letter. A row takes either pane to its entity.
 */
const DiffTree: FC<DiffTreeProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const root = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();
  const scroll = { top: 0 };
  const model = observable<Model>(
    {
      filter: '',
      roots: [],
      branchIds: [],
      rows: [],
      collapsed: {},
      activeId: null,
    },
    { shallow: true }
  );

  onBeforeMount(() => {
    addUnsubscribe(
      observer(() => {
        const tree = buildDiffTree(props.entries, model.filter);
        model.roots = tree.roots;
        model.branchIds = tree.branchIds;
      }),
      observer(() => {
        const expanded: Record<string, true> = {};
        for (const id of model.branchIds) {
          if (!model.collapsed[id]) expanded[id] = true;
        }
        model.rows = flattenTree(model.roots, expanded);
      })
    );
  });

  const setExpanded = (id: string, expanded: boolean) => {
    const next = { ...model.collapsed };
    expanded ? Reflect.deleteProperty(next, id) : (next[id] = true);
    model.collapsed = next;
  };

  const show = (pane: AppContext, target: ErdTarget | null) => {
    if (!target) return;
    const { store } = pane;
    const editorId = store.state.editor.id;
    clearRelationshipHighlight(editorId);
    store.dispatchSync(showErdTargetAction$(target));
    if (target.kind === 'relationship') {
      setRelationshipHighlight(editorId, target.relationshipId);
    }
  };

  const handleActivate = (row: TreeRow<DiffTreeItem>) => {
    const item = row.node.data;
    if (item.kind === 'folder') {
      setExpanded(row.node.id, !row.expanded);
      return;
    }
    const targets = diffTargets(item);
    show(props.prevApp, targets.prev);
    show(props.app, targets.next);
  };

  /** Lets past the chords that edit nothing and Escape, which closes the diff; the canvas hears no other. */
  const handleKeydown = (event: KeyboardEvent) => {
    stopsAtPanel(event, app.value.keyBindingMap, PASSING) &&
      event.stopPropagation();
  };

  const handleFilter = (event: InputEvent) => {
    model.filter = (event.target as HTMLInputElement).value;
  };

  const handleMove = ({ x }: { x: number }) => {
    const $root = root.value;
    $root && props.onResize(x - $root.getBoundingClientRect().left);
  };

  const icon = (item: DiffTreeItem, expanded: boolean): DOMTemplateLiterals => {
    if (item.kind === 'folder') {
      return expanded ? (
        <Icon name="folder-open" size={14} />
      ) : (
        <Icon name="folder" size={14} />
      );
    }
    switch (item.entry.kind) {
      case DiffKind.table:
        return <Icon name="table-2" size={14} />;
      case DiffKind.column:
        return <Icon name="list" size={14} />;
      case DiffKind.index:
        return <Icon name="list-tree" size={14} />;
      case DiffKind.foreignKey:
        return <Icon name="key-round" size={14} />;
      case DiffKind.memo:
        return <Icon name="sticky-note" size={14} />;
      case DiffKind.tableGroup:
        return <Icon name="group" size={14} />;
    }
  };

  const renderRow = (row: TreeRow<DiffTreeItem>): DOMTemplateLiterals => {
    const { t } = i18n.value;
    const item = row.node.data;
    const letter = statusLetter(item);

    if (item.kind === 'folder') {
      return (
        <>
          <span class={styles.rowIcon}>{icon(item, row.expanded)}</span>
          <span class={styles.name}>{t(FOLDER_LABEL[item.folder])}</span>
          <span class={styles.count}>{item.count}</span>
          <span class={styles.status} title={statusLabel(null, i18n.value)}>
            {letter}
          </span>
        </>
      );
    }

    const { entry } = item;
    const blank = !entry.name.trim();
    const status = entry.status ?? '';
    return (
      <>
        <span class={styles.rowIcon}>{icon(item, row.expanded)}</span>
        <span
          class={[styles.name, status, { unnamed: blank }]}
          title={describeEntry(entry, i18n.value)}
          prop:dir="auto"
        >
          {blank ? t('common.unnamed') : entry.name}
        </span>
        <span class={[styles.status, status]}>{letter}</span>
      </>
    );
  };

  return () => {
    const { t, dir } = i18n.value;
    const empty =
      !props.entries.tables.length &&
      !props.entries.tableGroups.length &&
      !props.entries.memos.length;

    return (
      <div
        class={['diff-viewer-tree', styles.root]}
        use:ref={ref(root)}
        prop:dir={dir}
        style={{ width: `${props.width}px` }}
        on:keydown={handleKeydown}
      >
        <div class={styles.header}>
          <TextInput
            class={['diff-tree-filter', styles.filter]}
            placeholder={t('explorer.diff.filter')}
            title={t('explorer.diff.filter')}
            dir="auto"
            value={model.filter}
            onInput={handleFilter}
          />
        </div>
        <div class={styles.body}>
          {empty ? (
            <div class={['diff-tree-empty', styles.empty]}>
              {t('explorer.diff.noChanges')}
            </div>
          ) : (
            <Tree
              rows={model.rows}
              activeId={model.activeId}
              label={t('feedback.diffViewer')}
              dir={dir}
              getScrollTop={() => scroll.top}
              onScroll={(top: number) => {
                scroll.top = top;
              }}
              onToggle={setExpanded}
              onActivate={handleActivate}
              onActiveChange={(id: string) => {
                model.activeId = id;
              }}
              renderRow={renderRow}
            />
          )}
        </div>
        <div class={['diff-tree-sash', styles.sash]}>
          <Sash
            type={SashType.vertical}
            onMove={handleMove}
            onDblclick={() => props.onResize(EXPLORER_WIDTH)}
          />
        </div>
      </div>
    );
  };
};

export default DiffTree;
