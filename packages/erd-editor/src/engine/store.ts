import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { createStore as runStore, Store as StoreType } from '@dineug/r-html';

import { RootActionMap } from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { editorReducers } from '@/engine/modules/editor/atom.actions';
import { createEditor } from '@/engine/modules/editor/state';
import { indexReducers } from '@/engine/modules/index/atom.actions';
import { indexColumnReducers } from '@/engine/modules/index-column/atom.actions';
import { memoReducers } from '@/engine/modules/memo/atom.actions';
import { relationshipReducers } from '@/engine/modules/relationship/atom.actions';
import { settingsReducers } from '@/engine/modules/settings/atom.actions';
import { tableReducers } from '@/engine/modules/table/atom.actions';
import { tableColumnReducers } from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';

export type Store = StoreType<RootState, EngineContext>;

export function createStore(
  context: EngineContext,
  enableObservable?: boolean
): Store {
  return runStore<RootState, RootActionMap, EngineContext>({
    context,
    state: {
      ...schemaV3Parser({}),
      editor: createEditor(),
      lww: {},
    },
    reducers: {
      ...editorReducers,
      ...tableReducers,
      ...tableColumnReducers,
      ...memoReducers,
      ...relationshipReducers,
      ...settingsReducers,
      ...indexReducers,
      ...indexColumnReducers,
    },
    enableObservable: enableObservable ?? true,
  });
}
