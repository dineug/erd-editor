import { describe, expect, it } from 'vite-plus/test';

import {
  contentScrollRange,
  openingOrigin,
} from '@/engine/modules/settings/scrollRange';
import { toScreenPoint } from '@/konva/scene/viewport';

const ZOOMS = [0.1, 0.5, 1, 1.25, 1.5];
const SPANS: Array<[number, number]> = [
  [0, 2_000],
  [-4_000, -2_500],
  [30_000, 30_365],
  [-250_000, 250_000],
];
const VIEWPORTS = [320, 1_000, 1_440, 3_840];

describe('contentScrollRange', () => {
  /**
   * The two ends written out longhand: the origin that puts the far edge on the
   * screen's near edge, and the one that puts the near edge on its far edge.
   */
  it('runs from the far edge at the start to the near edge at the end', () => {
    const off: string[] = [];

    for (const [near, far] of SPANS) {
      for (const zoomLevel of ZOOMS) {
        for (const viewport of VIEWPORTS) {
          const { min, max } = contentScrollRange(
            near,
            far,
            viewport,
            zoomLevel
          );

          if (
            Math.abs(min - -far * zoomLevel) > 1e-9 ||
            Math.abs(max - (viewport - near * zoomLevel)) > 1e-9
          ) {
            off.push(
              `${near}..${far} zoom ${zoomLevel} viewport ${viewport}: ${min}..${max}`
            );
          }
        }
      }
    }

    expect(off).toEqual([]);
  });

  it('places the edges on the screen edges when read back through the canon', () => {
    const off: string[] = [];

    for (const [near, far] of SPANS) {
      for (const zoomLevel of ZOOMS) {
        for (const viewport of VIEWPORTS) {
          const { min, max } = contentScrollRange(
            near,
            far,
            viewport,
            zoomLevel
          );
          const farEdge = toScreenPoint(
            { originX: min, originY: 0, zoomLevel },
            { x: far, y: 0 }
          ).x;
          const nearEdge = toScreenPoint(
            { originX: max, originY: 0, zoomLevel },
            { x: near, y: 0 }
          ).x;

          if (
            Math.abs(farEdge) > 1e-9 ||
            Math.abs(nearEdge - viewport) > 1e-9
          ) {
            off.push(
              `${near}..${far} zoom ${zoomLevel} viewport ${viewport}: far edge at ${farEdge}, near edge at ${nearEdge}`
            );
          }
        }
      }
    }

    expect(off).toEqual([]);
  });

  it('spans the content at the zoom plus one screen', () => {
    for (const [near, far] of SPANS) {
      for (const zoomLevel of ZOOMS) {
        for (const viewport of VIEWPORTS) {
          const { min, max } = contentScrollRange(
            near,
            far,
            viewport,
            zoomLevel
          );

          expect(max - min).toBeCloseTo((far - near) * zoomLevel + viewport, 6);
        }
      }
    }
  });

  it('sorts the ends when handed an inverted span or a screen of nothing', () => {
    const inverted = contentScrollRange(2_000, 0, 1_000, 1);
    const noScreen = contentScrollRange(0, 2_000, -500, 1);

    expect(inverted.min).toBeLessThanOrEqual(inverted.max);
    expect(inverted).toEqual({ min: 1_000 - 2_000, max: 0 });
    expect(noScreen.min).toBeLessThanOrEqual(noScreen.max);
    expect(noScreen).toEqual({ min: -2_000, max: -500 });
  });

  it('never hands back a negative zero, which Object.is tells from zero', () => {
    const { min } = contentScrollRange(-500, 0, 1_000, 1);
    const { max } = contentScrollRange(1_000, 3_000, 1_000, 1);

    expect(Object.is(min, 0)).toBe(true);
    expect(Object.is(max, 0)).toBe(true);
  });
});

describe('openingOrigin', () => {
  /** The screen position of a scene coordinate at an origin, on the one axis. */
  const at = (originX: number, zoomLevel: number, x: number) =>
    toScreenPoint({ originX, originY: 0, zoomLevel }, { x, y: 0 }).x;

  it('keeps an origin the pure range holds strictly, where some content is drawn', () => {
    for (const [near, far] of SPANS) {
      for (const zoomLevel of ZOOMS) {
        for (const viewport of VIEWPORTS) {
          const { min, max } = contentScrollRange(
            near,
            far,
            viewport,
            zoomLevel
          );

          for (const origin of [min + 1, (min + max) / 2, max - 1]) {
            expect(openingOrigin(origin, near, far, viewport, zoomLevel)).toBe(
              origin
            );
          }
        }
      }
    }
  });

  /**
   * At either end of the pure range the content is entirely off the screen,
   * and so it is past them. The origin is pulled the shortest way to where the
   * content is all on screen, or fills it when it is bigger than the screen.
   */
  it('pulls an origin on or past either end to where the content is drawn', () => {
    const off: string[] = [];

    for (const [near, far] of SPANS) {
      for (const zoomLevel of ZOOMS) {
        for (const viewport of VIEWPORTS) {
          const { min, max } = contentScrollRange(
            near,
            far,
            viewport,
            zoomLevel
          );
          const fills = (far - near) * zoomLevel >= viewport;
          const label = `${near}..${far} zoom ${zoomLevel} viewport ${viewport}`;

          for (const origin of [max, max + 12_345]) {
            const settled = openingOrigin(
              origin,
              near,
              far,
              viewport,
              zoomLevel
            );
            // Pulled back from past the far end: the near edge lands on the
            // screen's near edge when the content fills it, else the far edge
            // lands on the screen's far edge with the whole content inside.
            const landed = fills
              ? at(settled, zoomLevel, near)
              : at(settled, zoomLevel, far);
            const edge = fills ? 0 : viewport;

            if (
              Math.abs(landed - edge) > 1e-9 ||
              settled <= min ||
              settled >= max
            ) {
              off.push(
                `${label}: from ${origin} settled at ${settled}, edge at ${landed}`
              );
            }
          }

          for (const origin of [min, min - 12_345]) {
            const settled = openingOrigin(
              origin,
              near,
              far,
              viewport,
              zoomLevel
            );
            const landed = fills
              ? at(settled, zoomLevel, far)
              : at(settled, zoomLevel, near);
            const edge = fills ? viewport : 0;

            if (
              Math.abs(landed - edge) > 1e-9 ||
              settled <= min ||
              settled >= max
            ) {
              off.push(
                `${label}: from ${origin} settled at ${settled}, edge at ${landed}`
              );
            }
          }
        }
      }
    }

    expect(off).toEqual([]);
  });

  it('leaves the same overlap on screen whichever end it pulls back from', () => {
    for (const [near, far] of SPANS) {
      for (const zoomLevel of ZOOMS) {
        for (const viewport of VIEWPORTS) {
          const { min, max } = contentScrollRange(
            near,
            far,
            viewport,
            zoomLevel
          );
          const fromFar = openingOrigin(
            max + 1,
            near,
            far,
            viewport,
            zoomLevel
          );
          const fromNear = openingOrigin(
            min - 1,
            near,
            far,
            viewport,
            zoomLevel
          );

          expect(max - fromFar).toBeCloseTo(fromNear - min, 6);
          expect(max - fromFar).toBeCloseTo(
            Math.min(viewport, (far - near) * zoomLevel),
            6
          );
        }
      }
    }
  });

  it('answers a plain zero where the pull lands on one', () => {
    // Content from 0 to 200 at zoom 1 on a 1000 screen: from past the far end
    // the whole of it lands against the far edge, at an origin of 800; from
    // past the near end its near edge lands on the near edge, at zero exactly.
    const settled = openingOrigin(-5_000, 0, 200, 1_000, 1);

    expect(settled).toBe(0);
    expect(Object.is(settled, 0)).toBe(true);
    expect(openingOrigin(5_000, 0, 200, 1_000, 1)).toBe(800);
  });
});
