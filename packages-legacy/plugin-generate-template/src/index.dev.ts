import { extension } from 'vuerd';

import { generateTemplatePanel } from './index';

extension({
  panels: [generateTemplatePanel()],
});

function runEditor() {
  const editor = document.createElement('vuerd-editor');
  editor.automaticLayout = true;
  document.body.style.margin = '0';
  document.body.style.height = '100vh';
  document.body.appendChild(editor);
}

runEditor();
