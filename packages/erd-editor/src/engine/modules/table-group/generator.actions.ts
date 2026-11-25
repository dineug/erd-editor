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
  changeMemoGroupAction,
  changeZIndexAction as changeMemoZIndexAction,
  moveMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeTableGroupAction,
  changeZIndexAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { RootState } from '@/engine/state';
import { attachActionTag, Tag } from '@/engine/tag';
import type { Memo, Table } from '@/internal-types';
import { type Rect, unionRect } from '@/konva/scene/metrics';
import { arrayHas } from '@/utils/arrayHas';
import { isMemoShown } from '@/utils/memo';
import {
  findTableGroupsAt,
  getMemoCenter,
  getMemoGroupId,
  getTableCenter,
  getTableGroupId,
  getTableGroupMemberIds,
  getTableGroupMemberMemoIds,
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
 * as given, with the tables and memos given joining it: one dispatch, so one
 * undo takes back the group and every membership it set.
 */
function* addGroup$(
  state: RootState,
  rect: Rect,
  tableIds: string[],
  memoIds: string[],
  { name, color }: NewTableGroupFields
) {
  const id = uuid25();
  const { x, y, width, height } = rect;

  yield unselectAllAction$();
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
  yield selectAction({ [id]: SelectType.tableGroup });
  if (name) {
    yield changeTableGroupNameAction({ id, value: name });
  }
  yield tableIds.map(tableId =>
    changeTableGroupAction({ id: tableId, value: id })
  );
  yield memoIds.map(memoId => changeMemoGroupAction({ id: memoId, value: id }));
}

/**
 * Adds a group drawn over the canvas: the tables in no group, and the shown
 * memos in none, whose centre lies in the rect join it, and one in another
 * group stays where it is.
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
    const memoIds = isMemoShown(state)
      ? query(collections)
          .collection('memoEntities')
          .selectByIds(doc.memoIds)
          .filter(
            memo =>
              !getMemoGroupId(state, memo) &&
              isPointInRect(getMemoCenter(memo), rect)
          )
          .map(({ id }) => id)
      : [];

    yield* addGroup$(state, rect, tableIds, memoIds, fields);
  };

/**
 * Adds a group around the tables given or selected, and the memos given or, with
 * the tables selected, the selected memos, padded: each joins it, leaving its old
 * group. No table the document lists, memos alone too, and nothing is added.
 *
 * @example
 * store.dispatch(addTableGroupFromTablesAction$());
 */
export const addTableGroupFromTablesAction$ = (
  tableIds?: string[],
  fields: NewTableGroupFields = {},
  memoIds?: string[]
): GeneratorAction =>
  function* (state) {
    const { doc, editor } = state;
    const selected = getSelectTypeIds(editor.selectedMap);
    const ids = uniq(tableIds ?? selected.tableIds).filter(
      arrayHas(doc.tableIds)
    );
    const memos = uniq(memoIds ?? (tableIds ? [] : selected.memoIds)).filter(
      arrayHas(doc.memoIds)
    );
    const rect = ids.length ? getTablesGroupRect(state, ids, memos) : null;
    if (!rect) return;

    yield* addGroup$(state, rect, ids, memos, fields);
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
      yield getTableGroupMemberMemoIds(state, groupId).map(memoId =>
        changeMemoGroupAction({ id: memoId, value: '' })
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
 * The memos a move of groups and memos carries: the memos given and every
 * member memo of those groups, hidden ones too, a memo both given and a
 * member once.
 */
export function getCarriedMemoIds(
  state: RootState,
  groupIds: string[],
  memoIds: string[]
): string[] {
  return uniq([
    ...memoIds,
    ...groupIds.flatMap(id => getTableGroupMemberMemoIds(state, id)),
  ]);
}

/**
 * The drag step of groups and the tables and memos they carry
 * (getCarriedTableIds, getCarriedMemoIds): each by the same step, tagged as drags.
 */
export function toMoveTableGroupActions(
  groupIds: string[],
  tableIds: string[],
  movementX: number,
  movementY: number,
  memoIds: string[] = []
): AnyAction[] {
  return [
    ...(groupIds.length
      ? [moveTableGroupAction({ ids: groupIds, movementX, movementY })]
      : []),
    ...(tableIds.length
      ? [moveTableAction({ ids: tableIds, movementX, movementY })]
      : []),
    ...(memoIds.length
      ? [moveMemoAction({ ids: memoIds, movementX, movementY })]
      : []),
  ].map(action => attachActionTag(Tag.drag, action));
}

/**
 * Moves groups by a step in scene units, their member tables and memos with
 * them, in one dispatch, which a peer hears as the points they end at.
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
      movementY,
      getCarriedMemoIds(state, ids, [])
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

/**
 * Puts the memos in the group, or in none for '': a group the document does
 * not list, and nothing is sent, nor for a memo already where it goes.
 *
 * @example
 * store.dispatch(setMemoGroupAction$(['m1'], 'g1'));
 */
export const setMemoGroupAction$ = (
  memoIds: string[],
  groupId: string
): GeneratorAction =>
  function* ({ doc, collections }) {
    if (groupId && !doc.tableGroupIds.includes(groupId)) return;

    yield query(collections)
      .collection('memoEntities')
      .selectByIds(uniq(memoIds).filter(arrayHas(doc.memoIds)))
      .filter(memo => memo.groupId !== groupId)
      .map(({ id }) => changeMemoGroupAction({ id, value: groupId }));
  };

/** Where a drop lands, a group id, '' for none, and that group's box, null for none. */
type DropTarget = { groupId: string; box: Rect | null };

/** A table or a memo a drop judges, the group it lands in, '' for none, and that group's box, null for none. */
export type TableGroupDrop =
  | (DropTarget & { kind: 'table'; entity: Table })
  | (DropTarget & { kind: 'memo'; entity: Memo });

/**
 * The box each group showed as a drag began, by group id, held for the drag's
 * length: a member that grew past the stored rect stays in the box the reader
 * saw while its centre does, though only its own padding drew the box there.
 */
export type HeldTableGroupBoxes = ReadonlyMap<string, Rect>;

/**
 * Where a drop puts each selected table and shown memo no selected group carries: in the topmost
 * group whose box without them, and for a group the drag leaves standing the box it held too, holds
 * its centre, or in none. With groups hidden or nothing to judge, a drag of groups alone, it reads no box.
 */
export function getTableGroupDrops(
  state: RootState,
  held?: HeldTableGroupBoxes | null
): TableGroupDrop[] {
  if (!isTableGroupShown(state)) return [];

  const { doc, collections, editor } = state;
  const { tableIds, memoIds, tableGroupIds } = getSelectTypeIds(
    editor.selectedMap
  );
  const selectedTables = tableIds.filter(arrayHas(doc.tableIds));
  const selectedMemos = isMemoShown(state)
    ? memoIds.filter(arrayHas(doc.memoIds))
    : [];
  if (!selectedTables.length && !selectedMemos.length) return [];

  const carried = new Set(
    tableGroupIds.flatMap(id => [
      ...getTableGroupMemberIds(state, id),
      ...getTableGroupMemberMemoIds(state, id),
    ])
  );
  const judgedTables = selectedTables.filter(id => !carried.has(id));
  const judgedMemos = selectedMemos.filter(id => !carried.has(id));
  if (!judgedTables.length && !judgedMemos.length) return [];

  const moving = new Set(tableGroupIds);
  const boxes = getTableGroupRects(state, {
    excludeTableIds: judgedTables,
    excludeMemoIds: judgedMemos,
  });
  held?.forEach((rect, id) => {
    const box = boxes.get(id);
    if (box && !moving.has(id)) boxes.set(id, unionRect(box, rect));
  });

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(judgedTables);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(judgedMemos);
  const groups = findTableGroupsAt(
    state,
    [
      ...tables.map(table => getTableCenter(state, table)),
      ...memos.map(getMemoCenter),
    ],
    { boxes }
  );
  const targetAt = (index: number): DropTarget => {
    const groupId = groups[index]?.id ?? '';
    return { groupId, box: boxes.get(groupId) ?? null };
  };

  return [
    ...tables.map((table, index): TableGroupDrop => ({
      kind: 'table',
      entity: table,
      ...targetAt(index),
    })),
    ...memos.map((memo, index): TableGroupDrop => ({
      kind: 'memo',
      entity: memo,
      ...targetAt(tables.length + index),
    })),
  ];
}

/** The group a drop's table or memo reads as in before the drop, '' for none. */
const groupIdBefore = (state: RootState, drop: TableGroupDrop) =>
  drop.kind === 'table'
    ? getTableGroupId(state, drop.entity)
    : getMemoGroupId(state, drop.entity);

/**
 * Ends a drag of the selection: each table and memo getTableGroupDrops judges, given the boxes the
 * drag held, joins the group it landed in or leaves its own, tagged as the drag, so the history
 * closes the membership into the drag's undo entry; its undo reads prevValue.
 *
 * @example
 * store.dispatch(dropTablesIntoGroupsAction$(held));
 */
export const dropTablesIntoGroupsAction$ = (
  held?: HeldTableGroupBoxes | null
): GeneratorAction =>
  function* (state) {
    yield getTableGroupDrops(state, held)
      .filter(drop => drop.groupId !== groupIdBefore(state, drop))
      .map(drop => {
        const payload = {
          id: drop.entity.id,
          value: drop.groupId,
          prevValue: drop.entity.groupId,
        };
        return attachActionTag(
          Tag.drag,
          drop.kind === 'table'
            ? changeTableGroupAction(payload)
            : changeMemoGroupAction(payload)
        );
      });
  };

/**
 * Selects a group, alone unless $mod, and draws it over every other group and its tables and memos
 * over every other table and memo in their own order, as a press on a table raises it. Otherwise a
 * group drag would lift its members over the rest and drop them back under it.
 */
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
    yield raiseMembers(state, id);
  };

/**
 * The z-index changes that stack a group's tables and memos over every other table and memo, in
 * their own order, a table before a memo of one z-index, none once they stand there.
 */
function raiseMembers(state: RootState, groupId: string) {
  const {
    doc: { tableIds, memoIds },
    collections,
  } = state;
  const isMember = arrayHas([
    ...getTableGroupMemberIds(state, groupId),
    ...getTableGroupMemberMemoIds(state, groupId),
  ]);
  const entities = [
    ...query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds)
      .map(({ id, ui }) => ({ kind: 'table' as const, id, zIndex: ui.zIndex })),
    ...query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds)
      .map(({ id, ui }) => ({ kind: 'memo' as const, id, zIndex: ui.zIndex })),
  ];
  const members = entities
    .filter(({ id }) => isMember(id))
    .sort((a, b) => a.zIndex - b.zIndex);
  const others = entities.filter(({ id }) => !isMember(id));
  const base = Math.max(1, ...others.map(({ zIndex }) => zIndex)) + 1;

  if (members.every(({ zIndex }) => zIndex >= base)) return [];

  return members.map(({ kind, id }, index) =>
    kind === 'table'
      ? changeZIndexAction({ id, zIndex: base + index })
      : changeMemoZIndexAction({ id, zIndex: base + index })
  );
}

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
  setMemoGroupAction$,
  dropTablesIntoGroupsAction$,
  selectTableGroupAction$,
  selectTableGroupTablesAction$,
};
