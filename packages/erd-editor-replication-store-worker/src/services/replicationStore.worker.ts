import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import {
  AnyAction,
  Emitter,
  vscodeSaveValueAction,
} from '@dineug/erd-editor-vscode-bridge';

import { toWidth } from '@/utils/text';

const store = createReplicationStore({ toWidth });
const bridge = new Emitter();

const dispatch = (action: AnyAction) => {
  globalThis.postMessage(action);
};

store.on({
  change: () => {
    dispatch(
      vscodeSaveValueAction({
        value: store.value,
      })
    );
  },
});

bridge.on({
  webviewInitialValue: ({ payload: { value } }) => {
    store.setInitialValue(value);
  },
  webviewReplication: ({ payload: { actions } }) => {
    store.dispatch(actions);
  },
});

globalThis.addEventListener('message', event => bridge.emit(event.data));
