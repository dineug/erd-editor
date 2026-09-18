import { clamp } from 'es-toolkit';
import { fromEvent, Subscription, takeUntil } from 'rxjs';

import { Point } from '@/internal-types';
import { isMultiTouch } from '@/utils/domEvent';
import { moveEnd$, touchmove$ } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

/**
 * Where a ctrl wheel stops reading as a pinch and starts reading as a notch. A
 * pinch comes as ctrl wheels of -100 ln(scale) px, a few each, and a notch as
 * 100 px at a page zoom of 100%, which falls to this at 400%.
 */
const NOTCH_DELTA_MIN = 25;

/**
 * The most wheel travel one pinch event is taken at, a tenth of the zoom. A
 * pinch rarely reaches it; a ctrl notch on an Apple device, a pinch there too,
 * is held to it and steps the zoom rather than jumping it.
 */
const PINCH_DELTA_MAX = 10;

/**
 * Whether a wheel is a trackpad pinch, which a browser sends as a ctrl wheel.
 * On Apple devices the zoom chord is the command key, so every ctrl wheel is
 * one; elsewhere ctrl is the chord too, and only a wheel short of a notch is.
 */
export function isPinchWheel(event: WheelEvent): boolean {
  if (!event.ctrlKey) return false;

  return !isMod(event) || Math.abs(event.deltaY) < NOTCH_DELTA_MIN;
}

/** How much a pinch wheel scales the zoom: the scale the browser encoded in it. */
export function pinchWheelScale({ deltaY }: WheelEvent): number {
  const delta = clamp(deltaY, -PINCH_DELTA_MAX, PINCH_DELTA_MAX);

  return Math.exp(-delta / 100);
}

/** Where a pinch stands: how far it has scaled since it began, and its centre now. */
export type Pinch = {
  scale: number;
  center: Point;
};

/**
 * What a scene makes of a pinch beginning at the point given, in its own box:
 * the step to take on every move after, or null to let the pinch go by.
 */
export type PinchStart = (center: Point) => ((pinch: Pinch) => void) | null;

type Spread = {
  center: Point;
  distance: number;
};

type TouchPoints = ArrayLike<Pick<Touch, 'clientX' | 'clientY'>>;

/** The midpoint of the first two touches in the box, and how far apart they are. */
function spreadOf(touches: TouchPoints, box: DOMRect): Spread | null {
  if (touches.length < 2) return null;

  const [a, b] = [touches[0], touches[1]];

  return {
    center: {
      x: (a.clientX + b.clientX) / 2 - box.x,
      y: (a.clientY + b.clientY) / 2 - box.y,
    },
    distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
  };
}

/** Safari's GestureEvent, which lib.dom does not declare. */
type GestureEvent = UIEvent & {
  scale: number;
  clientX: number;
  clientY: number;
};

/**
 * The pinches a scene box takes besides the wheel: two fingers on a touch
 * screen, and Safari's trackpad pinch, which reaches a page as gesture events.
 * iOS sends both for one pinch, so the fingers win and the gestures stand down.
 *
 * @example
 * const pinch = createPinch(() => root.value, center => step);
 * onMounted(() => addUnsubscribe(pinch.listen()));
 */
export function createPinch(box: () => HTMLElement, start: PinchStart) {
  let touch: Subscription | null = null;
  let gestureStep: ((pinch: Pinch) => void) | null = null;

  const touching = () => touch !== null && !touch.closed;

  // A gesture carrying no point pinches about the middle of the box.
  const pointIn = (event: GestureEvent): Point => {
    const { x, y, width, height } = box().getBoundingClientRect();
    return Number.isFinite(event.clientX + event.clientY)
      ? { x: event.clientX - x, y: event.clientY - y }
      : { x: width / 2, y: height / 2 };
  };

  /**
   * Takes over a press that puts a second finger down, and says whether it was
   * one, so the caller leaves it alone either way. The pinch runs until a finger lifts.
   */
  const handleTouchstart = (event: MouseEvent | TouchEvent): boolean => {
    if (!isMultiTouch(event)) return false;

    const rect = box().getBoundingClientRect();
    const from = spreadOf((event as TouchEvent).touches, rect);
    const step = from && from.distance > 0 ? start(from.center) : null;

    touch?.unsubscribe();
    gestureStep = null;
    if (!from || !step) return true;

    touch = touchmove$.pipe(takeUntil(moveEnd$)).subscribe(move => {
      const to = spreadOf(move.touches, rect);
      if (!to) return;

      step({ scale: to.distance / from.distance, center: to.center });
    });

    return true;
  };

  // A gesture the page lets through zooms the whole page instead of the scene,
  // so each is spent here even when the scene lets the pinch go by.
  const handleGesturestart = (event: GestureEvent) => {
    event.preventDefault();
    gestureStep = touching() ? null : start(pointIn(event));
  };

  const handleGesturechange = (event: GestureEvent) => {
    event.preventDefault();
    if (!gestureStep || touching()) return;

    gestureStep({ scale: event.scale, center: pointIn(event) });
  };

  const handleGestureend = (event: GestureEvent) => {
    event.preventDefault();
    gestureStep = null;
  };

  /** Listens for the gestures on the box; the teardown ends a pinch still going too. */
  const listen = (): Subscription => {
    const $box = box();
    const subscription = new Subscription(() => {
      touch?.unsubscribe();
      gestureStep = null;
    });

    subscription.add(
      fromEvent<GestureEvent>($box, 'gesturestart').subscribe(
        handleGesturestart
      )
    );
    subscription.add(
      fromEvent<GestureEvent>($box, 'gesturechange').subscribe(
        handleGesturechange
      )
    );
    subscription.add(
      fromEvent<GestureEvent>($box, 'gestureend').subscribe(handleGestureend)
    );

    return subscription;
  };

  return { handleTouchstart, listen };
}
