// AC-G20 (4): a click on a drawn memo body opens the editor on the glyph the
// pointer was over. The expected offset comes off real line boxes measured with
// a Range, not off a second copy of the mapping under test.

import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  memoCaretOffsetAt,
  requestMemoCaret,
  takeMemoCaret,
} from '@/components/erd/canvas/memo/memoCaret';
import {
  getMemoLineHeightPx,
  layoutMemoLines,
  MEMO_FONT_WEIGHT,
} from '@/components/erd/canvas/memo/memoText';
import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';

/** Written out because a comment cannot show the character it names. */
const LINE_BREAK = String.fromCharCode(10);

const WIDTHS = [120, 220];

const PROSE = [
  'the quick brown fox jumps over the lazy dog and it does so once more',
  '메모 본문 편집을 되살린다. 클릭한 자리에 캐럿이 서야 한다.',
  'one' + LINE_BREAK + 'two' + LINE_BREAK + 'three',
  'a short line then supercalifragilisticexpialidociousandthensome end',
];

/**
 * How far into a character the pointer lands. A quarter is nearer that
 * character's own edge than the next one by half its width, which is wider than
 * anything the scene and the editor disagree about.
 */
const INTO_CHARACTER = 0.25;

const mirrors: HTMLElement[] = [];

afterEach(() => {
  mirrors.splice(0).forEach(mirror => mirror.remove());
  takeMemoCaret('');
});

/** A box laid out exactly as the overlay textarea is, off the visible page. */
function createMirror(width: number): HTMLElement {
  const mirror = document.createElement('div');
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '-10000px',
    left: '0',
    width: `${width}px`,
    margin: '0',
    padding: '0',
    border: '0',
    fontFamily: SCENE_FONT_FAMILY,
    fontSize: `${SCENE_FONT_SIZE}px`,
    fontWeight: MEMO_FONT_WEIGHT,
    lineHeight: `${getMemoLineHeightPx()}px`,
    letterSpacing: '0em',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  document.body.append(mirror);
  mirrors.push(mirror);

  return mirror;
}

type Hit = {
  index: number;
  x: number;
  y: number;
};

/**
 * A point inside every character of a body, in the body's own coordinates. A
 * space is left out because a fold hangs the one it broke at past the edge, and
 * no caret ever stops on the far side of it.
 */
function hitsOf(value: string, width: number): Hit[] {
  const mirror = createMirror(width);
  mirror.textContent = value;
  const node = mirror.firstChild;
  if (!node) return [];

  const origin = mirror.getBoundingClientRect();
  const range = document.createRange();
  const hits: Hit[] = [];

  for (let index = 0; index < value.length; index++) {
    if (/\s/.test(value[index])) continue;

    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const rects = Array.from(range.getClientRects());
    if (rects.length !== 1) continue;

    const [rect] = rects;
    hits.push({
      index,
      x: rect.left - origin.left + rect.width * INTO_CHARACTER,
      y: rect.top - origin.top + rect.height / 2,
    });
  }

  return hits;
}

describe('the offset a click on a drawn memo body falls on', () => {
  it.each(WIDTHS)(
    'lands on the character the pointer is over at %ipx',
    width => {
      for (const value of PROSE) {
        const hits = hitsOf(value, width);
        expect(hits.length, `${value} has characters to hit`).toBeGreaterThan(
          0
        );

        for (const hit of hits) {
          expect(
            memoCaretOffsetAt(value, width, hit.x, hit.y),
            `${JSON.stringify(value.slice(hit.index, hit.index + 1))} at ${width}px`
          ).toBe(hit.index);
        }
      }
    }
  );

  it('opens an empty body at its start', () => {
    expect(memoCaretOffsetAt('', 220, 40, 40)).toBe(0);
  });

  it('holds a point above the body on the first line', () => {
    const value = 'one' + LINE_BREAK + 'two';

    expect(memoCaretOffsetAt(value, 220, 0, -400)).toBe(0);
  });

  it('stops at the end of the line a point reaches past', () => {
    const value = 'one' + LINE_BREAK + 'two';
    const leading = getMemoLineHeightPx();

    expect(memoCaretOffsetAt(value, 220, 999, leading / 2)).toBe(3);
  });

  it('stops behind the space a fold broke at', () => {
    const value = 'the quick brown fox jumps over the lazy dog once more';
    const [first] = layoutMemoLines(value, 120);
    const leading = getMemoLineHeightPx();

    expect(first.endsWith(' ')).toBe(true);
    expect(memoCaretOffsetAt(value, 120, 119, leading / 2)).toBe(first.length);
  });

  it('opens a line at its start on the left edge of the body', () => {
    const value = 'the quick brown fox jumps over the lazy dog once more';
    const lines = layoutMemoLines(value, 120);
    const leading = getMemoLineHeightPx();
    let start = 0;

    lines.forEach((line, index) => {
      expect(
        memoCaretOffsetAt(value, 120, 0, index * leading + 1),
        `line ${index} left edge`
      ).toBe(start);
      start += line.length;
    });
  });
});

/**
 * What a textarea does with a click no glyph is under, which is where an author
 * presses to carry on writing. The offsets are the ones blink itself answers
 * with, read off a real textarea by the memo-editor-alignment e2e suite.
 */
describe('a point past the last line a memo body drew', () => {
  const BELOW: Array<[string, number]> = [
    ['hello', 5],
    ['first line here' + LINE_BREAK + 'second line here', 32],
    ['첫째 줄 한글입니다' + LINE_BREAK + '둘째 줄 한글입니다', 21],
    [['alpha', 'beta', 'gamma', 'delta'].join(LINE_BREAK), 22],
  ];

  it.each(BELOW)('takes the end of %j whatever x is', (value, end) => {
    for (const x of [0, 1, 40, 110, 219, 999]) {
      for (const y of [200, 320, 999]) {
        expect(memoCaretOffsetAt(value, 220, x, y), `x ${x} y ${y}`).toBe(end);
      }
    }
  });

  it('takes the end from the bottom of the last line box down', () => {
    const value = ['alpha', 'beta', 'gamma', 'delta'].join(LINE_BREAK);
    const leading = getMemoLineHeightPx();

    expect(memoCaretOffsetAt(value, 220, 0, leading * 4 - 0.5)).toBe(17);
    expect(memoCaretOffsetAt(value, 220, 0, leading * 4)).toBe(value.length);
  });

  it('takes the end of a body the author left a trailing break on', () => {
    const value = 'alpha' + LINE_BREAK;

    expect(memoCaretOffsetAt(value, 220, 0, 999)).toBe(value.length);
  });
});

/**
 * A body stored with carriage returns, which a textarea drops on the way in. A
 * caret offset indexes the value the element holds, so the mapping counts in
 * that shorter string rather than in the one the document carries.
 */
describe('a memo body stored with carriage returns', () => {
  const CARRIAGE_RETURN = String.fromCharCode(13);
  const CRLF = CARRIAGE_RETURN + LINE_BREAK;
  const STORED = ['alpha', 'bravo', 'charlie'].join(CRLF);
  const HELD = ['alpha', 'bravo', 'charlie'].join(LINE_BREAK);

  it('folds the stored body into the lines the editor holds', () => {
    expect(STORED.length).toBe(21);
    expect(HELD.length).toBe(19);
    expect(layoutMemoLines(STORED, 220)).toEqual(layoutMemoLines(HELD, 220));
  });

  it('counts a line start in the value the editor holds', () => {
    const leading = getMemoLineHeightPx();

    expect(memoCaretOffsetAt(STORED, 220, 0, leading + 1)).toBe(6);
    expect(memoCaretOffsetAt(STORED, 220, 0, leading * 2 + 1)).toBe(12);
  });

  it('takes the end of the value the editor holds', () => {
    expect(memoCaretOffsetAt(STORED, 220, 40, 999)).toBe(19);
  });

  it('counts a lone carriage return as the break it is drawn as', () => {
    const lone = ['alpha', 'bravo'].join(CARRIAGE_RETURN);
    const leading = getMemoLineHeightPx();

    expect(memoCaretOffsetAt(lone, 220, 0, leading + 1)).toBe(6);
  });
});

describe('the caret a memo body editor opens on', () => {
  it('hands the requested offset to the memo it was asked for', () => {
    requestMemoCaret('note', 12);

    expect(takeMemoCaret('note')).toBe(12);
  });

  it('hands it over once', () => {
    requestMemoCaret('note', 12);
    takeMemoCaret('note');

    expect(takeMemoCaret('note')).toBe(0);
  });

  it('opens another memo at its start rather than on a stale request', () => {
    requestMemoCaret('note', 12);

    expect(takeMemoCaret('other')).toBe(0);
  });

  it('opens at the start when nothing asked for a caret', () => {
    expect(takeMemoCaret('note')).toBe(0);
  });
});
