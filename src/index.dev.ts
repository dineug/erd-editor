import './index';
// @ts-ignore
import Stats from 'stats.js';

function runStats() {
  const stats = new Stats();
  stats.dom.style.top = '50px';
  stats.dom.style.left = '20px';
  document.body.style.margin = '0';
  document.body.style.height = '100vh';
  document.body.appendChild(stats.dom);

  const animate = () => {
    stats.begin();
    stats.end();
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function runEditor() {
  const editor = document.createElement('erd-editor');
  editor.automaticLayout = true;
  document.body.appendChild(editor);
}

runStats();
runEditor();
