import { Viewport } from '@/engine/modules/editor/state';
import {
  getScrollRanges,
  ScrollTransform,
} from '@/engine/modules/settings/atom.actions';
import { toScenePoint } from '@/konva/scene/viewport';
import { Rect } from '@/utils/dragSelect';

/**
 * The scene a reader can still get to: what the screen shows, taken over every
 * scroll offset the current zoom allows. A magnifying zoom sees less at once
 * but reaches the same document, so the bound has to follow the travel.
 */
export function getReachableRect(
  settings: ScrollTransform,
  viewport: Viewport
): Rect {
  const { zoomLevel } = settings;
  const { left, top } = getScrollRanges(settings, viewport);
  const min = toScenePoint(
    { zoomLevel, originX: left.max, originY: top.max },
    { x: 0, y: 0 }
  );
  const max = toScenePoint(
    { zoomLevel, originX: left.min, originY: top.min },
    { x: viewport.width, y: viewport.height }
  );

  return { x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y };
}
