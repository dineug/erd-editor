import './index';

function runEditor() {
  const editor = document.createElement('vuerd-editor');
  editor.automaticLayout = true;
  document.body.appendChild(editor);
}

runEditor();
