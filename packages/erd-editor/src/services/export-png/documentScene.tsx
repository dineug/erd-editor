/** @jsxHost konva */

import type { Stage } from 'konva/lib/Stage';

import { appDestroy, createAppContext } from '@/components/appContext';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';

import ExportScene from './ExportScene';

export type DocumentSceneOptions = {
  doc: string;
  theme: Theme;
  toWidth: (text: string) => number;
};

export type DocumentScene = {
  stage: Stage;
  width: number;
  height: number;
  destroy: () => void;
};

/**
 * Long enough for the load hooks to run. Table widths and connector routes are
 * recomputed off a throttleTime(5) on the load action, so a render before that
 * window closes would draw the document as it was written rather than as it is.
 */
const SETTLE_MS = 32;

const settle = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, SETTLE_MS);
  });

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
  await settle();

  const { width, height } = app.store.state.settings;
  // Detached on purpose: konva needs a container, and one outside the document
  // is never laid out, never painted and never reachable from the editor.
  const rendered = renderScene({
    app,
    container: document.createElement('div'),
    scene: <ExportScene />,
    width,
    height,
    theme,
  });

  await whenDrawn();

  return {
    stage: rendered.stage,
    width,
    height,
    destroy: () => {
      rendered.destroy();
      appDestroy(app);
    },
  };
}
