// What the fitter decides around pretext: what it measures, keeps, spends per
// frame and cuts. pretext stands in as ten pixels a character, since happy-dom
// has no canvas; text.browser.test.ts runs the real engine and faces.

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTextFitter,
  ELLIPSIS,
  MISS_BUDGET,
  normalizeCellText,
} from '@/model/text';

const pretext = vi.hoisted(() => {
  type Prepared = { text: string; font: string; segments: string[] };
  const CHAR_WIDTH = 10;

  return {
    CHAR_WIDTH,
    prepareWithSegments: vi.fn((text: string, font: string): Prepared => ({
      text,
      font,
      segments: [text],
    })),
    prepare: vi.fn(),
    clearCache: vi.fn(),
    measureNaturalWidth: vi.fn(
      (prepared: Prepared) => prepared.text.length * CHAR_WIDTH
    ),
    layoutNextLine: vi.fn(
      (
        prepared: Prepared,
        start: { segmentIndex: number; graphemeIndex: number },
        maxWidth: number
      ) => {
        const text = prepared.text.slice(0, Math.floor(maxWidth / CHAR_WIDTH));
        return { text, width: text.length * CHAR_WIDTH, start, end: start };
      }
    ),
  };
});

vi.mock('@chenglou/pretext', () => pretext);

const FONT = '13px sans-serif';

/** Twice the stand-in's advance, so a text of half the box or less is never measured. */
const MAX_ADVANCE = 20;

const WIDTH = 100;

/** The texts pretext was asked to prepare, the ellipsis included. */
const prepared = () =>
  pretext.prepareWithSegments.mock.calls.map(([text]) => text);

/** The prepared texts that were cells, which is what the budget and the cache count. */
const measuredCells = () => prepared().filter(text => text !== ELLIPSIS);

beforeEach(() => {
  pretext.prepareWithSegments.mockClear();
  pretext.measureNaturalWidth.mockClear();
  pretext.layoutNextLine.mockClear();
});

function startedFitter(capacity?: number) {
  const fitter = createTextFitter(capacity);
  fitter.beginFrame(FONT, MAX_ADVANCE);
  return fitter;
}

describe('normalizeCellText', () => {
  it('turns each tab, line feed, form feed and carriage return into one space', () => {
    expect(normalizeCellText('a\t\tb\r\nc\fd\ne')).toBe('a  b  c d e');
  });

  it('hands back the very string when there is nothing to replace', () => {
    const text = 'plain text';

    expect(normalizeCellText(text)).toBe(text);
  });

  it('leaves the spaces a canvas draws as themselves', () => {
    const text = 'a b　c\u000bd';

    expect(normalizeCellText(text)).toBe(text);
  });
});

describe('the bound a text fits under unmeasured', () => {
  it('draws a text before any frame begins without measuring it', () => {
    const fitter = createTextFitter();

    expect(fitter.fit('a long text no frame has bound a font for', WIDTH)).toBe(
      'a long text no frame has bound a font for'
    );
    expect(prepared()).toEqual([]);
  });

  it('draws a text whose length times the max advance fits as it is', () => {
    const fitter = startedFitter();

    expect(fitter.fit('abcde', WIDTH)).toBe('abcde');
    expect(prepared()).toEqual([]);
  });

  it('measures a text one character past the bound, in pre-wrap', () => {
    const fitter = startedFitter();

    expect(fitter.fit('abcdef', WIDTH)).toBe('abcdef');
    expect(pretext.prepareWithSegments).toHaveBeenCalledExactlyOnceWith(
      'abcdef',
      FONT,
      { whiteSpace: 'pre-wrap' }
    );
  });

  it('measures and draws the normalized string', () => {
    const fitter = startedFitter();

    expect(fitter.fit('ab\tcdefgh', WIDTH)).toBe('ab cdefgh');
    expect(prepared()).toEqual(['ab cdefgh']);
  });

  it('draws nothing in a content box with no width', () => {
    const fitter = startedFitter();

    expect(fitter.fit('abcdef', 0)).toBe('');
    expect(prepared()).toEqual([]);
  });
});

describe('the cut of a text wider than its cell', () => {
  it('keeps the first line that leaves room for the ellipsis', () => {
    const fitter = startedFitter();

    expect(fitter.fit('abcdefghijklmno', WIDTH)).toBe(`abcdefghi${ELLIPSIS}`);
    expect(pretext.layoutNextLine).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: 'abcdefghijklmno' }),
      { segmentIndex: 0, graphemeIndex: 0 },
      WIDTH - pretext.CHAR_WIDTH
    );
  });

  it('drops the spaces the line ends on before the ellipsis', () => {
    const fitter = startedFitter();

    expect(fitter.fit('abcdefg  hijklmn', WIDTH)).toBe(`abcdefg${ELLIPSIS}`);
  });

  it('draws the ellipsis alone where it leaves no room for text', () => {
    const fitter = startedFitter();

    expect(fitter.fit('ab', 8)).toBe(ELLIPSIS);
    expect(pretext.layoutNextLine).not.toHaveBeenCalled();
  });

  it('measures the ellipsis once per font', () => {
    const fitter = startedFitter();

    fitter.fit('abcdefghijklmno', WIDTH);
    fitter.fit('pqrstuvwxyzabcd', WIDTH);
    fitter.beginFrame('20px serif', MAX_ADVANCE);
    fitter.fit('abcdefghijklmno', WIDTH);

    expect(
      pretext.prepareWithSegments.mock.calls
        .filter(([text]) => text === ELLIPSIS)
        .map(([, font]) => font)
    ).toEqual([FONT, '20px serif']);
  });

  it('keeps the last cut and cuts again only for another width', () => {
    const fitter = startedFitter();

    fitter.fit('abcdefghijklmno', WIDTH);
    fitter.fit('abcdefghijklmno', WIDTH);

    expect(pretext.layoutNextLine).toHaveBeenCalledTimes(1);
    expect(fitter.fit('abcdefghijklmno', 120)).toBe(`abcdefghijk${ELLIPSIS}`);
    expect(pretext.layoutNextLine).toHaveBeenCalledTimes(2);
  });

  it('shows the whole text again once the column is wide enough, without measuring it', () => {
    const fitter = startedFitter();

    fitter.fit('abcdefghijklmno', WIDTH);

    expect(fitter.fit('abcdefghijklmno', 150)).toBe('abcdefghijklmno');
    expect(measuredCells()).toEqual(['abcdefghijklmno']);
  });

  it('measures again a text that fit once its column narrows past it', () => {
    const fitter = startedFitter();

    expect(fitter.fit('abcdefgh', WIDTH)).toBe('abcdefgh');
    expect(fitter.fit('abcdefgh', 60)).toBe(`abcde${ELLIPSIS}`);
    expect(measuredCells()).toEqual(['abcdefgh', 'abcdefgh']);
  });
});

describe('the miss budget of a frame', () => {
  const cells = (count: number, from = 0) =>
    Array.from(
      { length: count },
      (_, i) => `c${String(from + i).padStart(5, '0')}`
    );

  it(`measures ${MISS_BUDGET} texts and draws the next whole, asking for another frame`, () => {
    const fitter = startedFitter();
    cells(MISS_BUDGET).forEach(text => fitter.fit(text, WIDTH));

    expect(fitter.hasDeferred()).toBe(false);
    expect(fitter.fit('abcdefghijklmno', WIDTH)).toBe('abcdefghijklmno');
    expect(fitter.hasDeferred()).toBe(true);
    expect(measuredCells()).toHaveLength(MISS_BUDGET);
  });

  it('refills on the next frame, which measures and cuts what the last one drew whole', () => {
    const fitter = startedFitter();
    cells(MISS_BUDGET).forEach(text => fitter.fit(text, WIDTH));
    fitter.fit('abcdefghijklmno', WIDTH);

    fitter.beginFrame(FONT, MAX_ADVANCE);

    expect(fitter.hasDeferred()).toBe(false);
    expect(fitter.fit('abcdefghijklmno', WIDTH)).toBe(`abcdefghi${ELLIPSIS}`);
    expect(fitter.hasDeferred()).toBe(false);
  });

  it('spends nothing on a text the cache holds', () => {
    const fitter = startedFitter();
    cells(MISS_BUDGET).forEach(text => fitter.fit(text, WIDTH));

    fitter.beginFrame(FONT, MAX_ADVANCE);
    cells(MISS_BUDGET).forEach(text => fitter.fit(text, WIDTH));
    cells(MISS_BUDGET, MISS_BUDGET).forEach(text => fitter.fit(text, WIDTH));

    expect(fitter.hasDeferred()).toBe(false);
    expect(measuredCells()).toHaveLength(MISS_BUDGET * 2);
  });
});

describe('the measure cache', () => {
  it('keeps what it measured across frames in the same font', () => {
    const fitter = startedFitter();
    fitter.fit('abcdefgh', WIDTH);

    fitter.beginFrame(FONT, MAX_ADVANCE);
    fitter.fit('abcdefgh', WIDTH);

    expect(measuredCells()).toEqual(['abcdefgh']);
  });

  it('empties when the font changes, so a font changed back measures again', () => {
    const fitter = startedFitter();
    fitter.fit('abcdefgh', WIDTH);

    fitter.beginFrame('20px serif', MAX_ADVANCE);
    fitter.fit('abcdefgh', WIDTH);
    fitter.beginFrame(FONT, MAX_ADVANCE);
    fitter.fit('abcdefgh', WIDTH);

    expect(
      pretext.prepareWithSegments.mock.calls.map(([, font]) => font)
    ).toEqual([FONT, '20px serif', FONT]);
  });

  it('drops the text read longest ago once it is full', () => {
    const fitter = startedFitter(2);

    fitter.fit('first111', WIDTH);
    fitter.fit('second22', WIDTH);
    fitter.fit('first111', WIDTH);
    fitter.fit('third333', WIDTH);
    fitter.fit('first111', WIDTH);
    fitter.fit('second22', WIDTH);

    expect(measuredCells()).toEqual([
      'first111',
      'second22',
      'third333',
      'second22',
    ]);
  });

  it('grows to four times the visible cells a reserve names, and never shrinks', () => {
    const fitter = startedFitter(2);
    const texts = Array.from({ length: 12 }, (_, i) => `text${i}`.padEnd(8));

    fitter.reserve(3);
    fitter.reserve(1);
    texts.forEach(text => fitter.fit(text, WIDTH));
    texts.forEach(text => fitter.fit(text, WIDTH));

    expect(measuredCells()).toHaveLength(12);

    fitter.fit('thirteen', WIDTH);
    fitter.fit(texts[0], WIDTH);

    expect(measuredCells()).toHaveLength(14);
  });
});
