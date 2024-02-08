import { query } from '@dineug/erd-editor-schema';
import { FC, html } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { AppContext } from '@/components/appContext';
import {
  Diff,
  DiffMap,
  getNameToTableMap,
} from '@/components/erd/diff-viewer/diff';
import Icon from '@/components/primitives/icon/Icon';
import { START_X, START_Y } from '@/constants/layout';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import { bHas } from '@/utils/bit';
import { getAbsoluteZoomPoint } from '@/utils/dragSelect';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import * as styles from './TreeViewer.styles';

export type TreeViewerProps = {
  prevApp: AppContext;
  prevDiffMap: DiffMap;
  app: AppContext;
  diffMap: DiffMap;
};

type DiffTable = {
  diff: number;
  prevId?: string;
  id?: string;
  name: string;
  columns: DiffColumn[];
};

type DiffColumn = {
  diff: number;
  prevId?: string;
  id?: string;
  name: string;
};

const TreeViewer: FC<TreeViewerProps> = (props, ctx) => {
  const { prevApp, prevDiffMap, app, diffMap } = props;
  const prevNameToTableMap = getNameToTableMap(prevApp.store.state);
  const nameToTableMap = getNameToTableMap(app.store.state);
  const prevTableCollection = query(prevApp.store.state.collections).collection(
    'tableEntities'
  );
  const prevColumnCollection = query(
    prevApp.store.state.collections
  ).collection('tableColumnEntities');
  const tableCollection = query(app.store.state.collections).collection(
    'tableEntities'
  );
  const columnCollection = query(app.store.state.collections).collection(
    'tableColumnEntities'
  );

  const prevTableIds: string[] = [];
  const tableIds: string[] = [];
  const prevColumnIds: string[] = [];
  const columnIds: string[] = [];

  Array.from(prevDiffMap).forEach(([key, [tag, pathMap]]) => {
    tag === 'tableEntities' ? prevTableIds.push(key) : prevColumnIds.push(key);
  });

  Array.from(diffMap).forEach(([key, [tag, pathMap]]) => {
    tag === 'tableEntities' ? tableIds.push(key) : columnIds.push(key);
  });

  const hasPrevTableIds = arrayHas(prevTableIds);
  const hasTableIds = arrayHas(tableIds);
  const hasPrevColumnIds = arrayHas(prevColumnIds);
  const hasColumnIds = arrayHas(columnIds);

  prevColumnCollection.selectByIds(prevColumnIds).forEach(column => {
    if (hasPrevTableIds(column.tableId)) return;
    prevTableIds.push(column.tableId);
  });

  columnCollection.selectByIds(columnIds).forEach(column => {
    if (hasTableIds(column.tableId)) return;
    tableIds.push(column.tableId);
  });

  const prevTables = prevTableCollection.selectByIds(prevTableIds);
  const tables = tableCollection.selectByIds(tableIds);

  const diffTables: DiffTable[] = [];

  prevTables.forEach(table => {
    const diffTuple = prevDiffMap.get(table.id);
    const prevTableNameMap = prevNameToTableMap.get(table.name);
    const tableNameMap = nameToTableMap.get(table.name);
    const diffTable: DiffTable = {
      diff: 0,
      prevId: table.id,
      id: tableNameMap?.table.id,
      name: table.name,
      columns: [],
    };
    diffTables.push(diffTable);

    if (diffTuple) {
      diffTable.diff |= Diff.delete;

      if (tableNameMap) {
        diffTable.diff |= Diff.insert;
      }
    }

    prevColumnCollection
      .selectByIds(table.columnIds.filter(hasPrevColumnIds))
      .forEach(column => {
        const columnNameMap = tableNameMap?.nameToColumnMap.get(column.name);
        const diffColumn: DiffColumn = {
          diff: Diff.delete,
          prevId: column.id,
          id: columnNameMap?.id,
          name: column.name,
        };
        diffTable.columns.push(diffColumn);

        if (columnNameMap) {
          diffColumn.diff |= Diff.insert;
        }
      });

    if (tableNameMap) {
      columnCollection
        .selectByIds(tableNameMap.table.columnIds.filter(hasColumnIds))
        .forEach(column => {
          const columnNameMap = prevTableNameMap?.nameToColumnMap.get(
            column.name
          );
          if (columnNameMap) return;

          const diffColumn: DiffColumn = {
            diff: Diff.insert,
            id: column.id,
            name: column.name,
          };
          diffTable.columns.push(diffColumn);
        });
    }
  });

  tables.forEach(table => {
    const tableNameMap = prevNameToTableMap.get(table.name);
    if (tableNameMap) return;

    const diffTable: DiffTable = {
      diff: Diff.insert,
      id: table.id,
      name: table.name,
      columns: [],
    };
    diffTables.push(diffTable);

    columnCollection
      .selectByIds(table.columnIds.filter(hasColumnIds))
      .forEach(column => {
        const diffColumn: DiffColumn = {
          diff: Diff.insert,
          id: column.id,
          name: column.name,
        };
        diffTable.columns.push(diffColumn);
      });
  });

  diffTables.sort(orderByNameASC);

  const move = ({ store }: AppContext, tableId: string) => {
    const {
      settings: { width, height, zoomLevel },
      collections,
    } = store.state;
    const table = query(collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return;

    const { x, y } = getAbsoluteZoomPoint(
      { x: table.ui.x - START_X, y: table.ui.y - START_Y },
      width,
      height,
      zoomLevel
    );
    store.dispatch(
      scrollToAction({
        scrollLeft: x * -1,
        scrollTop: y * -1,
      }),
      selectTableAction$(table.id, false)
    );
  };

  const handleMove = (table: DiffTable) => {
    table.prevId && move(prevApp, table.prevId);
    table.id && move(app, table.id);
  };

  return () => html`
    <div class=${styles.root}>
      ${diffTables.map(table => {
        const tableName = table.name.trim() ? table.name : 'unnamed';
        const isInsert = bHas(table.diff, Diff.insert);
        const isDelete = bHas(table.diff, Diff.delete);
        const classMap = {
          'diff-cross': isInsert && isDelete,
          'diff-insert': isInsert && !isDelete,
          'diff-delete': !isInsert && isDelete,
        };

        return html`
          <div class=${styles.table} @click=${() => handleMove(table)}>
            <div class=${[styles.icon, classMap]}>
              ${isInsert && isDelete
                ? html`<${Icon} prefix="mdi" name="plus-minus" size=${14} />`
                : isInsert
                  ? html`<${Icon} prefix="mdi" name="plus" size=${14} />`
                  : isDelete
                    ? html`<${Icon} prefix="mdi" name="minus" size=${14} />`
                    : html`<${Icon} name="table" size=${14} />`}
            </div>
            <span class=${styles.ellipsis}>${tableName}</span>
          </div>
          ${table.columns.map(column => {
            const columnName = column.name.trim() ? column.name : 'unnamed';
            const isInsert = bHas(column.diff, Diff.insert);
            const isDelete = bHas(column.diff, Diff.delete);
            const classMap = {
              'diff-cross': isInsert && isDelete,
              'diff-insert': isInsert && !isDelete,
              'diff-delete': !isInsert && isDelete,
            };

            return html`
              <div class=${styles.column} @click=${() => handleMove(table)}>
                <div class=${[styles.icon, classMap]}>
                  ${isInsert && isDelete
                    ? html`<${Icon}
                        prefix="mdi"
                        name="plus-minus"
                        size=${14}
                      />`
                    : isInsert
                      ? html`<${Icon} prefix="mdi" name="plus" size=${14} />`
                      : isDelete
                        ? html`<${Icon} prefix="mdi" name="minus" size=${14} />`
                        : null}
                </div>
                <span class=${styles.ellipsis}>${columnName}</span>
              </div>
            `;
          })}
        `;
      })}
    </div>
  `;
};

export default TreeViewer;
