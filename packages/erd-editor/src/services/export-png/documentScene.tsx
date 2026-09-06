/** @jsxHost konva */

import { isNumber } from 'es-toolkit';
import type { Stage } from 'konva/lib/Stage';

import { appDestroy, createAppContext } from '@/components/appContext';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import type { Rect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import { delay } from '@/utils/promise';

import { getExportRect, getExportScale } from './exportBox';
import ExportScene from './ExportScene';

export type DocumentSceneOptions = {
  doc: string;
  theme: Theme;
  toWidth: (text: string) => number;
  /**
   * The zoom to draw at, for a caller whose editor is at one the document does
   * not carry. Left out, the document's own zoom is what the image is drawn at.
   */
  zoomLevel?: number;
};

export type DocumentScene = {
  stage: Stage;
  /** What the Stage holds, in scene units, before it was scaled to fit. */
  box: Rect;
  /** The factor between that box and the Stage the scene was drawn on. */
  scale: number;
  /** The zoom that was asked for, which scale is that cut to what a canvas holds. */
  zoomLevel: number;
  destroy: () => void;
};

/**
 * Long enough for the load hooks to run. Table widths and connector routes are
 * recomputed off a throttleTime(5) on the load action, so a render before that
 * window closes would draw the document as it was written rather than as it is.
 */
const SETTLE_MS = 32;

/**
 * The whole document on a Stage of its own, off any screen. The store is built
 * here rather than borrowed, so the editor's scroll and selection cannot reach
 * the image and it holds the whole document however it was being looked at.
 *
 * @example
 * const scene = await renderDocumentScene({ doc, theme, toWidth });
 */
export async function renderDocumentScene({
  doc,
  theme,
  toWidth,
  zoomLevel,
}: DocumentSceneOptions): Promise<DocumentScene> {
  const app = createAppContext({ toWidth }, { devtools: false });
  app.store.dispatchSync(initialLoadJsonAction$(doc));

  // Written into the store rather than carried beside it, because the layer's
  // scale and the spelling a table is drawn in are read from the same field,
  // and a document saved with the zoom left out arrives at 1 whatever the editor shows.
  if (isNumber(zoomLevel)) {
    app.store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
  }

  await delay(SETTLE_MS);

  // Read once the load hooks have run, which is what stamps the connector
  // routes: a sort in another editor retires them while this one draws, and
  // then getRouteBBox answers the anchors inflated by MAX_STUB, a box the union holds.
  const zoom = app.store.state.settings.zoomLevel;
  const box = getExportRect(app.store.state);
  const scale = getExportScale(box, zoom);

  // Detached on purpose: konva needs a container, and one outside the document
  // is never laid out, never painted and never reachable from the editor.
  const rendered = renderScene({
    app,
    container: document.createElement('div'),
    scene: <ExportScene box={box} scale={scale} />,
    width: box.width * scale,
    height: box.height * scale,
    theme,
  });

  await whenDrawn();

  return {
    stage: rendered.stage,
    box,
    scale,
    zoomLevel: zoom,
    destroy: () => {
      rendered.destroy();
      appDestroy(app);
    },
  };
}
