import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { createStore } from '@dineug/r-html';

import { RootActionTypes } from '@/engine/actions';
import { RootState } from '@/engine/state';

export function runStore() {
  return createStore<RootState, RootActionTypes, {}>({
    context: {},
    state: {
      ...schemaV3Parser({}),
    },
    reducers: {},
  });
}
