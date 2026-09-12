import { FOCUS_BAR_HEIGHT } from '@/constants/layout';
import { CANVAS_ZOOM_MAX, CanvasType } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  changeCanvasTypeAction,
  hasViewport,
} from '@/engine/modules/settings/atom.actions';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import { getOriginToPlace } from '@/konva/scene/viewport';

import { ViewKind } from './state';
import {
  viewChangeZoomLevelAction,
  viewCloseAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetCentersAction,
} from './view.actions';

/** The slot every Focus action here names, so none of them reads the active view. */
const FOCUS = ViewKind.focus;

/** Whether the ids name the centers the view stands on already, in the same order. */
const standsOn = (centerIds: string[], tableIds: string[]): boolean =>
  centerIds.length === tableIds.length &&
  centerIds.every((id, index) => id === tableIds[index]);

/**
 * Opens the Focus view on the tables given, which raises the overlay flag
 * with it. With one already open it walks there instead, pushing a step on
 * the trail the way a neighbour click does, and keeps its reach and show mode; asked for the centers it stands on, it stands.
 *
 * @example
 * store.dispatch(openFocusViewAction$(['orders']));
 */
export const openFocusViewAction$ = (tableIds: string[]): GeneratorAction =>
  function* ({ editor }) {
    if (!tableIds.length) return;

    const view = editor.views.focus;
    if (view) {
      if (standsOn(view.centerIds, tableIds)) return;
      yield viewSetCentersAction({ tableIds, push: true });
      return;
    }

    yield viewOpenAction({ kind: FOCUS, centerIds: tableIds });
  };

/**
 * Fits what the Focus view shows into the screen below the bar, as close as
 * the zoom's own ceiling allows: a hub of a few tables is read up close, where
 * the preview of a whole document is only ever read from afar. Nothing to fit, or no screen yet, and it stands.
 */
export const refitFocusViewAction$ = (): GeneratorAction =>
  function* (state) {
    const { viewport, views } = state.editor;
    const content = getSceneContentRect(state, FOCUS);
    if (!views.focus || !content || !hasViewport(viewport)) return;

    // The bar is drawn over the top of the scene box, so the screen a fit has
    // is the viewport less the bar, and the middle it lands on sits below it.
    const screen = {
      width: viewport.width,
      height: Math.max(viewport.height - FOCUS_BAR_HEIGHT, 0),
    };
    const zoomLevel = previewZoomLevel(content, screen, CANVAS_ZOOM_MAX);
    const origin = getOriginToPlace(
      zoomLevel,
      { x: content.x + content.width / 2, y: content.y + content.height / 2 },
      { x: screen.width / 2, y: FOCUS_BAR_HEIGHT + screen.height / 2 }
    );

    yield viewChangeZoomLevelAction({ value: zoomLevel, kind: FOCUS });
    yield viewScrollToAction({
      originX: origin.x,
      originY: origin.y,
      kind: FOCUS,
    });
  };

/**
 * Closes the Focus view, lowers the overlay and stands the reader on the ERD
 * tab. The scroll to the last center and its selection go in a dispatch after
 * this one: a batch is classified by the state before it, and a scroll here would land in the closing view.
 */
export const closeFocusViewAction$ = (): GeneratorAction =>
  function* ({ editor, settings }) {
    if (!editor.views.focus) return;

    yield viewCloseAction({ kind: FOCUS });

    if (settings.canvasType !== CanvasType.ERD) {
      yield changeCanvasTypeAction({ value: CanvasType.ERD });
    }
  };

export const viewActions$ = {
  openFocusViewAction$,
  refitFocusViewAction$,
  closeFocusViewAction$,
};
