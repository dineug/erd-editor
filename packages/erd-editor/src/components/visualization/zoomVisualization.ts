import type { AppContext } from '@/components/appContext';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';

import { updateGraphView } from './graphViewHandle';
import { zoomAt } from './visualizationView';

/**
 * The point a zoom with no pointer under it holds still, which is the middle of
 * the stage: the graph has no scroll to spend the rest of the move on.
 */
const middleOfStage = (app: AppContext) => {
  const { viewport } = app.store.state.editor;

  return { x: viewport.width / 2, y: viewport.height / 2 };
};

const isFlow = (app: AppContext) =>
  app.store.state.editor.visualizationMode === VisualizationMode.flow;

/**
 * One step of zoom in the mode that is up. The Flow's runs through the canon
 * the document's own does; the graph's holds the middle of the stage, which is
 * where the same step lands for a view with no scroll under it.
 *
 * @example
 * stepVisualizationZoom(app.value, ZOOM_STEP);
 */
export function stepVisualizationZoom(app: AppContext, step: number): void {
  if (isFlow(app)) {
    app.store.dispatch(streamZoomLevelAction$(step, ViewKind.flow));
    return;
  }

  const { editor } = app.store.state;
  updateGraphView(editor.id, ({ state }) =>
    zoomAt(state, middleOfStage(app), (state.scale + step) / state.scale)
  );
}

/**
 * The zoom of the mode that is up, at the level given rather than a step from
 * where it stands. Absolute, so the reset chord lands on the same number
 * whichever mode reads it and however far the reader had zoomed.
 *
 * @example
 * setVisualizationZoom(app.value, ZOOM_RESET);
 */
export function setVisualizationZoom(app: AppContext, level: number): void {
  if (isFlow(app)) {
    app.store.dispatch(changeZoomLevelAction$(level, ViewKind.flow));
    return;
  }

  const { editor } = app.store.state;
  updateGraphView(editor.id, ({ state }) =>
    zoomAt(state, middleOfStage(app), level / state.scale)
  );
}
