import { query } from '@dineug/erd-editor-schema';
import { nanoid } from '@dineug/shared';

import { OrderType } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';

import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
  moveIndexColumnAction,
  removeIndexColumnAction,
} from './atom.actions';

export const addIndexColumnAction$ = (
  indexId: string,
  columnId: string
): GeneratorAction =>
  function* ({ collections }) {
    const index = query(collections)
      .collection('indexEntities')
      .selectById(indexId);
    if (!index) return;

    const prevIndexColumn = query(collections)
      .collection('indexColumnEntities')
      .selectByIds(index.seqIndexColumnIds)
      .find(indexColumn => indexColumn.columnId === columnId);

    if (prevIndexColumn) {
      yield addIndexColumnAction({
        id: prevIndexColumn.id,
        indexId,
        tableId: index.tableId,
        columnId,
      });
    } else {
      yield addIndexColumnAction({
        id: nanoid(),
        indexId,
        tableId: index.tableId,
        columnId,
      });
    }
  };

export const removeIndexColumnAction$ = (
  indexId: string,
  columnId: string
): GeneratorAction =>
  function* ({ collections }) {
    const index = query(collections)
      .collection('indexEntities')
      .selectById(indexId);
    if (!index) return;

    const indexColumns = query(collections)
      .collection('indexColumnEntities')
      .selectByIds(index.indexColumnIds)
      .filter(indexColumn => indexColumn.columnId === columnId);

    for (const indexColumn of indexColumns) {
      yield removeIndexColumnAction({
        id: indexColumn.id,
        indexId,
        tableId: index.tableId,
      });
    }
  };

export const changeIndexColumnOrderTypeAction$ = (
  indexColumnId: string
): GeneratorAction =>
  function* ({ collections }) {
    const indexColumn = query(collections)
      .collection('indexColumnEntities')
      .selectById(indexColumnId);
    if (!indexColumn) return;

    yield changeIndexColumnOrderTypeAction({
      id: indexColumnId,
      indexId: indexColumn.indexId,
      columnId: indexColumn.columnId,
      value:
        indexColumn.orderType === OrderType.ASC
          ? OrderType.DESC
          : OrderType.ASC,
    });
  };

export const moveIndexColumnAction$ = (
  indexColumnId: string,
  targetId: string
): GeneratorAction =>
  function* ({ collections }) {
    if (indexColumnId === targetId) return;

    const indexColumn = query(collections)
      .collection('indexColumnEntities')
      .selectById(indexColumnId);
    if (!indexColumn) return;

    const index = query(collections)
      .collection('indexEntities')
      .selectById(indexColumn.indexId);
    if (!index) return;

    yield moveIndexColumnAction({
      id: indexColumnId,
      indexId: indexColumn.indexId,
      tableId: index.tableId,
      targetId,
    });
  };

export const actions$ = {
  addIndexColumnAction$,
  removeIndexColumnAction$,
  changeIndexColumnOrderTypeAction$,
  moveIndexColumnAction$,
};
