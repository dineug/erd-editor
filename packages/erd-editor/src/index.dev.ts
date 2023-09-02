import { cssUnwrap, hmr } from '@dineug/r-html';
// @ts-ignore
import Stats from 'stats.js';

function runStats() {
  const stats = new Stats();
  stats.dom.style.top = '';
  stats.dom.style.left = '';
  stats.dom.style.bottom = '20px';
  stats.dom.style.right = '20px';
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
  document.body.appendChild(editor);
}

cssUnwrap();
hmr();
runStats();
runEditor();

await import('./index');
