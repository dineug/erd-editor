import {
  AnyAction,
  Emitter,
  vscodeExportFileAction,
  vscodeImportFileAction,
  vscodeInitialAction,
  vscodeSaveValueAction,
} from '@dineug/erd-editor-vscode-bridge';
import { generateTemplatePanel } from '@vuerd/plugin-generate-template';
import { extension, setExportFileCallback, setImportFileCallback } from 'vuerd';

const bridge = new Emitter();
const vscode = window.acquireVsCodeApi();
const editor = document.createElement('vuerd-editor');
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const dispatch = (action: AnyAction) => {
  vscode.postMessage(action);
};

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
extension({
  panels: [generateTemplatePanel()],
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
        editor.loadSQLDDL(result);
        break;
    }
  },
  webviewInitialValue: ({ payload: { value } }) => {
    const result = textDecoder.decode(new Uint8Array(value));
    editor.addEventListener('change', handleChange);
    editor.automaticLayout = true;
    editor.initLoadJson(result);
    document.body.appendChild(editor);
  },
});

window.addEventListener('message', event => bridge.emit(event.data));
dispatch(vscodeInitialAction());
