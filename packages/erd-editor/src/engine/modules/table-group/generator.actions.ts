import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { uuid25 } from '@dineug/uuid';
import { uniq } from 'es-toolkit';

import { GeneratorAction } from '@/engine/generator.actions';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { getSelectTypeIds } from '@/engine/modules/editor/utils/selection';
import {
  changeTableGroupAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { RootState } from '@/engine/state';
import { attachActionTag, Tag } from '@/engine/tag';
import type { Table } from '@/internal-types';
import { type Rect, unionRect } from '@/konva/scene/metrics';
import { arrayHas } from '@/utils/arrayHas';
import {
  findTableGroupsAt,
  getTableCenter,
  getTableGroupId,
  getTableGroupMemberIds,
  getTableGroupRects,
  getTablesGroupRect,
  isPointInRect,
  isTableGroupShown,
  nextTableGroupZIndex,
} from '@/utils/tableGroup';

import {
  addTableGroupAction,
  changeTableGroupNameAction,
  changeTableGroupZIndexAction,
  moveTableGroupAction,
  removeTableGroupAction,
} from './atom.actions';

/** What a new group starts with besides its rect: no name and no color unless given. */
export type NewTableGroupFields = { name?: string; color?: string };

const selectGroups = ({ doc, collections }: RootState) =>
  query(collections)
    .collection('tableGroupEntities')
    .selectByIds(doc.tableGroupIds);

/**
 * The batch that adds a group at the rect, selected alone, named and colored
 * as given, with the tables given joining it: one dispatch, so one undo takes
 * back the group and every membership it set.
 */
function* addGroup$(
  state: RootState,
  rect: Rect,
  tableIds: string[],
  { name, color }: NewTableGroupFields
) {
  const id = uuid25();
  const { x, y, width, height } = rect;

  yield unselectAllAction$();
  yield selectAction({ [id]: SelectType.tableGroup });
  yield addTableGroupAction({
    id,
    ...(color ? { color } : {}),
    ui: {
      x,
      y,
      width,
      height,
      zIndex: nextTableGroupZIndex(selectGroups(state)),
    },
  });
  if (name) {
    yield changeTableGroupNameAction({ id, value: name });
  }
  yield tableIds.map(tableId =>
    changeTableGroupAction({ id: tableId, value: id })
  );
}

/**
 * Adds a group drawn over the canvas: the tables in no group whose centre lies
 * in the rect join it, and a table in another group stays where it is.
 *
 * @example
 * store.dispatch(addTableGroupAction$({ x: 0, y: 0, width: 600, height: 400 }));
 */
export const addTableGroupAction$ = (
  rect: Rect,
  fields: NewTableGroupFields = {}
): GeneratorAction =>
  function* (state) {
    const { doc, collections } = state;
    const tableIds = query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .filter(
        table =>
          !getTableGroupId(state, table) &&
          isPointInRect(getTableCenter(state, table), rect)
      )
      .map(({ id }) => id);

    yield* addGroup$(state, rect, tableIds, fields);
  };

/**
 * Adds a group around the tables given, or the selected ones, their bounds and
 * the padding its rect: each joins it, leaving any group it was in. No table
 * the document lists, and nothing is added.
 *
 * @example
 * store.dispatch(addTableGroupFromTablesAction$());
 */
export const addTableGroupFromTablesAction$ = (
  tableIds?: string[],
  fields: NewTableGroupFields = {}
): GeneratorAction =>
  function* (state) {
    const ids = uniq(
      tableIds ?? getSelectTypeIds(state.editor.selectedMap).tableIds
    ).filter(arrayHas(state.doc.tableIds));
    const rect = getTablesGroupRect(state, ids);
    if (!rect) return;

    yield* addGroup$(state, rect, ids, fields);
  };

/**
 * Removes the group named, or every selected one the document lists, each with
 * its members' groupId cleared in the same dispatch, so one undo brings back
 * the group and its members together.
 */
export const removeTableGroupAction$ = (id?: string): GeneratorAction =>
  function* (state) {
    const {
      doc: { tableGroupIds },
      editor: { selectedMap },
    } = state;
    // A group a peer, an agent or an undo removes stays selected, and its
    // removal recorded again would make an undo that brings it back.
    const isInDoc = arrayHas(tableGroupIds);
    const ids = id
      ? [id]
      : Object.entries(selectedMap)
          .filter(([id, type]) => type === SelectType.tableGroup && isInDoc(id))
          .map(([id]) => id);

    for (const groupId of ids) {
      yield getTableGroupMemberIds(state, groupId).map(tableId =>
        changeTableGroupAction({ id: tableId, value: '' })
      );
      yield removeTableGroupAction({ id: groupId });
    }
  };

/**
 * The tables a move of groups and tables carries: the tables given and every
 * member of those groups, a table both given and a member once.
 */
export function getCarriedTableIds(
  state: RootState,
  groupIds: string[],
  tableIds: string[]
): string[] {
  return uniq([
    ...tableIds,
    ...groupIds.flatMap(id => getTableGroupMemberIds(state, id)),
  ]);
}

/**
 * The drag step of groups and the tables they carry (getCarriedTableIds): each
 * group and each table by the same step, tagged as drags.
 */
export function toMoveTableGroupActions(
  groupIds: string[],
  tableIds: string[],
  movementX: number,
  movementY: number
): AnyAction[] {
  return [
    ...(groupIds.length
      ? [moveTableGroupAction({ ids: groupIds, movementX, movementY })]
      : []),
    ...(tableIds.length
      ? [moveTableAction({ ids: tableIds, movementX, movementY })]
      : []),
  ].map(action => attachActionTag(Tag.drag, action));
}

/**
 * Moves groups by a step in scene units, their member tables with them, in one
 * dispatch: moves are relative, so a peer's concurrent move adds up.
 *
 * @example
 * store.dispatch(moveTableGroupAction$(['g1'], 40, 0));
 */
export const moveTableGroupAction$ = (
  ids: string[],
  movementX: number,
  movementY: number
): GeneratorAction =>
  function* (state) {
    yield toMoveTableGroupActions(
      ids,
      getCarriedTableIds(state, ids, []),
      movementX,
      movementY
    );
  };

/**
 * Puts the tables in the group, or in none for '': a group the document does
 * not list, and nothing is sent, nor for a table already where it goes.
 *
 * @example
 * store.dispatch(setTableGroupAction$(['users', 'orders'], 'g1'));
 */
export const setTableGroupAction$ = (
  tableIds: string[],
  groupId: string
): GeneratorAction =>
  function* ({ doc, collections }) {
    if (groupId && !doc.tableGroupIds.includes(groupId)) return;

    yield query(collections)
      .collection('tableEntities')
      .selectByIds(uniq(tableIds).filter(arrayHas(doc.tableIds)))
      .filter(table => table.groupId !== groupId)
      .map(({ id }) => changeTableGroupAction({ id, value: groupId }));
  };

/** A table a drop judges, the group it lands in, '' for none, and that group's box, null for none. */
export type TableGroupDrop = {
  table: Table;
  groupId: string;
  box: Rect | null;
};

/**
 * The box each group showed as a drag began, by group id, held for the drag's
 * length: a member that grew past the stored rect stays in the box the reader
 * saw while its centre does, though only its own padding drew the box there.
 */
export type HeldTableGroupBoxes = ReadonlyMap<string, Rect>;

/**
 * Where a drop puts each selected table no selected group carries: in the topmost group whose box
 * without them, and for a group the drag leaves standing the box it held too, holds its centre, or
 * in none. With groups hidden or no table to judge, a drag of groups alone, it reads no box.
 */
export function getTableGroupDrops(
  state: RootState,
  held?: HeldTableGroupBoxes | null
): TableGroupDrop[] {
  if (!isTableGroupShown(state)) return [];

  const { doc, collections, editor } = state;
  const { tableIds, tableGroupIds } = getSelectTypeIds(editor.selectedMap);
  const listed = new Set(doc.tableIds);
  const selected = tableIds.filter(id => listed.has(id));
  if (!selected.length) return [];

  const carried = new Set(
    tableGroupIds.flatMap(id => getTableGroupMemberIds(state, id))
  );
  const judged = selected.filter(id => !carried.has(id));
  if (!judged.length) return [];

  const moving = new Set(tableGroupIds);
  const boxes = getTableGroupRects(state, { excludeTableIds: judged });
  held?.forEach((rect, id) => {
    const box = boxes.get(id);
    if (box && !moving.has(id)) boxes.set(id, unionRect(box, rect));
  });

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(judged);
  const groups = findTableGroupsAt(
    state,
    tables.map(table => getTableCenter(state, table)),
    { boxes }
  );

  return tables.map((table, index) => {
    const groupId = groups[index]?.id ?? '';
    return { table, groupId, box: boxes.get(groupId) ?? null };
  });
}

/**
 * Ends a drag of the selection: each table getTableGroupDrops judges, given the boxes the drag held,
 * joins the group it landed in or leaves its own, tagged as the drag, so the history closes the
 * membership into the drag's undo entry; its undo reads prevValue.
 *
 * @example
 * store.dispatch(dropTablesIntoGroupsAction$(held));
 */
export const dropTablesIntoGroupsAction$ = (
  held?: HeldTableGroupBoxes | null
): GeneratorAction =>
  function* (state) {
    yield getTableGroupDrops(state, held)
      .filter(({ table, groupId }) => groupId !== getTableGroupId(state, table))
      .map(({ table, groupId }) =>
        attachActionTag(
          Tag.drag,
          changeTableGroupAction({
            id: table.id,
            value: groupId,
            prevValue: table.groupId,
          })
        )
      );
  };

/** Selects a group, alone unless $mod, and draws it over every other group. */
export const selectTableGroupAction$ = (
  id: string,
  $mod: boolean
): GeneratorAction =>
  function* (state) {
    if (!$mod) {
      yield unselectAllAction$();
    }
    yield selectAction({ [id]: SelectType.tableGroup });
    yield changeTableGroupZIndexAction({
      id,
      zIndex: nextTableGroupZIndex(selectGroups(state)),
    });
  };

/**
 * Selects the group's member tables alone, the group itself left out, so what
 * a table command reaches next is its tables.
 *
 * @example
 * store.dispatch(selectTableGroupTablesAction$('g1'));
 */
export const selectTableGroupTablesAction$ = (id: string): GeneratorAction =>
  function* (state) {
    yield unselectAllAction$();
    yield selectAction(
      Object.fromEntries(
        getTableGroupMemberIds(state, id).map(tableId => [
          tableId,
          SelectType.table,
        ])
      )
    );
  };

export const actions$ = {
  addTableGroupAction$,
  addTableGroupFromTablesAction$,
  removeTableGroupAction$,
  moveTableGroupAction$,
  setTableGroupAction$,
  dropTablesIntoGroupsAction$,
  selectTableGroupAction$,
  selectTableGroupTablesAction$,
};
