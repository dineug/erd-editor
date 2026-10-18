// The Grid component in real Chromium: the DOM it stacks over its stage, what
// the pointer, the keyboard and the wheel do to the selection and the scroll,
// the callbacks each action fires and what an unmount leaves behind.

import { render } from '@dineug/r-html';
import { requestFlush } from '@dineug/r-html-konva';
import type { Layer } from 'konva/lib/Layer';
import { stages } from 'konva/lib/Stage';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  cellPoint,
  centreOf,
  cleanup,
  COLUMNS,
  edgePoint,
  geometry,
  headerPoint,
  HEIGHT,
  key,
  lastSelection,
  lastViewport,
  MILLION,
  MOD,
  mount,
  mouse,
  node,
  offsetsOf,
  pointer,
  press,
  range,
  ROW_COUNT,
  ROW_HEIGHT,
  rowNumberPoint,
  sizePage,
  spacerSize,
  teardowns,
  valueOf,
  type View,
  views,
  WIDTH,
} from '@/__test-utils__/grid';
import { drawn, near, nextFrame, pixelAt, rgba } from '@/__test-utils__/scene';
import { DEFAULT_FONT } from '@/font';
import type { CellContextMenuEvent, ViewportChange } from '@/Grid';
import type { CellStyle } from '@/model/types';
import { darkTheme, lightTheme } from '@/theme';

beforeAll(sizePage);

afterEach(cleanup);

describe('the DOM it stacks', () => {
  it('lays the stage, the scroller, the focus textarea and the editor slot in that order', async () => {
    const view = await mount({ ariaLabel: 'Words' });
    const { sheet, stageHost, scroller, textarea, slot, stage } = view;
    const style = (element: Element) => getComputedStyle(element);

    expect(sheet.tagName).toBe('STYLE');
    expect(style(view.container).overflow).toBe('clip');
    expect(stageHost.querySelectorAll('canvas')).toHaveLength(2);
    expect(stage.listening()).toBe(false);
    expect(stage.size()).toEqual({ width: WIDTH, height: HEIGHT });

    expect(scroller.getAttribute('tabindex')).toBe('-1');
    expect(style(scroller).position).toBe('absolute');
    expect(style(scroller).overflow).toBe('auto');
    expect(style(scroller).overscrollBehavior).toBe('contain');
    expect(scroller.getBoundingClientRect()).toEqual(
      view.container.getBoundingClientRect()
    );

    expect(textarea.getAttribute('aria-label')).toBe('Words');
    expect(style(textarea).opacity).toBe('0');
    expect(style(textarea).pointerEvents).toBe('none');
    expect(style(textarea).caretColor).toBe('rgba(0, 0, 0, 0)');
    expect(style(textarea).fontSize).toBe('13px');
    expect(slot.childElementCount).toBe(0);
    expect(slot.getBoundingClientRect().width).toBe(0);
  });

  it('hides the native scrollbars both ways, the property and the WebKit pseudo element', async () => {
    const { scroller, sheet } = await mount();
    const rules = Array.from(sheet.sheet?.cssRules ?? []) as CSSStyleRule[];
    const pseudo = rules.find(rule =>
      rule.selectorText.endsWith('::-webkit-scrollbar')
    );

    expect(getComputedStyle(scroller).scrollbarWidth).toBe('none');
    expect(pseudo?.style.display).toBe('none');
    expect(
      scroller.matches(pseudo!.selectorText.replace('::-webkit-scrollbar', ''))
    ).toBe(true);
    expect(scroller.offsetWidth - scroller.clientWidth).toBe(0);
  });

  it('sizes the spacer to the scroll range, the scrollbar strips included', async () => {
    const view = await mount();
    const g = geometry(view);
    const offsets = offsetsOf(view);

    expect(spacerSize(view)).toEqual({
      width: g.rowHeaderWidth + offsets[offsets.length - 1] + 12,
      height: g.headerHeight + ROW_COUNT * ROW_HEIGHT + 12,
    });
    expect(view.scroller.scrollHeight - view.scroller.clientHeight).toBe(
      ROW_COUNT * ROW_HEIGHT - g.body.height
    );
  });

  it('places the focus textarea on the active cell, held inside the cell area', async () => {
    const view = await mount();
    const at = (element: HTMLElement) => ({
      x: element.offsetLeft,
      y: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    });
    const g = geometry(view);

    press(view, cellPoint(view, 2, 1));
    await drawn();
    expect(at(view.textarea)).toEqual({
      x: g.body.x + 120,
      y: g.body.y + 2 * ROW_HEIGHT,
      width: 120,
      height: ROW_HEIGHT,
    });

    view.handle.scrollTo(800, 1);
    await drawn();
    expect(at(view.textarea)).toEqual({
      x: g.body.x + 120,
      y: g.body.y,
      width: 120,
      height: ROW_HEIGHT,
    });
  });
});

describe('the pointer', () => {
  it('selects the cell a press lands on, reporting it once', async () => {
    const view = await mount();

    press(view, cellPoint(view, 3, 2));
    expect(view.onSelectionChange).toHaveBeenCalledTimes(1);
    expect(lastSelection(view)).toEqual({
      active: { row: 3, col: 2 },
      ranges: [range(3, 2)],
    });

    press(view, cellPoint(view, 3, 2));
    expect(view.onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it('extends the range a drag holds, reporting each new cell once', async () => {
    const view = await mount();
    const start = cellPoint(view, 1, 1);
    const end = cellPoint(view, 4, 3);

    pointer(view, 'pointerdown', start);
    pointer(view, 'pointermove', { x: start.x + 10, y: start.y });
    pointer(view, 'pointermove', end);
    pointer(view, 'pointermove', { x: end.x + 10, y: end.y + 5 });
    pointer(view, 'pointerup', end);

    expect(view.onSelectionChange).toHaveBeenCalledTimes(2);
    expect(lastSelection(view)).toEqual({
      active: { row: 1, col: 1 },
      ranges: [range(1, 1, 4, 3)],
    });

    pointer(view, 'pointermove', cellPoint(view, 6, 6));
    expect(view.onSelectionChange).toHaveBeenCalledTimes(2);
  });

  it('extends from the active cell under Shift and adds a range under Ctrl or Cmd', async () => {
    const view = await mount();

    press(view, cellPoint(view, 1, 1));
    press(view, cellPoint(view, 3, 4), { shiftKey: true });
    expect(lastSelection(view)).toEqual({
      active: { row: 1, col: 1 },
      ranges: [range(1, 1, 3, 4)],
    });

    press(view, cellPoint(view, 6, 0), MOD);
    expect(lastSelection(view)).toEqual({
      active: { row: 6, col: 0 },
      ranges: [range(1, 1, 3, 4), range(6, 0)],
    });

    pointer(view, 'pointerdown', cellPoint(view, 8, 1), MOD);
    pointer(view, 'pointermove', cellPoint(view, 9, 2), MOD);
    pointer(view, 'pointerup', cellPoint(view, 9, 2), MOD);
    expect(lastSelection(view)?.ranges).toEqual([
      range(1, 1, 3, 4),
      range(6, 0),
      range(8, 1, 9, 2),
    ]);
    expect(view.onSelectionChange).toHaveBeenCalledTimes(5);
  });

  it('selects columns, rows and every cell from the headers and the corner, Shift and Ctrl alike', async () => {
    const view = await mount();
    const last = ROW_COUNT - 1;

    press(view, headerPoint(view, 2));
    expect(lastSelection(view)).toEqual({
      active: { row: 0, col: 2 },
      ranges: [range(0, 2, last, 2)],
    });

    press(view, headerPoint(view, 4), { shiftKey: true });
    expect(lastSelection(view)?.ranges).toEqual([range(0, 2, last, 4)]);

    press(view, headerPoint(view, 6), MOD);
    expect(lastSelection(view)?.ranges).toEqual([
      range(0, 2, last, 4),
      range(0, 6, last, 6),
    ]);

    press(view, rowNumberPoint(view, 5));
    expect(lastSelection(view)).toEqual({
      active: { row: 5, col: 0 },
      ranges: [range(5, 0, 5, 29)],
    });

    press(view, rowNumberPoint(view, 7), { shiftKey: true });
    expect(lastSelection(view)?.ranges).toEqual([range(5, 0, 7, 29)]);

    press(view, rowNumberPoint(view, 9), MOD);
    expect(lastSelection(view)?.ranges).toHaveLength(2);

    press(view, { x: 4, y: 4 });
    expect(lastSelection(view)).toEqual({
      active: { row: 9, col: 0 },
      ranges: [range(0, 0, last, 29)],
    });

    press(view, { x: 4, y: 4 }, MOD);
    expect(lastSelection(view)?.ranges).toEqual([
      range(0, 0, last, 29),
      range(0, 0, last, 29),
    ]);
  });

  it('drags across the column headers and the row numbers', async () => {
    const view = await mount();
    const last = ROW_COUNT - 1;

    pointer(view, 'pointerdown', headerPoint(view, 1));
    pointer(view, 'pointermove', headerPoint(view, 3));
    pointer(view, 'pointerup', headerPoint(view, 3));
    expect(lastSelection(view)?.ranges).toEqual([range(0, 1, last, 3)]);

    pointer(view, 'pointerdown', rowNumberPoint(view, 2));
    pointer(view, 'pointermove', rowNumberPoint(view, 6));
    pointer(view, 'pointerup', rowNumberPoint(view, 6));
    expect(lastSelection(view)?.ranges).toEqual([range(2, 0, 6, 29)]);
  });

  it('selects nothing for a touch pointer, another button or the space past the last row', async () => {
    const view = await mount({ rowCount: 3 });
    view.textarea.blur();

    pointer(view, 'pointerdown', cellPoint(view, 1, 1), {
      pointerType: 'touch',
    });
    mouse(view, 'mousedown', cellPoint(view, 1, 1));
    pointer(view, 'pointerdown', cellPoint(view, 2, 2), { button: 2 });
    press(view, cellPoint(view, 10, 1));

    expect(view.onSelectionChange).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(view.textarea);
  });

  it('takes Ctrl with the main button on an Apple platform as the right click it is there', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const menu = vi.fn<(event: CellContextMenuEvent) => void>();
    const view = await mount({ onCellContextMenu: menu });
    press(view, cellPoint(view, 1, 1));
    press(view, cellPoint(view, 3, 3), { shiftKey: true });
    press(view, cellPoint(view, 6, 5), { metaKey: true });
    expect(lastSelection(view)?.ranges).toEqual([
      range(1, 1, 3, 3),
      range(6, 5),
    ]);
    view.onSelectionChange.mockClear();

    // Blink sends a Mac's Ctrl+click as a press of the main button, then a
    // contextmenu, and the button may move before it comes up.
    const inside = cellPoint(view, 2, 2);
    const held = { ctrlKey: true };
    pointer(view, 'pointerdown', inside, held);
    mouse(view, 'mousedown', inside, held);
    mouse(view, 'contextmenu', inside, held);
    pointer(view, 'pointermove', cellPoint(view, 8, 6), held);
    pointer(view, 'pointerup', cellPoint(view, 8, 6), held);

    expect(view.onSelectionChange).not.toHaveBeenCalled();
    expect(menu).toHaveBeenCalledTimes(1);
    expect(menu.mock.calls[0][0]).toMatchObject({ row: 2, col: 2 });
  });

  it('ends a drag once a move finds its button up, as when no pointerup reached the scroller', async () => {
    const view = await mount();
    pointer(view, 'pointerdown', cellPoint(view, 1, 1));
    pointer(view, 'pointermove', cellPoint(view, 3, 3));
    expect(lastSelection(view)?.ranges).toEqual([range(1, 1, 3, 3)]);

    pointer(view, 'pointermove', cellPoint(view, 5, 5), { buttons: 0 });
    pointer(view, 'pointermove', cellPoint(view, 6, 6));
    expect(lastSelection(view)?.ranges).toEqual([range(1, 1, 3, 3)]);

    const edge = edgePoint(view, 1);
    const width = spacerSize(view).width;
    pointer(view, 'pointerdown', edge);
    pointer(view, 'pointermove', { x: edge.x + 30, y: edge.y });
    await drawn();
    expect(spacerSize(view).width).toBe(width + 30);

    pointer(view, 'pointermove', { x: edge.x + 60, y: edge.y }, { buttons: 0 });
    pointer(view, 'pointerup', { x: edge.x + 60, y: edge.y });
    await drawn();
    expect(spacerSize(view).width).toBe(width);
    expect(view.onColumnResize).not.toHaveBeenCalled();
  });

  it('keeps the focus textarea focused through a real press on the scroller', async () => {
    const view = await mount();
    view.textarea.focus();

    await userEvent.click(view.scroller);

    expect(document.activeElement).toBe(view.textarea);
    expect(view.onSelectionChange).toHaveBeenCalledTimes(1);
    expect(
      mouse(view, 'mousedown', cellPoint(view, 1, 1)).defaultPrevented
    ).toBe(true);
  });

  it('scrolls past an edge while a drag holds the pointer there, and stops as it lets go', async () => {
    const view = await mount();
    const g = geometry(view);
    const below = {
      x: cellPoint(view, 0, 1).x,
      y: g.body.y + g.body.height + 40,
    };

    pointer(view, 'pointerdown', cellPoint(view, 2, 1));
    pointer(view, 'pointermove', below);

    const tops: number[] = [];
    for (let frame = 0; frame < 3; frame++) {
      await nextFrame();
      tops.push(view.scroller.scrollTop);
    }

    expect(tops[0]).toBeGreaterThan(0);
    expect(tops[1]).toBeGreaterThan(tops[0]);
    expect(tops[2]).toBeGreaterThan(tops[1]);

    const extended = lastSelection(view)?.ranges[0];
    const lastShown = Math.floor((tops[2] + g.body.height - 1) / ROW_HEIGHT);
    expect(extended?.startRow).toBe(2);
    expect(extended?.endRow).toBe(lastShown);

    pointer(view, 'pointerup', below);
    const stopped = view.scroller.scrollTop;
    await nextFrame();
    await nextFrame();
    expect(view.scroller.scrollTop).toBe(stopped);
  });

  it('scrolls left past the cell area while a drag holds the pointer over the row numbers', async () => {
    const view = await mount();

    view.handle.scrollTo(0, 12);
    await drawn();
    const left = view.scroller.scrollLeft;
    expect(left).toBeGreaterThan(0);

    pointer(view, 'pointerdown', cellPoint(view, 2, 10));
    pointer(view, 'pointermove', { x: 4, y: cellPoint(view, 2, 10).y });
    await nextFrame();
    await nextFrame();
    pointer(view, 'pointerup', { x: 4, y: 0 });

    expect(view.scroller.scrollLeft).toBeLessThan(left);
  });

  it('resizes a column by its header edge, reporting the width once the drag ends', async () => {
    const view = await mount();
    const edge = edgePoint(view, 1);
    const width = spacerSize(view).width;

    pointer(view, 'pointermove', edge, { buttons: 0 });
    expect(view.scroller.style.cursor).toBe('col-resize');
    pointer(view, 'pointermove', cellPoint(view, 1, 1), { buttons: 0 });
    expect(view.scroller.style.cursor).toBe('');
    pointer(view, 'pointermove', edge, { buttons: 0 });

    pointer(view, 'pointerdown', edge);
    pointer(view, 'pointermove', { x: edge.x + 30, y: edge.y });
    await drawn();
    expect(spacerSize(view).width).toBe(width + 30);
    pointer(view, 'pointermove', { x: edge.x + 50, y: edge.y });
    await drawn();
    expect(spacerSize(view).width).toBe(width + 50);
    expect(view.onColumnResize).not.toHaveBeenCalled();

    pointer(view, 'pointerup', { x: edge.x + 50, y: edge.y });
    expect(view.onColumnResize).toHaveBeenCalledTimes(1);
    expect(view.onColumnResize).toHaveBeenCalledWith(1, 170);
    expect(view.onSelectionChange).not.toHaveBeenCalled();

    view.props.columns = COLUMNS.map((column, index) =>
      index === 1 ? { ...column, width: 170 } : column
    );
    await drawn();
    expect(spacerSize(view).width).toBe(width + 50);
  });

  it('holds a resize to the minimum width, and lets a cancelled one go back', async () => {
    const view = await mount();
    const edge = edgePoint(view, 0);
    const width = spacerSize(view).width;

    pointer(view, 'pointerdown', edge);
    pointer(view, 'pointermove', { x: edge.x - 200, y: edge.y });
    await drawn();
    expect(spacerSize(view).width).toBe(width - (120 - 24));

    pointer(view, 'pointercancel', edge);
    await drawn();
    expect(spacerSize(view).width).toBe(width);

    press(view, edge);
    expect(view.onColumnResize).not.toHaveBeenCalled();
  });

  it('fits a column to the texts of its visible rows on a double click of its edge, once', async () => {
    const long = 'a value far longer than one column holds';
    const view = await mount({
      getCell: (row, col) =>
        row === 3 && col === 1 ? long : valueOf(row, col),
    });
    const edge = edgePoint(view, 1);
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = DEFAULT_FONT;
    const expected = probe.measureText(long).width + 16;

    press(view, edge);
    press(view, edge);
    mouse(view, 'dblclick', edge, { detail: 2 });

    expect(view.onColumnResize).toHaveBeenCalledTimes(1);
    const [col, width] = view.onColumnResize.mock.calls[0];
    expect(col).toBe(1);
    expect(Math.abs(width - expected)).toBeLessThanOrEqual(2);

    mouse(view, 'dblclick', cellPoint(view, 3, 1), { detail: 2 });
    expect(view.onColumnResize).toHaveBeenCalledTimes(1);
  });

  it('drags the vertical thumb to the end of its track, reaching the last of a million rows', async () => {
    const view = await mount({ rowCount: MILLION });
    const thumb = centreOf(view, 'grid-vertical-thumb');

    pointer(view, 'pointerdown', thumb);
    pointer(view, 'pointermove', { x: thumb.x, y: thumb.y + 100 });
    await drawn();
    expect(geometry(view).top).toBeGreaterThan(0);

    pointer(view, 'pointermove', { x: thumb.x, y: HEIGHT + 40 });
    pointer(view, 'pointerup', { x: thumb.x, y: HEIGHT + 40 });
    await drawn();
    await nextFrame();

    expect(lastViewport(view)?.rowEnd).toBe(MILLION - 1);
    expect(
      view.scroller.scrollHeight -
        view.scroller.clientHeight -
        view.scroller.scrollTop
    ).toBeLessThan(1);
    expect(view.onSelectionChange).not.toHaveBeenCalled();
  });

  it('drags the horizontal thumb to the end of its track, reaching the last column', async () => {
    const view = await mount();
    const thumb = centreOf(view, 'grid-horizontal-thumb');

    pointer(view, 'pointerdown', thumb);
    pointer(view, 'pointermove', { x: WIDTH + 40, y: thumb.y });
    pointer(view, 'pointerup', { x: WIDTH + 40, y: thumb.y });
    await drawn();
    await nextFrame();

    expect(lastViewport(view)?.colEnd).toBe(COLUMNS.length - 1);
    expect(view.scroller.scrollLeft).toBe(
      view.scroller.scrollWidth - view.scroller.clientWidth
    );
  });

  it('pages the rows or the columns one view on a press on a track', async () => {
    const view = await mount();
    const g = geometry(view);
    const vertical = node(view, 'grid-vertical-thumb');
    const horizontal = node(view, 'grid-horizontal-thumb');
    const belowThumb = {
      x: vertical.x() + 2,
      y: vertical.y() + vertical.height() + 20,
    };

    press(view, belowThumb);
    await drawn();
    expect(geometry(view).top).toBe(g.body.height);

    press(view, { x: belowThumb.x, y: g.headerHeight + 2 });
    await drawn();
    expect(geometry(view).top).toBe(0);

    press(view, {
      x: horizontal.x() + horizontal.width() + 20,
      y: horizontal.y() + 2,
    });
    await drawn();
    expect(view.scroller.scrollLeft).toBe(g.body.width);
  });

  it('opens no native menu on a right click of a cell, and moves the active cell from outside the selection', async () => {
    const menu = vi.fn<(event: CellContextMenuEvent) => void>();
    const view = await mount({ onCellContextMenu: menu });
    const rect = view.scroller.getBoundingClientRect();

    press(view, cellPoint(view, 1, 1));
    press(view, cellPoint(view, 3, 3), { shiftKey: true });
    view.onSelectionChange.mockClear();

    const inside = cellPoint(view, 2, 2);
    expect(
      mouse(view, 'contextmenu', inside, { button: 2 }).defaultPrevented
    ).toBe(true);
    expect(view.onSelectionChange).not.toHaveBeenCalled();
    expect(menu).toHaveBeenLastCalledWith({
      row: 2,
      col: 2,
      clientX: rect.left + inside.x,
      clientY: rect.top + inside.y,
    });

    const outside = cellPoint(view, 6, 4);
    mouse(view, 'contextmenu', outside, { button: 2 });
    expect(view.onSelectionChange).toHaveBeenCalledTimes(1);
    expect(lastSelection(view)).toEqual({
      active: { row: 6, col: 4 },
      ranges: [range(6, 4)],
    });
    expect(menu).toHaveBeenCalledTimes(2);

    expect(
      mouse(view, 'contextmenu', headerPoint(view, 2), { button: 2 })
        .defaultPrevented
    ).toBe(false);
    expect(menu).toHaveBeenCalledTimes(2);
  });

  it('leaves the native menu alone when the host takes no right clicks', async () => {
    const view = await mount();

    expect(
      mouse(view, 'contextmenu', cellPoint(view, 2, 2), { button: 2 })
        .defaultPrevented
    ).toBe(false);
    expect(view.onSelectionChange).not.toHaveBeenCalled();
  });
});

describe('the keyboard', () => {
  it('moves the active cell with the arrows and extends the last range with Shift', async () => {
    const view = await mount();

    expect(key(view, 'ArrowDown').defaultPrevented).toBe(true);
    key(view, 'ArrowRight');
    expect(lastSelection(view)).toEqual({
      active: { row: 1, col: 1 },
      ranges: [range(1, 1)],
    });

    key(view, 'ArrowDown', { shiftKey: true });
    key(view, 'ArrowDown', { shiftKey: true });
    key(view, 'ArrowRight', { shiftKey: true });
    expect(lastSelection(view)).toEqual({
      active: { row: 1, col: 1 },
      ranges: [range(1, 1, 3, 2)],
    });

    key(view, 'ArrowUp');
    key(view, 'ArrowLeft');
    key(view, 'ArrowLeft');
    expect(lastSelection(view)).toEqual({
      active: { row: 0, col: 0 },
      ranges: [range(0, 0)],
    });
    expect(view.onSelectionChange).toHaveBeenCalledTimes(7);
  });

  it('jumps to the grid edges with Ctrl or Cmd, Home and End, the view following', async () => {
    const view = await mount();

    key(view, 'ArrowDown', MOD);
    await drawn();
    await nextFrame();
    expect(lastSelection(view)?.active).toEqual({ row: ROW_COUNT - 1, col: 0 });
    expect(lastViewport(view)?.rowEnd).toBe(ROW_COUNT - 1);

    key(view, 'ArrowRight', MOD);
    await drawn();
    await nextFrame();
    expect(lastSelection(view)?.active).toEqual({
      row: ROW_COUNT - 1,
      col: 29,
    });
    expect(lastViewport(view)?.colEnd).toBe(29);

    key(view, 'Home');
    expect(lastSelection(view)?.active).toEqual({ row: ROW_COUNT - 1, col: 0 });
    key(view, 'End');
    expect(lastSelection(view)?.active).toEqual({
      row: ROW_COUNT - 1,
      col: 29,
    });

    key(view, 'Home', MOD);
    await drawn();
    expect(lastSelection(view)?.active).toEqual({ row: 0, col: 0 });
    expect(geometry(view).top).toBe(0);
    expect(view.scroller.scrollLeft).toBe(0);

    key(view, 'End', MOD);
    expect(lastSelection(view)?.active).toEqual({
      row: ROW_COUNT - 1,
      col: 29,
    });
  });

  it('pages by the rows one screen holds, the view moving with the cell', async () => {
    const view = await mount();
    const page = Math.floor(geometry(view).body.height / ROW_HEIGHT);

    key(view, 'ArrowDown');
    key(view, 'PageDown');
    await drawn();
    expect(lastSelection(view)?.active).toEqual({ row: 1 + page, col: 0 });
    expect(geometry(view).top).toBe(page * ROW_HEIGHT);

    key(view, 'PageDown', { shiftKey: true });
    await drawn();
    expect(lastSelection(view)?.ranges).toEqual([
      range(1 + page, 0, 1 + 2 * page, 0),
    ]);
    expect(geometry(view).top).toBe(2 * page * ROW_HEIGHT);

    key(view, 'PageUp');
    key(view, 'PageUp');
    await drawn();
    expect(lastSelection(view)?.active).toEqual({ row: 0, col: 0 });
    expect(geometry(view).top).toBe(0);
  });

  it('stays put on Tab at the last column and on Shift+Enter at the first row, the keys still consumed', async () => {
    const view = await mount();

    expect(key(view, 'Tab').defaultPrevented).toBe(true);
    expect(lastSelection(view)?.active).toEqual({ row: 0, col: 1 });

    key(view, 'End');
    const calls = view.onSelectionChange.mock.calls.length;
    expect(key(view, 'Tab').defaultPrevented).toBe(true);
    expect(key(view, 'Enter', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(view.onSelectionChange).toHaveBeenCalledTimes(calls);

    key(view, 'Tab', { shiftKey: true });
    expect(lastSelection(view)?.active).toEqual({ row: 0, col: 28 });
  });

  it('selects every cell as one range with Ctrl or Cmd and A', async () => {
    const view = await mount({ rowCount: MILLION });

    key(view, 'ArrowDown');
    expect(key(view, 'a', MOD).defaultPrevented).toBe(true);
    expect(lastSelection(view)).toEqual({
      active: { row: 1, col: 0 },
      ranges: [range(0, 0, MILLION - 1, 29)],
    });
  });

  it('leaves every key it neither moves nor edits with to the host, unprevented', async () => {
    const view = await mount();
    const reached: string[] = [];
    const listener = (event: KeyboardEvent) => {
      if (!event.defaultPrevented) reached.push(event.key);
    };
    window.addEventListener('keydown', listener);
    teardowns.push(() => window.removeEventListener('keydown', listener));

    key(view, 'z', MOD);
    key(view, 's', MOD);
    key(view, 'x');
    key(view, 'Enter', MOD);
    key(view, 'F2', { shiftKey: true });
    key(view, 'Delete', { shiftKey: true });
    key(view, 'Escape');
    key(view, 'ArrowDown', { altKey: true });
    key(view, 'ArrowDown', { isComposing: true });

    expect(reached).toEqual([
      'z',
      's',
      'x',
      'Enter',
      'F2',
      'Delete',
      'Escape',
      'ArrowDown',
      'ArrowDown',
    ]);
    expect(view.onSelectionChange).not.toHaveBeenCalled();
    expect(view.onCommit).not.toHaveBeenCalled();
    expect(getComputedStyle(view.textarea).opacity).toBe('0');
  });

  it('scrolls the cell a key moves to into view by the least distance', async () => {
    const view = await mount();
    const g = geometry(view);
    const offsets = offsetsOf(view);
    const shown = Math.floor(g.body.height / ROW_HEIGHT);

    for (let step = 0; step < shown + 2; step++) key(view, 'ArrowDown');
    await drawn();
    expect(geometry(view).top).toBe((shown + 3) * ROW_HEIGHT - g.body.height);

    const columns = Math.floor(g.body.width / 120);
    for (let step = 0; step < columns + 1; step++) key(view, 'ArrowRight');
    await drawn();
    expect(geometry(view).left).toBe(offsets[columns + 2] - g.body.width);

    key(view, 'ArrowUp', MOD);
    await drawn();
    expect(geometry(view).top).toBe(0);
    expect(geometry(view).left).toBe(offsets[columns + 2] - g.body.width);
  });

  it('moves on a real key press in the focused textarea', async () => {
    const view = await mount();
    view.textarea.focus();

    await userEvent.keyboard('{ArrowDown}{ArrowRight}');

    expect(lastSelection(view)?.active).toEqual({ row: 1, col: 1 });
    expect(document.activeElement).toBe(view.textarea);
  });
});

describe('the wheel and the focus', () => {
  const wheel = (view: View, init: WheelEventInit) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      composed: true,
      ...init,
    });

    view.textarea.dispatchEvent(event);
    return event;
  };

  it('hands a wheel over the focus textarea to the scroller, in pixels, lines or across', async () => {
    const view = await mount();

    expect(wheel(view, { deltaY: 100 }).defaultPrevented).toBe(true);
    expect(view.scroller.scrollTop).toBe(100);
    await drawn();
    expect(geometry(view).top).toBe(100);

    wheel(view, { deltaY: 2, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(view.scroller.scrollTop).toBe(100 + 2 * ROW_HEIGHT);

    wheel(view, { deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_PAGE });
    expect(view.scroller.scrollTop).toBe(
      100 + 2 * ROW_HEIGHT + geometry(view).body.height
    );

    wheel(view, { deltaY: 50, shiftKey: true });
    expect(view.scroller.scrollLeft).toBe(50);

    const zoom = wheel(view, { deltaY: 100, ctrlKey: true });
    expect(zoom.defaultPrevented).toBe(false);
    expect(view.scroller.scrollLeft).toBe(50);
  });

  it('scrolls under a real wheel over the active cell, which the textarea lets through', async () => {
    const view = await mount();
    await userEvent.click(view.scroller);
    const textarea = view.textarea.getBoundingClientRect();
    const scroller = view.scroller.getBoundingClientRect();

    expect(textarea.left).toBeLessThanOrEqual(
      scroller.left + scroller.width / 2
    );
    expect(textarea.right).toBeGreaterThanOrEqual(
      scroller.left + scroller.width / 2
    );

    await userEvent.wheel(view.scroller, { delta: { y: 120 } });
    await nextFrame();

    expect(view.scroller.scrollTop).toBeGreaterThan(0);
    await drawn();
    expect(geometry(view).top).toBe(view.scroller.scrollTop);
  });

  it('takes the focus on a Tab from the field before it, past the scroller', async () => {
    const field = document.createElement('input');
    const view = await mount({}, undefined, field);
    field.focus();

    await userEvent.keyboard('{Tab}');

    expect(document.activeElement).toBe(view.textarea);
  });
});

describe('the scene it drives', () => {
  interface GetterCounts {
    cell: number;
    style: number;
  }

  /** Counts each getter's calls per draw of the body layer, the counters reset as each draw begins. */
  function countDraws(view: View, counts: GetterCounts): GetterCounts[] {
    const body = node(view, 'grid-body') as unknown as Layer;
    const draws: GetterCounts[] = [];

    body.on('beforeDraw.spec', () => {
      counts.cell = 0;
      counts.style = 0;
    });
    body.on('draw.spec', () => draws.push({ ...counts }));

    return draws;
  }

  it('reads each getter once per drawn cell, the overscan at most, at any scroll', async () => {
    const counts: GetterCounts = { cell: 0, style: 0 };
    const view = await mount({
      rowCount: MILLION,
      getCell: (row, col) => {
        counts.cell++;
        return valueOf(row, col);
      },
      getCellStyle: () => {
        counts.style++;
        return undefined;
      },
    });
    const draws = countDraws(view, counts);

    for (const [row, col] of [
      [123_456, 9],
      [MILLION - 1, 29],
    ]) {
      draws.length = 0;
      view.handle.scrollTo(row, col);
      await drawn();
      await nextFrame();

      const viewport = lastViewport(view) as ViewportChange;
      const rows = viewport.rowEnd - viewport.rowStart + 1;
      const cols = viewport.colEnd - viewport.colStart + 1;
      const lower = rows * cols;
      const upper = (rows + 4) * (cols + 2);

      expect(viewport.rowEnd).toBeGreaterThanOrEqual(row);
      expect(draws.length).toBeGreaterThan(0);
      for (const draw of draws) {
        expect(draw.cell).toBeLessThanOrEqual(upper);
        expect(draw.style).toBeLessThanOrEqual(upper);
      }
      expect(draws[draws.length - 1].cell).toBeGreaterThanOrEqual(lower);
      expect(draws[draws.length - 1].style).toBeGreaterThanOrEqual(lower);
    }
  });

  it('reads every cell in view again when the version goes up, and only then', async () => {
    const counts: GetterCounts = { cell: 0, style: 0 };
    const view = await mount({
      getCell: (row, col) => {
        counts.cell++;
        return valueOf(row, col);
      },
    });
    const draws = countDraws(view, counts);

    press(view, cellPoint(view, 2, 2));
    await drawn();
    expect(draws).toEqual([]);

    view.props.version = 1;
    await drawn();
    expect(draws.length).toBeGreaterThan(0);
    expect(draws[draws.length - 1].cell).toBeGreaterThan(0);
  });

  it('draws at a pixel ratio of 2 from the mount, and follows the screen to another ratio', async () => {
    const listeners: Array<() => void> = [];
    const removed: Array<() => void> = [];
    vi.spyOn(window, 'matchMedia').mockImplementation(
      query =>
        ({
          media: query,
          matches: true,
          addEventListener: (_: string, listener: () => void) =>
            listeners.push(listener),
          removeEventListener: (_: string, listener: () => void) =>
            removed.push(listener),
        }) as unknown as MediaQueryList
    );
    const ratio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    let current = 2;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => current,
    });
    teardowns.push(() => {
      if (ratio) Object.defineProperty(window, 'devicePixelRatio', ratio);
      else Reflect.deleteProperty(window, 'devicePixelRatio');
    });

    const view = await mount();
    const canvases = Array.from(view.stageHost.querySelectorAll('canvas'));

    for (const canvas of canvases) {
      expect(canvas.width).toBe(canvas.clientWidth * 2);
      expect(canvas.height).toBe(canvas.clientHeight * 2);
    }
    expect(window.matchMedia).toHaveBeenLastCalledWith('(resolution: 2dppx)');

    current = 3;
    listeners[listeners.length - 1]();
    await drawn();

    for (const canvas of canvases) {
      expect(canvas.width).toBe(canvas.clientWidth * 3);
    }
    expect(window.matchMedia).toHaveBeenLastCalledWith('(resolution: 3dppx)');
    expect(removed).toEqual([listeners[0]]);

    const body = node(view, 'grid-body') as unknown as Layer;
    const background = cellPoint(view, 1, 1);
    expect(
      near(
        pixelAt(body, background.x + 50, background.y),
        rgba(lightTheme.background)
      )
    ).toBe(true);
  });

  it('follows its container to a new size, the stage, the spacer and the viewport with it', async () => {
    const view = await mount();
    const before = lastViewport(view) as ViewportChange;
    const spacer = spacerSize(view);

    view.host.style.width = '600px';
    view.host.style.height = '400px';
    await drawn();
    await nextFrame();

    expect(view.stage.size()).toEqual({ width: 600, height: 400 });
    expect(spacerSize(view).height).toBe(spacer.height);
    expect(spacerSize(view).width).toBe(spacer.width);
    const after = lastViewport(view) as ViewportChange;
    expect(after.colEnd).toBeLessThan(before.colEnd);
    expect(after.rowEnd).toBeLessThan(before.rowEnd);
    expect(view.onViewportChange).toHaveBeenCalledTimes(2);
  });

  it('reports the cells in view once per frame, however many scrolls moved them', async () => {
    const view = await mount({ frozenColumns: 2 });
    expect(lastViewport(view)?.colStart).toBe(0);

    view.handle.scrollTo(300, 0);
    view.handle.scrollTo(400, 0);
    view.handle.scrollTo(500, 0);
    await nextFrame();
    await nextFrame();

    expect(view.onViewportChange).toHaveBeenCalledTimes(2);
    expect(lastViewport(view)?.rowEnd).toBe(500);

    await nextFrame();
    expect(view.onViewportChange).toHaveBeenCalledTimes(2);
  });

  it('hands each prop it watches to the scene that draws it', async () => {
    const view = await mount();
    const body = node(view, 'grid-body') as unknown as Layer;
    const clear = () => {
      const point = cellPoint(view, 1, 1);
      return pixelAt(body, point.x + 50, point.y);
    };

    view.props.theme = darkTheme;
    await drawn();
    expect(near(clear(), rgba(darkTheme.background))).toBe(true);

    const style: CellStyle = { background: '#ff0000' };
    view.props.getCellStyle = () => style;
    await drawn();
    expect(near(clear(), rgba('#ff0000'))).toBe(true);

    view.props.frozenColumns = 2;
    await drawn();
    expect(geometry(view).frozen.width).toBe(240);

    view.props.rowHeight = 32;
    await drawn();
    expect(geometry(view).headerHeight).toBe(32);
    expect(spacerSize(view).height).toBe(32 + ROW_COUNT * 32 + 12);

    view.props.rowCount = 10;
    await drawn();
    expect(spacerSize(view).height).toBe(32 + 10 * 32 + 12);

    view.props.columns = COLUMNS.slice(0, 3);
    await drawn();
    expect(spacerSize(view).width).toBe(WIDTH);

    view.props.font = '20px serif';
    await drawn();
    expect(view.textarea.style.font).toBe('20px serif');

    const reads: string[] = [];
    view.props.getCell = (row, col) => {
      reads.push(`${row}:${col}`);
      return 'x';
    };
    await drawn();
    expect(reads).toContain('0:0');

    view.props.theme = undefined;
    view.props.font = undefined;
    view.props.rowHeight = undefined;
    view.props.frozenColumns = undefined;
    view.props.version = undefined;
    await drawn();
    expect(geometry(view).headerHeight).toBe(ROW_HEIGHT);
    expect(view.textarea.style.font).not.toBe('20px serif');
  });

  it('keeps the row shown when a new row count rescales the scroll range', async () => {
    const view = await mount();

    view.handle.scrollTo(500, 0);
    await drawn();
    const top = geometry(view).top;

    view.props.rowCount = MILLION;
    await drawn();

    expect(geometry(view).top).toBe(top);
    expect(view.scroller.scrollTop).toBeLessThan(top);
  });
});

describe('the handle', () => {
  it('scrolls to a cell, selects without echoing the change and takes the focus', async () => {
    const view = await mount();
    const active = node(view, 'grid-active-cell');

    view.handle.scrollTo(5, 1);
    await drawn();
    expect(geometry(view).top).toBe(0);

    view.handle.scrollTo(Number.NaN, 400);
    await drawn();
    expect(lastViewport(view)?.colEnd).toBe(COLUMNS.length - 1);

    const x = active.x();
    view.handle.select({ active: { row: 0, col: 28 }, ranges: [range(0, 28)] });
    await drawn();
    expect(active.x()).toBeGreaterThan(x);
    expect(view.onSelectionChange).not.toHaveBeenCalled();

    key(view, 'ArrowLeft');
    expect(lastSelection(view)?.active).toEqual({ row: 0, col: 27 });

    view.handle.focus();
    expect(document.activeElement).toBe(view.textarea);
  });

  it('does nothing once the grid is gone, and a grid with no rows scrolls nowhere', async () => {
    const empty = await mount({ rowCount: 0 });
    empty.handle.scrollTo(4, 4);
    expect(empty.scroller.scrollTop).toBe(0);

    const view = await mount();
    const { handle } = view;
    view.unmount();
    views.splice(views.indexOf(view), 1);

    handle.scrollTo(10, 10);
    handle.select({ active: { row: 1, col: 1 }, ranges: [range(1, 1)] });
    handle.focus();
    expect(document.activeElement).not.toBe(view.textarea);
  });
});

describe('an unmount', () => {
  it('tears the stage down first and leaves no observer, listener or frame running', async () => {
    const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
    const queries: MediaQueryList[] = [];
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation(query => {
      const list = matchMedia(query);
      vi.spyOn(list, 'removeEventListener');
      queries.push(list);
      return list;
    });

    const view = await mount();
    const { stage, host, stageHost } = view;
    view.onViewportChange.mockClear();

    view.handle.scrollTo(400, 0);
    render(host, null);
    views.splice(views.indexOf(view), 1);

    expect(stages).not.toContain(stage);
    expect(stageHost.isConnected).toBe(false);
    for (const canvas of Array.from(stageHost.querySelectorAll('canvas'))) {
      expect([canvas.width, canvas.height]).toEqual([0, 0]);
    }
    expect(disconnect).toHaveBeenCalled();
    expect(queries[0].removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );

    host.style.width = '500px';
    requestFlush();
    await drawn();
    await nextFrame();
    await nextFrame();

    expect(view.onViewportChange).not.toHaveBeenCalled();
    expect(stage.size()).toEqual({ width: WIDTH, height: HEIGHT });
    host.remove();
  });
});
