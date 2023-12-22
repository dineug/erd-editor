import {
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
import { getShikiService } from '@dineug/erd-editor-shiki-worker';
import {
  AnyAction,
  Emitter,
  ThemeOptions,
  vscodeExportFileAction,
  vscodeImportFileAction,
  vscodeInitialAction,
  vscodeSaveThemeAction,
  vscodeSaveValueAction,
} from '@dineug/erd-editor-vscode-bridge';

const bridge = new Emitter();
const vscode = window.acquireVsCodeApi();
const editor = document.createElement('erd-editor');
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const dispatch = (action: AnyAction) => {
  vscode.postMessage(action);
};

setGetShikiServiceCallback(getShikiService);
setImportFileCallback(options => {
  dispatch(vscodeImportFileAction(options));
});
setExportFileCallback(async (blob, options) => {
  const arrayBuffer = await blob.arrayBuffer();
  dispatch(
    vscodeExportFileAction({
      value: Array.from(new Uint8Array(arrayBuffer)),
      fileName: options.fileName,
    })
  );
});

const getSystemTheme = () =>
  document.body.classList.contains('vscode-light') ? 'light' : 'dark';

const handleChange = () => {
  dispatch(
    vscodeSaveValueAction({
      value: Array.from(textEncoder.encode(editor.value)),
    })
  );
};

const handleChangePresetTheme = (event: Event) => {
  const e = event as CustomEvent<ThemeOptions>;
  dispatch(vscodeSaveThemeAction(e.detail));
};

bridge.on({
  webviewImportFile: ({ payload: { type, value } }) => {
    const result = textDecoder.decode(new Uint8Array(value));
    switch (type) {
      case 'json':
        editor.value = result;
        break;
      case 'sql':
        editor.setSchemaSQL(result);
        break;
    }
  },
  webviewInitialValue: ({ payload: { value } }) => {
    const result = textDecoder.decode(new Uint8Array(value));
    editor.addEventListener('change', handleChange);
    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    editor.setInitialValue(result);
    editor.enableThemeBuilder = true;
    document.body.appendChild(editor);
  },
  webviewUpdateTheme: ({ payload }) => {
    editor.setPresetTheme({
      ...payload,
      appearance:
        payload.appearance === 'auto' ? getSystemTheme() : payload.appearance,
    });
  },
  webviewReadonly: ({ payload }) => {
    editor.readonly = payload;
  },
});

window.addEventListener('message', event => bridge.emit(event.data));
dispatch(vscodeInitialAction());
