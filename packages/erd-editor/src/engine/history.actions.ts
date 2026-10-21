import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { cloneDeep, isString } from 'es-toolkit';

import { History, Replay } from '@/engine/history';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
  domainTypeIn,
  toDomainTypeActions,
  toDomainUnlinkActions,
} from '@/engine/modules/dictionary/domainTypes';
import {
  dictionaryPushUndoHistoryMap,
  reverseDictionaryListings,
} from '@/engine/modules/dictionary/history';
import { isListed } from '@/engine/modules/dictionary/membership';
import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { keepsDictionaries } from '@/engine/modules/editor/atom.actions';
import { editorPushUndoHistoryMap } from '@/engine/modules/editor/history';
import { indexPushUndoHistoryMap } from '@/engine/modules/index/history';
import { indexColumnPushUndoHistoryMap } from '@/engine/modules/index-column/history';
import {
  memoPushStreamHistoryMap,
  memoPushUndoHistoryMap,
} from '@/engine/modules/memo/history';
import { relationshipPushUndoHistoryMap } from '@/engine/modules/relationship/history';
import {
  settingsPushStreamHistoryMap,
  settingsPushUndoHistoryMap,
} from '@/engine/modules/settings/history';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import {
  tablePushStreamHistoryMap,
  tablePushUndoHistoryMap,
} from '@/engine/modules/table/history';
import {
  ActionType as ColumnActionType,
  ChangeColumnValuePayload,
} from '@/engine/modules/table-column/actions';
import { changeColumnDomainAction } from '@/engine/modules/table-column/atom.actions';
import { tableColumnPushUndoHistoryMap } from '@/engine/modules/table-column/history';
import {
  tableGroupPushStreamHistoryMap,
  tableGroupPushUndoHistoryMap,
} from '@/engine/modules/table-group/history';
import { RootState } from '@/engine/state';
import { Store } from '@/engine/store';
import { safeCallback } from '@/utils/safeCallback';

export type PushUndoHistory = (
  undoActions: AnyAction[],
  action: AnyAction,
  state: RootState
) => void;

export type PushStreamHistory = (
  undoActions: AnyAction[],
  redoActions: AnyAction[],
  actions: AnyAction[]
) => void;

export const pushUndoHistoryMap: Record<string, PushUndoHistory> = {
  ...tablePushUndoHistoryMap,
  ...tableColumnPushUndoHistoryMap,
  ...relationshipPushUndoHistoryMap,
  ...memoPushUndoHistoryMap,
  ...settingsPushUndoHistoryMap,
  ...editorPushUndoHistoryMap,
  ...indexPushUndoHistoryMap,
  ...indexColumnPushUndoHistoryMap,
  ...tableGroupPushUndoHistoryMap,
  ...dictionaryPushUndoHistoryMap,
};

export const pushStreamHistoryMap: Record<string, PushStreamHistory> = {
  ...tablePushStreamHistoryMap,
  ...memoPushStreamHistoryMap,
  ...settingsPushStreamHistoryMap,
  ...tableGroupPushStreamHistoryMap,
};

function push(store: Store, history: History, actions: AnyAction[]) {
  const undoActions: AnyAction[] = [];
  const redoActions: AnyAction[] = [];

  for (const action of actions) {
    const pushUndoHistory = pushUndoHistoryMap[action.type];
    if (!pushUndoHistory) continue;

    pushUndoHistory(undoActions, action, store.state);
    redoActions.push(cloneDeep(action));
  }

  reverseDictionaryListings(undoActions);

  for (const key of Object.keys(pushStreamHistoryMap)) {
    pushStreamHistoryMap[key](undoActions, redoActions, actions);
  }

  if (!undoActions.length || !redoActions.length) return;

  history.push({
    undo: replayDocument(store, undoActions),
    redo: replayDocument(store, redoActions),
  });
}

function cloneAction(version: number) {
  return (action: AnyAction) => ({
    ...cloneDeep(action),
    version,
  });
}

const isUnlink = ({ type, payload }: AnyAction) =>
  type === ColumnActionType.changeColumnDomain && payload.value === '';

/** The ids of the columns these actions unlink. */
const unlinkedIdsOf = (actions: ReadonlyArray<AnyAction>) =>
  new Set(actions.filter(isUnlink).map(({ payload }) => payload.id));

/** The type each column ends these actions with: its last write in them, else its own. */
function endTypeOf(state: RootState, actions: ReadonlyArray<AnyAction>) {
  const columns = query(state.collections).collection('tableColumnEntities');
  const written = new Map<string, string>();
  for (const { type, payload } of actions) {
    if (type === ColumnActionType.changeColumnDataType) {
      written.set(payload.id, payload.value);
    }
  }
  return (id: string) =>
    written.get(id) ?? columns.selectById(id)?.dataType ?? '';
}

/** The link of each live column of a live table linking a domain. */
function liveLinks({ doc, collections }: RootState) {
  const columns = query(collections).collection('tableColumnEntities');
  return query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .flatMap(({ id: tableId, columnIds }) =>
      columns
        .selectByIds(columnIds)
        .filter(({ domainId }) => domainId !== '')
        .map(({ id, domainId }) => ({ tableId, id, value: domainId }))
    );
}

/** Whether a column stands in a table the document lists, each table read once. */
function liveColumnIn({ doc, collections }: RootState) {
  const tables = query(collections).collection('tableEntities');
  const listed = new Set(doc.tableIds);
  const held = new Map<string, Set<string>>();
  return (tableId: string, id: string) => {
    if (!listed.has(tableId)) return false;
    const ids =
      held.get(tableId) ?? new Set(tables.selectById(tableId)?.columnIds);
    held.set(tableId, ids);
    return ids.has(id);
  };
}

/**
 * The live columns a document replay touched, each id to its table's id: those
 * it links, brings back or whose domain it types (every linked one after a kept
 * load), which follow their domain, and those it types, which step 3 judges.
 */
function touchedBy(state: RootState, actions: ReadonlyArray<AnyAction>) {
  const tables = query(state.collections).collection('tableEntities');
  const governed = new Map<string, string>();
  const typed = new Map<string, string>();
  const links = new Map<string, ChangeColumnValuePayload>();
  const domainIds = new Set(domainTypesOf(actions).keys());
  let loaded = false;

  for (const { type, payload } of actions) {
    if (type === ColumnActionType.changeColumnDomain) {
      links.set(payload.id, payload);
    } else if (type === ColumnActionType.changeColumnDataType) {
      typed.set(payload.id, payload.tableId);
    } else if (type === ColumnActionType.addColumn) {
      governed.set(payload.id, payload.tableId);
    } else if (type === TableActionType.addTable) {
      for (const id of tables.selectById(payload.id)?.columnIds ?? []) {
        governed.set(id, payload.id);
      }
    } else if (type === EditorActionType.loadJson) {
      loaded ||= keepsDictionaries(payload);
    }
  }
  for (const { tableId, id, value } of links.values()) {
    if (value !== '') governed.set(id, tableId);
  }
  if (loaded || domainIds.size) {
    for (const { tableId, id, value } of liveLinks(state)) {
      if (loaded || domainIds.has(value)) governed.set(id, tableId);
    }
  }
  const isLive = liveColumnIn(state);
  const live = (ids: Map<string, string>) =>
    new Map([...ids].filter(([id, tableId]) => isLive(tableId, id)));
  return { governed: live(governed), typed: live(typed) };
}

/**
 * What the state a document replay left calls for: a governed column off its
 * listed domain's type takes it, the sync spreading from it, then step 3 over
 * the typed ones and those of a removed domain, as a type typed now would be.
 */
function settle(
  state: RootState,
  { governed, typed }: ReturnType<typeof touchedBy>
) {
  const columns = query(state.collections).collection('tableColumnEntities');
  const domainTypeOf = domainTypeIn(state, new Map());
  const drifted: ChangeColumnValuePayload[] = [];
  const judged = new Map(typed);

  for (const [id, tableId] of governed) {
    const column = columns.selectById(id);
    if (!column?.domainId) continue;
    if (!isListed(state.doc.domainIds, column.domainId)) {
      judged.set(id, tableId);
    } else if (column.dataType !== domainTypeOf(column.domainId)) {
      drifted.push({ tableId, id, value: column.domainId });
    }
  }

  const retyped = drifted.length
    ? toDomainTypeActions(state, { links: drifted })
    : [];
  const typeOf = endTypeOf(state, retyped);
  const unlinked = unlinkedIdsOf(retyped);
  const unlinks = toDomainUnlinkActions(
    state,
    [...judged].map(([id, tableId]) => ({ tableId, id, value: typeOf(id) }))
  ).filter(({ payload }) => !unlinked.has(payload.id));
  return [...retyped, ...unlinks];
}

/**
 * Replays a document entry as recorded, then, from the state it left, settles
 * in a second dispatch of the same command the columns it leaves off their
 * domains, so a replay that leaves none sends one batch.
 */
const replayDocument =
  (store: Store, actions: AnyAction[]): Replay =>
  (dispatch, getNextVersion, getState = () => store.state) => {
    dispatch(actions.map(cloneAction(getNextVersion())));
    const state = getState();
    const settled = settle(state, touchedBy(state, actions));
    if (settled.length) dispatch(settled.map(cloneAction(getNextVersion())));
  };

export const pushHistory =
  (store: Store, history: History) => (actions: AnyAction[]) => {
    safeCallback(push, store, history, actions);
  };

/** Whether an action writes a dictionary row, the actions a sheet's history holds. */
export const isDictionaryAction = ({ type }: AnyAction) =>
  type.startsWith('dictionary.');

/** The data type each domain row of these actions writes, by the row's id. */
function domainTypesOf(actions: ReadonlyArray<AnyAction>) {
  const domainTypes = new Map<string, string>();
  for (const { payload } of actions.filter(isDictionaryAction)) {
    const dataType = payload?.values?.dataType;
    if (payload?.kind === DictionaryKind.domain && isString(dataType)) {
      domainTypes.set(payload.id, dataType);
    }
  }
  return domainTypes;
}

/** A link a sheet batch or replay took off a column, and the type it left the column at. */
type SheetUnlink = { link: ChangeColumnValuePayload; dataType: string };

/** The links a push, then each replay, took off columns, which the next replay restores. */
type SheetUnlinks = { links: ReadonlyArray<SheetUnlink> };

/**
 * Replays a sheet entry's rows with the column writes their domain types call
 * for at the replay: a column linked elsewhere or typed by hand since keeps it,
 * and one the last replay unlinked, still unlinked at that type, links again.
 */
const replayRows =
  (store: Store, rows: AnyAction[], unlinked: SheetUnlinks): Replay =>
  (dispatch, getNextVersion, getState = () => store.state) => {
    const state = getState();
    const held = query(state.collections).collection('tableColumnEntities');
    const restored = unlinked.links
      .filter(({ link, dataType }) => {
        const column = held.selectById(link.id);
        return column?.domainId === '' && column.dataType === dataType;
      })
      .map(({ link }) => link);
    const domainTypes = domainTypesOf(rows);
    const columns = toDomainTypeActions(state, {
      domainTypes,
      links: restored,
    });
    // A removed domain governs no type, so a link to one comes back only
    // where the column ends at its type, or a type off it would unlink it.
    const typeOf = endTypeOf(state, columns);
    const domainTypeOf = domainTypeIn(state, domainTypes);
    const relinks = restored
      .filter(
        ({ id, value }) =>
          !isListed(state.doc.domainIds, value) &&
          typeOf(id) === domainTypeOf(value)
      )
      .map(changeColumnDomainAction);
    // A removed domain's type the rows write unlinks each live column linking
    // it that ends off it (step 3), or listing the domain again would leave
    // that column off its domain's type.
    const unlinkedIds = unlinkedIdsOf(columns);
    const offRemoved = toDomainUnlinkActions(
      state,
      liveLinks(state)
        .filter(
          ({ id, value }) =>
            domainTypes.has(value) &&
            !isListed(state.doc.domainIds, value) &&
            !unlinkedIds.has(id)
        )
        .map(({ tableId, id }) => ({ tableId, id, value: typeOf(id) })),
      { domainTypes }
    );
    const sent = [...columns, ...relinks, ...offRemoved];
    unlinked.links = unlinksOf(state, sent);
    dispatch([...rows, ...sent].map(cloneAction(getNextVersion())));
  };

/** The links a batch takes off columns, at the domains they name before it. */
function unlinksOf(state: RootState, actions: ReadonlyArray<AnyAction>) {
  const columns = query(state.collections).collection('tableColumnEntities');
  const typeOf = endTypeOf(state, actions);
  return actions
    .filter(isUnlink)
    .flatMap(({ payload: { tableId, id } }): SheetUnlink[] => {
      const value = columns.selectById(id)?.domainId ?? '';
      if (value === '') return [];
      return [{ link: { tableId, id, value }, dataType: typeOf(id) }];
    });
}

function pushSheet(store: Store, history: History, actions: AnyAction[]) {
  const rows = actions.filter(isDictionaryAction);
  const undoActions: AnyAction[] = [];
  const redoActions: AnyAction[] = [];

  for (const action of rows) {
    const pushUndoHistory = pushUndoHistoryMap[action.type];
    if (!pushUndoHistory) continue;

    pushUndoHistory(undoActions, action, store.state);
    redoActions.push(cloneDeep(action));
  }

  reverseDictionaryListings(undoActions);
  if (!undoActions.length || !redoActions.length) return;

  const unlinked: SheetUnlinks = { links: unlinksOf(store.state, actions) };
  history.push({
    undo: replayRows(store, undoActions, unlinked),
    redo: replayRows(store, redoActions, unlinked),
  });
}

/**
 * Pushes a Dictionary tab batch onto its sheet's history: its row actions and
 * the links it took off columns, the column writes a domain's type spread to
 * worked out again at each replay, which keeps the links it takes off in turn.
 */
export const pushSheetHistory =
  (store: Store, history: History) => (actions: AnyAction[]) => {
    safeCallback(pushSheet, store, history, actions);
  };
