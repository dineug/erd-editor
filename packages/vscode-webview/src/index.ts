import './webview.css';
import 'core-js/stable';

import {
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
import {
  AnyAction,
  Appearance,
  Bridge,
  hostExportFileCommand,
  hostImportFileCommand,
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
import { ReplicationStoreWorker } from '@dineug/erd-editor-vscode-replication-store-worker';
import { encode } from 'base64-arraybuffer';

const bridge = new Bridge();
const workerBridge = new Bridge();
const vscode = acquireVsCodeApi();
const editor = document.createElement('erd-editor');
const sharedStore = editor.getSharedStore({ mouseTracker: false });
const replicationStoreWorker = new ReplicationStoreWorker({
  name: '@dineug/erd-editor-vscode-webview/replication-store-worker',
});
const loading = document.querySelector('#loading');

let appearance: Appearance | 'auto' = 'dark';

const dispatch = (action: AnyAction) => {
  vscode.postMessage(action);
};

const dispatchWorker = (action: AnyAction) => {
  replicationStoreWorker.postMessage(action);
};

import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});
setImportFileCallback(options => {
  dispatch(Bridge.executeCommand(hostImportFileCommand, options));
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

function getSystemTheme(): Appearance {
  const themeKind = document.body.dataset.vscodeThemeKind;

  return themeKind
    ? themeKind === 'vscode-light'
      ? Appearance.light
      : Appearance.dark
    : document.body.classList.contains('vscode-light')
      ? Appearance.light
      : Appearance.dark;
}

const handleChangePresetTheme = (event: Event) => {
  const e = event as CustomEvent<ThemeOptions>;
  dispatch(Bridge.executeCommand(hostSaveThemeCommand, e.detail));
  appearance = e.detail.appearance;
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
    loading?.remove();
    document.body.appendChild(editor);
  }),
  bridge.registerCommand(webviewReplicationCommand, ({ actions }) => {
    sharedStore.dispatch(actions);
    dispatchWorker(
      Bridge.executeCommand(webviewReplicationCommand, { actions })
    );
  }),
  bridge.registerCommand(webviewUpdateThemeCommand, payload => {
    if (payload.appearance) {
      appearance = payload.appearance;
    }

    editor.setPresetTheme({
      ...payload,
      appearance:
        payload.appearance === 'auto' ? getSystemTheme() : payload.appearance,
    });
  }),
  bridge.registerCommand(webviewUpdateReadonlyCommand, readonly => {
    editor.readonly = readonly;
  }),
  workerBridge.registerCommand(hostSaveValueCommand, ({ value }) => {
    dispatch(Bridge.executeCommand(hostSaveValueCommand, { value }));
  })
);

const observer = new MutationObserver(() => {
  if (appearance === 'auto') {
    editor.setPresetTheme({
      appearance: getSystemTheme(),
    });
  }
});
observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'data-vscode-theme-kind'],
});

globalThis.addEventListener('message', event => {
  bridge.executeAction(event.data);
});
replicationStoreWorker.addEventListener('message', event => {
  workerBridge.executeAction(event.data);
});
dispatch(Bridge.executeCommand(hostInitialCommand, undefined));
