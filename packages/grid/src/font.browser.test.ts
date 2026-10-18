// The metrics of real faces in Chromium, against what its own canvas reports
// for them, and the one DOM read pretext makes per font landing at mount.

import { prepareWithSegments } from '@chenglou/pretext';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  ADVANCE_PROBES,
  DEFAULT_FONT,
  DEFAULT_FONT_SIZE,
  maxAdvance,
  measureFont,
} from '@/font';

function contextIn(font: string): CanvasRenderingContext2D {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Chromium handed out no 2d context');
  context.font = font;
  return context;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the default font', () => {
  it('is a shorthand a canvas takes, at the default size', () => {
    // A canvas keeps its previous font when handed one it cannot parse, so a
    // broken family list would leave the 10px default in place.
    const context = contextIn(DEFAULT_FONT);

    expect(context.font.startsWith(`${DEFAULT_FONT_SIZE}px `)).toBe(true);
    expect(context.font).toContain('-apple-system');
  });
});

describe('measureFont in a real canvas', () => {
  it('reads the font box ascent and descent of M', () => {
    const box = contextIn(DEFAULT_FONT).measureText('M');
    const { ascent, descent } = measureFont(DEFAULT_FONT);

    expect(ascent).toBe(box.fontBoundingBoxAscent);
    expect(descent).toBe(box.fontBoundingBoxDescent);
    expect(ascent).toBeGreaterThan(descent);
    expect(descent).toBeGreaterThan(0);
  });

  it('takes the widest probe as the max advance', () => {
    const context = contextIn(DEFAULT_FONT);
    const widths = ADVANCE_PROBES.map(
      probe => context.measureText(probe).width
    );

    expect(maxAdvance(DEFAULT_FONT)).toBe(Math.max(...widths));
    expect(maxAdvance(DEFAULT_FONT)).toBeGreaterThan(0);
  });

  it('reads the DOM for the emoji calibration at mount, and not when a cell is measured after', () => {
    const font = '15px sans-serif';
    const emoji = contextIn(font).measureText(ADVANCE_PROBES[3]).width;
    // pretext calibrates only where the canvas draws an emoji wider than the
    // font size, which depends on the platform's emoji face.
    const calibrates = emoji > 15 + 0.5;
    const appendChild = vi.spyOn(document.body, 'appendChild');

    measureFont(font);

    expect(appendChild).toHaveBeenCalledTimes(calibrates ? 1 : 0);

    appendChild.mockClear();
    prepareWithSegments(`a ${ADVANCE_PROBES[3]} b`, font, {
      whiteSpace: 'pre-wrap',
    });

    expect(appendChild).not.toHaveBeenCalled();
  });
});
