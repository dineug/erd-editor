import { extension } from 'vuerd';

import { generateTemplatePanel } from './index';

extension({
  panels: [generateTemplatePanel()],
});

function runEditor() {
  const editor = document.createElement('erd-editor');
  editor.automaticLayout = true;
  document.body.appendChild(editor);
}

runEditor();
