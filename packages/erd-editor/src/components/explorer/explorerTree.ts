import { query } from '@dineug/erd-editor-schema';

import type { TreeNode } from '@/components/primitives/tree/treeModel';
import { ColumnUIKey, OrderType } from '@/constants/schema';
import type { RootState } from '@/engine/state';
import type { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
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

/** What one row of the Explorer stands for, and what it shows of it. */
export type ExplorerNode =
  | { kind: 'folder'; folder: ExplorerFolder; count: number }
  | { kind: 'table'; tableId: string; name: string }
  | {
      kind: 'column';
      tableId: string;
      columnId: string;
      name: string;
      dataType: string;
      primaryKey: boolean;
      foreignKey: boolean;
    }
  | {
      kind: 'index';
      tableId: string;
      indexId: string;
      name: string;
      unique: boolean;
      columns: string;
    }
  | {
      kind: 'foreignKey';
      relationshipId: string;
      tableId: string;
      columns: string;
      parent: string;
      parentColumns: string;
    }
  | { kind: 'tableGroup'; tableGroupId: string; name: string; color: string }
  | { kind: 'groupTable'; tableGroupId: string; tableId: string; name: string }
  | { kind: 'memo'; memoId: string; text: string };

export type ExplorerTreeNode = TreeNode<ExplorerNode>;

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

function columnNodes(state: RootState, table: Table): ExplorerTreeNode[] {
  return query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .map(column => ({
      id: `c:${column.id}`,
      hasChildren: false,
      children: () => [],
      data: {
        kind: 'column',
        tableId: table.id,
        columnId: column.id,
        name: column.name,
        dataType: column.dataType,
        primaryKey: bHas(column.ui.keys, ColumnUIKey.primaryKey),
        foreignKey: bHas(column.ui.keys, ColumnUIKey.foreignKey),
      },
    }));
}

function indexNodes(state: RootState, table: Table): ExplorerTreeNode[] {
  const { collections } = state;
  const columns = query(collections).collection('tableColumnEntities');
  const indexColumns = query(collections).collection('indexColumnEntities');

  return query(collections)
    .collection('indexEntities')
    .selectByIds(getTableIndexIds(state, table.id))
    .map(index => ({
      id: `i:${index.id}`,
      hasChildren: false,
      children: () => [],
      data: {
        kind: 'index',
        tableId: table.id,
        indexId: index.id,
        name: index.name,
        unique: index.unique,
        columns: indexColumns
          .selectByIds(index.indexColumnIds)
          .map(indexColumn => {
            const name = columns.selectById(indexColumn.columnId)?.name ?? '';
            return indexColumn.orderType === OrderType.DESC
              ? `${name} DESC`
              : name;
          })
          .join(', '),
      },
    }));
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
