import './webview.css';

import {
  setExportFileCallback,
  setGetShikiServiceCallback,
} from '@dineug/erd-editor';
import {
  AnyAction,
  Bridge,
  hostExportFileCommand,
  hostInitialCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveValueCommand,
  ThemeOptions,
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
  webviewUpdateReadonlyCommand,
  webviewUpdateThemeCommand,
} from '@dineug/erd-editor-vscode-bridge';
import { encode } from 'base64-arraybuffer';

const bridge = new Bridge();
const workerBridge = new Bridge();
const editor = document.createElement('erd-editor');
const sharedStore = editor.getSharedStore({ mouseTracker: false });
const replicationStoreWorker = new Worker(
  new URL('./services/replicationStore.worker.ts', import.meta.url),
  {
    type: 'module',
    name: '@dineug/erd-editor-intellij-webview/replication-store-worker',
  }
);

const dispatch = (action: AnyAction) => {
  window.cefQuery({
    request: JSON.stringify(action),
    persistent: false,
    onSuccess: () => {},
    onFailure: () => {},
  });
};

const dispatchWorker = (action: AnyAction) => {
  replicationStoreWorker.postMessage(action);
};

import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});
setExportFileCallback(async (blob, options) => {
  const arrayBuffer = await blob.arrayBuffer();
  dispatch(
    Bridge.executeCommand(hostExportFileCommand, {
      value: encode(arrayBuffer),
      fileName: options.fileName,
    })
  );
});

const handleChangePresetTheme = (event: Event) => {
  const e = event as CustomEvent<ThemeOptions>;
  dispatch(Bridge.executeCommand(hostSaveThemeCommand, e.detail));
};

Bridge.mergeRegister(
  bridge.registerCommand(webviewImportFileCommand, ({ type, op, value }) => {
    switch (type) {
      case 'json':
        op === 'set' ? (editor.value = value) : editor.setDiffValue(value);
        break;
      case 'sql':
        op === 'set' && editor.setSchemaSQL(value);
        break;
    }
  }),
  bridge.registerCommand(webviewInitialValueCommand, ({ value }) => {
    dispatchWorker(
      Bridge.executeCommand(webviewInitialValueCommand, { value })
    );

    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    editor.setInitialValue(value);
    editor.enableThemeBuilder = true;
    sharedStore.subscribe(actions => {
      dispatchWorker(
        Bridge.executeCommand(webviewReplicationCommand, { actions })
      );
      dispatch(Bridge.executeCommand(hostSaveReplicationCommand, { actions }));
    });
    document.body.appendChild(editor);
  }),
  bridge.registerCommand(webviewReplicationCommand, ({ actions }) => {
    sharedStore.dispatch(actions);
    dispatchWorker(
      Bridge.executeCommand(webviewReplicationCommand, { actions })
    );
  }),
  bridge.registerCommand(webviewUpdateThemeCommand, payload => {
    editor.setPresetTheme({
      ...payload,
      appearance: payload.appearance === 'auto' ? 'dark' : payload.appearance,
    });
  }),
  bridge.registerCommand(webviewUpdateReadonlyCommand, readonly => {
    editor.readonly = readonly;
  }),
  workerBridge.registerCommand(hostSaveValueCommand, ({ value }) => {
    dispatch(Bridge.executeCommand(hostSaveValueCommand, { value }));
  })
);

globalThis.addEventListener('message', event => {
  bridge.executeAction(event.data);
});
replicationStoreWorker.addEventListener('message', event => {
  workerBridge.executeAction(event.data);
});
dispatch(Bridge.executeCommand(hostInitialCommand, undefined));
