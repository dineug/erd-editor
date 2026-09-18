import { describe, expect, it } from 'vite-plus/test';

import { createTouch, releasePointer } from '@/__test-utils__';
import {
  CLICK_SLOP,
  isClick,
  isPlainPress,
  onClickRelease,
  pointOf,
} from '@/utils/clickGesture';

/**
 * The one definition the card's second press and the background's release
 * share. Both read a click off it, so a bound that moved on one axis alone
 * would part the two gestures without either of their own specs noticing.
 */
describe('the release a press is read as a click by', () => {
  it('takes the slop on both axes, and refuses the pixel past it on each', () => {
    expect(CLICK_SLOP).toBe(4);
    expect(isClick({ x: 100, y: 100 }, { x: 104, y: 100 })).toBe(true);
    expect(isClick({ x: 100, y: 100 }, { x: 105, y: 100 })).toBe(false);
    expect(isClick({ x: 100, y: 100 }, { x: 100, y: 104 })).toBe(true);
    expect(isClick({ x: 100, y: 100 }, { x: 100, y: 105 })).toBe(false);
    expect(isClick({ x: 100, y: 100 }, { x: 96, y: 96 })).toBe(true);
    expect(isClick({ x: 100, y: 100 }, { x: 95, y: 95 })).toBe(false);
  });

  it('reads the point off a mouse event, off a touch, and off nothing else', () => {
    expect(
      pointOf(new MouseEvent('mousedown', { clientX: 30, clientY: 40 }))
    ).toEqual({ x: 30, y: 40 });
    expect(pointOf(createTouch('touchend', 30, 40))).toEqual({ x: 30, y: 40 });
    expect(pointOf(new Event('mousedown'))).toBeNull();
  });

  it('is a plain press with the main button alone, and never under a modifier', () => {
    expect(isPlainPress(new MouseEvent('mousedown', { button: 0 }))).toBe(true);
    expect(isPlainPress(new MouseEvent('mousedown', { button: 1 }))).toBe(
      false
    );
    expect(
      isPlainPress(
        new MouseEvent('mousedown', {
          button: 0,
          ctrlKey: true,
          metaKey: true,
        })
      )
    ).toBe(false);
    expect(isPlainPress(createTouch('touchstart') as TouchEvent)).toBe(true);
  });

  it('calls back on a lift near the press, and stays silent on one that travelled', () => {
    const near: string[] = [];
    onClickRelease(
      new MouseEvent('mousedown', { clientX: 100, clientY: 100 }),
      () => near.push('near')
    );
    releasePointer(102, 103);
    expect(near).toEqual(['near']);

    const far: string[] = [];
    onClickRelease(
      new MouseEvent('mousedown', { clientX: 100, clientY: 100 }),
      () => far.push('far')
    );
    releasePointer(140, 100);
    expect(far).toEqual([]);
  });

  it('stays silent where the gesture ended without a lift, and where the press had no point', () => {
    const ended: string[] = [];
    onClickRelease(
      new MouseEvent('mousedown', { clientX: 100, clientY: 100 }),
      () => ended.push('ended')
    );
    window.dispatchEvent(new Event('dragstart', { bubbles: true }));
    releasePointer(100, 100);
    expect(ended).toEqual([]);

    const pointless: string[] = [];
    onClickRelease(new Event('mousedown'), () => pointless.push('pointless'));
    releasePointer(0, 0);
    expect(pointless).toEqual([]);
  });

  it('reads no click off a pinch, whose fingers lift one at a time', () => {
    const fingers = (type: string, points: Array<[number, number]>) =>
      new TouchEvent(type, {
        touches: points.map(([x, y]) => ({ clientX: x, clientY: y })) as any,
      });

    // The first finger held still while the second lifts, then lifts itself.
    const still: string[] = [];
    onClickRelease(fingers('touchstart', [[100, 100]]), () =>
      still.push('click')
    );
    window.dispatchEvent(fingers('touchend', [[100, 100]]));
    expect(still).toEqual([]);

    // The second finger, whose press reads the first one's point.
    const second: string[] = [];
    onClickRelease(
      fingers('touchstart', [
        [100, 100],
        [180, 100],
      ]),
      () => second.push('click')
    );
    window.dispatchEvent(fingers('touchend', []));
    expect(second).toEqual([]);
  });
});
