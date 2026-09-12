import { CanvasType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

import { SceneView, ShowMode, ViewKind, VisualizationMode } from './state';

/**
 * The view the reader stands in, or null in the document itself. Focus wins
 * over Flow, and Flow counts only while the visualization tab shows it, so the
 * short circuit reads the tab only while no Focus view is open.
 */
export const getActiveView = (state: RootState): SceneView | null =>
  state.editor.views.focus ??
  (state.settings.canvasType === CanvasType.visualization &&
  state.editor.visualizationMode === VisualizationMode.flow
    ? state.editor.views.flow
    : null);

/**
 * The view a scene drawn from the source given reads, open or not: the slot
 * of that kind, and null for the document. A scene reads its own slot and
 * never the active one, so a Focus overlay leaves the Flow scene under it on Flow.
 */
export const getSourceView = (
  state: RootState,
  source: GeometrySource
): SceneView | null =>
  source === 'document' ? null : state.editor.views[source];

/**
 * A view just opened: nothing placed yet, the neutral placement a fit will
 * replace, and the display a kind opens with. Flow draws name boxes, Focus
 * opens on the key rows and stands on the centers it was given.
 */
export function createSceneView(
  kind: ViewKind,
  centerIds: string[] = []
): SceneView {
  const centers = [...centerIds];

  return {
    kind,
    showMode: kind === ViewKind.flow ? ShowMode.nameOnly : ShowMode.keysOnly,
    positions: {},
    originX: 0,
    originY: 0,
    zoomLevel: 1,
    centerIds: centers,
    hop: 1,
    history: { entries: [[...centers]], cursor: 0 },
  };
}
