/** @jsxHost konva */

import type { Stage } from 'konva/lib/Stage';

import { appDestroy, createAppContext } from '@/components/appContext';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
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
};

export type DocumentScene = {
  stage: Stage;
  /** What the Stage holds, in scene units, before it was scaled to fit. */
  box: Rect;
  /** The factor between that box and the Stage the scene was drawn on. */
  scale: number;
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
 * here rather than borrowed so the editor's scroll, zoom and selection cannot
 * reach the image, which is the whole difference between this and a screenshot.
 *
 * @example
 * const scene = await renderDocumentScene({ doc, theme, toWidth });
 */
export async function renderDocumentScene({
  doc,
  theme,
  toWidth,
}: DocumentSceneOptions): Promise<DocumentScene> {
  const app = createAppContext({ toWidth }, { devtools: false });
  app.store.dispatchSync(initialLoadJsonAction$(doc));
  await delay(SETTLE_MS);

  // Read once the load hooks have run, which is what stamps the connector
  // routes: a sort in another editor retires them while this one draws, and
  // then getRouteBBox answers the anchors inflated by MAX_STUB, a box the union holds.
  const box = getExportRect(app.store.state);
  const scale = getExportScale(box);

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
    destroy: () => {
      rendered.destroy();
      appDestroy(app);
    },
  };
}
