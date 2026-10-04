import type { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { placeByFlow } from '@/components/erd/automatic-table-placement/flowPlacement';
import { scrollIntoView, showErdTab } from '@/components/erd/goToErdTarget';
import { coveredWidth } from '@/components/find-replace/panelLayout';
import { TABLE_SORT_START } from '@/constants/layout';
import type { GeneratorAction } from '@/engine/generator.actions';
import { ActionType } from '@/engine/modules/editor/actions';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import {
  type AppendLayout,
  loadJsonAction$,
  loadSchemaAction$,
  type SchemaAppend,
  type SchemaImportType,
  toSchemaAppend,
  toSchemaImportJson,
  unselectAllAction$,
  withImportSettings,
} from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { sortTableAction } from '@/engine/modules/table/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import type { ElkLayoutPoint } from '@/services/elk-layout';
import { arrayHas } from '@/utils/arrayHas';
import { closePromise } from '@/utils/promise';

/** Every action a load or a clear starts with, from this editor, a peer or an undo. */
const isLoad = arrayHas<string>([
  ActionType.clear,
  ActionType.loadJson,
  ActionType.initialClear,
  ActionType.initialLoadJson,
]);

/** A placed import waiting on its layout, and on those started before it. */
type Placement = {
  controller: AbortController;
  /** Resolves once it has landed or been dropped, so the next one may land. */
  done: Promise<void>;
};

/** The placed imports each store waits on, in the order they started. */
const placements = new WeakMap<RxStore, Set<Placement>>();

/** The stores a placed import is landing on, whose own load ends none after it. */
const landingStores = new WeakSet<RxStore>();

/**
 * Starts a placed import on a store. A replace ends every one started before
 * it, which it would wipe, and an append ends none. A load meanwhile, from this
 * editor, a peer or an undo, ends them all, and stop lets the next one land.
 */
function startPlacement(store: RxStore, replace: boolean) {
  const pending = placements.get(store) ?? new Set<Placement>();
  placements.set(store, pending);
  if (replace) pending.forEach(({ controller }) => controller.abort());

  const before = Promise.all(Array.from(pending, ({ done }) => done));
  const controller = new AbortController();
  const [done, finish] = closePromise();
  const placement: Placement = { controller, done };
  const unsubscribe = store.subscribe(actions => {
    if (landingStores.has(store)) return;
    actions.some(({ type }) => isLoad(type)) && controller.abort();
  });
  pending.add(placement);

  const stop = () => {
    unsubscribe();
    pending.delete(placement);
    finish();
  };

  return { signal: controller.signal, before, stop };
}

/**
 * Flow's points for an import's document, null for the grid, handed to land
 * once every placed import started before it has landed or been dropped, so
 * they land in the order they started; once superseded, nothing lands.
 */
async function placeAndLand(
  app: AppContext,
  json: string,
  replace: boolean,
  land: (points: ElkLayoutPoint[] | null) => void
): Promise<void> {
  const { store } = app;
  const { signal, before, stop } = startPlacement(store, replace);

  try {
    const points = await placeByFlow(app, json, signal);
    await before;
    if (signal.aborted) return;

    landingStores.add(store);
    try {
      land(points);
    } finally {
      landingStores.delete(store);
    }
  } finally {
    stop();
  }
}

/**
 * Replaces the document with an import whose tables stand in the grid, in
 * one dispatch, as the element's setters always did.
 *
 * @example
 * importSchema(app, 'sql', value);
 */
export function importSchema(
  { store }: AppContext,
  type: SchemaImportType,
  value: string
): void {
  store.dispatchSync(loadSchemaAction$(type, value));
}

/**
 * The import's document as it lands: the settings as they stand by then, and
 * every table at its point, the block the points make standing where the grid
 * would have started. A layout answers every table of this document.
 */
function toLandingJson(
  json: string,
  settings: RootState['settings'],
  points: ElkLayoutPoint[] | null
): string {
  const schema: Pick<ERDEditorSchemaV3, 'settings' | 'collections'> =
    JSON.parse(json);
  const tables = schema.collections.tableEntities;

  withImportSettings(schema, settings);
  points?.forEach(({ id, x, y }) => {
    tables[id].ui.x = TABLE_SORT_START + x;
    tables[id].ui.y = TABLE_SORT_START + y;
  });

  return JSON.stringify(schema);
}

/**
 * Replaces the document with an import Flow placed first, in one dispatch:
 * one undo puts the previous document back and no grid shows in between. A
 * load or another placed replace meanwhile supersedes it and nothing lands.
 *
 * @example
 * await importSchemaPlaced(app, 'sql', value);
 */
export async function importSchemaPlaced(
  app: AppContext,
  type: SchemaImportType,
  value: string
): Promise<void> {
  const { store } = app;
  // The readonly filter would drop the load, so nothing is parsed or laid out.
  if (store.getReadonly()) return;

  const json = toSchemaImportJson(type, value, store.state, app);

  await placeAndLand(app, json, true, points => {
    // A placement that could not be had leaves the grid, which a failure, a
    // host with no worker and Cancel all land without a word.
    const landing = toLandingJson(json, store.state.settings, points);
    if (points) {
      store.dispatchSync(loadJsonAction$(landing));
    } else {
      store.dispatchSync(loadJsonAction$(landing), sortTableAction());
    }
  });
}

/**
 * An append as the editor lands it: the new tables and memos alone selected,
 * and brought on screen clear of an open Find and Replace panel, in the
 * dispatch that adds them, so one undo takes them away and the scroll back.
 */
const appendLandingAction$ = ({
  actions,
  tableIds,
  memoIds,
  rect,
}: SchemaAppend): GeneratorAction =>
  function* (state) {
    yield unselectAllAction$();
    yield actions;
    yield selectAction(
      Object.fromEntries([
        ...tableIds.map(id => [id, SelectType.table]),
        ...memoIds.map(id => [id, SelectType.memo]),
      ])
    );
    yield* scrollIntoView(state, rect, coveredWidth(state));
  };

/**
 * Lands an append under the diagram as it stands now, on the ERD tab, which
 * comes up first from any other in a dispatch of its own: a Flow view drops
 * every edit of the document, and a batch is classified by the state before it.
 */
function landAppend(app: AppContext, json: string, layout: AppendLayout): void {
  const { store } = app;
  // Readonly drops the adds alone, so the selection and scroll would still land.
  if (store.getReadonly()) return;

  const append = toSchemaAppend(store.state, json, layout, app);
  if (!append) return;

  showErdTab(store);
  store.dispatchSync(appendLandingAction$(append));
}

/**
 * Adds an import to the document below the diagram, its tables in the grid,
 * in one dispatch, leaving every table and setting already there as it is.
 *
 * @example
 * appendSchema(app, 'sql', value);
 */
export function appendSchema(
  app: AppContext,
  type: SchemaImportType,
  value: string
): void {
  landAppend(
    app,
    toSchemaImportJson(type, value, app.store.state, app),
    'grid'
  );
}

/**
 * Adds an .erd.json document to this one below the diagram, its tables and
 * memos standing apart as the file has them, its settings left out.
 *
 * @example
 * appendSchemaJSON(app, value);
 */
export function appendSchemaJSON(app: AppContext, value: string): void {
  landAppend(app, value, 'file');
}

/**
 * Adds an import Flow placed first below the diagram, in one dispatch, after
 * every placed import started before it. The diagram is read as it lands, so a
 * table moved meanwhile is cleared; a load or a later placed replace drops it.
 *
 * @example
 * await appendSchemaPlaced(app, 'sql', value);
 */
export async function appendSchemaPlaced(
  app: AppContext,
  type: SchemaImportType,
  value: string
): Promise<void> {
  const { store } = app;
  if (store.getReadonly()) return;

  const json = toSchemaImportJson(type, value, store.state, app);
  await placeAndLand(app, json, false, points =>
    landAppend(app, json, points ?? 'grid')
  );
}
