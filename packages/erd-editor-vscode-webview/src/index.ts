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

const handleChange = () => {
  dispatch(
    vscodeSaveValueAction({
      value: Array.from(textEncoder.encode(editor.value)),
    })
  );
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
    editor.setInitialValue(result);
    document.body.appendChild(editor);
  },
});

document.body.setAttribute(
  'style',
  `padding: 0; margin: 0; width: 100%; height:100vh;`
);

window.addEventListener('message', event => bridge.emit(event.data));

dispatch(vscodeInitialAction());
