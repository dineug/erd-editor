/** @jsxHost konva */

import { isNumber } from 'es-toolkit';
import type { Stage } from 'konva/lib/Stage';

import { appDestroy, createAppContext } from '@/components/appContext';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { createI18n, type LocaleMessages } from '@/i18n/translate';
import { whenDrawn } from '@/konva/batchDraw';
import type { Rect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import { delay } from '@/utils/promise';

import {
  EXPORT_ZOOM_LEVEL,
  getExportRect,
  getExportScale,
  getStageSize,
} from './exportBox';
import ExportScene from './ExportScene';

export type DocumentSceneOptions = {
  doc: string;
  theme: Theme;
  toWidth: (text: string) => number;
  /**
   * The longest side the Stage may take, in pixels, which caps the scale below
   * the export's zoom for a preview or for an svg read off the nodes. The store
   * keeps that zoom all the same, so either holds the shapes the export does.
   */
  maxSide?: number;
  /**
   * The language and dictionary the scene's own words are drawn in, a table
   * with no name say. Left out, the scene draws them in English.
   */
  i18n?: LocaleMessages;
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
 * The whole document on a Stage of its own, off any screen, at the export's
 * zoom. The store is built here rather than borrowed, so the editor's zoom,
 * scroll and selection cannot reach the image, which holds the whole document.
 *
 * @example
 * const scene = await renderDocumentScene({ doc, theme, toWidth });
 */
export async function renderDocumentScene({
  doc,
  theme,
  toWidth,
  maxSide,
  i18n,
}: DocumentSceneOptions): Promise<DocumentScene> {
  const app = createAppContext({ toWidth }, { devtools: false });
  app.store.dispatchSync(initialLoadJsonAction$(doc));

  // Written over the zoom the document was saved with, because whether a
  // connector shows its referential action label reads this field.
  app.store.dispatchSync(changeZoomLevelAction({ value: EXPORT_ZOOM_LEVEL }));

  await delay(SETTLE_MS);

  // Read once the load hooks have run, which is what stamps the connector
  // routes: a sort in another editor retires them while this one draws, and
  // then getRouteBBox answers the anchors inflated by MAX_STUB, a box the union holds.
  const box = getExportRect(app.store.state);
  const fitted = getExportScale(box);
  const scale = isNumber(maxSide)
    ? Math.min(fitted, maxSide / Math.max(box.width, box.height))
    : fitted;
  const stageSize = getStageSize(box, scale);

  // Detached on purpose: konva needs a container, and one outside the document
  // is never laid out, never painted and never reachable from the editor. No
  // scene source provider is met either, so the scene draws the document.
  const rendered = renderScene({
    app,
    container: document.createElement('div'),
    scene: <ExportScene box={box} scale={scale} />,
    width: stageSize.width,
    height: stageSize.height,
    theme,
    i18n: i18n && createI18n(i18n.locale, i18n.messages),
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
