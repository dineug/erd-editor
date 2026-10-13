import { query } from '@dineug/erd-editor-schema';

import type { TreeNode } from '@/components/primitives/tree/treeModel';
import { ColumnUIKey, OrderType } from '@/constants/schema';
import type { RootState } from '@/engine/state';
import type { Column, Index, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { FindField, type FindMatch } from '@/utils/find-replace';
import { isMemoShown } from '@/utils/memo';
import { orderByNameASC } from '@/utils/schema-sql/utils';
import { getTableGroupMemberIds, isTableGroupShown } from '@/utils/tableGroup';
import { getTableIndexIds } from '@/utils/tableKeys';

import { TABLES_FOLDER_ID } from './explorerView';

export type ExplorerFolder =
  | 'tables'
  | 'tableGroups'
  | 'memos'
  | 'columns'
  | 'indexes'
  | 'foreignKeys';

/** The matches a search found in a row's own name, which it marks; none outside a search. */
type NameMatches = { matches?: ReadonlyArray<FindMatch> };

/** What one row of the Explorer stands for, and what it shows of it. */
export type ExplorerNode =
  | { kind: 'folder'; folder: ExplorerFolder; count: number }
  | ({ kind: 'table'; tableId: string; name: string } & NameMatches)
  | ({
      kind: 'column';
      tableId: string;
      columnId: string;
      name: string;
      dataType: string;
      primaryKey: boolean;
      foreignKey: boolean;
    } & NameMatches)
  | ({
      kind: 'index';
      tableId: string;
      indexId: string;
      name: string;
      unique: boolean;
      columns: string;
    } & NameMatches)
  | {
      kind: 'foreignKey';
      relationshipId: string;
      tableId: string;
      columns: string;
      parent: string;
      parentColumns: string;
    }
  | ({
      kind: 'tableGroup';
      tableGroupId: string;
      name: string;
      color: string;
    } & NameMatches)
  | { kind: 'groupTable'; tableGroupId: string; tableId: string; name: string }
  | { kind: 'memo'; memoId: string; text: string }
  /** One match in a comment or a memo, shown as the stretch of text around it. */
  | { kind: 'excerpt'; match: FindMatch };

export type ExplorerTreeNode = TreeNode<ExplorerNode>;

type NodeOf<K extends ExplorerNode['kind']> = Extract<
  ExplorerNode,
  { kind: K }
>;

const folder = (
  id: string,
  name: ExplorerFolder,
  children: () => ExplorerTreeNode[]
): ExplorerTreeNode | null => {
  const list = children();
  return list.length
    ? {
        id,
        hasChildren: true,
        children: () => list,
        data: { kind: 'folder', folder: name, count: list.length },
      }
    : null;
};

const present = <T>(nodes: Array<T | null>): T[] =>
  nodes.filter((node): node is T => node !== null);

/** The first line of a memo, the one its row shows. */
const firstLine = (text: string) => text.split(/\r?\n/, 1)[0].trim();

const leaf = (id: string, data: ExplorerNode): ExplorerTreeNode => ({
  id,
  hasChildren: false,
  children: () => [],
  data,
});

const columnData = (tableId: string, column: Column): NodeOf<'column'> => ({
  kind: 'column',
  tableId,
  columnId: column.id,
  name: column.name,
  dataType: column.dataType,
  primaryKey: bHas(column.ui.keys, ColumnUIKey.primaryKey),
  foreignKey: bHas(column.ui.keys, ColumnUIKey.foreignKey),
});

function columnNodes(state: RootState, table: Table): ExplorerTreeNode[] {
  return query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .map(column => leaf(`c:${column.id}`, columnData(table.id, column)));
}

function indexData(
  state: RootState,
  tableId: string,
  index: Index
): NodeOf<'index'> {
  const { collections } = state;
  const columns = query(collections).collection('tableColumnEntities');

  return {
    kind: 'index',
    tableId,
    indexId: index.id,
    name: index.name,
    unique: index.unique,
    columns: query(collections)
      .collection('indexColumnEntities')
      .selectByIds(index.indexColumnIds)
      .map(indexColumn => {
        const name = columns.selectById(indexColumn.columnId)?.name ?? '';
        return indexColumn.orderType === OrderType.DESC ? `${name} DESC` : name;
      })
      .join(', '),
  };
}

function indexNodes(state: RootState, table: Table): ExplorerTreeNode[] {
  return query(state.collections)
    .collection('indexEntities')
    .selectByIds(getTableIndexIds(state, table.id))
    .map(index => leaf(`i:${index.id}`, indexData(state, table.id, index)));
}

/** The relationships this table is the child of, in document order, of a parent still in the document. */
function foreignKeyNodes(state: RootState, table: Table): ExplorerTreeNode[] {
  const { doc, collections } = state;
  const columns = query(collections).collection('tableColumnEntities');
  const tables = query(collections).collection('tableEntities');
  const names = (ids: string[]) =>
    columns
      .selectByIds(ids)
      .map(column => column.name)
      .join(', ');

  return query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds)
    .filter(
      relationship =>
        relationship.end.tableId === table.id &&
        doc.tableIds.includes(relationship.start.tableId)
    )
    .map(relationship => ({
      id: `r:${relationship.id}`,
      hasChildren: false,
      children: () => [],
      data: {
        kind: 'foreignKey',
        relationshipId: relationship.id,
        tableId: table.id,
        columns: names(relationship.end.columnIds),
        parent: tables.selectById(relationship.start.tableId)?.name ?? '',
        parentColumns: names(relationship.start.columnIds),
      },
    }));
}

function tableNode(state: RootState, table: Table): ExplorerTreeNode {
  const base = `t:${table.id}`;

  return {
    id: base,
    hasChildren: true,
    children: () =>
      present([
        folder(`${base}/f:columns`, 'columns', () => columnNodes(state, table)),
        folder(`${base}/f:indexes`, 'indexes', () => indexNodes(state, table)),
        folder(`${base}/f:foreignKeys`, 'foreignKeys', () =>
          foreignKeyNodes(state, table)
        ),
      ]),
    data: { kind: 'table', tableId: table.id, name: table.name },
  };
}

function tableGroupNodes(state: RootState): ExplorerTreeNode[] {
  const { doc, collections } = state;
  const tables = query(collections).collection('tableEntities');

  return query(collections)
    .collection('tableGroupEntities')
    .selectByIds(doc.tableGroupIds)
    .sort(orderByNameASC)
    .map(group => {
      const base = `g:${group.id}`;
      // A member is a row that goes to its table, never a second copy of the
      // table's own folders.
      const members = () =>
        tables
          .selectByIds(getTableGroupMemberIds(state, group.id))
          .sort(orderByNameASC)
          .map<ExplorerTreeNode>(table => ({
            id: `${base}/t:${table.id}`,
            hasChildren: false,
            children: () => [],
            data: {
              kind: 'groupTable',
              tableGroupId: group.id,
              tableId: table.id,
              name: table.name,
            },
          }));

      return {
        id: base,
        hasChildren: getTableGroupMemberIds(state, group.id).length > 0,
        children: members,
        data: {
          kind: 'tableGroup',
          tableGroupId: group.id,
          name: group.name,
          color: group.color,
        },
      };
    });
}

function memoNodes(state: RootState): ExplorerTreeNode[] {
  const { doc, collections } = state;

  return query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds)
    .map(memo => ({
      id: `m:${memo.id}`,
      hasChildren: false,
      children: () => [],
      data: { kind: 'memo', memoId: memo.id, text: firstLine(memo.value) },
    }));
}

/**
 * The Explorer's folders, Tables, Table Groups and Memos, each only while it
 * holds something and groups and memos only while shown. Tables and groups go
 * by name, memos as the document has them; a table's folders wait for its expanding.
 */
export function buildExplorerTree(state: RootState): ExplorerTreeNode[] {
  const { doc, collections } = state;

  return present([
    folder(TABLES_FOLDER_ID, 'tables', () =>
      query(collections)
        .collection('tableEntities')
        .selectByIds(doc.tableIds)
        .sort(orderByNameASC)
        .map(table => tableNode(state, table))
    ),
    isTableGroupShown(state)
      ? folder('f:tableGroups', 'tableGroups', () => tableGroupNodes(state))
      : null,
    isMemoShown(state)
      ? folder('f:memos', 'memos', () => memoNodes(state))
      : null,
  ]);
}

/**
 * The row a match shows on in the search's tree: a name's own row, or the
 * excerpt row of a comment or memo, one for each match there.
 */
export function matchRowId({ field, id, start }: FindMatch): string {
  switch (field) {
    case FindField.tableName:
      return `t:${id}`;
    case FindField.columnName:
      return `c:${id}`;
    case FindField.indexName:
      return `i:${id}`;
    case FindField.tableGroupName:
      return `g:${id}`;
    case FindField.tableComment:
      return `t:${id}/x:${field}:${start}`;
    case FindField.columnComment:
      return `c:${id}/x:${field}:${start}`;
    case FindField.memo:
      return `m:${id}/x:${field}:${start}`;
  }
}

export type SearchTree = {
  roots: ExplorerTreeNode[];
  /** Every row with children, which a search shows open unless folded. */
  branchIds: string[];
};

type TableHits = {
  table: Table;
  name: FindMatch[];
  comment: FindMatch[];
  columns: Map<string, { name: FindMatch[]; comment: FindMatch[] }>;
  indexes: Map<string, FindMatch[]>;
};

const excerpt = (parentId: string, match: FindMatch) =>
  leaf(`${parentId}/x:${match.field}:${match.start}`, {
    kind: 'excerpt',
    match,
  });

const branch = (
  id: string,
  data: ExplorerNode,
  list: ExplorerTreeNode[]
): ExplorerTreeNode =>
  list.length
    ? { id, hasChildren: true, children: () => list, data }
    : leaf(id, data);

function searchTableNode(state: RootState, hits: TableHits): ExplorerTreeNode {
  const { table } = hits;
  const base = `t:${table.id}`;
  const columns = query(state.collections).collection('tableColumnEntities');
  const indexes = query(state.collections).collection('indexEntities');

  return branch(
    base,
    { kind: 'table', tableId: table.id, name: table.name, matches: hits.name },
    present([
      ...hits.comment.map(match => excerpt(base, match)),
      folder(`${base}/f:columns`, 'columns', () =>
        columns.selectByIds([...hits.columns.keys()]).map(column => {
          const found = hits.columns.get(column.id)!;
          const id = `c:${column.id}`;
          return branch(
            id,
            { ...columnData(table.id, column), matches: found.name },
            found.comment.map(match => excerpt(id, match))
          );
        })
      ),
      folder(`${base}/f:indexes`, 'indexes', () =>
        indexes
          .selectByIds(
            getTableIndexIds(state, table.id).filter(id => hits.indexes.has(id))
          )
          .map(index =>
            leaf(`i:${index.id}`, {
              ...indexData(state, table.id, index),
              matches: hits.indexes.get(index.id),
            })
          )
      ),
    ])
  );
}

/** Sorts the matches by the row each stands under, in the order the search met them. */
function gatherHits(state: RootState, matches: ReadonlyArray<FindMatch>) {
  const { doc, collections } = state;
  const tables = query(collections).collection('tableEntities');
  const shownTables = new Set(doc.tableIds);
  const shownGroups = new Set(doc.tableGroupIds);
  const shownMemos = new Set(doc.memoIds);
  const tableHits = new Map<string, TableHits>();
  const groupHits = new Map<string, FindMatch[]>();
  const memoHits = new Map<string, FindMatch[]>();
  const add = <K>(map: Map<K, FindMatch[]>, key: K, match: FindMatch) => {
    const list = map.get(key);
    list ? list.push(match) : map.set(key, [match]);
  };

  for (const match of matches) {
    if (match.field === FindField.tableGroupName) {
      shownGroups.has(match.id) && add(groupHits, match.id, match);
      continue;
    }
    if (match.field === FindField.memo) {
      shownMemos.has(match.id) && add(memoHits, match.id, match);
      continue;
    }

    // A match a removal has left behind waits for the search the edit asks for.
    const table = shownTables.has(match.tableId)
      ? tables.selectById(match.tableId)
      : undefined;
    if (!table) continue;
    let hits = tableHits.get(table.id);
    if (!hits) {
      hits = {
        table,
        name: [],
        comment: [],
        columns: new Map(),
        indexes: new Map(),
      };
      tableHits.set(table.id, hits);
    }

    switch (match.field) {
      case FindField.tableName:
        hits.name.push(match);
        break;
      case FindField.tableComment:
        hits.comment.push(match);
        break;
      case FindField.indexName:
        add(hits.indexes, match.id, match);
        break;
      default: {
        if (!table.columnIds.includes(match.id)) break;
        let column = hits.columns.get(match.id);
        if (!column) {
          column = { name: [], comment: [] };
          hits.columns.set(match.id, column);
        }
        match.field === FindField.columnName
          ? column.name.push(match)
          : column.comment.push(match);
      }
    }
  }

  return { tableHits, groupHits, memoHits };
}

/**
 * The tree a search shows: the rows that hold a match and the rows above
 * them, in the order the search walked, with a comment's or memo's matches as
 * rows of their own. A group's tables are left out, found under Tables alone.
 */
export function buildSearchTree(
  state: RootState,
  matches: ReadonlyArray<FindMatch>
): SearchTree {
  const { collections } = state;
  const { tableHits, groupHits, memoHits } = gatherHits(state, matches);
  const groups = query(collections).collection('tableGroupEntities');
  const memos = query(collections).collection('memoEntities');

  const roots = present([
    folder(TABLES_FOLDER_ID, 'tables', () =>
      [...tableHits.values()].map(hits => searchTableNode(state, hits))
    ),
    folder('f:tableGroups', 'tableGroups', () =>
      groups.selectByIds([...groupHits.keys()]).map(group =>
        leaf(`g:${group.id}`, {
          kind: 'tableGroup',
          tableGroupId: group.id,
          name: group.name,
          color: group.color,
          matches: groupHits.get(group.id),
        })
      )
    ),
    folder('f:memos', 'memos', () =>
      memos.selectByIds([...memoHits.keys()]).map(memo => {
        const id = `m:${memo.id}`;
        return branch(
          id,
          { kind: 'memo', memoId: memo.id, text: firstLine(memo.value) },
          memoHits.get(memo.id)!.map(match => excerpt(id, match))
        );
      })
    ),
  ]);

  const branchIds: string[] = [];
  const collect = (nodes: ReadonlyArray<ExplorerTreeNode>) =>
    nodes.forEach(node => {
      if (!node.hasChildren) return;
      branchIds.push(node.id);
      collect(node.children());
    });
  collect(roots);

  return { roots, branchIds };
}

/** What a search shows open: every row with children but those folded. */
export function searchExpanded(
  branchIds: ReadonlyArray<string>,
  collapsed: Readonly<Record<string, true>>
): Record<string, true> {
  const expanded: Record<string, true> = {};
  for (const id of branchIds) {
    if (!collapsed[id]) expanded[id] = true;
  }
  return expanded;
}
