import { getShikiService } from '@dineug/erd-editor-shiki-worker';

import { setGetShikiServiceCallback } from '@/index';

/**
 * Deterministic mount for the e2e suite.
 *
 * Differences from `src/index.dev.ts` are all in service of repeatability:
 * no stats.js rAF loop, no HMR, no theme builder, and `systemDarkMode` pinned
 * off so the runner's `prefers-color-scheme` cannot change what is rendered.
 */
setGetShikiServiceCallback(getShikiService);

const editor = document.createElement('erd-editor');
editor.systemDarkMode = false;
editor.enableThemeBuilder = false;
editor.setAttribute('style', 'display: block; width: 100%; height: 100%;');

const app = document.getElementById('app');
if (!app) {
  throw new Error('e2e fixture: #app container is missing');
}
app.appendChild(editor);

// Tests reach the element through `document.querySelector('erd-editor')`; this
// handle exists so a failing spec can be debugged from the browser console.
Reflect.set(window, 'erdEditor', editor);
