import type { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { placeByFlow } from '@/components/erd/automatic-table-placement/flowPlacement';
import { TABLE_SORT_START } from '@/constants/layout';
import { ActionType } from '@/engine/modules/editor/actions';
import {
  loadJsonAction$,
  loadSchemaAMLAction$,
  loadSchemaDBMLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaSQLAction$,
  type SchemaImportType,
  toSchemaImportJson,
  withImportSettings,
} from '@/engine/modules/editor/generator.actions';
import { sortTableAction } from '@/engine/modules/table/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import type { ElkLayoutPoint } from '@/services/elk-layout';
import { arrayHas } from '@/utils/arrayHas';

const LOAD_SCHEMA = {
  sql: loadSchemaSQLAction$,
  graphql: loadSchemaGraphQLAction$,
  dbml: loadSchemaDBMLAction$,
  aml: loadSchemaAMLAction$,
} as const;

/** Every action a load or a clear starts with, from this editor, a peer or an undo. */
const isLoad = arrayHas<string>([
  ActionType.clear,
  ActionType.loadJson,
  ActionType.initialClear,
  ActionType.initialLoadJson,
]);

/** The placement each store waits on, which the next one to start ends. */
const placements = new WeakMap<RxStore, AbortController>();

/**
 * Starts the one placement a store waits on, ending the one before it: the
 * newest import is the one that lands. A load meanwhile, from this editor, a
 * peer or an undo, ends it too, and stop ends the listening.
 */
function startPlacement(store: RxStore) {
  placements.get(store)?.abort();

  const controller = new AbortController();
  const unsubscribe = store.subscribe(actions => {
    actions.some(({ type }) => isLoad(type)) && controller.abort();
  });
  placements.set(store, controller);

  const stop = () => {
    unsubscribe();
    placements.get(store) === controller && placements.delete(store);
  };

  return { signal: controller.signal, stop };
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
  store.dispatchSync(LOAD_SCHEMA[type](value));
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
 * load or another placed import meanwhile supersedes it and nothing lands.
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
  const json = toSchemaImportJson(type, value, store.state, app);
  const { signal, stop } = startPlacement(store);

  let points: ElkLayoutPoint[] | null;
  try {
    points = await placeByFlow(app, json, signal);
  } finally {
    stop();
  }
  if (signal.aborted) return;

  // A placement that could not be had leaves the grid, which a failure, a
  // host with no worker and Cancel all land without a word.
  const landing = toLandingJson(json, store.state.settings, points);
  if (points) {
    store.dispatchSync(loadJsonAction$(landing));
  } else {
    store.dispatchSync(loadJsonAction$(landing), sortTableAction());
  }
}
