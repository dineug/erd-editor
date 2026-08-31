// AC-G20 (3): the lines the scene draws a memo body in are the lines a textarea
// of the same box shows. The comparison is against real line boxes measured
// with a Range, not against a second copy of the same line breaker.

import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  layoutMemoLines,
  MEMO_FONT,
  MEMO_FONT_WEIGHT,
  MEMO_LINE_HEIGHT,
  MEMO_LINE_HEIGHT_PX,
} from '@/components/erd/canvas/memo/memoText';
import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';

/** Written out because a comment cannot show the character it names. */
const LINE_BREAK = String.fromCharCode(10);

const WIDTHS = [120, 200, 272];

/**
 * Bodies with no token longer than the box. This is what a memo holds, and it
 * is the set the drawn scene and the editor have to agree on exactly.
 */
const PROSE = [
  'the quick brown fox jumps over the lazy dog and it does so once more',
  '메모 본문 편집을 되살린다. 여러 줄 레이아웃은 pretext가 계산하고, 텍스트 영역을 클릭하면 오버레이가 뜬다.',
  'ハローワールド、これは日本語のテキストです。折り返しを確認します。',
  'CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) NOT NULL);',
  'a short line then supercalifragilisticexpialidociousandthensome end',
  '   leading and trailing   ',
  'one' + LINE_BREAK + 'two' + LINE_BREAK + 'three',
];

const mirrors: HTMLElement[] = [];

afterEach(() => {
  mirrors.splice(0).forEach(mirror => mirror.remove());
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
    lineHeight: `${MEMO_LINE_HEIGHT_PX}px`,
    letterSpacing: '0em',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  document.body.append(mirror);
  mirrors.push(mirror);

  return mirror;
}

/**
 * The line boxes the browser folds a value into, read one character at a time
 * off a Range. A character that starts a new box opens the next line, which is
 * the same boundary a caret would move across.
 */
function domLines(value: string, width: number): string[] {
  const mirror = createMirror(width);
  mirror.textContent = value;
  const node = mirror.firstChild;
  if (!node) return [];

  const range = document.createRange();
  const lines: string[] = [];
  let start = 0;
  let top: number | null = null;

  for (let i = 0; i < value.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const [rect] = Array.from(range.getClientRects());
    const at: number | null = rect ? Math.round(rect.top) : top;
    if (top === null) top = at;

    if (at !== null && top !== null && at > top) {
      // A newline the author typed belongs to the line it ended, and the
      // browser hands it back inside the slice rather than dropping it.
      lines.push(value.slice(start, i).replace(/\n$/, ''));
      start = i;
      top = at;
    }
  }
  lines.push(value.slice(start).replace(/\n$/, ''));

  return lines;
}

describe('the memo body line breaker', () => {
  it('spells the font canvas and css both resolve to', () => {
    expect(MEMO_FONT).toBe(`400 12px ${SCENE_FONT_FAMILY}`);
    expect(MEMO_LINE_HEIGHT_PX).toBe(SCENE_FONT_SIZE * MEMO_LINE_HEIGHT);
  });

  it.each(WIDTHS)('folds prose exactly as a textarea does at %ipx', width => {
    for (const value of PROSE) {
      expect(layoutMemoLines(value, width)).toEqual(domLines(value, width));
    }
  });

  it('loses no character to a soft wrap', () => {
    for (const width of WIDTHS) {
      for (const value of PROSE.filter(item => !item.includes(LINE_BREAK))) {
        expect(layoutMemoLines(value, width).join('')).toBe(value);
      }
    }
  });

  it('keeps a hard break as a break rather than as a character', () => {
    const value = 'one' + LINE_BREAK + 'two' + LINE_BREAK + 'three';

    expect(layoutMemoLines(value, 200)).toEqual(['one', 'two', 'three']);
    expect(layoutMemoLines(value, 200).join(LINE_BREAK)).toBe(value);
  });

  it('folds an empty body into nothing to draw', () => {
    expect(layoutMemoLines('', 200)).toEqual([]);
  });

  it('breaks a token wider than the box rather than letting it run', () => {
    const value = 'https://erd-editor.io/verylongunbreakableurlsegmenthere';
    const lines = layoutMemoLines(value, 120);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(value);
  });

  it('answers the same fold twice without recomputing it', () => {
    const value = 'the quick brown fox jumps over the lazy dog';

    expect(layoutMemoLines(value, 200)).toBe(layoutMemoLines(value, 200));
    expect(layoutMemoLines(value, 200)).not.toBe(layoutMemoLines(value, 120));
  });
});
