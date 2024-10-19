import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import {
  AnyAction,
  Bridge,
  hostSaveValueCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
} from '@dineug/erd-editor-vscode-bridge';

import { toWidth } from '@/utils/text';

const store = createReplicationStore({ toWidth });
const bridge = new Bridge();

const dispatch = (action: AnyAction) => {
  globalThis.postMessage(action);
};

store.on({
  change: () => {
    dispatch(
      Bridge.executeCommand(hostSaveValueCommand, {
        value: store.value,
      })
    );
  },
});

Bridge.mergeRegister(
  bridge.registerCommand(webviewInitialValueCommand, ({ value }) => {
    store.setInitialValue(value);
  }),
  bridge.registerCommand(webviewReplicationCommand, ({ actions }) => {
    store.dispatch(actions);
  })
);

globalThis.addEventListener('message', event => {
  bridge.executeAction(event.data);
});
