import { getShikiService } from '@dineug/erd-editor-shiki-worker';

import { setGetShikiServiceCallback } from '@/index';
import { installStageTestHandle } from '@/konva/testHandle';

import { installSceneMirror, SCENE_MIRROR_FLAG } from '../support/sceneMirror';

/**
 * Deterministic mount for the e2e suite: no stats.js loop, no HMR, no theme
 * builder, and systemDarkMode pinned off so the runner's prefers-color-scheme
 * cannot change what is rendered.
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

// Tests reach the element through document.querySelector('erd-editor'); this
// handle exists so a failing spec can be debugged from the browser console.
Reflect.set(window, 'erdEditor', editor);

// Konva stages register themselves as they mount; installing the handle here
// makes window.__erdStages exist from page load, so a spec polls for a stage
// rather than for the global that holds it.
installStageTestHandle();

// The scene mirror is what a css locator over the canvas still resolves against
// now that the scene is Konva. The bench measures frames, so it loads the same
// page without the flag and pays nothing for the projection.
if (new URLSearchParams(window.location.search).has(SCENE_MIRROR_FLAG)) {
  installSceneMirror();
}
