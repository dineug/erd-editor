import {
  getMemoLineHeightPx,
  layoutMemoLines,
  MEMO_FONT,
} from '@/components/erd/canvas/memo/memoText';

/**
 * How the scene measures a run of body text. Konva draws the glyphs a pointer
 * lands on with a canvas, so the click is read back against that measurement
 * rather than against the layout the textarea over it will take.
 */
function createMeasure(): (text: string) => number {
  const context =
    typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d');
  if (!context) return () => 0;

  context.font = MEMO_FONT;

  return text => context.measureText(text).width;
}

let measure: ((text: string) => number) | null = null;

function widthOf(text: string): number {
  measure ??= createMeasure();

  return measure(text);
}

/**
 * The string a textarea holds for a stored body, which is the space a caret
 * offset indexes. An element normalises every carriage return out of its value,
 * so a document carrying crlf reaches the editor shorter than it is stored.
 */
function editorValueOf(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

/** One drawn body line, and where in the editor's value that line begins. */
type MemoLine = {
  text: string;
  start: number;
};

/**
 * The lines the scene drew, each carrying its offset into the value. A pre-wrap
 * fold keeps every character, so a line's own length is the whole step to the
 * next one and a break the author typed is the single character past it.
 */
function foldOf(value: string, width: number): MemoLine[] {
  const lines: MemoLine[] = [];
  let at = 0;

  for (const text of layoutMemoLines(value, width)) {
    const start = at;
    at += text.length;
    if (value[at] === '\n') at += 1;
    lines.push({ text, start });
  }

  return lines;
}

/**
 * How far into a line a click at x falls, in code units. The space a fold broke
 * at keeps its whole advance and a caret stops behind it, so the search runs to
 * the end of the line rather than to the end of its ink.
 */
function columnOf(line: MemoLine, x: number): number {
  let best = 0;
  let gap = Math.abs(x);
  let prefix = '';

  for (const char of Array.from(line.text)) {
    prefix += char;
    const distance = Math.abs(x - widthOf(prefix));
    if (distance > gap) break;

    best = prefix.length;
    gap = distance;
  }

  return best;
}

/**
 * The offset in a memo's editor value that a point in its drawn body falls on,
 * in the body's own coordinates. Past the last line box a textarea takes the
 * end of the value whatever x is, which is where an author carries on writing.
 *
 * @example
 * const offset = memoCaretOffsetAt(memo.value, memo.ui.width, 12, 40);
 */
export function memoCaretOffsetAt(
  value: string,
  width: number,
  x: number,
  y: number
): number {
  const text = editorValueOf(value);
  const lines = foldOf(text, width);
  if (!lines.length) return 0;

  const index = Math.max(0, Math.floor(y / getMemoLineHeightPx()));
  if (index >= lines.length) return text.length;

  const line = lines[index];

  return line.start + columnOf(line, x);
}

type MemoCaret = {
  memoId: string;
  offset: number;
};

let requested: MemoCaret | null = null;

/**
 * Asks the next body editor for this memo to open with its caret here. The
 * editor is a textarea the click itself mounts, so the point the pointer landed
 * on is gone by the time it exists and has to be carried across.
 *
 * @example
 * requestMemoCaret(memo.id, memoCaretOffsetAt(memo.value, width, x, y));
 */
export function requestMemoCaret(memoId: string, offset: number) {
  requested = { memoId, offset };
}

/**
 * The caret asked for, taken once. Anything the pointer did not open, and any
 * request left over from another memo, opens the body at its start instead.
 *
 * @example
 * const offset = takeMemoCaret(target.memoId);
 */
export function takeMemoCaret(memoId: string): number {
  const caret = requested;
  requested = null;

  return caret?.memoId === memoId ? caret.offset : 0;
}
