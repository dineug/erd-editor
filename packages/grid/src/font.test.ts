// The metrics a font is measured to, through a stand-in canvas whose answers
// the cases set, and what a realm without one answers. font.browser.test.ts
// measures the real faces; each case here imports a fresh module for its cache.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const { prepare } = vi.hoisted(() => ({ prepare: vi.fn() }));

// happy-dom has no canvas to measure with, which pretext needs; the mount
// warm-up is judged by the call it makes.
vi.mock('@chenglou/pretext', () => ({ prepare }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  prepare.mockClear();
});

async function freshFont() {
  vi.resetModules();
  return await import('@/font');
}

type Answer = Partial<TextMetrics> & { width?: number };

/**
 * A document whose canvas measures each text by the table given, in whatever
 * font it was last set to, and records each measure with that font.
 */
function stubCanvas(answer: (text: string) => Answer) {
  const measures: { font: string; text: string }[] = [];
  const context = {
    font: '10px sans-serif',
    measureText(text: string) {
      measures.push({ font: context.font, text });
      return { width: 0, ...answer(text) };
    },
  };
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => context }),
  });

  return measures;
}

const PROBE_WIDTHS: Record<string, number> = {
  W: 11,
  가: 13,
  漢: 12.5,
  '😀': 12,
};

const fontBox = (text: string): Answer => ({
  width: PROBE_WIDTHS[text] ?? 9,
  fontBoundingBoxAscent: 12,
  fontBoundingBoxDescent: 3,
});

describe('the default font', () => {
  it('is the editor scene family at 13px', async () => {
    const { DEFAULT_FONT, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } =
      await freshFont();

    expect(DEFAULT_FONT_SIZE).toBe(13);
    expect(DEFAULT_FONT).toBe(`13px ${DEFAULT_FONT_FAMILY}`);
    expect(DEFAULT_FONT_FAMILY.startsWith('-apple-system,')).toBe(true);
  });
});

describe('measureFont', () => {
  it('reads the ascent and descent of M off the font box', async () => {
    const measures = stubCanvas(fontBox);
    const { measureFont } = await freshFont();

    const metrics = measureFont('14px serif');

    expect(metrics.ascent).toBe(12);
    expect(metrics.descent).toBe(3);
    expect(measures[0]).toEqual({ font: '14px serif', text: 'M' });
  });

  it('takes the widest of the four probe glyphs as the max advance', async () => {
    const measures = stubCanvas(fontBox);
    const { ADVANCE_PROBES, measureFont } = await freshFont();

    expect(measureFont('14px serif').maxAdvance).toBe(13);
    expect(measures.slice(1).map(({ text }) => text)).toEqual([
      ...ADVANCE_PROBES,
    ]);
    expect(measures.every(({ font }) => font === '14px serif')).toBe(true);
  });

  it('has pretext meet the probes once, so its emoji calibration happens at mount', async () => {
    stubCanvas(fontBox);
    const { ADVANCE_PROBES, measureFont } = await freshFont();

    measureFont('14px serif');
    measureFont('14px serif');

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(ADVANCE_PROBES.join(''), '14px serif');
  });

  it('has pretext calibrate every font it measured again, once pretext’s caches were emptied', async () => {
    stubCanvas(fontBox);
    const { ADVANCE_PROBES, measureFont, recalibrateFonts } = await freshFont();

    measureFont('14px serif');
    measureFont('28px serif');
    prepare.mockClear();
    recalibrateFonts();

    expect(prepare.mock.calls).toEqual([
      [ADVANCE_PROBES.join(''), '14px serif'],
      [ADVANCE_PROBES.join(''), '28px serif'],
    ]);
  });

  it('measures a font once and answers the same metrics after', async () => {
    const measures = stubCanvas(fontBox);
    const { maxAdvance, measureFont } = await freshFont();

    const first = measureFont('14px serif');
    const count = measures.length;

    expect(measureFont('14px serif')).toBe(first);
    expect(maxAdvance('14px serif')).toBe(first.maxAdvance);
    expect(measures).toHaveLength(count);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('measures each font on its own', async () => {
    const measures = stubCanvas(text => ({
      ...fontBox(text),
      width: (PROBE_WIDTHS[text] ?? 9) * 2,
    }));
    const { measureFont } = await freshFont();

    measureFont('14px serif');
    const wide = measureFont('28px serif');

    expect(wide.maxAdvance).toBe(26);
    expect(measures.filter(({ text }) => text === 'M')).toEqual([
      { font: '14px serif', text: 'M' },
      { font: '28px serif', text: 'M' },
    ]);
  });

  it('falls back to the glyph box where a browser reports no font box', async () => {
    stubCanvas(text => ({
      width: PROBE_WIDTHS[text] ?? 9,
      actualBoundingBoxAscent: 9,
      actualBoundingBoxDescent: 1,
    }));
    const { measureFont } = await freshFont();

    expect(measureFont('14px serif')).toEqual({
      ascent: 9,
      descent: 1,
      maxAdvance: 13,
    });
  });

  it('answers zeros it does not keep when the canvas reports no box at all', async () => {
    stubCanvas(() => ({ width: 10 }));
    const { measureFont } = await freshFont();

    expect(measureFont('14px serif')).toEqual({
      ascent: 0,
      descent: 0,
      maxAdvance: 0,
    });
    expect(prepare).not.toHaveBeenCalled();

    stubCanvas(fontBox);

    expect(measureFont('14px serif').ascent).toBe(12);
  });

  it('answers zeros in a realm with no document, and measures once one exists', async () => {
    vi.stubGlobal('document', undefined);
    const { measureFont } = await freshFont();

    expect(measureFont('14px serif').maxAdvance).toBe(0);

    stubCanvas(fontBox);

    expect(measureFont('14px serif').maxAdvance).toBe(13);
  });

  it('answers zeros where the canvas gives no 2d context', async () => {
    // happy-dom's own canvas answers null without a canvas adapter, as a
    // browser does once it has no context left to hand out.
    const { measureFont } = await freshFont();

    expect(measureFont('14px serif')).toEqual({
      ascent: 0,
      descent: 0,
      maxAdvance: 0,
    });
  });
});
