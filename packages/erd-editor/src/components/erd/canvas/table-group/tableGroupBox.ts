import { observable } from '@dineug/r-html';

import {
  getHeldTableGroupBoxes,
  isEntityDragActive,
} from '@/components/erd/canvas/entityDrag';
import {
  createDoubleClickGuard,
  type DoubleClickGuard,
} from '@/components/erd/canvas/table/doubleClick';
import { RootState } from '@/engine/state';
import type { Memo, Table, TableGroup } from '@/internal-types';
import { type Rect, unionRect } from '@/konva/scene/metrics';
import { trackTableWidths } from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import {
  getTableGroupMemberMemos,
  getTableGroupMembers,
  getTableGroupRect,
} from '@/utils/tableGroup';

/** A group's member tables and member memos, hidden memos too, each in document order. */
export type TableGroupMemberLists = {
  tables: ReadonlyArray<Table>;
  memos: ReadonlyArray<Memo>;
};

/**
 * The members of a group with none, one pair of lists every such group shares, left unfrozen: r-html
 * tracks no read of a frozen value, so a group handed its first member would never draw it in its box.
 */
export const NO_TABLE_GROUP_MEMBERS: TableGroupMemberLists = {
  tables: [],
  memos: [],
};

/**
 * The box a group is drawn in, on the canvas and the minimap: getTableGroupRect's, and while a drag
 * holds the scene and leaves the group standing, the box it held as the drag began with the members
 * left standing, so it neither shrinks under a member lifted out nor stretches after one carried off.
 *
 * @example
 * const box = getDrawnTableGroupRect(state, group, source, members);
 */
export function getDrawnTableGroupRect(
  state: RootState,
  group: TableGroup,
  source: GeometrySource,
  members: TableGroupMemberLists
): Rect {
  // A member widened by a column edit or a remeasure changes no field the size
  // cache keys on, so the box asks to be drawn again on every such change.
  trackTableWidths();
  const { selectedMap } = state.editor;
  // A group dragged itself moves with its members and keeps them all.
  const standing = isEntityDragActive(state, source) && !selectedMap[group.id];
  const dragged = standing ? Object.keys(selectedMap) : [];
  const box = getTableGroupRect(state, group, {
    members: members.tables,
    memberMemos: members.memos,
    excludeTableIds: dragged,
    excludeMemoIds: dragged,
  });
  const held = standing
    ? getHeldTableGroupBoxes(state, source)?.get(group.id)
    : undefined;

  return held ? unionRect(held, box) : box;
}

/** The two nodes a group draws apart, each telling the other whether the pointer is over it. */
export type TableGroupHoverPart = 'frame' | 'body';

/**
 * What a group's body and its frame share, drawn apart in TableGroups' two passes: the box a sash
 * drag draws until its one resize, the guard telling a double click on the bar from a pair begun on
 * the body, and whether the pointer is over either, which shows the remove button.
 */
export type TableGroupLinks = {
  draftOf(groupId: string): Rect | null;
  setDraft(groupId: string, rect: Rect | null): void;
  guardOf(groupId: string): DoubleClickGuard;
  isHovered(groupId: string): boolean;
  setHover(groupId: string, part: TableGroupHoverPart, hovered: boolean): void;
};

export function createTableGroupLinks(): TableGroupLinks {
  const drafts = observable({} as Record<string, Rect>);
  const guards = new Map<string, DoubleClickGuard>();
  const hovers = observable({} as Record<string, true>);

  return {
    isHovered: groupId =>
      Boolean(hovers[`${groupId}:frame`] || hovers[`${groupId}:body`]),
    setHover: (groupId, part, hovered) => {
      const key = `${groupId}:${part}`;
      if (hovered) {
        hovers[key] = true;
      } else {
        Reflect.deleteProperty(hovers, key);
      }
    },
    draftOf: groupId => drafts[groupId] ?? null,
    setDraft: (groupId, rect) => {
      if (rect) {
        drafts[groupId] = rect;
      } else {
        Reflect.deleteProperty(drafts, groupId);
      }
    },
    guardOf: groupId => {
      const guard = guards.get(groupId) ?? createDoubleClickGuard();
      guards.set(groupId, guard);
      return guard;
    },
  };
}

const isSameList = <T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>) =>
  a.length === b.length && a.every((member, index) => member === b[index]);

/**
 * Reads each group's members off one walk over the tables and one over the memos, handing a group
 * the lists it had last time while no member came or went, so a scene render that moved no
 * membership leaves every group component's props as they were.
 *
 * @example
 * const membersOf = memberLists(state);
 * membersOf(group.id);
 */
export function createTableGroupMemberLists(): (
  state: RootState
) => (groupId: string) => TableGroupMemberLists {
  let last = new Map<string, TableGroupMemberLists>();

  return (state: RootState) => {
    const next = new Map<string, TableGroupMemberLists>();
    const tablesOf = getTableGroupMembers(state);
    const memosOf = getTableGroupMemberMemos(state);

    new Set([...tablesOf.keys(), ...memosOf.keys()]).forEach(groupId => {
      const tables = tablesOf.get(groupId) ?? NO_TABLE_GROUP_MEMBERS.tables;
      const memos = memosOf.get(groupId) ?? NO_TABLE_GROUP_MEMBERS.memos;
      const before = last.get(groupId);
      next.set(
        groupId,
        before &&
          isSameList(before.tables, tables) &&
          isSameList(before.memos, memos)
          ? before
          : { tables, memos }
      );
    });
    last = next;

    return (groupId: string) => next.get(groupId) ?? NO_TABLE_GROUP_MEMBERS;
  };
}
