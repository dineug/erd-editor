import { query } from '@dineug/erd-editor-schema';

import { toForeignKeyNames } from '@/engine/modules/relationship/fkColumns';
import { RootState } from '@/engine/state';
import { Relationship, Table } from '@/internal-types';
import { getColumnKeys } from '@/utils/tableKeys';

import {
  CandidateKey,
  CURRENT_KEY_ID,
  getCandidateKeys,
  toCurrentKey,
} from './candidateKeys';
import {
  ColumnMapping,
  ColumnPick,
  getLiveRelationship,
  getLiveTable,
  isLiveColumn,
  isNormalMapping,
  MapColumnsDraft,
  MappingRow,
  repeatedIds,
  sameMembers,
  sameSet,
} from './mapping';
import { prefillPicks } from './prefill';
import { hasMappingIssues, MappingIssues, validateMapping } from './validate';

/** The child column picked for each parent column, null where the reader emptied it. */
export type MapColumnsPicks = Readonly<Record<string, ColumnPick | null>>;

/** A Map Columns dialog opened while drawing a relationship between two tables. */
export type CreateMapColumnsSession = {
  mode: 'create';
  startTableId: string;
  endTableId: string;
  relationshipType: number;
  keyId: string | null;
  picks: MapColumnsPicks;
};

/** The mapping and the keys a relationship had when the dialog opened on it. */
export type MapColumnsBase = {
  startColumnIds: string[];
  endColumnIds: string[];
  keyId: string;
  keys: Readonly<Record<string, string[]>>;
};

/**
 * A Map Columns dialog opened on a relationship. Until the reader changes a row
 * or the key it follows the relationship as it stands; after, it keeps the key
 * and the rows they changed, the others still following it.
 */
export type EditMapColumnsSession = {
  mode: 'edit';
  relationshipId: string;
  base: MapColumnsBase;
  touched: boolean;
  keyId: string;
  picks: MapColumnsPicks;
};

export type MapColumnsSession = CreateMapColumnsSession | EditMapColumnsSession;

/**
 * A row as the dialog shows it: whether its parent or picked child column has
 * left its table, and the name a new foreign key column takes for it beside
 * the other rows picking one.
 */
export type MappingRowView = MappingRow & {
  removedParent: boolean;
  removedChild: boolean;
  newColumnName: string;
};

/** The line under a stored mapping no key covers, or one only a key can mend. */
export type MapColumnsNotice =
  | 'notAKey'
  | 'noKey'
  | 'fixMapping'
  | 'addKeyToFix';

/** Why the dialog closes on its own: a table it maps between, or the relationship, is gone. */
export type MapColumnsClosed =
  | { reason: 'tableRemoved'; tableId: string }
  | { reason: 'relationshipRemoved' };

export type MapColumnsView = {
  closed: null;
  parentTable: Table;
  childTable: Table;
  relationshipType: number;
  keys: CandidateKey[];
  keyId: string | null;
  showReferences: boolean;
  rows: MappingRowView[];
  notice: MapColumnsNotice | null;
  changedRemotely: boolean;
  draft: MapColumnsDraft;
  issues: MappingIssues;
  canConfirm: boolean;
};

export type MapColumnsClosedView = { closed: MapColumnsClosed };

type MapState = Pick<RootState, 'doc' | 'collections' | 'settings'>;

type RowsAndKey = { keyId: string | null; rows: MappingRow[] };

const existing = (columnId: string): ColumnPick => ({
  kind: 'existing',
  columnId,
});

const toMapping = ({ start, end }: Relationship): ColumnMapping => ({
  start: start.columnIds,
  end: end.columnIds,
});

/**
 * The places of a stored mapping in their order, each place past the end of
 * one list or holding an id its list repeats marked invalid.
 */
function toPlaceRows({ start, end }: ColumnMapping): MappingRow[] {
  const repeatedStart = repeatedIds(start);
  const repeatedEnd = repeatedIds(end);

  return Array.from(
    { length: Math.max(start.length, end.length) },
    (_, index) => {
      const parentColumnId = start[index] ?? null;
      const childId = end[index];
      const invalid =
        parentColumnId === null ||
        childId === undefined ||
        repeatedStart.has(parentColumnId) ||
        repeatedEnd.has(childId);
      const pick = childId === undefined ? null : existing(childId);

      return invalid
        ? { parentColumnId, pick, invalid }
        : { parentColumnId, pick };
    }
  );
}

/** The child a stored mapping pairs with a parent column it names once. */
function toStoredPick(
  { start, end }: ColumnMapping,
  parentColumnId: string
): ColumnPick | null {
  const index = start.indexOf(parentColumnId);
  if (index === -1 || start.lastIndexOf(parentColumnId) !== index) return null;

  const childId = end[index];
  return childId === undefined ? null : existing(childId);
}

/**
 * How a dialog opens on a stored mapping: on the key whose columns it pairs
 * once each, in key order, or else on the stored places, kept as they are, the
 * References choice of those columns joining the keys.
 */
function openOnMapping(
  mapping: ColumnMapping,
  keys: CandidateKey[]
): RowsAndKey & { keys: CandidateKey[] } {
  const key = isNormalMapping(mapping)
    ? keys.find(({ columnIds }) => sameMembers(columnIds, mapping.start))
    : undefined;
  if (!key) {
    return {
      keyId: CURRENT_KEY_ID,
      rows: toPlaceRows(mapping),
      keys: [...keys, toCurrentKey(mapping.start)],
    };
  }

  return {
    keyId: key.id,
    rows: key.columnIds.map(parentColumnId => ({
      parentColumnId,
      pick: toStoredPick(mapping, parentColumnId),
    })),
    keys,
  };
}

/**
 * Empties a row picking a child an earlier row holds, the rows the reader set
 * claiming first, so no two rows ever write one child column.
 */
function releaseRepeatedPicks(
  rows: MappingRow[],
  isSet: (row: MappingRow) => boolean
): MappingRow[] {
  const claimed = new Set<string>();
  const claim = (row: MappingRow) => {
    if (row.invalid || row.pick?.kind !== 'existing') return;
    if (claimed.has(row.pick.columnId)) {
      row.pick = null;
    } else {
      claimed.add(row.pick.columnId);
    }
  };
  const copies = rows.map(row => ({ ...row }));

  copies.filter(isSet).forEach(claim);
  copies.filter(row => !isSet(row)).forEach(claim);
  return copies;
}

function createRows(
  session: CreateMapColumnsSession,
  keys: CandidateKey[],
  childTable: Table
): RowsAndKey {
  const key = keys.find(({ id }) => id === session.keyId) ?? keys[0];
  if (!key) return { keyId: null, rows: [] };

  const rows = key.columnIds.map(parentColumnId => {
    const pick = session.picks[parentColumnId] ?? null;
    return {
      parentColumnId,
      pick:
        pick?.kind === 'existing' && !isLiveColumn(childTable, pick.columnId)
          ? null
          : pick,
    };
  });

  return { keyId: key.id, rows: releaseRepeatedPicks(rows, () => true) };
}

function editRows(
  session: EditMapColumnsSession,
  relationship: Relationship,
  opened: RowsAndKey & { keys: CandidateKey[] }
): RowsAndKey {
  if (!session.touched) return opened;

  const { picks } = session;
  const isPicked = (parentColumnId: string | null) =>
    parentColumnId !== null && Object.hasOwn(picks, parentColumnId);
  const key =
    opened.keys.find(({ id }) => id === session.keyId) ??
    (opened.keys.find(({ id }) => id === opened.keyId) as CandidateKey);
  const mapping = toMapping(relationship);
  const rows =
    key.id === CURRENT_KEY_ID
      ? toPlaceRows(mapping).map(row =>
          !row.invalid && isPicked(row.parentColumnId)
            ? { ...row, pick: picks[row.parentColumnId as string] }
            : row
        )
      : key.columnIds.map(parentColumnId => ({
          parentColumnId,
          pick: isPicked(parentColumnId)
            ? picks[parentColumnId]
            : toStoredPick(mapping, parentColumnId),
        }));

  return {
    keyId: key.id,
    rows: releaseRepeatedPicks(rows, row => isPicked(row.parentColumnId)),
  };
}

/** Whether a key the dialog opened on has since lost or gained a column, or gone. */
function keyChanged(
  state: MapState,
  base: MapColumnsBase,
  parentTable: Table,
  keyId: string
): boolean {
  const opened = base.keys[keyId];
  if (keyId === CURRENT_KEY_ID || !opened) return false;

  const key = getColumnKeys(state, parentTable).find(({ id }) => id === keyId);
  return !key || !sameSet(key.columnIds, opened);
}

function isChangedRemotely(
  state: MapState,
  session: EditMapColumnsSession,
  relationship: Relationship,
  parentTable: Table
): boolean {
  const { base } = session;
  const sameList = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);

  return (
    !sameList(relationship.start.columnIds, base.startColumnIds) ||
    !sameList(relationship.end.columnIds, base.endColumnIds) ||
    keyChanged(state, base, parentTable, base.keyId) ||
    (session.touched && keyChanged(state, base, parentTable, session.keyId))
  );
}

/** The name a new foreign key column takes for each row, with the rows picking one. */
function toNewColumnNames(
  { collections }: MapState,
  rows: MappingRow[],
  parentTable: Table,
  childTable: Table
): string[] {
  const columns = query(collections).collection('tableColumnEntities');
  const childNames = columns
    .selectByIds(childTable.columnIds)
    .map(({ name }) => name);
  const parentName = (row: MappingRow) =>
    row.parentColumnId === null
      ? undefined
      : columns.selectById(row.parentColumnId)?.name;

  return rows.map((row, rowIndex) => {
    if (row.invalid || parentName(row) === undefined) return '';

    const named = rows.filter(
      (other, index) =>
        index === rowIndex ||
        (!other.invalid &&
          other.pick?.kind === 'new' &&
          parentName(other) !== undefined)
    );
    const names = toForeignKeyNames(
      parentTable.name,
      named.map(other => parentName(other) as string),
      childNames
    );
    return names[named.indexOf(row)];
  });
}

/**
 * The line under stored columns no key covers: how to mend a place no pick can,
 * that the parent has no key, or, only while no row is broken, that the
 * columns are no key, a removed child saying so in its own row.
 */
function toNotice(
  keyId: string | null,
  rows: MappingRowView[],
  keys: CandidateKey[]
): MapColumnsNotice | null {
  if (keyId !== CURRENT_KEY_ID) return null;

  const hasKey = keys.some(({ kind }) => kind !== 'current');
  if (rows.some(({ invalid, removedParent }) => invalid || removedParent)) {
    return hasKey ? 'fixMapping' : 'addKeyToFix';
  }
  if (!hasKey) return 'noKey';
  return rows.some(({ removedChild }) => removedChild) ? null : 'notAKey';
}

function toView(
  state: MapState,
  {
    parentTable,
    childTable,
    relationshipType,
    keys,
    keyId,
    rows,
    changedRemotely,
    toDraft,
  }: {
    parentTable: Table;
    childTable: Table;
    relationshipType: number;
    keys: CandidateKey[];
    keyId: string | null;
    rows: MappingRow[];
    changedRemotely: boolean;
    toDraft: (rows: MappingRow[]) => MapColumnsDraft;
  }
): MapColumnsView {
  const newColumnNames = toNewColumnNames(state, rows, parentTable, childTable);
  const views: MappingRowView[] = rows.map((row, index) => ({
    ...row,
    removedParent:
      row.parentColumnId !== null &&
      !isLiveColumn(parentTable, row.parentColumnId),
    removedChild:
      row.pick?.kind === 'existing' &&
      !isLiveColumn(childTable, row.pick.columnId),
    newColumnName: newColumnNames[index],
  }));
  const draft = toDraft(
    rows.map(({ parentColumnId, pick, invalid }) =>
      invalid ? { parentColumnId, pick, invalid } : { parentColumnId, pick }
    )
  );
  const issues = validateMapping(state, draft);

  return {
    closed: null,
    parentTable,
    childTable,
    relationshipType,
    keys,
    keyId,
    showReferences: keys.length > 1,
    rows: views,
    notice: toNotice(keyId, views, keys),
    changedRemotely,
    draft,
    issues,
    canConfirm: !hasMappingIssues(issues),
  };
}

function buildCreate(
  state: MapState,
  session: CreateMapColumnsSession
): MapColumnsView | MapColumnsClosedView {
  for (const tableId of [session.startTableId, session.endTableId]) {
    if (!getLiveTable(state, tableId)) {
      return { closed: { reason: 'tableRemoved', tableId } };
    }
  }

  const parentTable = getLiveTable(state, session.startTableId) as Table;
  const childTable = getLiveTable(state, session.endTableId) as Table;
  const keys = getCandidateKeys(state, parentTable);
  const { keyId, rows } = createRows(session, keys, childTable);
  const { startTableId, endTableId, relationshipType } = session;

  return toView(state, {
    parentTable,
    childTable,
    relationshipType,
    keys,
    keyId,
    rows,
    changedRemotely: false,
    toDraft: draftRows => ({
      mode: 'create',
      startTableId,
      endTableId,
      relationshipType,
      keyId,
      rows: draftRows,
    }),
  });
}

function buildEdit(
  state: MapState,
  session: EditMapColumnsSession
): MapColumnsView | MapColumnsClosedView {
  const { relationshipId } = session;
  const entity = query(state.collections)
    .collection('relationshipEntities')
    .selectById(relationshipId);

  if (entity) {
    for (const { tableId } of [entity.start, entity.end]) {
      if (!getLiveTable(state, tableId)) {
        return { closed: { reason: 'tableRemoved', tableId } };
      }
    }
  }

  const relationship = getLiveRelationship(state, relationshipId);
  if (!relationship) {
    return { closed: { reason: 'relationshipRemoved' } };
  }

  const parentTable = getLiveTable(state, relationship.start.tableId) as Table;
  const childTable = getLiveTable(state, relationship.end.tableId) as Table;
  const opened = openOnMapping(
    toMapping(relationship),
    getCandidateKeys(state, parentTable)
  );
  const { keyId, rows } = editRows(session, relationship, opened);

  return toView(state, {
    parentTable,
    childTable,
    relationshipType: relationship.relationshipType,
    keys: opened.keys,
    keyId,
    rows,
    changedRemotely: isChangedRemotely(
      state,
      session,
      relationship,
      parentTable
    ),
    toDraft: draftRows => ({
      mode: 'edit',
      relationshipId,
      keyId: keyId as string,
      rows: draftRows,
    }),
  });
}

/**
 * What the dialog shows for its session over the state as it stands, built
 * again on every render, or why it closes: a table it maps between, or the
 * relationship it edits, has left the document.
 */
export function buildMapColumns(
  state: MapState,
  session: MapColumnsSession
): MapColumnsView | MapColumnsClosedView {
  return session.mode === 'create'
    ? buildCreate(state, session)
    : buildEdit(state, session);
}

/**
 * A dialog opened to map the start table's key onto the end table's columns:
 * on the primary key, or the first unique column without one, each row a
 * column of the end table only one name match points at, or empty.
 */
export function openCreateSession(
  state: MapState,
  {
    startTableId,
    endTableId,
    relationshipType,
  }: Pick<
    CreateMapColumnsSession,
    'startTableId' | 'endTableId' | 'relationshipType'
  >
): CreateMapColumnsSession {
  const session: CreateMapColumnsSession = {
    mode: 'create',
    startTableId,
    endTableId,
    relationshipType,
    keyId: null,
    picks: {},
  };
  const view = buildMapColumns(state, session);
  if (view.closed !== null || view.keyId === null) return session;

  return changeMapColumnsKey(state, session, view.keyId);
}

/** A dialog opened on the relationship, remembering its mapping and the parent's keys. */
export function openEditSession(
  state: MapState,
  relationshipId: string
): EditMapColumnsSession {
  const relationship = query(state.collections)
    .collection('relationshipEntities')
    .selectById(relationshipId);
  const parentTable =
    relationship && getLiveTable(state, relationship.start.tableId);
  const mapping = relationship
    ? toMapping(relationship)
    : { start: [], end: [] };
  const keys = parentTable ? getCandidateKeys(state, parentTable) : [];
  const { keyId } = openOnMapping(mapping, keys);

  return {
    mode: 'edit',
    relationshipId,
    base: {
      startColumnIds: [...mapping.start],
      endColumnIds: [...mapping.end],
      keyId: keyId as string,
      keys: Object.fromEntries(
        (parentTable ? getColumnKeys(state, parentTable) : []).map(
          ({ id, columnIds }) => [id, [...columnIds]]
        )
      ),
    },
    touched: false,
    keyId: keyId as string,
    picks: {},
  };
}

/**
 * The session once the reader picks another key in References: a row for each
 * of its columns keeps the child it had where that child is live, and an empty
 * row takes the one column a name match points at, if any.
 */
export const changeMapColumnsKey = <S extends MapColumnsSession>(
  state: MapState,
  session: S,
  keyId: string
): S => changeKey(state, session, keyId) as S;

function changeKey(
  state: MapState,
  session: MapColumnsSession,
  keyId: string
): MapColumnsSession {
  const view = buildMapColumns(state, session);
  if (view.closed !== null) return session;

  const key = view.keys.find(({ id }) => id === keyId);
  if (!key) return session;

  const keeps = (pick: ColumnPick | null) =>
    pick?.kind !== 'existing' || isLiveColumn(view.childTable, pick.columnId);
  const prefill = (
    rows: Array<{ parentColumnId: string; pick: ColumnPick | null }>
  ) =>
    prefillPicks(state, {
      parentTable: view.parentTable,
      childTable: view.childTable,
      keyKind: key.kind,
      rows,
    });

  if (session.mode === 'create') {
    const picks: Record<string, ColumnPick> = {};
    for (const parentColumnId of key.columnIds) {
      const pick = session.picks[parentColumnId] ?? null;
      if (pick && keeps(pick)) picks[parentColumnId] = pick;
    }
    const rows = key.columnIds.map(parentColumnId => ({
      parentColumnId,
      pick: picks[parentColumnId] ?? null,
    }));

    return { ...session, keyId: key.id, picks: { ...picks, ...prefill(rows) } };
  }

  const relationship = getLiveRelationship(
    state,
    session.relationshipId
  ) as Relationship;
  const mapping = toMapping(relationship);
  const picks: Record<string, ColumnPick | null> = {};

  const isCurrent = key.id === CURRENT_KEY_ID;

  for (const parentColumnId of key.columnIds) {
    if (session.touched && Object.hasOwn(session.picks, parentColumnId)) {
      picks[parentColumnId] = session.picks[parentColumnId];
    } else if (!isCurrent && !keeps(toStoredPick(mapping, parentColumnId))) {
      picks[parentColumnId] = null;
    }
  }

  if (isCurrent) {
    return { ...session, touched: true, keyId: key.id, picks };
  }

  const rows = key.columnIds.map(parentColumnId => ({
    parentColumnId,
    pick: Object.hasOwn(picks, parentColumnId)
      ? picks[parentColumnId]
      : toStoredPick(mapping, parentColumnId),
  }));

  return {
    ...session,
    touched: true,
    keyId: key.id,
    picks: { ...picks, ...prefill(rows) },
  };
}

/**
 * The session once the reader picks a child column for a row, or empties it,
 * on the key the dialog shows, which an edit keeps from then on.
 */
export const pickMapColumn = <S extends MapColumnsSession>(
  state: MapState,
  session: S,
  parentColumnId: string,
  pick: ColumnPick | null
): S => pickColumn(state, session, parentColumnId, pick) as S;

function pickColumn(
  state: MapState,
  session: MapColumnsSession,
  parentColumnId: string,
  pick: ColumnPick | null
): MapColumnsSession {
  const view = buildMapColumns(state, session);
  const picks = { ...session.picks, [parentColumnId]: pick };
  if (view.closed !== null) return { ...session, picks };

  return session.mode === 'create'
    ? { ...session, keyId: view.keyId, picks }
    : { ...session, touched: true, keyId: view.keyId as string, picks };
}
