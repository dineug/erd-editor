// The fitter on pretext and the real faces in Chromium: a cut text drawn by
// the canvas stays inside its content box, a wide enough column shows the
// whole text, and the unmeasured bound never passes a text drawn wider.

import { prepareWithSegments } from '@chenglou/pretext';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { ADVANCE_PROBES, DEFAULT_FONT, measureFont } from '@/font';
import { createTextFitter, ELLIPSIS } from '@/model/text';

/** A 120px column less 8px of padding on each side. */
const CONTENT_WIDTH = 104;

/** Written out because a comment cannot show the characters they name. */
const LINE_FEED = String.fromCharCode(10);

const TAB = String.fromCharCode(9);

/**
 * Texts too wide for the box, in the scripts a cell holds. None carries an
 * emoji: pretext narrows an emoji to its DOM width, which a canvas draws
 * wider, and the column clip is what bounds that difference.
 */
const SAMPLES = [
  'the quick brown fox jumps over the lazy dog',
  '데이터베이스 테이블의 컬럼 이름이 길어서 셀을 넘친다',
  'ハローワールド、これは日本語のテキストです',
  '漢字が続くと一文字ずつ折り返せる長い文章',
  'SELECT id, email FROM users WHERE id = 42',
  'supercalifragilisticexpialidocious',
  '12345678901234567890123456789',
  'مرحبا بالعالم هذا نص طويل جدا',
];

const metrics = measureFont(DEFAULT_FONT);

const context = (() => {
  const created = document.createElement('canvas').getContext('2d');
  if (!created) throw new Error('Chromium handed out no 2d context');
  created.font = DEFAULT_FONT;
  return created;
})();

const drawnWidth = (text: string) => context.measureText(text).width;

function startedFitter() {
  const fitter = createTextFitter();
  fitter.beginFrame(DEFAULT_FONT, metrics.maxAdvance);
  return fitter;
}

describe('a text wider than its cell', () => {
  it.each(SAMPLES)('cuts %s to a head and an ellipsis inside the box', text => {
    const fitted = startedFitter().fit(text, CONTENT_WIDTH);
    const head = fitted.slice(0, -ELLIPSIS.length);

    expect(fitted.endsWith(ELLIPSIS)).toBe(true);
    expect(head.length).toBeGreaterThan(0);
    expect(text.startsWith(head)).toBe(true);
    expect(head.endsWith(' ')).toBe(false);
    // Half a pixel for the kerning between the last glyph and the ellipsis,
    // which pretext measures apart and a canvas draws together.
    expect(drawnWidth(fitted)).toBeLessThanOrEqual(CONTENT_WIDTH + 0.5);
  });

  it.each(SAMPLES)('shows %s whole once its column takes its width', text => {
    const fitter = startedFitter();
    fitter.fit(text, CONTENT_WIDTH);

    expect(fitter.fit(text, Math.ceil(drawnWidth(text)) + 1)).toBe(text);
  });

  it('cuts a word longer than the cell inside the word', () => {
    const fitted = startedFitter().fit(SAMPLES[5], CONTENT_WIDTH);

    expect(fitted.length).toBeGreaterThan(2);
    expect(fitted.length).toBeLessThan(SAMPLES[5].length);
  });

  it('cuts a text carrying an emoji the same way', () => {
    const text = `release notes 😀 shipped to everyone today`;
    const fitted = startedFitter().fit(text, CONTENT_WIDTH);

    expect(fitted.endsWith(ELLIPSIS)).toBe(true);
    expect(text.startsWith(fitted.slice(0, -ELLIPSIS.length))).toBe(true);
  });
});

describe('the spaces a cell draws', () => {
  it('measures a run of spaces as drawn, so it can push the text out', () => {
    // Collapsed, the run would measure one space wide and the text would fit.
    const text = `a${' '.repeat(30)}b`;

    expect(drawnWidth('a b')).toBeLessThan(60);
    expect(startedFitter().fit(text, 60)).toBe(`a${ELLIPSIS}`);
  });

  it('draws a line break and a tab as spaces, on the one line', () => {
    // Kept as a line break, it would end the first line at ab.
    const text = `ab${LINE_FEED}cd${TAB}ef ghijklmnopqrstuvwxyz`;
    const fitter = startedFitter();

    expect(fitter.fit(text, 1000)).toBe('ab cd ef ghijklmnopqrstuvwxyz');
    expect(fitter.fit(text, CONTENT_WIDTH)).toBe(`ab cd ef${ELLIPSIS}`);
  });
});

describe('the bound a text fits under unmeasured', () => {
  it.each(ADVANCE_PROBES)('holds for runs of %s', probe => {
    for (let count = 1; count <= 8; count++) {
      const text = probe.repeat(count);

      expect(drawnWidth(text)).toBeLessThanOrEqual(
        text.length * metrics.maxAdvance
      );
    }
  });

  it('holds for mixed text a cell holds', () => {
    for (const text of [...SAMPLES, 'Wg가漢😀 mixed', 'MMMMWWWW']) {
      expect(drawnWidth(text)).toBeLessThanOrEqual(
        text.length * metrics.maxAdvance
      );
    }
  });
});

describe('pretext’s own caches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Whether pretext measures a segment it was handed before with the canvas again, as it does once its caches are emptied. */
  function measuresAgain(segment: string) {
    const measureText = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'measureText'
    );
    prepareWithSegments(segment, DEFAULT_FONT);
    const again = measureText.mock.calls.some(([text]) => text === segment);
    measureText.mockRestore();

    return again;
  }

  it('are kept under a fitter’s bound and emptied once its texts outgrow it', () => {
    // A cache of one entry bounds pretext at sixteen segments, and one of
    // four thousand at sixty-five thousand, which these texts never reach.
    const small = createTextFitter(1);
    const large = createTextFitter(4096);
    small.beginFrame(DEFAULT_FONT, metrics.maxAdvance);
    large.beginFrame(DEFAULT_FONT, metrics.maxAdvance);
    small.trim();

    small.fit('zqxvw kept segment probe', CONTENT_WIDTH);
    large.trim();
    expect(measuresAgain('zqxvw')).toBe(false);

    for (let index = 0; index < 20; index++) {
      small.fit(`a distinct value ${index}`, CONTENT_WIDTH);
    }
    large.trim();
    expect(measuresAgain('zqxvw')).toBe(false);
    small.trim();
    expect(measuresAgain('zqxvw')).toBe(true);
  });

  it('keep the fitter’s own cuts, which need no measure once emptied', () => {
    const fitter = createTextFitter(1);
    fitter.beginFrame(DEFAULT_FONT, metrics.maxAdvance);
    const text = SAMPLES[0];
    const cut = fitter.fit(text, CONTENT_WIDTH);

    for (let index = 0; index < 20; index++) {
      fitter.fit(`a distinct value ${index}`, CONTENT_WIDTH);
    }
    fitter.trim();
    fitter.beginFrame(DEFAULT_FONT, metrics.maxAdvance);

    expect(fitter.fit(text, CONTENT_WIDTH - 40)).not.toBe(cut);
    expect(fitter.fit(text, CONTENT_WIDTH)).toBe(cut);
    expect(fitter.hasDeferred()).toBe(false);
  });
});
