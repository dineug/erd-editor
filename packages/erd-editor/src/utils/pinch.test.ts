import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createPinch,
  isPinchWheel,
  type Pinch,
  pinchWheelScale,
} from '@/utils/pinch';

const device = vi.hoisted(() => ({ apple: false }));

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => device.apple,
}));

type Modifiers = { ctrlKey?: boolean; metaKey?: boolean };

/** happy-dom's WheelEvent constructor drops the modifier flags, so they are set after. */
function wheel(deltaY: number, { ctrlKey, metaKey }: Modifiers = {}) {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true });
  Object.defineProperties(event, {
    ctrlKey: { value: Boolean(ctrlKey) },
    metaKey: { value: Boolean(metaKey) },
  });
  return event;
}

type TouchPoint = { x: number; y: number };

function touch(type: string, points: TouchPoint[]): TouchEvent {
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: points.map(({ x, y }) => ({ clientX: x, clientY: y })) as any,
  });
}

function gesture(type: string, scale: number, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    scale: { value: scale },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event;
}

/** The box the pinch is measured in, standing 10 across and 20 down the page. */
const BOX = { x: 10, y: 20 };

describe('isPinchWheel', () => {
  beforeEach(() => {
    device.apple = false;
  });

  it('takes a ctrl wheel short of a notch for a pinch where ctrl is the chord', () => {
    expect(isPinchWheel(wheel(-3.2, { ctrlKey: true }))).toBe(true);
    expect(isPinchWheel(wheel(24, { ctrlKey: true }))).toBe(true);
  });

  it('leaves a whole notch under the chord to the zoom step', () => {
    expect(isPinchWheel(wheel(100, { ctrlKey: true }))).toBe(false);
    expect(isPinchWheel(wheel(-53, { ctrlKey: true }))).toBe(false);
  });

  it('takes every ctrl wheel for a pinch on an apple device, whose chord is command', () => {
    device.apple = true;

    expect(isPinchWheel(wheel(-3, { ctrlKey: true }))).toBe(true);
    expect(isPinchWheel(wheel(100, { ctrlKey: true }))).toBe(true);
    expect(isPinchWheel(wheel(3, { metaKey: true }))).toBe(false);
  });

  it('never takes a wheel without ctrl', () => {
    expect(isPinchWheel(wheel(3))).toBe(false);
    expect(isPinchWheel(wheel(3, { metaKey: true }))).toBe(false);
  });
});

describe('pinchWheelScale', () => {
  it('reads back the scale the browser encoded as -100 ln(scale)', () => {
    expect(pinchWheelScale(wheel(-100 * Math.log(1.08)))).toBeCloseTo(1.08, 10);
    expect(pinchWheelScale(wheel(-100 * Math.log(0.95)))).toBeCloseTo(0.95, 10);
  });

  it('cancels out between a pinch out and the same pinch back in', () => {
    const out = pinchWheelScale(wheel(7));
    const back = pinchWheelScale(wheel(-7));

    expect(out).toBeLessThan(1);
    expect(out * back).toBeCloseTo(1, 12);
  });

  it('holds one event to a tenth, so a ctrl notch on an apple device is a step', () => {
    expect(pinchWheelScale(wheel(100))).toBeCloseTo(Math.exp(-0.1), 12);
    expect(pinchWheelScale(wheel(-400))).toBeCloseTo(Math.exp(0.1), 12);
  });
});

describe('createPinch', () => {
  let box: HTMLDivElement;
  let steps: Pinch[];
  let begun: TouchPoint[];
  let declined: boolean;
  let listening: { unsubscribe: () => void } | null;

  const setup = () => {
    const pinch = createPinch(
      () => box,
      center => {
        begun.push(center);
        return declined ? null : step => steps.push(step);
      }
    );
    listening = pinch.listen();
    return pinch;
  };

  beforeEach(() => {
    box = document.createElement('div');
    box.getBoundingClientRect = () =>
      ({ ...BOX, width: 800, height: 600 }) as DOMRect;
    document.body.append(box);
    steps = [];
    begun = [];
    declined = false;
    listening = null;
  });

  afterEach(() => {
    listening?.unsubscribe();
    window.dispatchEvent(touch('touchend', []));
    box.remove();
  });

  describe('two fingers', () => {
    it('scales by how far the fingers spread and follows their midpoint', () => {
      const pinch = setup();

      const handled = pinch.handleTouchstart(
        touch('touchstart', [
          { x: 110, y: 120 },
          { x: 210, y: 120 },
        ])
      );
      window.dispatchEvent(
        touch('touchmove', [
          { x: 80, y: 150 },
          { x: 280, y: 150 },
        ])
      );

      expect(handled).toBe(true);
      expect(begun).toEqual([{ x: 150, y: 100 }]);
      expect(steps).toEqual([{ scale: 2, center: { x: 170, y: 130 } }]);
    });

    it('leaves a single finger to the caller', () => {
      const pinch = setup();

      expect(
        pinch.handleTouchstart(touch('touchstart', [{ x: 1, y: 2 }]))
      ).toBe(false);
      expect(pinch.handleTouchstart(new MouseEvent('mousedown'))).toBe(false);
      expect(begun).toEqual([]);
    });

    it('ends as a finger lifts', () => {
      const pinch = setup();
      pinch.handleTouchstart(
        touch('touchstart', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ])
      );

      window.dispatchEvent(touch('touchend', [{ x: 0, y: 0 }]));
      window.dispatchEvent(
        touch('touchmove', [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ])
      );

      expect(steps).toEqual([]);
    });

    it('still spends a pinch the scene lets go by, so no pan starts under it', () => {
      declined = true;
      const pinch = setup();

      const handled = pinch.handleTouchstart(
        touch('touchstart', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ])
      );
      window.dispatchEvent(
        touch('touchmove', [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ])
      );

      expect(handled).toBe(true);
      expect(steps).toEqual([]);
    });

    it('never divides by two fingers that land on one point', () => {
      const pinch = setup();

      pinch.handleTouchstart(
        touch('touchstart', [
          { x: 50, y: 50 },
          { x: 50, y: 50 },
        ])
      );
      window.dispatchEvent(
        touch('touchmove', [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ])
      );

      expect(begun).toEqual([]);
      expect(steps).toEqual([]);
    });
  });

  describe('safari gestures', () => {
    it('scales by the gesture and holds the page zoom off', () => {
      setup();

      const start = gesture('gesturestart', 1, 110, 220);
      const change = gesture('gesturechange', 1.5, 110, 220);
      const end = gesture('gestureend', 1.5, 110, 220);
      box.dispatchEvent(start);
      box.dispatchEvent(change);
      box.dispatchEvent(end);
      box.dispatchEvent(gesture('gesturechange', 3, 110, 220));

      expect(begun).toEqual([{ x: 100, y: 200 }]);
      expect(steps).toEqual([{ scale: 1.5, center: { x: 100, y: 200 } }]);
      expect([start, change, end].map(e => e.defaultPrevented)).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('pinches about the middle of the box for a gesture carrying no point', () => {
      setup();

      box.dispatchEvent(gesture('gesturestart', 1, NaN, NaN));
      box.dispatchEvent(gesture('gesturechange', 2, NaN, NaN));

      expect(begun).toEqual([{ x: 400, y: 300 }]);
      expect(steps).toEqual([{ scale: 2, center: { x: 400, y: 300 } }]);
    });

    it('stands down while two fingers drive the pinch, as iOS sends both', () => {
      const pinch = setup();

      box.dispatchEvent(gesture('gesturestart', 1, 0, 0));
      pinch.handleTouchstart(
        touch('touchstart', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ])
      );
      box.dispatchEvent(gesture('gesturechange', 4, 0, 0));
      box.dispatchEvent(gesture('gesturestart', 1, 0, 0));
      box.dispatchEvent(gesture('gesturechange', 4, 0, 0));

      expect(steps).toEqual([]);
    });

    it('stops listening, and ends a pinch still going, once torn down', () => {
      const pinch = setup();
      pinch.handleTouchstart(
        touch('touchstart', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ])
      );

      listening?.unsubscribe();
      window.dispatchEvent(
        touch('touchmove', [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ])
      );
      const start = gesture('gesturestart', 1, 0, 0);
      box.dispatchEvent(start);

      expect(steps).toEqual([]);
      expect(start.defaultPrevented).toBe(false);
    });
  });
});
