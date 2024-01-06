import {
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
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
import { encode } from 'base64-arraybuffer';

const LAZY_KEY = Symbol.for('@dineug/erd-editor');
const bridge = new Emitter();
const vscode = globalThis.acquireVsCodeApi();
const editor = document.createElement('erd-editor');

const dispatch = (action: AnyAction) => {
  vscode.postMessage(action);
};

Reflect.set(globalThis, LAZY_KEY, {
  setGetShikiServiceCallback,
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

const getSystemTheme = () =>
  document.body.classList.contains('vscode-light') ? 'light' : 'dark';

const handleChange = () => {
  dispatch(
    vscodeSaveValueAction({
      value: editor.value,
    })
  );
};

const handleChangePresetTheme = (event: Event) => {
  const e = event as CustomEvent<ThemeOptions>;
  dispatch(vscodeSaveThemeAction(e.detail));
};

bridge.on({
  webviewImportFile: ({ payload: { type, value } }) => {
    switch (type) {
      case 'json':
        editor.value = value;
        break;
      case 'sql':
        editor.setSchemaSQL(value);
        break;
    }
  },
  webviewInitialValue: ({ payload: { value } }) => {
    editor.addEventListener('change', handleChange);
    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    editor.setInitialValue(value);
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

globalThis.addEventListener('message', event => bridge.emit(event.data));
dispatch(vscodeInitialAction());
