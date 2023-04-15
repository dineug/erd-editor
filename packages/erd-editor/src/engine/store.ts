import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { createStore as runStore, Store as StoreType } from '@dineug/r-html';

import { RootActionMap } from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { createEditor } from '@/engine/modules/editor/state';
import { tableReducers } from '@/engine/modules/table/atom.actions';
import { tableColumnReducers } from '@/engine/modules/tableColumn/atom.actions';
import { RootState } from '@/engine/state';

export type Store = StoreType<RootState, EngineContext>;

export function createStore(context: EngineContext): Store {
  return runStore<RootState, RootActionMap, EngineContext>({
    context,
    state: {
      ...schemaV3Parser({}),
      editor: createEditor(),
    },
    reducers: {
      ...tableReducers,
      ...tableColumnReducers,
    },
  });
}
