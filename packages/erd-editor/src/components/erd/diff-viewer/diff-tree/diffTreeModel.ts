import type { ErdTarget } from '@/components/erd/goToErdTarget';
import type { TreeNode } from '@/components/primitives/tree/treeModel';
import { ReferentialActionToSQL, RelationshipType } from '@/constants/schema';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import {
  type DiffChange,
  type DiffEntries,
  type DiffEntry,
  DiffField,
  DiffKind,
  DiffStatus,
} from '@/utils/diff';

export type DiffFolder =
  | 'tables'
  | 'tableGroups'
  | 'memos'
  | 'columns'
  | 'indexes'
  | 'foreignKeys';

/** What one row of the diff tree stands for: a folder, or an entry with the table it is in. */
export type DiffTreeItem =
  | { kind: 'folder'; folder: DiffFolder; count: number }
  | { kind: 'entry'; entry: DiffEntry; table: DiffEntry | null };

export type DiffTreeNode = TreeNode<DiffTreeItem>;

export type DiffTree = {
  roots: DiffTreeNode[];
  /** Every row with children, which the tree shows open unless folded. */
  branchIds: string[];
};

const PREFIX: Record<DiffEntry['kind'], string> = {
  [DiffKind.table]: 't',
  [DiffKind.column]: 'c',
  [DiffKind.index]: 'i',
  [DiffKind.foreignKey]: 'r',
  [DiffKind.memo]: 'm',
  [DiffKind.tableGroup]: 'g',
};

/** A row's id: the current entity's, or the saved one's where it is gone. */
export const entryNodeId = (entry: DiffEntry) =>
  `${PREFIX[entry.kind]}:${entry.nextId ?? `prev-${entry.prevId}`}`;

const CHILD_FOLDER: Partial<Record<DiffEntry['kind'], DiffFolder>> = {
  [DiffKind.column]: 'columns',
  [DiffKind.index]: 'indexes',
  [DiffKind.foreignKey]: 'foreignKeys',
};

const leaf = (id: string, data: DiffTreeItem): DiffTreeNode => ({
  id,
  hasChildren: false,
  children: () => [],
  data,
});

function folder(
  id: string,
  name: DiffFolder,
  list: DiffTreeNode[]
): DiffTreeNode | null {
  return list.length
    ? {
        id,
        hasChildren: true,
        children: () => list,
        data: { kind: 'folder', folder: name, count: list.length },
      }
    : null;
}

const present = <T>(nodes: Array<T | null>): T[] =>
  nodes.filter((node): node is T => node !== null);

/** Whether a name filter keeps an entry: its current name or the saved one holds what is typed, in any case. */
export function matchesFilter(entry: DiffEntry, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return (
    !needle ||
    entry.name.toLowerCase().includes(needle) ||
    entry.prevName.toLowerCase().includes(needle)
  );
}

function tableNode(table: DiffEntry, filter: string): DiffTreeNode | null {
  const id = entryNodeId(table);
  const kept = matchesFilter(table, filter);
  const children = kept
    ? table.children
    : table.children.filter(child => matchesFilter(child, filter));
  if (!kept && !children.length) return null;

  const folders = present(
    (['columns', 'indexes', 'foreignKeys'] as const).map(name =>
      folder(
        `${id}/f:${name}`,
        name,
        children
          .filter(child => CHILD_FOLDER[child.kind] === name)
          .map(child =>
            leaf(entryNodeId(child), { kind: 'entry', entry: child, table })
          )
      )
    )
  );

  return {
    id,
    hasChildren: folders.length > 0,
    children: () => folders,
    data: { kind: 'entry', entry: table, table: null },
  };
}

/**
 * The tree a diff lists: Tables, Table Groups and Memos as the Explorer has
 * them, holding what changed and the tables what changed is in, and only what
 * the name filter keeps. Every row with children shows open to begin with.
 */
export function buildDiffTree(entries: DiffEntries, filter = ''): DiffTree {
  const kept = (list: DiffEntry[]) =>
    list
      .filter(entry => matchesFilter(entry, filter))
      .map(entry =>
        leaf(entryNodeId(entry), { kind: 'entry', entry, table: null })
      );

  const roots = present([
    folder(
      'f:tables',
      'tables',
      present(entries.tables.map(table => tableNode(table, filter)))
    ),
    folder('f:tableGroups', 'tableGroups', kept(entries.tableGroups)),
    folder('f:memos', 'memos', kept(entries.memos)),
  ]);

  const branchIds: string[] = [];
  const collect = (nodes: ReadonlyArray<DiffTreeNode>) =>
    nodes.forEach(node => {
      if (!node.hasChildren) return;
      branchIds.push(node.id);
      collect(node.children());
    });
  collect(roots);

  return { roots, branchIds };
}

/** The letter a row ends on: its status, or a tilde for a row listed only for what it holds. */
export function statusLetter(item: DiffTreeItem): string {
  if (item.kind === 'folder') return '~';
  switch (item.entry.status) {
    case DiffStatus.added:
      return 'A';
    case DiffStatus.modified:
      return 'M';
    case DiffStatus.deleted:
      return 'D';
    case DiffStatus.renamed:
      return 'R';
    default:
      return '~';
  }
}

const STATUS_LABEL: Record<DiffStatus, PlainMessageKey> = {
  [DiffStatus.added]: 'explorer.status.added',
  [DiffStatus.modified]: 'explorer.status.modified',
  [DiffStatus.deleted]: 'explorer.status.deleted',
  [DiffStatus.renamed]: 'explorer.status.renamed',
};

export const statusLabel = (
  status: DiffStatus | null,
  { t }: Pick<I18n, 't'>
) => t(status ? STATUS_LABEL[status] : 'explorer.status.inside');

const FIELD_LABEL = {
  [DiffField.name]: 'explorer.diff.field.name',
  [DiffField.comment]: 'explorer.diff.field.comment',
  [DiffField.dataType]: 'explorer.diff.field.dataType',
  [DiffField.default]: 'explorer.diff.field.default',
  [DiffField.order]: 'explorer.diff.field.order',
  [DiffField.tableGroup]: 'explorer.diff.field.tableGroup',
  [DiffField.position]: 'explorer.diff.field.position',
  [DiffField.size]: 'explorer.diff.field.size',
  [DiffField.color]: 'explorer.diff.field.color',
  [DiffField.members]: 'explorer.diff.field.members',
  [DiffField.columns]: 'explorer.diff.field.columns',
  [DiffField.relationshipType]: 'explorer.diff.field.relationshipType',
  [DiffField.value]: 'explorer.diff.field.value',
} as const satisfies Partial<Record<DiffField, PlainMessageKey>>;

/** The keys and clauses a field is named by as written: AI, PK, UQ, NN, UNIQUE and the referential clauses. */
function fieldLabel(
  { field }: DiffChange,
  kind: DiffEntry['kind'],
  { t }: Pick<I18n, 't'>
): string {
  switch (field) {
    case DiffField.autoIncrement:
      return 'AI';
    case DiffField.primaryKey:
      return 'PK';
    case DiffField.unique:
      return kind === DiffKind.index ? 'UNIQUE' : 'UQ';
    case DiffField.notNull:
      return 'NN';
    case DiffField.onDelete:
      return 'ON DELETE';
    case DiffField.onUpdate:
      return 'ON UPDATE';
    default:
      return t(FIELD_LABEL[field]);
  }
}

const RELATIONSHIP_LABEL: Record<number, PlainMessageKey> = {
  [RelationshipType.ZeroOne]: 'common.relationshipType.zeroOne',
  [RelationshipType.ZeroN]: 'common.relationshipType.zeroN',
  [RelationshipType.OneOnly]: 'common.relationshipType.oneOnly',
  [RelationshipType.OneN]: 'common.relationshipType.oneN',
};

/** How long a text a tooltip line quotes may run before it is cut. */
export const QUOTE_LIMIT = 40;

function valueText(
  field: DiffField,
  value: DiffChange['before'],
  { t }: Pick<I18n, 't'>
): string {
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (field === DiffField.relationshipType && typeof value === 'number') {
    const key = RELATIONSHIP_LABEL[value];
    return key ? t(key) : String(value);
  }
  if (field === DiffField.onDelete || field === DiffField.onUpdate) {
    return ReferentialActionToSQL[value as number] ?? '—';
  }
  const text = String(value).split(/\r?\n/, 1)[0];
  if (!text.trim()) return '—';
  return text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT)}…` : text;
}

/** The tooltip of a row: what it is, then each change as before → after, one a line. */
export function describeEntry(entry: DiffEntry, i18n: Pick<I18n, 't'>): string {
  return [
    statusLabel(entry.status, i18n),
    ...entry.changes.map(change =>
      i18n.t('explorer.diff.change', {
        field: fieldLabel(change, entry.kind, i18n),
        before: valueText(change.field, change.before, i18n),
        after: valueText(change.field, change.after, i18n),
      })
    ),
  ].join('\n');
}

export type DiffTargets = {
  prev: ErdTarget | null;
  next: ErdTarget | null;
};

function targetOf(
  entry: DiffEntry,
  table: DiffEntry | null,
  side: 'prev' | 'next'
): ErdTarget | null {
  const id = side === 'prev' ? entry.prevId : entry.nextId;
  if (!id) return null;
  switch (entry.kind) {
    case DiffKind.table:
      return { kind: 'table', tableId: id };
    case DiffKind.column:
    case DiffKind.index: {
      const tableId = side === 'prev' ? table?.prevId : table?.nextId;
      return tableId ? { kind: 'table', tableId } : null;
    }
    case DiffKind.foreignKey:
      return { kind: 'relationship', relationshipId: id };
    case DiffKind.memo:
      return { kind: 'memo', memoId: id };
    case DiffKind.tableGroup:
      return { kind: 'tableGroup', tableGroupId: id };
  }
}

/**
 * Where a row takes each pane: an added entity the current pane alone, a
 * removed one the saved pane alone, and anything both hold both; a column or
 * an index its table, and a folder neither.
 */
export function diffTargets(item: DiffTreeItem): DiffTargets {
  if (item.kind === 'folder') return { prev: null, next: null };
  const { entry, table } = item;
  return {
    prev:
      entry.status === DiffStatus.added ? null : targetOf(entry, table, 'prev'),
    next:
      entry.status === DiffStatus.deleted
        ? null
        : targetOf(entry, table, 'next'),
  };
}
