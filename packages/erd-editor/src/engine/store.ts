import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { createStore } from '@dineug/r-html';

import { RootActionMap } from '@/engine/actions';
import { Context } from '@/engine/context';
import { tableReducers } from '@/engine/modules/table/atom.actions';
import { tableColumnReducers } from '@/engine/modules/tableColumn/atom.actions';
import { RootState } from '@/engine/state';

export function runStore(context: Context) {
  return createStore<RootState, RootActionMap, Context>({
    context,
    state: {
      ...schemaV3Parser({}),
    },
    reducers: {
      ...tableReducers,
      ...tableColumnReducers,
    },
  });
}
