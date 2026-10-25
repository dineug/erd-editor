import '@/erd-viewer';

import { whenDrawn } from '@dineug/r-html-konva';

import { installStageTestHandle } from '@/konva/testHandle';

import { installSceneMirror, SCENE_MIRROR_FLAG } from '../support/sceneMirror';
import { createSchema, twoTables } from '../support/schema';

/**
 * The pages this fixture mounts, picked by ?mount=. One viewer fills the page,
 * two split it with a document each, a long page scrolls around one, and the
 * lang page is the single viewer under the html lang that ?lang= names.
 */
export const VIEWER_MODES = ['viewer', 'viewers', 'long', 'lang'] as const;

export type ViewerMode = (typeof VIEWER_MODES)[number];

const FILL = 'display: block; width: 100%; height: 100%;';

/** The second document of the pair, sharing no id with the first. */
const orders = () =>
  createSchema({
    tables: [
      {
        id: 'orders',
        name: 'orders',
        x: 160,
        y: 140,
        columns: [{ id: 'orders_id', name: 'id', dataType: 'int' }],
      },
    ],
  });

function isViewerMode(value: string): value is ViewerMode {
  return (VIEWER_MODES as readonly string[]).includes(value);
}

function createViewer(style: string): HTMLElement {
  const viewer = document.createElement('erd-viewer');
  viewer.setAttribute('style', style);
  return viewer;
}

/** A block of page text that pushes the long page past the viewport. */
function filler(height: number): HTMLElement {
  const block = document.createElement('div');
  block.className = 'filler';
  block.textContent = 'Page text around an embedded diagram.';
  block.setAttribute('style', `height: ${height}px; padding: 16px;`);
  return block;
}

/**
 * Lays the page out for a mode and mounts its viewers. A document is handed
 * over once its viewer is connected, as a host would, so the page asks nothing
 * of how an element treats a value set before it connects.
 */
function mount(mode: ViewerMode, app: HTMLElement): HTMLElement[] {
  switch (mode) {
    case 'viewers': {
      app.setAttribute('style', 'display: flex; width: 100vw; height: 100vh;');
      const half = 'display: block; flex: 1 1 0; min-width: 0; height: 100%;';
      const pair = [createViewer(half), createViewer(half)];
      app.append(...pair);
      Reflect.set(pair[0], 'value', JSON.stringify(twoTables()));
      Reflect.set(pair[1], 'value', JSON.stringify(orders()));
      return pair;
    }
    case 'long': {
      const viewer = createViewer(
        'display: block; width: 960px; height: 540px;'
      );
      document.body.style.overflow = 'auto';
      app.append(filler(240), viewer, filler(2400));
      return [viewer];
    }
    case 'viewer':
    case 'lang': {
      const viewer = createViewer(FILL);
      app.setAttribute('style', 'width: 100vw; height: 100vh;');
      app.append(viewer);
      return [viewer];
    }
  }
}

const params = new URLSearchParams(window.location.search);
const mode = params.get('mount') ?? 'viewer';
const app = document.getElementById('app');

if (!app) {
  throw new Error('e2e viewer fixture: #app container is missing');
}
if (!isViewerMode(mode)) {
  throw new Error(`e2e viewer fixture: unknown mount mode "${mode}"`);
}
if (mode === 'lang' && !params.get('lang')) {
  throw new Error('e2e viewer fixture: the lang mode needs ?lang=<code>');
}

// Installed before any viewer mounts, so the registry and the claim lists are
// there from page load and a spec polls for its own stage, never for them.
installStageTestHandle();

const viewers = mount(mode, app);

// The elements, for debugging a failing spec from the browser console.
Reflect.set(window, 'erdViewers', viewers);
Reflect.set(window, '__erdWhenDrawn', whenDrawn);

if (params.has(SCENE_MIRROR_FLAG)) {
  installSceneMirror();
}
