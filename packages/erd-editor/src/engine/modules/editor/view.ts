import { CanvasType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import type {
  GeometrySource,
  ViewSource,
} from '@/utils/draw-relationship/geometrySource';

import { SceneView, ShowMode, ViewKind, VisualizationMode } from './state';

/** Whether the visualization tab is up and on Flow, which is where and only where a Flow scene is mounted. */
const showsFlowTab = (state: RootState): boolean =>
  state.settings.canvasType === CanvasType.visualization &&
  state.editor.visualizationMode === VisualizationMode.flow;

/**
 * The view the reader stands in, or null in the document itself. A Flow view
 * counts only while the visualization tab shows it, so one kept across tabs is
 * open but not stood in.
 */
export const getActiveView = (state: RootState): SceneView | null =>
  showsFlowTab(state) ? state.editor.views.flow : null;

/**
 * Whether a scene is drawing the view of the kind given: an open Flow view
 * only while its tab shows Flow. One kept across tabs is open but unseen, and
 * nothing reads its geometry until it is back.
 */
export const isViewShown = (state: RootState, kind: ViewSource): boolean =>
  state.editor.views[kind] !== null && showsFlowTab(state);

/**
 * The view a scene drawn from the source given reads, open or not: the slot
 * of that kind, and null for the document. A scene reads its own slot and
 * never the active one, so an export of the document is never drawn from a view.
 */
export const getSourceView = (
  state: RootState,
  source: GeometrySource
): SceneView | null =>
  source === 'document' ? null : state.editor.views[source];

/**
 * A view just opened: nothing placed yet, the neutral placement a fit will
 * replace, and the display its centers ask for. Narrowed to a few tables it
 * opens on the key rows; over the whole document it draws name boxes.
 */
export function createSceneView(
  kind: ViewKind,
  centerIds: string[] = []
): SceneView {
  const centers = [...centerIds];

  return {
    kind,
    showMode: centers.length ? ShowMode.keysOnly : ShowMode.nameOnly,
    positions: {},
    originX: 0,
    originY: 0,
    zoomLevel: 1,
    centerIds: centers,
  };
}
