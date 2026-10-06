import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Relationship, Table } from '@/internal-types';

import { CURRENT_KEY_ID, findColumnKey } from './candidateKeys';
import {
  getLiveRelationship,
  getLiveTable,
  isLiveColumn,
  isNormalMapping,
  MapColumnsDraft,
  MappingRow,
  repeatedIds,
  sameMembers,
  samePairs,
  sameSet,
} from './mapping';

/**
 * What keeps one row from being written: a place its stored lists cannot pair,
 * a parent or picked child column gone from its table, no pick yet, or a child
 * an earlier row already holds.
 */
export type MappingRowIssue =
  | 'invalid'
  | 'removedParent'
  | 'unpicked'
  | 'removedChild'
  | 'inUse';

/**
 * What keeps the mapping as a whole from being written: rows that cover no key
 * of the parent as it stands, every row on its own column, another relationship
 * linking the same columns, or a mapping the relationship already holds.
 */
export type MappingSetIssue = 'noKey' | 'selfOnly' | 'duplicate' | 'unchanged';

export type MappingIssues = {
  rows: Array<MappingRowIssue | null>;
  set: MappingSetIssue[];
};

type MappingState = Pick<RootState, 'doc' | 'collections' | 'settings'>;

type DraftEnds = {
  startTableId: string;
  endTableId: string;
  relationship?: Relationship;
};

/** The tables a draft maps between, read from the relationship it edits. */
export function getDraftEnds(
  { collections }: Pick<RootState, 'collections'>,
  draft: MapColumnsDraft
): DraftEnds | null {
  if (draft.mode === 'create') {
    return { startTableId: draft.startTableId, endTableId: draft.endTableId };
  }

  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(draft.relationshipId);
  if (!relationship) return null;

  return {
    startTableId: relationship.start.tableId,
    endTableId: relationship.end.tableId,
    relationship,
  };
}

/** The parent and child column ids of rows each naming both. */
const toColumnIds = (rows: MappingRow[]) => ({
  start: rows.map(({ parentColumnId }) => parentColumnId ?? ''),
  end: rows.map(({ pick }) => (pick?.kind === 'existing' ? pick.columnId : '')),
});

const isComplete = (rows: MappingRow[]) =>
  rows.every(
    ({ invalid, parentColumnId, pick }) =>
      !invalid && parentColumnId !== null && pick?.kind === 'existing'
  );

function validateRows(
  rows: MappingRow[],
  startTable: Table | undefined,
  endTable: Table | undefined
): Array<MappingRowIssue | null> {
  const repeatedParents = repeatedIds(
    rows.flatMap(({ parentColumnId }) =>
      parentColumnId === null ? [] : [parentColumnId]
    )
  );
  const claimed = new Set<string>();

  return rows.map(({ parentColumnId, pick, invalid }) => {
    if (invalid || parentColumnId === null) return 'invalid';
    if (repeatedParents.has(parentColumnId)) return 'invalid';
    if (!isLiveColumn(startTable, parentColumnId)) return 'removedParent';
    if (!pick) return 'unpicked';
    if (pick.kind === 'new') return null;
    if (!isLiveColumn(endTable, pick.columnId)) return 'removedChild';
    if (claimed.has(pick.columnId)) return 'inUse';

    claimed.add(pick.columnId);
    return null;
  });
}

function hasDuplicate(
  { doc, collections }: MappingState,
  { startTableId, endTableId }: DraftEnds,
  rows: MappingRow[],
  relationshipId?: string
): boolean {
  const { start, end } = toColumnIds(rows);

  return query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds)
    .some(
      relationship =>
        relationship.id !== relationshipId &&
        relationship.start.tableId === startTableId &&
        relationship.end.tableId === endTableId &&
        sameSet(relationship.start.columnIds, start) &&
        sameSet(relationship.end.columnIds, end)
    );
}

/**
 * The issues of each row and of the mapping as a whole, read against the state
 * as it stands, which the dialog shows and the write checks again on landing.
 * A row past the first issue it has reports that one.
 */
export function validateMapping(
  state: MappingState,
  draft: MapColumnsDraft
): MappingIssues {
  const ends = getDraftEnds(state, draft);
  const startTable = ends ? getLiveTable(state, ends.startTableId) : undefined;
  const endTable = ends ? getLiveTable(state, ends.endTableId) : undefined;
  const { rows } = draft;
  const set: MappingSetIssue[] = [];

  if (draft.keyId !== CURRENT_KEY_ID) {
    const key =
      startTable && draft.keyId !== null
        ? findColumnKey(state, startTable, draft.keyId)
        : undefined;
    const parentIds = rows.map(({ parentColumnId }) => parentColumnId);
    if (
      !key ||
      parentIds.includes(null) ||
      !sameMembers(parentIds as string[], key.columnIds)
    ) {
      set.push('noKey');
    }
  }

  if (ends && rows.length && isComplete(rows)) {
    if (
      ends.startTableId === ends.endTableId &&
      rows.every(
        ({ parentColumnId, pick }) =>
          pick?.kind === 'existing' && pick.columnId === parentColumnId
      )
    ) {
      set.push('selfOnly');
    }

    const editedId = draft.mode === 'edit' ? draft.relationshipId : undefined;
    if (hasDuplicate(state, ends, rows, editedId)) {
      set.push('duplicate');
    }
  }

  if (ends?.relationship && isComplete(rows)) {
    const { start, end } = ends.relationship;
    const live = { start: start.columnIds, end: end.columnIds };
    if (isNormalMapping(live) && samePairs(live, toColumnIds(rows))) {
      set.push('unchanged');
    }
  }

  return { rows: validateRows(rows, startTable, endTable), set };
}

/** Whether any issue but the set issues given stands in the way. */
export const hasMappingIssues = (
  { rows, set }: MappingIssues,
  ignore: MappingSetIssue[] = []
) => rows.some(Boolean) || set.some(issue => !ignore.includes(issue));

/** Whether the tables a draft maps between, and the relationship it edits, are all still there. */
export function hasMappingTargets(
  state: Pick<RootState, 'doc' | 'collections'>,
  draft: MapColumnsDraft
): boolean {
  if (
    draft.mode === 'edit' &&
    !getLiveRelationship(state, draft.relationshipId)
  ) {
    return false;
  }

  const ends = getDraftEnds(state, draft);
  return (
    !!ends &&
    !!getLiveTable(state, ends.startTableId) &&
    !!getLiveTable(state, ends.endTableId)
  );
}

/**
 * Whether the state already holds what the draft would write: every row on a
 * live column it already pairs, in the relationship it edits, or in one from
 * the same parent to the same child a peer or an agent made first.
 */
export function isSameResult(
  state: Pick<RootState, 'doc' | 'collections'>,
  draft: MapColumnsDraft
): boolean {
  const ends = getDraftEnds(state, draft);
  if (!ends) return false;

  const startTable = getLiveTable(state, ends.startTableId);
  const endTable = getLiveTable(state, ends.endTableId);
  const { rows } = draft;
  const mapping = toColumnIds(rows);
  if (
    !isComplete(rows) ||
    !isNormalMapping(mapping) ||
    !mapping.start.every(id => isLiveColumn(startTable, id)) ||
    !mapping.end.every(id => isLiveColumn(endTable, id))
  ) {
    return false;
  }

  const holds = ({ start, end }: Relationship) => {
    const live = { start: start.columnIds, end: end.columnIds };
    return isNormalMapping(live) && samePairs(live, mapping);
  };

  if (ends.relationship) return holds(ends.relationship);

  return query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds)
    .some(
      relationship =>
        relationship.start.tableId === ends.startTableId &&
        relationship.end.tableId === ends.endTableId &&
        holds(relationship)
    );
}
