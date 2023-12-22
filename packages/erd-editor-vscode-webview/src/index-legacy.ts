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

const getTheme = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(
    `--vscode-${name.replace('.', '-')}`
  );

const createDefaultTheme = () => ({
  canvas: '#282828',
  table: '#191919',
  tableActive: '#14496d',
  focus: '#00a9ff',
  keyPK: '#B4B400',
  keyFK: '#dda8b1',
  keyPFK: '#60b9c4',
  font: '#a2a2a2',
  fontActive: 'white',
  fontPlaceholder: '#6D6D6D',
  contextmenu: '#191919',
  contextmenuActive: '#383d41',
  edit: '#ffc107',
  columnSelect: '#232a2f',
  columnActive: '#372908',
  minimapShadow: 'black',
  scrollbarThumb: '#6D6D6D',
  scrollbarThumbActive: '#a2a2a2',
  menubar: 'black',
  visualization: '#191919',
  diffAdd: '#74c56a2a',
  diffModify: '#ebd4703d',
  diffRemove: '#dda8b12a',
});

const createVscodeTheme = () => ({
  canvas: getTheme('editor.background'),
  table: getTheme('sideBar.background'),
  tableActive: getTheme('editorCursor.foreground'),
  focus: getTheme('editorCursor.foreground'),
  // keyPK: getTheme("editor.background"),
  // keyFK: getTheme("editor.background"),
  // keyPFK: getTheme("editor.background"),
  font: getTheme('input.foreground'),
  fontActive: getTheme('inputOption.activeForeground'),
  fontPlaceholder: getTheme('input.placeholderForeground'),
  contextmenu: getTheme('menu.background'),
  contextmenuActive: getTheme('menu.selectionBackground'),
  // edit: getTheme("editorCursor.foreground"),
  columnSelect: getTheme('list.activeSelectionBackground'),
  columnActive: getTheme('list.hoverBackground'),
  minimapShadow: getTheme('widget.shadow'),
  scrollbarThumb: getTheme('scrollbarSlider.background'),
  scrollbarThumbActive: getTheme('scrollbarSlider.hoverBackground'),
  menubar: getTheme('activityBar.background'),
  visualization: getTheme('editor.background'),
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
  webviewUpdateThemeLegacy: ({ payload: { themeSync, theme } }) => {
    editor.setTheme(
      Object.assign(
        createDefaultTheme(),
        theme,
        themeSync ? createVscodeTheme() : {}
      )
    );
  },
  webviewReadonly: ({ payload }) => {
    editor.readonly = payload;
  },
});

window.addEventListener('message', event => bridge.emit(event.data));
dispatch(vscodeInitialAction());
