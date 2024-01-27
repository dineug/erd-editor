import { getShikiService } from '@dineug/erd-editor-shiki-worker';
import { cssUnwrap, hmr } from '@dineug/r-html';
// @ts-ignore
import Stats from 'stats.js';

import { setGetShikiServiceCallback } from './index';

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
  editor.enableThemeBuilder = true;
  editor.setAttribute('style', 'display: block; height: 50%;');
  document.body.appendChild(editor);

  return editor;
}

setGetShikiServiceCallback(getShikiService);
// cssUnwrap();
hmr();
runStats();
runEditor();
