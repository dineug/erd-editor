import { arrayHas } from '@dineug/shared';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  drawEndRelationshipAction,
  focusTableAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { drawStartAddRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnForeignKeyAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/tableColumn/atom.actions';
import { nextPoint, nextZIndex } from '@/utils';
import { bHas } from '@/utils/bit';
import { query } from '@/utils/collection/query';

import {
  addTableAction,
  changeZIndexAction,
  removeTableAction,
} from './atom.actions';

export const addTableAction$ = (): GeneratorAction =>
  function* ({ settings, doc: { tableIds, memoIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);
    const point = nextPoint(settings, tables, memos);
    const id = nanoid();

    yield unselectAllAction();
    yield selectAction({ [id]: SelectType.table });
    yield addTableAction({
      id,
      ui: {
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(tables, memos),
      },
    });
    yield focusTableAction({ tableId: id });
  };

export const removeTableAction$ = (id?: string): GeneratorAction =>
  function* ({
    doc: { relationshipIds },
    editor: { selectedMap },
    collections,
  }) {
    // TODO: valid index
    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    if (id) {
      const removeRelationships = relationships.filter(
        ({ start, end }) => start.tableId === id || end.tableId === id
      );
      for (const { id } of removeRelationships) {
        yield removeRelationshipAction({ id });
      }
      yield removeTableAction({ id });

      return;
    }

    const selectedTableIds = Object.entries(selectedMap)
      .filter(([, type]) => type === SelectType.table)
      .map(([id]) => id);
    const hasTableIds = arrayHas(selectedTableIds);
    const removeRelationships = relationships.filter(
      ({ start, end }) => hasTableIds(start.tableId) || hasTableIds(end.tableId)
    );

    for (const { id } of removeRelationships) {
      yield removeRelationshipAction({ id });
    }
    for (const id of selectedTableIds) {
      yield removeTableAction({ id });
    }
  };

export const selectTableAction$ = (
  id: string,
  $mod: boolean
): GeneratorAction =>
  function* ({
    doc: { tableIds, memoIds },
    collections,
    editor: { drawRelationship },
  }) {
    const tableCollection = query(collections).collection('tableEntities');
    const tables = tableCollection.selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);

    if (!$mod) {
      yield unselectAllAction();
    }

    yield selectAction({ [id]: SelectType.table });
    yield changeZIndexAction({ id, zIndex: nextZIndex(tables, memos) });
    yield focusTableAction({ tableId: id });

    if (!drawRelationship) return;

    if (drawRelationship.start) {
      const startTable = tableCollection.selectById(
        drawRelationship.start.tableId
      );
      const endTable = tableCollection.selectById(id);
      if (!startTable || !endTable) return;

      const startColumns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(startTable.columnIds)
        .filter(({ options }) => bHas(options, ColumnOption.primaryKey));
      if (!startColumns.length) return;

      const endColumnIds = startColumns.map(() => nanoid());

      for (let i = 0; i < startColumns.length; i++) {
        const startColumn = startColumns[i];
        const endColumnId = endColumnIds[i];
        const payload = {
          id: endColumnId,
          tableId: endTable.id,
        };

        yield [
          addColumnAction(payload),
          changeColumnNotNullAction({
            ...payload,
            value: true,
          }),
          changeColumnForeignKeyAction({
            ...payload,
            value: true,
          }),
          changeColumnNameAction({
            ...payload,
            value: startColumn.name,
          }),
          changeColumnDataTypeAction({
            ...payload,
            value: startColumn.dataType,
          }),
          changeColumnDefaultAction({
            ...payload,
            value: startColumn.default,
          }),
          changeColumnCommentAction({
            ...payload,
            value: startColumn.comment,
          }),
        ];
      }

      yield addRelationshipAction({
        id: nanoid(),
        relationshipType: drawRelationship.relationshipType,
        start: {
          tableId: startTable.id,
          columnIds: startColumns.map(({ id }) => id),
        },
        end: {
          tableId: endTable.id,
          columnIds: endColumnIds,
        },
      });
      yield drawEndRelationshipAction();
    } else {
      yield drawStartAddRelationshipAction$(id);
    }
  };

export const actions$ = {
  addTableAction$,
  removeTableAction$,
  selectTableAction$,
};
