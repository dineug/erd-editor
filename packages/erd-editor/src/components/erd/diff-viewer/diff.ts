import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';

/**
 * Map<uuid, Map<path, diff>>
 */
export type DiffMap = Map<string, Map<string, number>>;

type NameToTableMap = Map<
  string,
  {
    table: Table;
    nameToColumnMap: Map<string, Column>;
  }
>;

export const Diff = {
  insert: 1,
  equal: 0,
  delete: -1,
} as const;

export function diffState(
  prevState: RootState,
  state: RootState
): [DiffMap, DiffMap] {
  const prevNameToTableMap = getNameToTableMap(prevState);
  const nameToTableMap = getNameToTableMap(state);
  const prevDiffMap = getDiffMap(prevState, nameToTableMap, Diff.delete);
  const diffMap = getDiffMap(state, prevNameToTableMap, Diff.insert);

  return [prevDiffMap, diffMap];
}

function getNameToTableMap({
  doc: { tableIds },
  collections,
}: RootState): NameToTableMap {
  const map: NameToTableMap = new Map();

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .forEach(table => {
      const nameToColumnMap = new Map<string, Column>();
      map.set(table.name, { table, nameToColumnMap });

      query(collections)
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds)
        .forEach(column => {
          nameToColumnMap.set(column.name, column);
        });
    });

  return map;
}

function getDiffMap(
  { doc: { tableIds }, collections }: RootState,
  nameToTableMap: NameToTableMap,
  diff: number
): DiffMap {
  const diffMap = new Map<string, Map<string, number>>();

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .forEach(table => {
      const tableNameMap = nameToTableMap.get(table.name);
      const pathMap = new Map<string, number>();
      diffMap.set(table.id, pathMap);

      pathMap.set(
        'tableName',
        getDiffValue(diff, table.name, tableNameMap?.table.name)
      );
      pathMap.set(
        'tableComment',
        getDiffValue(diff, table.comment, tableNameMap?.table.comment)
      );

      query(collections)
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds)
        .forEach(column => {
          const columnNameMap = tableNameMap?.nameToColumnMap.get(column.name);
          const pathMap = new Map<string, number>();
          diffMap.set(column.id, pathMap);

          pathMap.set(
            'columnName',
            getDiffValue(diff, column.name, columnNameMap?.name)
          );
          pathMap.set(
            'columnComment',
            getDiffValue(diff, column.comment, columnNameMap?.comment)
          );
          pathMap.set(
            'columnDataType',
            getDiffValue(diff, column.dataType, columnNameMap?.dataType)
          );
          pathMap.set(
            'columnDefault',
            getDiffValue(diff, column.default, columnNameMap?.default)
          );
          pathMap.set(
            'columnAutoIncrement',
            columnNameMap
              ? getDiffValue(
                  diff,
                  bHas(column.options, ColumnOption.autoIncrement),
                  bHas(columnNameMap.options, ColumnOption.autoIncrement)
                )
              : diff
          );
          pathMap.set(
            'columnPrimaryKey',
            columnNameMap
              ? getDiffValue(
                  diff,
                  bHas(column.options, ColumnOption.primaryKey),
                  bHas(columnNameMap.options, ColumnOption.primaryKey)
                )
              : diff
          );
          pathMap.set(
            'columnUnique',
            columnNameMap
              ? getDiffValue(
                  diff,
                  bHas(column.options, ColumnOption.unique),
                  bHas(columnNameMap.options, ColumnOption.unique)
                )
              : diff
          );
          pathMap.set(
            'columnNotNull',
            columnNameMap
              ? getDiffValue(
                  diff,
                  bHas(column.options, ColumnOption.notNull),
                  bHas(columnNameMap.options, ColumnOption.notNull)
                )
              : diff
          );
        });
    });

  diffMap.forEach(map => {
    Array.from(map).forEach(([path, diff]) => {
      diff === Diff.equal && map.delete(path);
    });
  });

  return diffMap;
}

function getDiffValue<T>(diff: number, value: T, prev: T): number {
  return value === prev ? Diff.equal : diff;
}

export function getDiffStyle(diff: number, diffMap: DiffMap) {
  const style = document.createElement('style');
  const rootClass =
    diff === Diff.insert ? '.diff-viewer-insert' : '.diff-viewer-delete';

  const diffStyle = Array.from(diffMap)
    .map(([id, pathMap]) => {
      const selector = `${rootClass} [data-id="${id}"]`;
      return Array.from(pathMap)
        .map(([path, diff]) =>
          diff !== Diff.equal
            ? /* css */ `
              ${selector} [data-type="${path}"] {
                background-color: ${
                  diff === Diff.insert
                    ? 'var(--diff-insert-background)'
                    : 'var(--diff-delete-background)'
                };
              }
            `
            : ''
        )
        .join('\n');
    })
    .join('\n');

  style.textContent = diffStyle;
  return style;
}
