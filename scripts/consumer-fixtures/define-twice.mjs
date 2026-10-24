// Both entries, then each define function once more from the package root: the
// bundle holds one class per element, so the second calls do nothing.
import '@dineug/erd-editor/erd-editor.js';
import '@dineug/erd-editor/erd-viewer.js';

import {
  defineErdEditor,
  defineErdViewer,
  ErdEditorElement,
  ErdViewerElement,
} from '@dineug/erd-editor';

defineErdEditor();
defineErdViewer();

globalThis.__consumerProbe =
  customElements.get('erd-editor') === ErdEditorElement &&
  customElements.get('erd-viewer') === ErdViewerElement;
