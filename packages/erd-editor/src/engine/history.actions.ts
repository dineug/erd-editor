import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { cloneDeep, isString } from 'es-toolkit';

import { Command, History } from '@/engine/history';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
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

/**
 * The link each column ends a replay with that the replay links, brings back
 * (a table's columns with the table) or finds live on a domain it types: its
 * last link in the batch, else the one it holds.
 */
function replayedLinks(
  state: RootState,
  actions: ReadonlyArray<AnyAction>,
  domainTypes: ReadonlyMap<string, string>
) {
  const { collections } = state;
  const tables = query(collections).collection('tableEntities');
  const columns = query(collections).collection('tableColumnEntities');
  const links = new Map<string, ChangeColumnValuePayload>();
  const bringBack = (tableId: string, id: string) => {
    if (links.has(id)) return;
    const value = columns.selectById(id)?.domainId ?? '';
    links.set(id, { tableId, id, value });
  };

  for (const { type, payload } of actions) {
    if (type === ColumnActionType.changeColumnDomain) {
      links.set(payload.id, payload);
    } else if (type === ColumnActionType.addColumn) {
      bringBack(payload.tableId, payload.id);
    } else if (type === TableActionType.addTable) {
      for (const id of tables.selectById(payload.id)?.columnIds ?? []) {
        bringBack(payload.id, id);
      }
    }
  }
  if (domainTypes.size) {
    for (const link of liveLinks(state)) {
      if (domainTypes.has(link.value)) bringBack(link.tableId, link.id);
    }
  }

  return [...links.values()].filter(({ value }) => value !== '');
}

const typedColumnIds = (actions: ReadonlyArray<AnyAction>) =>
  new Set(
    actions
      .filter(({ type }) => type === ColumnActionType.changeColumnDataType)
      .map(({ payload }) => payload.id as string)
  );

const columnWriteKey = ({ type, payload }: AnyAction) =>
  `${type}:${payload?.id}`;

/** The actions less each column write the sent ones make again, then the sent ones. */
function withWrites(
  actions: ReadonlyArray<AnyAction>,
  sent: ReadonlyArray<AnyAction>
) {
  const keys = new Set(sent.map(columnWriteKey));
  return [
    ...actions.filter(action => !keys.has(columnWriteKey(action))),
    ...sent,
  ];
}

/** The type each column ends a replay with: its last write in it, else its own. */
function endTypeOf(state: RootState, sent: ReadonlyArray<AnyAction>) {
  const columns = query(state.collections).collection('tableColumnEntities');
  const written = new Map<string, string>();
  for (const { type, payload } of sent) {
    if (type === ColumnActionType.changeColumnDataType) {
      written.set(payload.id, payload.value);
    }
  }
  return (id: string) =>
    written.get(id) ?? columns.selectById(id)?.dataType ?? '';
}

/** A domain's type at a replay: the one the replay writes it, else its own. */
const domainTypeIn =
  (state: RootState, domainTypes: ReadonlyMap<string, string>) =>
  (id: string) =>
    domainTypes.get(id) ?? state.collections.domainEntities[id]?.dataType ?? '';

/**
 * The unlinks that close a replay (step 3): each column of these links or one
 * it types that ends off the type of the domain it ends linking, listed or
 * removed, as a type typed now would leave it.
 */
function replayUnlinks(
  state: RootState,
  batch: ReadonlyArray<AnyAction>,
  links: ReadonlyArray<ChangeColumnValuePayload>,
  domainTypes: ReadonlyMap<string, string>
) {
  const typeOf = endTypeOf(state, batch);
  const judged = new Map(links.map(({ tableId, id }) => [id, tableId]));
  for (const { type, payload } of batch) {
    if (type === ColumnActionType.changeColumnDataType) {
      judged.set(payload.id, payload.tableId);
    }
  }
  return toDomainUnlinkActions(
    state,
    [...judged].map(([id, tableId]) => ({ tableId, id, value: typeOf(id) })),
    {
      domainTypes,
      links: batch
        .filter(({ type }) => type === ColumnActionType.changeColumnDomain)
        .map(({ payload }) => payload),
    }
  );
}

/**
 * A replay's batch, the actions as recorded but for each column of these links
 * they leave off the type its listed domain holds then, which takes that type
 * with the sync spreading from it; then the unlinks that close it (step 3).
 */
function toReplayBatch(
  state: RootState,
  actions: ReadonlyArray<AnyAction>,
  links: ReadonlyArray<ChangeColumnValuePayload>,
  domainTypes: ReadonlyMap<string, string>
) {
  const domainTypeOf = domainTypeIn(state, domainTypes);
  const recorded = endTypeOf(state, actions);
  const drifted = links.filter(
    ({ id, value }) =>
      isListed(state.doc.domainIds, value) &&
      recorded(id) !== domainTypeOf(value)
  );
  // Its unlinks read the links held before the replay, so they are dropped:
  // step 3 below reads the ones it ends with, the entry's own among them.
  const batch = drifted.length
    ? withWrites(
        actions,
        toDomainTypeActions(state, {
          domainTypes,
          links: drifted,
          replaced: typedColumnIds(actions),
        }).filter(
          ({ type, payload }) =>
            type !== ColumnActionType.changeColumnDomain || payload.value !== ''
        )
      )
    : actions;
  return withWrites(batch, replayUnlinks(state, batch, links, domainTypes));
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

const isKeptLoad = ({ type, payload }: AnyAction) =>
  type === EditorActionType.loadJson && keepsDictionaries(payload);

/**
 * Replays a document entry as recorded but for the columns it leaves off the
 * types of their domains (toReplayBatch), a kept load's columns among them.
 */
const replayDocument =
  (store: Store, actions: AnyAction[]): Command[keyof Command] =>
  (dispatch, getNextVersion, getState = () => store.state) => {
    const state = getState();
    const domainTypes = domainTypesOf(actions);
    const links = replayedLinks(state, actions, domainTypes);
    const batch = toReplayBatch(state, actions, links, domainTypes);
    dispatch(batch.map(cloneAction(getNextVersion())));

    // A load that keeps the dictionaries brings columns back at the types the
    // entry recorded under the domains as they stand now, read once it lands.
    if (!actions.some(isKeptLoad)) return;
    const loaded = getState();
    const settled = toReplayBatch(loaded, [], liveLinks(loaded), new Map());
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
  (
    store: Store,
    rows: AnyAction[],
    unlinked: SheetUnlinks
  ): Command[keyof Command] =>
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
    const sent = [...columns, ...relinks];
    unlinked.links = unlinksOf(state, sent);
    dispatch([...rows, ...sent].map(cloneAction(getNextVersion())));
  };

/** The links a batch takes off columns, at the domains they name before it. */
function unlinksOf(state: RootState, actions: ReadonlyArray<AnyAction>) {
  const columns = query(state.collections).collection('tableColumnEntities');
  const typeOf = endTypeOf(state, actions);
  return actions.flatMap(({ type, payload }): SheetUnlink[] => {
    if (type !== ColumnActionType.changeColumnDomain || payload.value !== '') {
      return [];
    }
    const { tableId, id } = payload;
    const value = columns.selectById(id)?.domainId ?? '';
    const link = { tableId, id, value };
    return value === '' ? [] : [{ link, dataType: typeOf(id) }];
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
