import './index';

function runEditor() {
  const editor = document.createElement('erd-editor');
  editor.automaticLayout = true;
  document.body.appendChild(editor);
}

runEditor();
