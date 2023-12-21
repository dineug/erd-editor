import {
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
import { getShikiService } from '@dineug/erd-editor-shiki-worker';

const vscode = acquireVsCodeApi();
setGetShikiServiceCallback(getShikiService);

document.body.setAttribute(
  'style',
  `padding: 0; margin: 0; width: 100%; height:100vh;`
);

const editor = document.createElement('erd-editor');

document.body.appendChild(editor);
