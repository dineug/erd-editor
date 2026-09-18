import { onMounted, type Ref } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import { pinchZoomAction$ } from '@/engine/modules/settings/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Point } from '@/internal-types';
import { getZoomTransform, toScenePoint } from '@/konva/scene/viewport';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { createPinch, isPinchWheel, pinchWheelScale } from '@/utils/pinch';
import { zoomInRange, zoomLevelInRange } from '@/utils/validation';

export type PinchZoomOptions = {
  /** The editor whose store the zoom lands in. */
  app: () => AppContext;
  /** The box the scene hangs in, which a pinch is measured against. */
  root: Ref<HTMLDivElement>;
  /** The scene zoomed, else the one the zoom chords reach. */
  source?: GeometrySource;
  /** Whether the scene zooms by a pinch now; an overlay over it does not. */
  enabled?: () => boolean;
};

/**
 * The pinches a store scene zooms by: a trackpad's about the pointer, and two
 * fingers about their midpoint, which also pans as it travels. The caller hands
 * each its wheel and its press first and leaves the one spent here alone.
 *
 * @example
 * const pinch = usePinchZoom({ app: () => app.value, root });
 * if (pinch.handleWheel(event)) return;
 */
export function usePinchZoom({
  app,
  root,
  source,
  enabled = () => true,
}: PinchZoomOptions) {
  const { addUnsubscribe } = useUnmounted();

  /**
   * The zoom the last pinch wheel reached and what the store rounded it to. A
   * pinch wheel is a fraction of a percent, which the rounding would swallow
   * at a low zoom, so the next one scales this while the store still holds it.
   */
  let reached = { exact: 0, stored: NaN };

  const transformOf = () => getZoomTransform(app().store.state, source);

  const pointIn = (event: MouseEvent): Point => {
    const { x, y } = root.value.getBoundingClientRect();
    return { x: event.clientX - x, y: event.clientY - y };
  };

  const zoomTo = (zoomLevel: number, screen: Point, scene?: Point) => {
    app().store.dispatch(
      pinchZoomAction$({ zoomLevel, screen, scene }, source)
    );
  };

  const pinch = createPinch(
    () => root.value,
    center => {
      if (!enabled()) return null;

      // Read off now: the transform is the store's own, which the pinch moves.
      const transform = transformOf();
      const { zoomLevel } = transform;
      const scene = toScenePoint(transform, center);

      return ({ scale, center: now }) => zoomTo(zoomLevel * scale, now, scene);
    }
  );

  /**
   * Spends a pinch wheel, and says whether it was one. It zooms about the
   * pointer while the scene takes a pinch, and is held off the page either
   * way, which would otherwise zoom with it.
   */
  const handleWheel = (event: WheelEvent): boolean => {
    if (!isPinchWheel(event)) return false;
    event.preventDefault();
    if (!enabled()) return true;

    const { zoomLevel } = transformOf();
    const from = reached.stored === zoomLevel ? reached.exact : zoomLevel;
    const exact = zoomInRange(from * pinchWheelScale(event));

    reached = { exact, stored: zoomLevelInRange(exact) };
    zoomTo(exact, pointIn(event));
    return true;
  };

  onMounted(() => {
    addUnsubscribe(pinch.listen());
  });

  return { handleWheel, handleTouchstart: pinch.handleTouchstart };
}
