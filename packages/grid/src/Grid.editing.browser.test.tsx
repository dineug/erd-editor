// Editing in real Chromium: the focus textarea as the editor over its cell,
// what ends an edit, a composition through Chrome's own IME, Delete, the
// clipboard and a column's own editor in the slot.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { cdp, page, userEvent } from 'vite-plus/test/browser/context';

import {
  cellBox,
  cellPoint,
  centreOf,
  cleanup,
  COLUMNS,
  geometry,
  key,
  lastSelection,
  MOD,
  mount,
  mouse,
  type Point,
  pointer,
  press,
  range,
  ROW_COUNT,
  sizePage,
  teardowns,
  valueOf,
  type View,
  views,
} from '@/__test-utils__/grid';
import { drawn, nextFrame } from '@/__test-utils__/scene';
import { DEFAULT_FONT } from '@/font';
import type { EditorContext, GridColumn } from '@/Grid';
import type { CellChange } from '@/model/editing';
import { lightTheme } from '@/theme';

/** The two Input commands the spec sends, which the provider's session types only under its own config. */
type ImeSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as ImeSession;

/** The syllable an IME is building, shown in the textarea and not yet committed. */
async function compose(text: string) {
  await session().send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await nextFrame();
}

/** The IME finishing the syllable it was building, as the next key does. */
async function finishComposition(text: string) {
  await session().send('Input.insertText', { text });
  await nextFrame();
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where an element sits in the grid container, which is its offset parent. */
const at = (element: HTMLElement): Box => ({
  x: element.offsetLeft,
  y: element.offsetTop,
  width: element.offsetWidth,
  height: element.offsetHeight,
});

/** What the active cell's 2px edge leaves of a cell, where the grid's own editor sits. */
const inner = (box: Box): Box => ({
  x: box.x + 1,
  y: box.y + 1,
  width: box.width - 3,
  height: box.height - 3,
});

/** The bounds of the dark pixels a screenshot of the grid shows inside an area of it, in its CSS pixels. */
async function inkOf(view: View, area: Box) {
  const base64 = await page.screenshot({
    element: view.container,
    save: false,
  });
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: 'image/png' })
  );
  const scale = bitmap.width / view.container.clientWidth;
  const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
    '2d'
  )!;
  context.drawImage(bitmap, 0, 0);

  const { data, width, height } = context.getImageData(
    Math.round(area.x * scale),
    Math.round(area.y * scale),
    Math.round(area.width * scale),
    Math.round(area.height * scale)
  );
  const ink = { left: width, top: height, right: -1, bottom: -1 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      if (data[pixel] + data[pixel + 1] + data[pixel + 2] >= 384) continue;

      ink.left = Math.min(ink.left, x);
      ink.top = Math.min(ink.top, y);
      ink.right = Math.max(ink.right, x);
      ink.bottom = Math.max(ink.bottom, y);
    }
  }

  return {
    left: ink.left / scale,
    top: ink.top / scale,
    right: ink.right / scale,
    bottom: ink.bottom / scale,
  };
}

/** The family a font shorthand names, as a computed style spells it. */
function fontFamilyOf(font: string) {
  const probe = document.createElement('div');
  probe.style.font = font;
  document.body.append(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();

  return family;
}

const shown = (element: HTMLElement) =>
  getComputedStyle(element).opacity === '1';

/** Whether the focus textarea is the open editor: visible and taking the pointer. */
const editorOpen = (view: View) =>
  shown(view.textarea) &&
  getComputedStyle(view.textarea).pointerEvents === 'auto';

/** The four sides of an inset() clip, top, right, bottom and left, its shorthand spelled out. */
function insetOf(element: HTMLElement): number[] | null {
  const match = /^inset\(([^)]*)\)$/.exec(getComputedStyle(element).clipPath);
  if (!match) return null;

  const [top, right = top, bottom = top, left = right] = match[1]
    .trim()
    .split(/\s+/)
    .map(parseFloat);
  return [top, right, bottom, left];
}

/** One change of the commit event, the column id read off the column. */
const change = (row: number, col: number, value: string): CellChange => ({
  row,
  col,
  columnId: `c${col}`,
  value,
});

const lastCommit = (view: View) => view.onCommit.mock.lastCall?.[0];

function clipboardEvent(
  view: View,
  type: 'copy' | 'paste',
  data = new DataTransfer()
) {
  const event = new ClipboardEvent(type, {
    clipboardData: data,
    bubbles: true,
    cancelable: true,
    composed: true,
  });

  view.textarea.dispatchEvent(event);
  return { event, data };
}

function paste(view: View, text: string) {
  const data = new DataTransfer();
  data.setData('text/plain', text);

  return clipboardEvent(view, 'paste', data).event;
}

/** Selects a cell with a press and opens the grid's own editor on it with F2. */
async function editAt(view: View, row: number, col: number) {
  press(view, cellPoint(view, row, col));
  view.textarea.focus();
  key(view, 'F2');
  await nextFrame();
}

function dblclick(view: View, point: Point) {
  press(view, point);
  press(view, point);
  mouse(view, 'dblclick', point, { detail: 2 });
}

/** A column set whose column at the index brings the editor given. */
const withEditor = (
  col: number,
  editor: GridColumn['editor'],
  extra: Partial<GridColumn> = {}
): GridColumn[] =>
  COLUMNS.map((column, index) =>
    index === col ? { ...column, ...extra, editor } : column
  );

beforeAll(sizePage);

afterEach(cleanup);

describe('starting an edit', () => {
  it('opens the editor over the cell with its value and font on Enter, F2 and a double click', async () => {
    const view = await mount();
    const { textarea } = view;
    view.textarea.focus();

    press(view, cellPoint(view, 2, 1));
    expect(key(view, 'Enter').defaultPrevented).toBe(true);
    await nextFrame();

    const style = getComputedStyle(textarea);
    expect(textarea.value).toBe(valueOf(2, 1));
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(editorOpen(view)).toBe(true);
    expect(at(textarea)).toEqual(inner(cellBox(view, 2, 1)));
    expect(style.fontSize).toBe('13px');
    expect(style.fontFamily).toBe(fontFamilyOf(DEFAULT_FONT));
    expect(style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(style.color).toBe('rgb(31, 31, 31)');
    expect(style.paddingLeft).toBe('7px');
    expect(
      parseFloat(style.paddingTop) + parseFloat(style.lineHeight)
    ).toBeLessThanOrEqual(at(textarea).height);
    expect(style.clipPath).toBe('none');
    expect(document.activeElement).toBe(textarea);

    expect(key(view, 'Escape').defaultPrevented).toBe(true);
    await nextFrame();
    expect(editorOpen(view)).toBe(false);
    expect(textarea.value).toBe('');

    press(view, cellPoint(view, 3, 2));
    expect(key(view, 'F2').defaultPrevented).toBe(true);
    await nextFrame();
    expect(textarea.value).toBe(valueOf(3, 2));
    expect(at(textarea)).toEqual(inner(cellBox(view, 3, 2)));
    key(view, 'Escape');

    dblclick(view, cellPoint(view, 4, 3));
    await nextFrame();
    expect(textarea.value).toBe(valueOf(4, 3));
    expect(at(textarea)).toEqual(inner(cellBox(view, 4, 3)));
    expect(editorOpen(view)).toBe(true);
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('scrolls a value longer than its cell to the caret at its end, on Enter, F2 and a double click', async () => {
    const long = 'a value far longer than one column of the grid holds';
    const view = await mount({
      getCell: (row, col) => (col === 1 ? `${long} ${row}` : valueOf(row, col)),
    });
    const { textarea } = view;
    const atEnd = () =>
      textarea.scrollLeft > 0 &&
      textarea.scrollLeft + textarea.clientWidth >= textarea.scrollWidth - 1;

    await editAt(view, 2, 1);
    expect(textarea.value).toBe(`${long} 2`);
    expect(atEnd()).toBe(true);
    key(view, 'Escape');

    press(view, cellPoint(view, 3, 1));
    key(view, 'Enter');
    await nextFrame();
    expect(atEnd()).toBe(true);
    key(view, 'Escape');

    dblclick(view, cellPoint(view, 4, 1));
    await nextFrame();
    expect(textarea.value).toBe(`${long} 4`);
    expect(atEnd()).toBe(true);
  });

  it('paints the editor in the colours the style hook gives the cell', async () => {
    const view = await mount({
      getCellStyle: (row, col) =>
        row === 1 && col === 1
          ? { background: '#ffeeaa', color: '#aa0000' }
          : undefined,
    });

    await editAt(view, 1, 1);

    const style = getComputedStyle(view.textarea);
    expect(style.backgroundColor).toBe('rgb(255, 238, 170)');
    expect(style.color).toBe('rgb(170, 0, 0)');
    expect(style.caretColor).toBe('rgb(170, 0, 0)');
    expect(lightTheme.background).toBe('#ffffff');
  });

  it('replaces the value with the characters typed on the active cell, the first one kept', async () => {
    const view = await mount();
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();

    await userEvent.keyboard('x');
    await nextFrame();
    expect(view.textarea.value).toBe('x');
    expect(editorOpen(view)).toBe(true);
    expect(at(view.textarea)).toEqual(inner(cellBox(view, 1, 1)));

    await userEvent.keyboard('yz{Enter}');

    expect(view.onCommit).toHaveBeenCalledTimes(1);
    expect(view.onCommit).toHaveBeenCalledWith({
      changes: [change(1, 1, 'xyz')],
      source: 'edit',
    });
    expect(lastSelection(view)?.active).toEqual({ row: 2, col: 1 });
    expect(view.textarea.value).toBe('');
  });

  it('never edits a cell its column or its style makes readonly', async () => {
    const columns = COLUMNS.map((column, index) =>
      index === 1 ? { ...column, readonly: true } : column
    );
    const view = await mount({
      columns,
      getCellStyle: (row, col) =>
        row === 2 && col === 2 ? { readonly: true } : undefined,
    });
    view.textarea.focus();

    for (const [row, col] of [
      [0, 1],
      [2, 2],
    ]) {
      press(view, cellPoint(view, row, col));
      expect(key(view, 'Enter').defaultPrevented).toBe(true);
      key(view, 'F2');
      dblclick(view, cellPoint(view, row, col));
      await userEvent.keyboard('q');
      await nextFrame();

      expect(editorOpen(view)).toBe(false);
      expect(view.textarea.value).toBe('');
    }

    expect(view.onCommit).not.toHaveBeenCalled();
  });
});

describe('ending an edit', () => {
  it('commits on Enter and moves down, on Tab and moves right, Shift turning both back', async () => {
    const view = await mount();

    await editAt(view, 5, 5);
    await userEvent.keyboard('a');
    expect(key(view, 'Enter').defaultPrevented).toBe(true);
    expect(lastCommit(view)).toEqual({
      changes: [change(5, 5, '5:5a')],
      source: 'edit',
    });
    expect(lastSelection(view)?.active).toEqual({ row: 6, col: 5 });

    key(view, 'F2');
    await userEvent.keyboard('b');
    key(view, 'Enter', { shiftKey: true });
    expect(lastCommit(view)?.changes).toEqual([change(6, 5, '6:5b')]);
    expect(lastSelection(view)?.active).toEqual({ row: 5, col: 5 });

    key(view, 'F2');
    await userEvent.keyboard('c');
    expect(key(view, 'Tab').defaultPrevented).toBe(true);
    expect(lastCommit(view)?.changes).toEqual([change(5, 5, '5:5c')]);
    expect(lastSelection(view)?.active).toEqual({ row: 5, col: 6 });

    key(view, 'F2');
    await userEvent.keyboard('d');
    key(view, 'Tab', { shiftKey: true });
    expect(lastCommit(view)?.changes).toEqual([change(5, 6, '5:6d')]);
    expect(lastSelection(view)?.active).toEqual({ row: 5, col: 5 });

    expect(view.onCommit).toHaveBeenCalledTimes(4);
    await nextFrame();
    expect(editorOpen(view)).toBe(false);
  });

  it('sends nothing for an edit that changed nothing, and still moves', async () => {
    const view = await mount();

    await editAt(view, 1, 1);
    key(view, 'Enter');

    expect(view.onCommit).not.toHaveBeenCalled();
    expect(lastSelection(view)?.active).toEqual({ row: 2, col: 1 });
  });

  it('cancels on Escape, sending nothing and keeping the selection', async () => {
    const view = await mount();
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();
    await userEvent.keyboard('hello');
    const selections = view.onSelectionChange.mock.calls.length;

    await userEvent.keyboard('{Escape}');
    await nextFrame();

    expect(view.onCommit).not.toHaveBeenCalled();
    expect(view.onSelectionChange).toHaveBeenCalledTimes(selections);
    expect(editorOpen(view)).toBe(false);
    expect(view.textarea.value).toBe('');
    expect(document.activeElement).toBe(view.textarea);
  });

  it('commits on a press on another cell, then selects that cell', async () => {
    const view = await mount();
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();
    await userEvent.keyboard('new');
    view.onSelectionChange.mockClear();

    await userEvent.click(view.scroller, { position: cellPoint(view, 4, 2) });

    expect(view.onCommit).toHaveBeenCalledTimes(1);
    expect(lastCommit(view)).toEqual({
      changes: [change(1, 1, 'new')],
      source: 'edit',
    });
    expect(view.onSelectionChange).toHaveBeenCalledTimes(1);
    expect(lastSelection(view)?.active).toEqual({ row: 4, col: 2 });
    expect(view.onCommit.mock.invocationCallOrder[0]).toBeLessThan(
      view.onSelectionChange.mock.invocationCallOrder[0]
    );
    await nextFrame();
    expect(editorOpen(view)).toBe(false);
    expect(document.activeElement).toBe(view.textarea);
  });

  it('commits on a press outside the grid, and when the focus moves to another field', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    const view = await mount({}, undefined, outside);

    await editAt(view, 1, 1);
    await userEvent.keyboard('!');
    await userEvent.click(outside);
    expect(lastCommit(view)?.changes).toEqual([change(1, 1, '1:1!')]);
    expect(document.activeElement).toBe(outside);

    await editAt(view, 2, 1);
    await userEvent.keyboard('?');
    outside.focus();
    await nextFrame();
    expect(view.onCommit).toHaveBeenCalledTimes(2);
    expect(lastCommit(view)?.changes).toEqual([change(2, 1, '2:1?')]);
  });

  it('keeps the edit through a press inside the editor, on a scrollbar, and a blur the window caused', async () => {
    const view = await mount();
    await editAt(view, 2, 1);
    const box = at(view.textarea);
    const rect = view.textarea.getBoundingClientRect();

    view.textarea.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        clientX: rect.left + 4,
        clientY: rect.top + 4,
      })
    );
    press(view, centreOf(view, 'grid-vertical-thumb'));
    view.textarea.dispatchEvent(new FocusEvent('blur'));
    await nextFrame();

    expect(view.onCommit).not.toHaveBeenCalled();
    expect(editorOpen(view)).toBe(true);
    expect(at(view.textarea)).toEqual(box);

    const thumb = centreOf(view, 'grid-vertical-thumb');
    press(view, { x: thumb.x, y: thumb.y + 200 });
    await drawn();
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(geometry(view).top).toBeGreaterThan(0);
    expect(view.textarea.value).toBe(valueOf(2, 1));
  });

  it('reads a press inside a closed shadow root as it does one in the document', async () => {
    const reasons: string[] = [];
    const editor = (ctx: EditorContext) => {
      ctx.container.append(document.createElement('input'));
      ctx.onClose(reason => reasons.push(reason));
    };
    const view = await mount(
      { columns: withEditor(2, editor) },
      undefined,
      undefined,
      'closed'
    );
    const pressOn = (target: Element) =>
      target.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, composed: true })
      );

    await editAt(view, 2, 1);
    await userEvent.keyboard('!');
    pressOn(view.textarea);
    press(view, centreOf(view, 'grid-vertical-thumb'));
    await nextFrame();
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(editorOpen(view)).toBe(true);

    pressOn(document.body);
    expect(lastCommit(view)?.changes).toEqual([change(2, 1, '2:1!')]);

    press(view, cellPoint(view, 1, 2));
    key(view, 'Enter');
    pressOn(view.slot.firstElementChild as Element);
    press(view, centreOf(view, 'grid-vertical-thumb'));
    expect(reasons).toEqual([]);

    pressOn(document.body);
    expect(reasons).toEqual(['outside']);
  });

  it('leaves the draft alone when the host raises the version meanwhile', async () => {
    const view = await mount();
    await editAt(view, 1, 1);
    await userEvent.keyboard('!');

    view.props.getCell = () => 'from a peer';
    view.props.version = 1;
    await drawn();

    expect(view.textarea.value).toBe('1:1!');
    key(view, 'Enter');
    expect(lastCommit(view)?.changes).toEqual([change(1, 1, '1:1!')]);
  });

  it('lets go of the document once the grid unmounts with an edit open', async () => {
    const added = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    const view = await mount();
    await editAt(view, 1, 1);
    await userEvent.keyboard('!');
    const [, listener] =
      added.mock.calls.find(
        ([type, , options]) => type === 'pointerdown' && options === true
      ) ?? [];
    expect(listener).toBeTypeOf('function');

    expect(document.activeElement).toBe(view.textarea);
    view.unmount();
    views.splice(views.indexOf(view), 1);
    expect(removed).toHaveBeenCalledWith('pointerdown', listener, true);
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true })
    );
    await nextFrame();

    expect(view.onCommit).not.toHaveBeenCalled();
  });
});

describe('the editor and its cell', () => {
  it('follows its cell on a scroll and a resize, cut where the view cuts it', async () => {
    const view = await mount();
    await editAt(view, 2, 1);
    const g = geometry(view);

    view.scroller.scrollTop = 40;
    await drawn();
    expect(at(view.textarea)).toEqual(inner(cellBox(view, 2, 1)));
    expect(insetOf(view.textarea)).toBeNull();

    view.scroller.scrollTop = 70;
    await drawn();
    const cut = inner(cellBox(view, 2, 1));
    expect(at(view.textarea)).toEqual(cut);
    expect(insetOf(view.textarea)).toEqual([g.body.y - cut.y, 0, 0, 0]);
    expect(editorOpen(view)).toBe(true);

    view.props.columns = COLUMNS.map((column, index) =>
      index === 0 ? { ...column, width: 200 } : column
    );
    await drawn();
    expect(at(view.textarea).x).toBe(cut.x + 80);
  });

  it('cuts the editor of a scrolled cell at the frozen columns', async () => {
    const view = await mount({ frozenColumns: 1 });
    await editAt(view, 1, 2);

    view.scroller.scrollLeft = 160;
    await drawn();
    const g = geometry(view);
    const box = inner(cellBox(view, 1, 2));

    expect(at(view.textarea)).toEqual(box);
    expect(insetOf(view.textarea)).toEqual([0, 0, 0, g.body.x - box.x]);
  });

  it('sets the editor’s text on the pixels the canvas drew the cell’s text on, in any font', async () => {
    for (const init of [{}, { font: '15px Georgia, serif', rowHeight: 31 }]) {
      const view = await mount(init);
      const cell = cellBox(view, 3, 1);
      // Inside the cell, clear of its grid lines and the active cell's edge.
      const area = {
        x: cell.x + 3,
        y: cell.y + 3,
        width: cell.width - 6,
        height: cell.height - 6,
      };

      press(view, cellPoint(view, 6, 1));
      await drawn();
      const drawnText = await inkOf(view, area);

      await editAt(view, 3, 1);
      view.textarea.style.caretColor = 'transparent';
      await nextFrame();
      const editedText = await inkOf(view, area);

      expect(view.textarea.value).toBe(valueOf(3, 1));
      expect(drawnText.right).toBeGreaterThan(drawnText.left);
      expect(editedText).toEqual(drawnText);

      view.unmount();
      views.splice(views.indexOf(view), 1);
    }
  });

  it('hides the editor inside the cell area once its cell leaves the view, and shows it on the way back', async () => {
    const view = await mount();
    await editAt(view, 2, 1);
    await userEvent.keyboard('!');

    view.handle.scrollTo(800, 1);
    await drawn();

    const g = geometry(view);
    const box = at(view.textarea);
    expect(shown(view.textarea)).toBe(false);
    expect(getComputedStyle(view.textarea).pointerEvents).toBe('none');
    expect(box.y).toBe(g.body.y);
    expect(box.x).toBeGreaterThanOrEqual(g.rowHeaderWidth);
    expect(document.activeElement).toBe(view.textarea);
    expect(view.textarea.value).toBe('2:1!');

    view.handle.scrollTo(0, 0);
    await drawn();
    expect(editorOpen(view)).toBe(true);
    expect(at(view.textarea)).toEqual(inner(cellBox(view, 2, 1)));
  });

  it('types into a cell out of view or cut at the container edge without scrolling anything', async () => {
    const view = await mount();
    const long = 'abcdefghijklmnopqrstuvwxyz'.repeat(3);
    await editAt(view, 2, 1);

    view.handle.scrollTo(800, 12);
    await drawn();
    const { scrollTop, scrollLeft } = view.scroller;
    await userEvent.keyboard(long);
    await drawn();

    expect(view.scroller.scrollTop).toBe(scrollTop);
    expect(view.scroller.scrollLeft).toBe(scrollLeft);
    expect([view.container.scrollTop, view.container.scrollLeft]).toEqual([
      0, 0,
    ]);
    expect(view.textarea.value).toBe(`2:1${long}`);
    key(view, 'Escape');

    // The column cut at the right edge is widened to run past the container,
    // so its editor's caret does too once the text outgrows the part in view.
    view.handle.scrollTo(0, 0);
    await drawn();
    const edge = Math.floor((geometry(view).body.width - 1) / 120);
    view.props.columns = COLUMNS.map((column, index) =>
      index === edge ? { ...column, width: 400 } : column
    );
    view.handle.select({
      active: { row: 0, col: edge },
      ranges: [range(0, edge)],
    });
    key(view, 'F2');
    await drawn();
    expect(at(view.textarea).x + at(view.textarea).width).toBeGreaterThan(
      view.container.clientWidth
    );
    expect(insetOf(view.textarea)?.[1]).toBeGreaterThan(0);
    await userEvent.keyboard(long);
    await drawn();

    expect([view.container.scrollTop, view.container.scrollLeft]).toEqual([
      0, 0,
    ]);
    expect(view.scroller.scrollLeft).toBe(0);
    expect(at(view.textarea)).toEqual(inner(cellBox(view, 0, edge)));
  });

  it('scrolls the grid under a real wheel over the open editor', async () => {
    const view = await mount();
    await editAt(view, 4, 1);

    await userEvent.wheel(view.textarea, { delta: { y: 60 } });
    await drawn();

    expect(view.scroller.scrollTop).toBeGreaterThan(0);
    expect(geometry(view).top).toBe(view.scroller.scrollTop);
    expect(at(view.textarea)).toEqual(inner(cellBox(view, 4, 1)));
    expect(editorOpen(view)).toBe(true);
  });
});

describe('an IME composition', () => {
  it('keeps the first composed character, the composition carrying on as the editor opens', async () => {
    const view = await mount();
    const events: string[] = [];
    for (const type of ['compositionstart', 'compositionend']) {
      view.textarea.addEventListener(type, () => events.push(type));
    }
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();

    await compose('ㅎ');
    expect(editorOpen(view)).toBe(true);
    expect(view.textarea.value).toBe('ㅎ');
    expect(at(view.textarea)).toEqual(inner(cellBox(view, 1, 1)));

    await compose('하');
    await compose('한');
    expect(events).toEqual(['compositionstart']);
    expect(view.textarea.value).toBe('한');

    await finishComposition('한');
    expect(events).toEqual(['compositionstart', 'compositionend']);
    expect(view.textarea.value).toBe('한');

    await compose('ㄱ');
    await compose('글');
    await finishComposition('글');
    expect(view.textarea.value).toBe('한글');

    key(view, 'Enter');
    expect(view.onCommit).toHaveBeenCalledTimes(1);
    expect(lastCommit(view)).toEqual({
      changes: [change(1, 1, '한글')],
      source: 'edit',
    });
  });

  it('takes no Enter, Tab or Escape as an end while a composition holds them', async () => {
    const view = await mount();
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();

    await compose('ㅎ');
    const held = [
      key(view, 'Enter', { isComposing: true }),
      key(view, 'Tab', { isComposing: true }),
      key(view, 'Escape', { keyCode: 229 }),
    ];
    await nextFrame();

    expect(held.map(event => event.defaultPrevented)).toEqual([
      false,
      false,
      false,
    ]);
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(editorOpen(view)).toBe(true);
    expect(view.textarea.value).toBe('ㅎ');

    await finishComposition('한');
    key(view, 'Enter');
    expect(lastCommit(view)?.changes).toEqual([change(1, 1, '한')]);
  });

  it('commits what a composition holds on a press elsewhere, and empties the textarea once it ends', async () => {
    const view = await mount();
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();

    await compose('한');
    press(view, cellPoint(view, 3, 3));
    expect(lastCommit(view)?.changes).toEqual([change(1, 1, '한')]);

    await finishComposition('한');
    await nextFrame();
    expect(view.textarea.value).toBe('');
    expect(editorOpen(view)).toBe(false);
    expect(lastSelection(view)?.active).toEqual({ row: 3, col: 3 });
  });

  it('drops a composition on a readonly cell once it ends', async () => {
    const columns = COLUMNS.map((column, index) =>
      index === 1 ? { ...column, readonly: true } : column
    );
    const view = await mount({ columns });
    press(view, cellPoint(view, 1, 1));
    view.textarea.focus();

    await compose('한');
    expect(editorOpen(view)).toBe(false);
    await finishComposition('한');

    expect(view.textarea.value).toBe('');
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('opens a column’s own editor with the composed text once the composition ends', async () => {
    const editor = vi.fn<(ctx: EditorContext) => void>();
    const view = await mount({ columns: withEditor(2, editor) });
    press(view, cellPoint(view, 1, 2));
    view.textarea.focus();

    await compose('가');
    expect(editor).not.toHaveBeenCalled();
    await finishComposition('가');

    expect(editor).toHaveBeenCalledTimes(1);
    expect(editor.mock.calls[0][0]).toMatchObject({
      mode: 'replace',
      initialValue: '가',
    });
    expect(view.textarea.value).toBe('');
  });
});

describe('Delete and Backspace', () => {
  it('clear every selected range as one commit, readonly cells left out', async () => {
    const columns = COLUMNS.map((column, index) =>
      index === 2 ? { ...column, readonly: true } : column
    );
    const view = await mount({
      columns,
      getCellStyle: (row, col) =>
        row === 1 && col === 1 ? { readonly: true } : undefined,
    });
    press(view, cellPoint(view, 0, 0));
    press(view, cellPoint(view, 1, 2), { shiftKey: true });
    press(view, cellPoint(view, 4, 4), MOD);
    const expected = {
      changes: [
        change(0, 0, ''),
        change(0, 1, ''),
        change(1, 0, ''),
        change(4, 4, ''),
      ],
      source: 'clear',
    };

    expect(key(view, 'Delete').defaultPrevented).toBe(true);
    expect(view.onCommit).toHaveBeenCalledTimes(1);
    expect(lastCommit(view)).toEqual(expected);

    expect(key(view, 'Backspace').defaultPrevented).toBe(true);
    expect(view.onCommit).toHaveBeenCalledTimes(2);
    expect(lastCommit(view)).toEqual(expected);

    press(view, cellPoint(view, 3, 2));
    expect(key(view, 'Delete').defaultPrevented).toBe(true);
    expect(view.onCommit).toHaveBeenCalledTimes(2);
    await nextFrame();
    expect(editorOpen(view)).toBe(false);
  });

  it('delete text inside an open editor, as its own keys', async () => {
    const view = await mount();
    await editAt(view, 1, 1);

    expect(key(view, 'Backspace').defaultPrevented).toBe(false);
    expect(key(view, 'Delete').defaultPrevented).toBe(false);
    expect(view.onCommit).not.toHaveBeenCalled();
  });
});

describe('the clipboard', () => {
  it('copies the selection as tab-separated text/plain', async () => {
    const view = await mount();
    press(view, cellPoint(view, 1, 1));
    press(view, cellPoint(view, 2, 3), { shiftKey: true });

    const { event, data } = clipboardEvent(view, 'copy');

    expect(event.defaultPrevented).toBe(true);
    expect(data.getData('text/plain')).toBe('1:1\t1:2\t1:3\n2:1\t2:2\t2:3');
    expect(view.onReject).not.toHaveBeenCalled();
  });

  it('copies ranges over the same rows or the same columns, and refuses any others', async () => {
    const view = await mount();

    press(view, cellPoint(view, 1, 1));
    press(view, cellPoint(view, 2, 1), { shiftKey: true });
    pointer(view, 'pointerdown', cellPoint(view, 1, 3), MOD);
    pointer(view, 'pointermove', cellPoint(view, 2, 4), MOD);
    pointer(view, 'pointerup', cellPoint(view, 2, 4), MOD);
    expect(clipboardEvent(view, 'copy').data.getData('text/plain')).toBe(
      '1:1\t1:3\t1:4\n2:1\t2:3\t2:4'
    );

    view.handle.select({
      active: { row: 4, col: 1 },
      ranges: [range(1, 1, 1, 2), range(4, 1, 5, 2)],
    });
    expect(clipboardEvent(view, 'copy').data.getData('text/plain')).toBe(
      '1:1\t1:2\n4:1\t4:2\n5:1\t5:2'
    );

    view.handle.select({
      active: { row: 3, col: 3 },
      ranges: [range(1, 1), range(3, 3, 4, 4)],
    });
    const refused = clipboardEvent(view, 'copy');
    expect(refused.event.defaultPrevented).toBe(true);
    expect(refused.data.getData('text/plain')).toBe('');
    expect(refused.data.types).toEqual([]);
    expect(view.onReject).toHaveBeenCalledTimes(1);
    expect(view.onReject).toHaveBeenCalledWith({ reason: 'multi-range-copy' });
  });

  it('copies nothing and throws nothing once the selection’s text outgrows the longest string', async () => {
    // Five values of 2^27 characters make a text past the 2^29 - 24 that V8
    // holds in one string; they sit in a row out of view, which no draw reads.
    const long = 'x'.repeat(2 ** 27);
    const view = await mount({
      getCell: (row, col) => (row === 900 ? long : valueOf(row, col)),
    });
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener('error', onError);
    teardowns.push(() => window.removeEventListener('error', onError));
    view.handle.select({
      active: { row: 900, col: 1 },
      ranges: [range(900, 1, 900, 5)],
    });

    const { event, data } = clipboardEvent(view, 'copy');

    expect(errors).toEqual([]);
    expect(event.defaultPrevented).toBe(true);
    expect(data.types).toEqual([]);
    expect(view.onReject).not.toHaveBeenCalled();
  });

  it('pastes from the active cell as one commit, past the last row, dropping columns past the last', async () => {
    const view = await mount({ rowCount: 10 });

    press(view, cellPoint(view, 1, 1));
    expect(paste(view, 'a\tb\r\nc\td\r\n').defaultPrevented).toBe(true);
    expect(view.onCommit).toHaveBeenCalledTimes(1);
    expect(lastCommit(view)).toEqual({
      changes: [
        change(1, 1, 'a'),
        change(1, 2, 'b'),
        change(2, 1, 'c'),
        change(2, 2, 'd'),
      ],
      source: 'paste',
    });
    expect(view.onReject).not.toHaveBeenCalled();

    view.handle.select({ active: { row: 8, col: 28 }, ranges: [range(8, 28)] });
    paste(view, '1\t2\t3\n4\t5\t6\n7\t8\t9');
    expect(view.onCommit).toHaveBeenCalledTimes(2);
    expect(lastCommit(view)?.changes).toEqual([
      change(8, 28, '1'),
      change(8, 29, '2'),
      change(9, 28, '4'),
      change(9, 29, '5'),
      change(10, 28, '7'),
      change(10, 29, '8'),
    ]);
    expect(view.onReject).toHaveBeenCalledTimes(1);
    expect(view.onReject).toHaveBeenCalledWith({
      reason: 'paste-beyond-columns',
    });

    await nextFrame();
    expect(editorOpen(view)).toBe(false);
    expect(view.textarea.value).toBe('');
  });

  it('fills every range from a one-cell clipboard, readonly cells left out', async () => {
    const columns = COLUMNS.map((column, index) =>
      index === 2 ? { ...column, readonly: true } : column
    );
    const view = await mount({ columns });
    press(view, cellPoint(view, 1, 1));
    press(view, cellPoint(view, 2, 2), { shiftKey: true });
    press(view, cellPoint(view, 5, 5), MOD);

    paste(view, 'x\n');

    expect(lastCommit(view)).toEqual({
      changes: [change(1, 1, 'x'), change(2, 1, 'x'), change(5, 5, 'x')],
      source: 'paste',
    });

    press(view, cellPoint(view, 0, 1));
    paste(view, 'a\tb\tc');
    expect(lastCommit(view)?.changes).toEqual([
      change(0, 1, 'a'),
      change(0, 3, 'c'),
    ]);
  });

  it('reads text/plain alone, and pastes nothing from a clipboard without it', async () => {
    const view = await mount();
    const data = new DataTransfer();
    data.setData('text/html', '<b>bold</b>');

    const { event } = clipboardEvent(view, 'paste', data);

    expect(event.defaultPrevented).toBe(true);
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(view.textarea.value).toBe('');
  });

  it('opens the grid’s own editor on one line, and pastes a tab or line break into it as a space', async () => {
    const view = await mount({
      getCell: (row, col) =>
        row === 1 && col === 1 ? 'top\nbottom' : valueOf(row, col),
    });
    await editAt(view, 1, 1);
    expect(view.textarea.value).toBe('top bottom');
    key(view, 'Enter');
    expect(view.onCommit).not.toHaveBeenCalled();

    await editAt(view, 2, 1);
    view.textarea.select();
    expect(paste(view, 'a\tb\r\nc\r\n').defaultPrevented).toBe(true);
    expect(view.textarea.value).toBe('a b  c');
    key(view, 'Enter');
    expect(lastCommit(view)?.changes).toEqual([change(2, 1, 'a b  c')]);

    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    await editAt(view, 3, 1);
    expect(paste(view, 'x\ny').defaultPrevented).toBe(true);
    expect(view.textarea.value).toBe('3:1x y');
    key(view, 'Enter');
    expect(lastCommit(view)?.changes).toEqual([change(3, 1, '3:1x y')]);
  });

  it('leaves copy and paste to the open editor', async () => {
    const view = await mount();
    await editAt(view, 1, 1);

    const copy = clipboardEvent(view, 'copy');
    expect(copy.event.defaultPrevented).toBe(false);
    expect(copy.data.types).toEqual([]);
    expect(paste(view, 'pasted').defaultPrevented).toBe(false);
    expect(view.onCommit).not.toHaveBeenCalled();
  });
});

describe('a column’s own editor', () => {
  it('opens on Enter, F2, a double click and typing, over its cell in the slot', async () => {
    const contexts: EditorContext[] = [];
    const editor = vi.fn((ctx: EditorContext) => {
      contexts.push(ctx);
    });
    const view = await mount({ columns: withEditor(2, editor) });
    view.textarea.focus();

    press(view, cellPoint(view, 3, 2));
    expect(key(view, 'Enter').defaultPrevented).toBe(true);
    await nextFrame();

    const box = cellBox(view, 3, 2);
    const [first] = contexts;
    expect(first.container).toBe(view.slot);
    expect(first.rect).toBeInstanceOf(DOMRect);
    expect({
      x: first.rect.x,
      y: first.rect.y,
      width: first.rect.width,
      height: first.rect.height,
    }).toEqual(box);
    expect(first.mode).toBe('edit');
    expect(first.initialValue).toBe(valueOf(3, 2));
    expect(at(view.slot)).toEqual(box);
    expect(shown(view.slot)).toBe(true);
    expect(editorOpen(view)).toBe(false);

    first.cancel();
    await nextFrame();
    expect(at(view.slot)).toEqual({ x: 0, y: 0, width: 0, height: 0 });

    key(view, 'F2');
    expect(contexts[1]).toMatchObject({
      mode: 'edit',
      initialValue: valueOf(3, 2),
    });
    contexts[1].cancel();

    dblclick(view, cellPoint(view, 4, 2));
    expect(contexts[2]).toMatchObject({
      mode: 'edit',
      initialValue: valueOf(4, 2),
    });
    contexts[2].cancel();

    await userEvent.keyboard('q');
    expect(contexts[3]).toMatchObject({ mode: 'replace', initialValue: 'q' });
    expect(view.textarea.value).toBe('');
    contexts[3].cancel();

    expect(editor).toHaveBeenCalledTimes(4);
    expect(view.onCommit).not.toHaveBeenCalled();
  });

  it('opens on no readonly cell', async () => {
    const editor = vi.fn<(ctx: EditorContext) => void>();
    const view = await mount({
      columns: withEditor(2, editor, { readonly: true }),
    });
    press(view, cellPoint(view, 1, 2));
    view.textarea.focus();

    key(view, 'Enter');
    dblclick(view, cellPoint(view, 1, 2));
    await userEvent.keyboard('q');

    expect(editor).not.toHaveBeenCalled();
    expect(view.textarea.value).toBe('');
  });

  it('tells the editor why to close, waits for its answer and takes the focus back', async () => {
    const reasons: string[] = [];
    let ctx: EditorContext | null = null;
    let input: HTMLInputElement | null = null;
    const editor = (next: EditorContext) => {
      ctx = next;
      input = document.createElement('input');
      input.value = next.initialValue;
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape' && input?.value === 'busy') {
          event.preventDefault();
        }
      });
      next.container.append(input);
      input.focus();
      next.onClose(reason => reasons.push(reason));
    };
    const view = await mount({ columns: withEditor(2, editor) });
    press(view, cellPoint(view, 1, 2));
    view.textarea.focus();
    key(view, 'Enter');
    await nextFrame();
    const field = input as unknown as HTMLInputElement;
    const context = ctx as unknown as EditorContext;
    expect(document.activeElement).toBe(field);

    expect(key(view, 'Escape', {}, field).defaultPrevented).toBe(true);
    expect(reasons).toEqual(['escape']);

    const composing = key(view, 'Escape', { isComposing: true }, field);
    expect(composing.defaultPrevented).toBe(false);
    const ending = key(view, 'Escape', { keyCode: 229 }, field);
    expect(ending.defaultPrevented).toBe(false);
    expect(reasons).toEqual(['escape']);

    field.value = 'busy';
    expect(key(view, 'Escape', {}, field).defaultPrevented).toBe(true);
    expect(reasons).toEqual(['escape']);

    pointer(view, 'pointerdown', cellPoint(view, 6, 6));
    expect(reasons).toEqual(['escape', 'outside']);
    await nextFrame();
    expect(at(view.slot)).toEqual(cellBox(view, 1, 2));
    expect(view.onCommit).not.toHaveBeenCalled();

    field.focus();
    context.commit('picked');
    expect(view.onCommit).toHaveBeenCalledTimes(1);
    expect(lastCommit(view)).toEqual({
      changes: [change(1, 2, 'picked')],
      source: 'edit',
    });
    expect(document.activeElement).toBe(view.textarea);
    field.remove();

    context.commit('again');
    context.cancel();
    expect(view.onCommit).toHaveBeenCalledTimes(1);

    press(view, cellPoint(view, 2, 2));
    key(view, 'F2');
    expect(key(view, 'Escape').defaultPrevented).toBe(true);
    expect(key(view, 'Enter').defaultPrevented).toBe(true);
    expect(reasons).toEqual(['escape', 'outside', 'escape']);
  });

  it('leaves the focus in the editor through a real press on a scrollbar or a cell, until it answers', async () => {
    let ctx: EditorContext | null = null;
    const editor = (next: EditorContext) => {
      ctx = next;
      const input = document.createElement('input');
      input.value = next.initialValue;
      next.container.append(input);
      input.focus();
    };
    const view = await mount({ columns: withEditor(2, editor) });
    press(view, cellPoint(view, 1, 2));
    view.textarea.focus();
    key(view, 'Enter');
    await nextFrame();
    const field = view.slot.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(field);

    await userEvent.click(view.scroller, {
      position: centreOf(view, 'grid-vertical-thumb'),
    });
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard('x');
    expect(field.value).toBe(`${valueOf(1, 2)}x`);

    await userEvent.click(view.scroller, { position: cellPoint(view, 4, 4) });
    expect(document.activeElement).toBe(field);
    expect(lastSelection(view)?.active).toEqual({ row: 4, col: 4 });

    (ctx as unknown as EditorContext).commit(field.value);
    expect(lastCommit(view)?.changes).toEqual([
      change(1, 2, `${valueOf(1, 2)}x`),
    ]);
    expect(document.activeElement).toBe(view.textarea);
  });

  it('keeps the wheel for a list in the slot that can still scroll, and hands it on once it cannot', async () => {
    const editor = (ctx: EditorContext) => {
      const list = document.createElement('div');
      list.style.height = '84px';
      list.style.overflow = 'auto';
      list.style.background = 'white';
      for (let index = 0; index < 20; index++) {
        const item = document.createElement('div');
        item.style.height = '24px';
        item.textContent = `item ${index}`;
        list.append(item);
      }
      ctx.container.append(list);
    };
    const view = await mount({ columns: withEditor(2, editor) });
    press(view, cellPoint(view, 5, 2));
    view.textarea.focus();
    key(view, 'Enter');
    await nextFrame();
    const list = view.slot.firstElementChild as HTMLDivElement;

    await userEvent.wheel(list, { delta: { y: 60 } });
    await nextFrame();
    expect(list.scrollTop).toBeGreaterThan(0);
    expect(view.scroller.scrollTop).toBe(0);

    list.scrollTop = list.scrollHeight;
    await userEvent.wheel(list, { delta: { y: 60 } });
    await drawn();
    expect(view.scroller.scrollTop).toBeGreaterThan(0);
    expect(at(view.slot)).toEqual(cellBox(view, 5, 2));
    expect(shown(view.slot)).toBe(true);
  });

  it('leaves a wheel an element in the slot prevented to it, the rows staying put', async () => {
    let turns = 0;
    const editor = (ctx: EditorContext) => {
      const spinner = document.createElement('div');
      spinner.style.height = '24px';
      spinner.style.background = 'white';
      spinner.addEventListener(
        'wheel',
        event => {
          event.preventDefault();
          turns++;
        },
        { passive: false }
      );
      ctx.container.append(spinner);
    };
    const view = await mount({ columns: withEditor(2, editor) });
    press(view, cellPoint(view, 5, 2));
    view.textarea.focus();
    key(view, 'Enter');
    await nextFrame();

    await userEvent.wheel(view.slot.firstElementChild as HTMLElement, {
      delta: { y: 60 },
    });
    await drawn();

    expect(turns).toBe(1);
    expect(view.scroller.scrollTop).toBe(0);
    expect(at(view.slot)).toEqual(cellBox(view, 5, 2));
  });

  it('hides the slot inside the cell area once its cell leaves the view', async () => {
    const editor = vi.fn<(ctx: EditorContext) => void>();
    const view = await mount({ columns: withEditor(2, editor) });
    press(view, cellPoint(view, 1, 2));
    view.textarea.focus();
    key(view, 'Enter');

    view.handle.scrollTo(ROW_COUNT - 1, 2);
    await drawn();

    expect(shown(view.slot)).toBe(false);
    expect(getComputedStyle(view.slot).pointerEvents).toBe('none');
    expect(at(view.slot).y).toBe(geometry(view).body.y);
  });
});
