import {
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
import { getShikiService } from '@dineug/erd-editor-shiki-worker';
import {
  AnyAction,
  Emitter,
  vscodeExportFileAction,
  vscodeImportFileAction,
  vscodeInitialAction,
  vscodeSaveValueAction,
} from '@dineug/erd-editor-vscode-bridge';

const emitter = new Emitter();
const vscode = window.acquireVsCodeApi();
const editor = document.createElement('erd-editor');

function dispatch(action: AnyAction) {
  vscode.postMessage(action);
}

setGetShikiServiceCallback(getShikiService);
setImportFileCallback(options => {
  dispatch(vscodeImportFileAction(options));
});
setExportFileCallback((blob, options) => {
  const reader = new FileReader();

  reader.onloadend = () => {
    dispatch(
      vscodeExportFileAction({
        base64: reader.result as string,
        fileName: options.fileName,
      })
    );
  };
  reader.readAsDataURL(blob);
});

const handleChange = () => {
  dispatch(vscodeSaveValueAction({ value: editor.value }));
};

emitter.on({
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
    editor.setInitialValue(value);
    document.body.appendChild(editor);
  },
});

document.body.setAttribute(
  'style',
  `padding: 0; margin: 0; width: 100%; height:100vh;`
);

window.addEventListener('message', event => emitter.emit(event.data));

dispatch(vscodeInitialAction());
