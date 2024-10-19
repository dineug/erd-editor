import './webview.css';

import {
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
import {
  AnyAction,
  Appearance,
  Emitter,
  ThemeOptions,
  vscodeExportFileAction,
  vscodeImportFileAction,
  vscodeInitialAction,
  vscodeSaveReplicationAction,
  vscodeSaveThemeAction,
  webviewReplicationAction,
} from '@dineug/erd-editor-vscode-bridge';
import { ReplicationStoreWorker } from '@dineug/erd-editor-vscode-replication-store-worker';
import { encode } from 'base64-arraybuffer';

const bridge = new Emitter();
const workerBridge = new Emitter();
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
  dispatch(vscodeImportFileAction(options));
});
setExportFileCallback(async (blob, options) => {
  const arrayBuffer = await blob.arrayBuffer();
  dispatch(
    vscodeExportFileAction({
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
  dispatch(vscodeSaveThemeAction(e.detail));
  appearance = e.detail.appearance;
};

bridge.on({
  webviewImportFile: ({ payload: { type, op, value } }) => {
    switch (type) {
      case 'json':
        op === 'set' ? (editor.value = value) : editor.setDiffValue(value);
        break;
      case 'sql':
        op === 'set' && editor.setSchemaSQL(value);
        break;
    }
  },
  webviewInitialValue: action => {
    const {
      payload: { value },
    } = action;
    dispatchWorker(action);

    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    editor.setInitialValue(value);
    editor.enableThemeBuilder = true;
    sharedStore.subscribe(actions => {
      dispatchWorker(webviewReplicationAction({ actions }));
      dispatch(vscodeSaveReplicationAction({ actions }));
    });
    loading?.remove();
    document.body.appendChild(editor);
  },
  webviewReplication: action => {
    const {
      payload: { actions },
    } = action;
    sharedStore.dispatch(actions);
    dispatchWorker(action);
  },
  webviewUpdateTheme: ({ payload }) => {
    if (payload.appearance) {
      appearance = payload.appearance;
    }

    editor.setPresetTheme({
      ...payload,
      appearance:
        payload.appearance === 'auto' ? getSystemTheme() : payload.appearance,
    });
  },
  webviewUpdateReadonly: ({ payload }) => {
    editor.readonly = payload;
  },
});

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

workerBridge.on({
  vscodeSaveValue: action => {
    dispatch(action);
  },
});

globalThis.addEventListener('message', event => bridge.emit(event.data));
replicationStoreWorker.addEventListener('message', event => {
  workerBridge.emit(event.data);
});
dispatch(vscodeInitialAction());
