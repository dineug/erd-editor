import { addCSSHost, createRef, render, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import { type AppContext, appContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import * as overlayStyles from '@/components/erd/canvas/EditOverlay.styles';
import {
  getMemoLineHeightPx,
  layoutMemoLines,
  MEMO_FONT_WEIGHT,
} from '@/components/erd/canvas/memo/memoText';
import {
  SCENE_FONT,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';
import {
  CELL_UNDERLINE_Y,
  COLUMN_TEXT_Y,
  getCellTextBaseline,
  getCellTextHeight,
  getColumnCellSlots,
  HEADER_CELLS_X,
  HEADER_CELLS_Y,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import * as dataTypeStyles from '@/components/table-view/column/column-data-type/ColumnDataType.styles';
import { themeContext } from '@/components/themeContext';
import {
  INPUT_HEIGHT,
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_PADDING,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import {
  editMemoAction,
  editMemoEndAction,
  editTableAction,
  editTableEndAction,
  focusColumnAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import {
  addMemoAction$,
  removeMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import { whenDrawn } from '@/konva/batchDraw';
import {
  getColumnRect,
  getTableRect,
  getTableWidths,
} from '@/konva/scene/metrics';
import { focusEvent } from '@/utils/internalEvents';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

type Fixture = {
  app: AppContext;
  mounted: Mounted;
  tableId: string;
  columnId: string;
};

async function setup(): Promise<Fixture> {
  const $root = document.createElement('div');
  document.body.append($root);
  const root = createRef<HTMLDivElement>($root);
  const canvas = createRef<HTMLDivElement>();
  const app = createTestAppContext();
  const mounted = mount(<Canvas root={root} canvas={canvas} />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  const { store } = app;
  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  store.dispatchSync(addColumnAction$(tableId));
  const columnId = store.state.collections.tableEntities[tableId].columnIds[0];

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
    $root.remove();
  });

  return { app, mounted, tableId, columnId };
}

const overlayOf = (mounted: Mounted) =>
  mounted.container.querySelector('.edit-overlay') as HTMLElement;

const inputOf = (mounted: Mounted) =>
  overlayOf(mounted).querySelector('input.edit-input') as HTMLInputElement;

const cellOf = (mounted: Mounted) =>
  overlayOf(mounted).querySelector('.edit-overlay-cell') as HTMLElement;

/** The three numbers a placed editor's transform is written out of. */
const transformOf = (mounted: Mounted) => {
  const [x, y, scale] = (
    cellOf(mounted).style.transform.match(/-?[\d.]+/g) ?? []
  ).map(Number);
  return { x, y, scale };
};

async function editTableName(fixture: Fixture) {
  const { store } = fixture.app;
  store.dispatchSync(
    focusTableAction({
      tableId: fixture.tableId,
      focusType: FocusType.tableName,
    }),
    editTableAction()
  );
  await flush();
}

async function editColumnName(fixture: Fixture) {
  const { store } = fixture.app;
  store.dispatchSync(
    focusColumnAction({
      tableId: fixture.tableId,
      columnId: fixture.columnId,
      focusType: FocusType.columnName,
      $mod: false,
      shiftKey: false,
    }),
    editTableAction()
  );
  await flush();
}

async function editColumnDataType(fixture: Fixture) {
  const { store } = fixture.app;
  store.dispatchSync(
    focusColumnAction({
      tableId: fixture.tableId,
      columnId: fixture.columnId,
      focusType: FocusType.columnDataType,
      $mod: false,
      shiftKey: false,
    }),
    editTableAction()
  );
  await flush();
}

const hintRowsOf = (mounted: Mounted) =>
  Array.from(
    cellOf(mounted).querySelectorAll<HTMLElement>(`.${dataTypeStyles.hintItem}`)
  );

/** A row's data type, without the shortcut badge sharing the line with it. */
const hintNameOf = (row: HTMLElement) =>
  Array.from(row.childNodes)
    .filter(
      node => !(node instanceof HTMLElement && node.classList.contains('kbd'))
    )
    .map(node => node.textContent ?? '')
    .join('')
    .trim();

/** Raises the hint list the way a person does, by typing into the open editor. */
async function typeDataType(fixture: Fixture, value: string) {
  await userEvent.fill(inputOf(fixture.mounted), value);
  await flush();
}

describe('the editing overlay', () => {
  it('takes no pointer event of its own while nothing is being edited', async () => {
    const { mounted } = await setup();
    const overlay = overlayOf(mounted);

    expect(overlay).toBeTruthy();
    expect(overlay.style.pointerEvents).toBe('none');
    expect(inputOf(mounted)).toBeNull();
  });

  it('opens an input on the cell the focus is editing', async () => {
    const fixture = await setup();
    await editTableName(fixture);

    const input = inputOf(fixture.mounted);
    expect(input).toBeTruthy();
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('table');
    expect(document.activeElement).toBe(input);
  });

  it('closes the input when the edit ends', async () => {
    const fixture = await setup();
    await editTableName(fixture);
    fixture.app.store.dispatchSync(editTableEndAction());
    await flush();

    expect(inputOf(fixture.mounted)).toBeNull();
  });

  it('opens nothing while the focus is on a cell no editor writes into', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    store.dispatchSync(
      focusColumnAction({
        tableId: fixture.tableId,
        columnId: fixture.columnId,
        focusType: FocusType.columnNotNull,
        $mod: false,
        shiftKey: false,
      }),
      editTableAction()
    );
    await flush();

    expect(inputOf(fixture.mounted)).toBeNull();
  });

  it('writes the typed table name back into the store', async () => {
    const fixture = await setup();
    await editTableName(fixture);

    const input = inputOf(fixture.mounted);
    input.value = 'members';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    expect(
      fixture.app.store.state.collections.tableEntities[fixture.tableId].name
    ).toBe('members');
  });

  it('writes the typed table comment back into the store', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    store.dispatchSync(
      focusTableAction({
        tableId: fixture.tableId,
        focusType: FocusType.tableComment,
      }),
      editTableAction()
    );
    await flush();

    const input = inputOf(fixture.mounted);
    input.value = 'the members';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    expect(
      fixture.app.store.state.collections.tableEntities[fixture.tableId].comment
    ).toBe('the members');
  });

  it('writes the typed column name back into the store', async () => {
    const fixture = await setup();
    await editColumnName(fixture);

    const input = inputOf(fixture.mounted);
    input.value = 'nickname';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    expect(
      fixture.app.store.state.collections.tableColumnEntities[fixture.columnId]
        .name
    ).toBe('nickname');
  });

  it.each([
    ['columnDataType', FocusType.columnDataType, 'dataType'],
    ['columnDefault', FocusType.columnDefault, 'default'],
    ['columnComment', FocusType.columnComment, 'comment'],
  ])(
    'opens the %s editor on the value that cell holds',
    async (_name, focusType, placeholder) => {
      const fixture = await setup();
      const { store } = fixture.app;
      store.dispatchSync(
        changeShowAction({ show: Show.columnDefault, value: true }),
        changeShowAction({ show: Show.columnComment, value: true }),
        focusColumnAction({
          tableId: fixture.tableId,
          columnId: fixture.columnId,
          focusType,
          $mod: false,
          shiftKey: false,
        }),
        editTableAction()
      );
      await flush();

      const input = inputOf(fixture.mounted);
      expect(input.placeholder).toBe(placeholder);

      input.value = 'written';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      const column =
        store.state.collections.tableColumnEntities[fixture.columnId];
      const written =
        focusType === FocusType.columnDataType
          ? column.dataType
          : focusType === FocusType.columnDefault
            ? column.default
            : column.comment;
      expect(written).toBe('written');
    }
  );

  it('ignores an input event that carries no element', async () => {
    const fixture = await setup();
    await editTableName(fixture);

    const input = inputOf(fixture.mounted);
    const event = new InputEvent('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    input.dispatchEvent(event);
    await flush();

    expect(
      fixture.app.store.state.collections.tableEntities[fixture.tableId].name
    ).toBe('');
  });

  it('opens nothing for a focus naming a column its table has dropped', async () => {
    const fixture = await setup();
    await editColumnName(fixture);
    expect(inputOf(fixture.mounted)).toBeTruthy();

    fixture.app.store.dispatchSync(
      removeColumnAction$(fixture.tableId, [fixture.columnId])
    );
    await flush();

    expect(inputOf(fixture.mounted)).toBeNull();
  });

  it('ends the edit when the editor blurs', async () => {
    const fixture = await setup();
    await editTableName(fixture);

    inputOf(fixture.mounted).dispatchEvent(
      new FocusEvent('blur', { bubbles: false })
    );
    await flush();

    expect(fixture.app.store.state.editor.focusTable?.edit).toBe(false);
  });

  it('places the editor on the header cell it replaces', async () => {
    const fixture = await setup();
    await editTableName(fixture);

    const { store } = fixture.app;
    const table = store.state.collections.tableEntities[fixture.tableId];
    const rect = getTableRect(store.state, table);
    const transform = transformOf(fixture.mounted);

    expect(transform.x).toBeCloseTo(rect.x + HEADER_CELLS_X, 5);
    expect(transform.y).toBeCloseTo(rect.y + HEADER_CELLS_Y + HEADER_TEXT_Y, 5);
    expect(transform.scale).toBe(1);
  });

  it('places the editor on the column cell it replaces', async () => {
    const fixture = await setup();
    await editColumnName(fixture);

    const { store } = fixture.app;
    const table = store.state.collections.tableEntities[fixture.tableId];
    const rect = getTableRect(store.state, table);
    const slot = getColumnCellSlots(
      store.state,
      getTableWidths(store.state, table)
    ).find(candidate => candidate.focusType === FocusType.columnName);
    const columnRect = getColumnRect(store.state, table, 0);
    const transform = transformOf(fixture.mounted);

    expect(transform.x).toBeCloseTo(rect.x + (slot?.x ?? 0), 5);
    expect(transform.y).toBeCloseTo(columnRect.y + COLUMN_TEXT_Y, 5);
    expect(transform.scale).toBe(1);
  });

  it('scales the editor with the zoom and follows the scroll', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    // The lowest zoom that still draws cells: below the 0.7 boundary a table is
    // the high level box, which has no cell for an editor to sit on.
    const zoom = 0.8;
    store.dispatchSync(
      changeZoomLevelAction({ value: zoom }),
      streamScrollToAction({ movementX: -40, movementY: -20 })
    );
    await editTableName(fixture);

    const { scrollLeft, scrollTop, width, height } = store.state.settings;
    const table = store.state.collections.tableEntities[fixture.tableId];
    const rect = getTableRect(store.state, table);
    const originX = scrollLeft + (width * (1 - zoom)) / 2;
    const originY = scrollTop + (height * (1 - zoom)) / 2;
    const transform = transformOf(fixture.mounted);

    expect(transform.x).toBeCloseTo(
      originX + (rect.x + HEADER_CELLS_X) * zoom,
      5
    );
    expect(transform.y).toBeCloseTo(
      originY + (rect.y + HEADER_CELLS_Y + HEADER_TEXT_Y) * zoom,
      5
    );
    expect(transform.scale).toBe(zoom);

    // The css scale carries the border, the padding and the caret with it, so
    // the box on screen is exactly the layout box times the zoom.
    const input = inputOf(fixture.mounted);
    const painted = input.getBoundingClientRect();
    expect(painted.width).toBeCloseTo(input.offsetWidth * zoom, 1);
    expect(painted.height).toBeCloseTo(input.offsetHeight * zoom, 1);
  });

  it('closes the editor when the zoom drops to the high level render', async () => {
    const fixture = await setup();
    await editTableName(fixture);
    expect(inputOf(fixture.mounted)).toBeTruthy();

    fixture.app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    expect(inputOf(fixture.mounted)).toBeNull();
  });

  it('hides the konva text under the editor and shows it again after', async () => {
    const fixture = await setup();
    const stage = Reflect.get(globalThis, '__erdStages').canvas;
    const cellText = () =>
      stage
        .findOne(`#table-${fixture.tableId}`)
        ?.findOne('.tableName')
        ?.findOne('.cell-text');

    expect(cellText().visible()).toBe(true);

    await editTableName(fixture);
    await whenDrawn();
    expect(cellText().visible()).toBe(false);

    fixture.app.store.dispatchSync(editTableEndAction());
    await flush();
    await whenDrawn();
    expect(cellText().visible()).toBe(true);
  });
});

/** Written out because a comment cannot show the character it names. */
const LINE_BREAK = String.fromCharCode(10);

const MEMO_VALUE =
  'the quick brown fox jumps over the lazy dog and then does it once more';

const memoTextareas = (mounted: Mounted) =>
  overlayOf(mounted).querySelectorAll('textarea.memo-textarea');

const memoTextareaOf = (mounted: Mounted) =>
  memoTextareas(mounted)[0] as HTMLTextAreaElement;

type MemoFixture = Fixture & { memoId: string };

async function editMemo(value = MEMO_VALUE): Promise<MemoFixture> {
  const fixture = await setup();
  const { store } = fixture.app;

  store.dispatchSync(addMemoAction$());
  const memoId = store.state.doc.memoIds[0];
  store.dispatchSync(
    changeMemoValueAction({ id: memoId, value }),
    editMemoAction({ id: memoId })
  );
  await flush();
  await whenDrawn();

  return { ...fixture, memoId };
}

/**
 * How many line boxes the browser folds a value into inside a box of the same
 * width, measured in a mirror that carries the editor's own font and leading.
 */
function domLineCount(value: string, width: number): number {
  const mirror = document.createElement('div');
  mirror.textContent = value;
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
  const count = Math.round(
    mirror.getBoundingClientRect().height / getMemoLineHeightPx()
  );
  mirror.remove();

  return count;
}

describe('the memo body editor over the scene', () => {
  it('opens one textarea, focused, and no more of them', async () => {
    const { mounted, app, memoId } = await editMemo();

    expect(memoTextareas(mounted).length).toBe(1);
    const textarea = memoTextareaOf(mounted);
    expect(textarea.value).toBe(MEMO_VALUE);
    expect(document.activeElement).toBe(textarea);
    expect(app.store.state.editor.editMemoId).toBe(memoId);
  });

  it('opens no textarea while no memo is being edited', async () => {
    const { mounted } = await setup();

    expect(memoTextareas(mounted).length).toBe(0);
  });

  it('keeps a single editor open across many memos', async () => {
    const fixture = await editMemo();
    const { store } = fixture.app;

    store.dispatchSync(addMemoAction$(), addMemoAction$());
    await flush();

    expect(store.state.doc.memoIds.length).toBe(3);
    expect(memoTextareas(fixture.mounted).length).toBe(1);
  });

  it('places the editor on the body box the scene clipped', async () => {
    const fixture = await editMemo();
    const memo =
      fixture.app.store.state.collections.memoEntities[fixture.memoId];
    const transform = transformOf(fixture.mounted);

    expect(transform.x).toBeCloseTo(memo.ui.x + MEMO_BORDER + MEMO_PADDING, 5);
    expect(transform.y).toBeCloseTo(
      memo.ui.y + MEMO_BORDER + MEMO_PADDING + MEMO_HEADER_HEIGHT,
      5
    );
    expect(transform.scale).toBe(1);

    const textarea = memoTextareaOf(fixture.mounted);
    expect(textarea.offsetWidth).toBe(memo.ui.width);
    expect(textarea.offsetHeight).toBe(memo.ui.height);
  });

  it('writes the typed memo body back into the store', async () => {
    const fixture = await editMemo();

    const textarea = memoTextareaOf(fixture.mounted);
    textarea.value = 'a note to self';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    expect(
      fixture.app.store.state.collections.memoEntities[fixture.memoId].value
    ).toBe('a note to self');
  });

  it('ignores a memo input event that carries no element', async () => {
    const fixture = await editMemo();

    const textarea = memoTextareaOf(fixture.mounted);
    textarea.value = 'dropped';
    const event = new InputEvent('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    textarea.dispatchEvent(event);
    await flush();

    expect(
      fixture.app.store.state.collections.memoEntities[fixture.memoId].value
    ).toBe(MEMO_VALUE);
  });

  it('ends the edit and asks the host for the focus back on blur', async () => {
    const fixture = await editMemo();
    let asked = 0;
    const listen = () => {
      asked += 1;
    };
    document.body.addEventListener(focusEvent.type, listen, true);

    memoTextareaOf(fixture.mounted).blur();
    await flush();
    document.body.removeEventListener(focusEvent.type, listen, true);

    expect(fixture.app.store.state.editor.editMemoId).toBeNull();
    expect(memoTextareas(fixture.mounted).length).toBe(0);
    expect(asked).toBe(1);
  });

  it('closes the memo editor when Escape is pressed in it', async () => {
    const fixture = await editMemo();

    memoTextareaOf(fixture.mounted).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await flush();

    expect(fixture.app.store.state.editor.editMemoId).toBeNull();
  });

  // Escape mid-composition cancels the composition in any textarea and leaves
  // the field standing; closing here would commit a half-formed syllable.
  it.each([
    ['isComposing', { isComposing: true }],
    ['keyCode 229', { keyCode: 229 }],
  ])(
    'keeps the memo editor open on Escape while the IME reports %s',
    async (_label, composing) => {
      const fixture = await editMemo();

      memoTextareaOf(fixture.mounted).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          ...composing,
        })
      );
      await flush();

      expect(fixture.app.store.state.editor.editMemoId).toBe(fixture.memoId);
      expect(memoTextareas(fixture.mounted).length).toBe(1);
    }
  );

  it('leaves the memo editor open on any other key', async () => {
    const fixture = await editMemo();

    memoTextareaOf(fixture.mounted).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    );
    await flush();

    expect(fixture.app.store.state.editor.editMemoId).toBe(fixture.memoId);
  });

  it('keeps a wheel over the memo editor off the canvas below it', async () => {
    const fixture = await editMemo();
    let reached = 0;
    const listen = () => {
      reached += 1;
    };
    fixture.mounted.container.addEventListener('wheel', listen);

    memoTextareaOf(fixture.mounted).dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, deltaY: 120 })
    );
    fixture.mounted.container.removeEventListener('wheel', listen);

    expect(reached).toBe(0);
  });

  it('closes the memo editor once the memo is gone', async () => {
    const fixture = await editMemo();
    expect(memoTextareas(fixture.mounted).length).toBe(1);

    fixture.app.store.dispatchSync(removeMemoAction$(fixture.memoId));
    await flush();

    expect(memoTextareas(fixture.mounted).length).toBe(0);
  });

  it('hides the drawn memo body under the editor and shows it again after', async () => {
    const fixture = await editMemo();
    const stage = Reflect.get(globalThis, '__erdStages').canvas;
    const body = () =>
      stage.findOne(`#memo-${fixture.memoId}`)?.findOne('.memo-textarea');

    await whenDrawn();
    expect(body().visible()).toBe(false);

    fixture.app.store.dispatchSync(editMemoEndAction());
    await flush();
    await whenDrawn();
    expect(body().visible()).toBe(true);
  });

  it('folds the editor and the drawn body on the same line breaks', async () => {
    const fixture = await editMemo();
    const memo =
      fixture.app.store.state.collections.memoEntities[fixture.memoId];
    const folded = layoutMemoLines(MEMO_VALUE, memo.ui.width);

    expect(folded.length).toBeGreaterThan(1);
    expect(folded.join('')).toBe(MEMO_VALUE);
    expect(domLineCount(MEMO_VALUE, memo.ui.width)).toBe(folded.length);

    fixture.app.store.dispatchSync(editMemoEndAction());
    await flush();
    await whenDrawn();

    const stage = Reflect.get(globalThis, '__erdStages').canvas;
    const drawn = stage
      .findOne(`#memo-${fixture.memoId}`)
      .findOne('.memo-textarea').attrs.text as string;

    expect(drawn.split(LINE_BREAK)).toEqual(folded);
  });
});

/**
 * The data type autocomplete, which is the one editor that opens dom of its
 * own beside the input. The list sits over the stage rather than in it, so the
 * canvas routing cannot hit test it and reads a press on it as bare canvas.
 */
describe('the data type hint list over the scene', () => {
  it('writes the data type of a hint pressed with a real mouse', async () => {
    const fixture = await setup();
    await editColumnDataType(fixture);
    await typeDataType(fixture, 'int');

    const [row] = hintRowsOf(fixture.mounted);
    expect(row).toBeTruthy();
    const name = hintNameOf(row);
    expect(name).toBeTruthy();

    await userEvent.click(row);
    await flush();

    const { store } = fixture.app;
    expect(
      store.state.collections.tableColumnEntities[fixture.columnId].dataType
    ).toBe(name);
    expect(hintRowsOf(fixture.mounted).length).toBe(0);
    expect(store.state.editor.focusTable?.edit).toBe(true);
  });

  it('keeps a press on the hint list from reaching the canvas routing', async () => {
    const fixture = await setup();
    await editColumnDataType(fixture);
    await typeDataType(fixture, 'int');

    let reached = 0;
    const listen = () => {
      reached += 1;
    };
    fixture.mounted.container.addEventListener('mousedown', listen);

    // The input's own press does travel, which is what the routing filters on
    // its class and what proves the listener below is wired at all.
    await userEvent.click(inputOf(fixture.mounted));
    expect(reached).toBe(1);

    const [row] = hintRowsOf(fixture.mounted);
    expect(row).toBeTruthy();
    await userEvent.click(row);
    fixture.mounted.container.removeEventListener('mousedown', listen);

    expect(reached).toBe(1);
  });
});

/** The pixel rows one crop of a canvas has ink in, dimmest sample first. */
function inkRows(canvas: HTMLCanvasElement): number[] {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context to read the drawn line back');

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const rows: number[] = [];

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += data[(y * width + x) * 4 + 3] / 255;
    rows.push(sum);
  }

  return rows;
}

/** Where the weight of an ink profile sits, which a sub-pixel shift moves. */
function centroidOf(rows: number[]): number {
  let weighted = 0;
  let total = 0;

  rows.forEach((row, index) => {
    weighted += row * index;
    total += row;
  });

  return total ? weighted / total : 0;
}

const CELL_SAMPLE = 'Hxp';
const RASTER_SCALE = 4;

/**
 * Where a line centred in the cell box sits, written out here rather than read
 * off the scene. Konva is the other half of the comparison, and neither one is
 * allowed to be the definition of the other.
 */
function cellTextBaseline(): number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('no 2d context to measure the face with');
  context.font = SCENE_FONT;
  const metrics = context.measureText('M');

  return (
    getCellTextHeight() / 2 +
    (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
  );
}

/**
 * That same line drawn straight onto a canvas, at the scale the comparison
 * reads it back at. One rasteriser puts a glyph where the number says, which is
 * what the other one is then asked to agree with.
 */
function drawBaselineText(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 60 * RASTER_SCALE;
  canvas.height = getCellTextHeight() * RASTER_SCALE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context to draw the reference line');
  context.scale(RASTER_SCALE, RASTER_SCALE);
  context.font = SCENE_FONT;
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#fff';
  context.fillText(CELL_SAMPLE, 0, cellTextBaseline());

  return canvas;
}

/** The same string through konva, laid out the way a cell hands it over. */
async function drawKonvaText(): Promise<HTMLCanvasElement> {
  const { Stage } = await import('konva/lib/Stage');
  const { Layer } = await import('konva/lib/Layer');
  const { Text } = await import('konva/lib/shapes/Text');

  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({
    container,
    width: 60,
    height: getCellTextHeight(),
  });
  const layer = new Layer();
  stage.add(layer);
  layer.add(
    new Text({
      x: 0,
      y: 0,
      width: 60,
      height: getCellTextHeight(),
      text: CELL_SAMPLE,
      fill: '#fff',
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
      verticalAlign: 'middle',
      wrap: 'none',
    })
  );
  layer.draw();

  const canvas = stage.toCanvas({ pixelRatio: RASTER_SCALE });
  stage.destroy();
  container.remove();

  return canvas;
}

/**
 * The number the editor places its input by. Konva centres a drawn line by the
 * font's own metrics, so nothing but drawing it says where that lands, and the
 * editor would follow a stale formula in silence.
 */
describe('the baseline the scene draws a cell line on', () => {
  it('is the one a line centred in the cell box lands on', async () => {
    const konva = inkRows(await drawKonvaText());
    const reference = inkRows(drawBaselineText());

    expect(konva.some(row => row > 0)).toBe(true);
    expect(
      Math.abs(centroidOf(konva) - centroidOf(reference)) / RASTER_SCALE
    ).toBeLessThan(0.05);
  });

  it('is the whole pixel the cell box was sized to centre one on', () => {
    // Blink puts a painted baseline on the device grid before the zoom scales
    // it, and rounds to the css pixel where a device pixel is one. A fraction
    // here is what one rasteriser keeps and the other takes away.
    expect(cellTextBaseline()).toBe(getCellTextBaseline());
    expect(Number.isInteger(getCellTextBaseline())).toBe(true);
  });

  it('keeps the box it centres in inside the slot, and the line above the rule', () => {
    expect(getCellTextHeight()).toBeLessThanOrEqual(INPUT_HEIGHT);
    expect(getCellTextBaseline()).toBeLessThan(CELL_UNDERLINE_Y);
  });
});

/**
 * What the editor puts on the cell box so its own line lands on the drawn one.
 * Each of these is a number the scene also draws by, and a cell that loses one
 * of them drifts by a fraction nobody can see until the caret arrives.
 */
describe('the box the cell editor is placed in', () => {
  it('carries the cell class and the width the scene reserved', async () => {
    const fixture = await setup();
    await editTableName(fixture);

    const cell = cellOf(fixture.mounted);
    expect(cell.classList.contains(String(overlayStyles.cell))).toBe(true);
    expect(cell.style.width).toBe(
      `${fixture.app.store.state.collections.tableEntities[fixture.tableId].ui.widthName}px`
    );
  });

  it('leaves the memo body editor out of all of it', async () => {
    const fixture = await editMemo();

    const cell = cellOf(fixture.mounted);
    expect(cell.classList.contains(String(overlayStyles.cell))).toBe(false);
    expect(cell.style.width).toBe('');
  });
});

/**
 * A mount whose stylesheets are live. The fixture above renders into a bare
 * div, which adopts no css template at all, so the input there falls back to
 * the browser's own box and every rule the overlay is placed by goes missing.
 */
async function setupStyled(): Promise<Fixture> {
  const $host = document.createElement('div');
  document.body.append($host);
  const shadow = $host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);

  const globals = document.createElement('div');
  const container = document.createElement('div');
  const $root = document.createElement('div');
  shadow.append(globals, container, $root);

  const root = createRef<HTMLDivElement>($root);
  const canvas = createRef<HTMLDivElement>();
  const app = createTestAppContext();
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(container as any, appContext, app);
  // The reset, the fonts and the typography tokens, in the order the element
  // itself puts them in. Without them an input keeps the browser's own border
  // and padding, and the box under test is nobody's.
  render(globals, <GlobalStyles />);
  render(container, <Canvas root={root} canvas={canvas} />);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    container as any,
    themeContext,
    createTestTheme()
  );

  const { store } = app;
  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  store.dispatchSync(addColumnAction$(tableId));
  const columnId = store.state.collections.tableEntities[tableId].columnIds[0];

  await flush();
  await whenDrawn();

  const mounted: Mounted = {
    container,
    app,
    unmount: () => {
      render(container, null);
      render(globals, null);
    },
  };

  teardowns.push(() => {
    mounted.unmount();
    provider.destroy();
    themeProvider.destroy();
    $host.remove();
  });

  return { app, mounted, tableId, columnId };
}

type EditedCell = {
  focusType: FocusType;
  /** Whether the cell belongs to a column row rather than the table header. */
  column: boolean;
};

/** Every cell an editor opens on, the header row first. */
const EDITED_CELLS: EditedCell[] = [
  { focusType: FocusType.tableName, column: false },
  { focusType: FocusType.tableComment, column: false },
  { focusType: FocusType.columnName, column: true },
  { focusType: FocusType.columnDataType, column: true },
  { focusType: FocusType.columnDefault, column: true },
  { focusType: FocusType.columnComment, column: true },
];

/**
 * The box the scene drew one cell's line in, in the coordinates a dom rect is
 * read in. Konva answers for it, so nothing the overlay computes goes into the
 * number the editor's own box is then held against.
 */
function sceneCellBox(fixture: Fixture, cell: EditedCell) {
  const stage = Reflect.get(globalThis, '__erdStages').canvas;
  const owner = cell.column
    ? stage.findOne(`#column-${fixture.columnId}`)
    : stage.findOne(`#table-${fixture.tableId}`);
  const text = owner?.findOne(`.${cell.focusType}`)?.findOne('.cell-text');
  if (!text) throw new Error(`the scene draws no ${cell.focusType} cell`);

  const rect = text.getClientRect({ relativeTo: stage });
  const origin = stage.container().getBoundingClientRect();

  return {
    top: origin.y + rect.y,
    left: origin.x + rect.x,
    width: rect.width,
    height: rect.height,
  };
}

/** Draws the cells the settings hide by default, at one zoom. */
async function showEveryCell(fixture: Fixture, zoomLevel: number) {
  fixture.app.store.dispatchSync(
    changeShowAction({ show: Show.columnDefault, value: true }),
    changeShowAction({ show: Show.columnComment, value: true }),
    changeZoomLevelAction({ value: zoomLevel })
  );
  await flush();
  await whenDrawn();
}

async function openCell(fixture: Fixture, cell: EditedCell) {
  fixture.app.store.dispatchSync(
    cell.column
      ? focusColumnAction({
          tableId: fixture.tableId,
          columnId: fixture.columnId,
          focusType: cell.focusType,
          $mod: false,
          shiftKey: false,
        })
      : focusTableAction({
          tableId: fixture.tableId,
          focusType: cell.focusType,
        }),
    editTableAction()
  );
  await flush();
  await whenDrawn();
}

/**
 * Ends the edit before the next cell is focused. The open input blurs when the
 * focus moves and that blur ends the edit a beat later, which would close the
 * editor the next cell had just opened.
 */
async function closeEditor(fixture: Fixture) {
  fixture.app.store.dispatchSync(editTableEndAction());
  await flush();
  await whenDrawn();
}

/**
 * Where the editor lays the line it edits, measured down from the top of its
 * own box. A zero height inline block sits on the baseline of the line it
 * joins, so a copy of the input shares one with it in a strut free holder.
 */
function editorBaselineOf(mounted: Mounted, zoomLevel: number): number {
  const input = inputOf(mounted);
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:absolute;visibility:hidden;white-space:nowrap;font-size:0;line-height:0';
  const copy = input.cloneNode(true) as HTMLElement;
  copy.style.verticalAlign = 'baseline';
  const marker = document.createElement('span');
  marker.style.cssText =
    'display:inline-block;width:0;height:0;vertical-align:baseline';
  holder.append(copy, marker);
  // Inside the cell the editor was placed in, so the copy is under the same
  // scope class and the same scale as the input it stands for.
  cellOf(mounted).append(holder);

  const top = copy.getBoundingClientRect().top;
  const baseline = marker.getBoundingClientRect().top;
  holder.remove();

  return (baseline - top) / zoomLevel;
}

/**
 * That same line in a box carrying nothing but the scene's own font and the
 * height it reserves. Laid out by the engine that lays the editor out, so the
 * two can only differ by what the editor's box puts between them.
 */
function bareLineBaseline(mounted: Mounted): number {
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:absolute;visibility:hidden;white-space:nowrap;font-size:0;line-height:0';
  const bare = document.createElement('input');
  bare.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'box-sizing:border-box',
    `height:${getCellTextHeight()}px`,
    'margin:0',
    'padding:0',
    'border:0',
    `font-family:${SCENE_FONT_FAMILY}`,
    `font-size:${SCENE_FONT_SIZE}px`,
    'font-weight:400',
    'line-height:normal',
    'vertical-align:baseline',
  ].join(';');
  const marker = document.createElement('span');
  marker.style.cssText =
    'display:inline-block;width:0;height:0;vertical-align:baseline';
  holder.append(bare, marker);
  // Outside the placed cell, so nothing the overlay writes reaches it and no
  // zoom scales the box it is measured in.
  (mounted.container.getRootNode() as ShadowRoot).append(holder);

  const top = bare.getBoundingClientRect().top;
  const baseline = marker.getBoundingClientRect().top;
  holder.remove();

  return baseline - top;
}

/**
 * What the layout may carry between the scene's box and the editor's, in scene
 * pixels. Blink lays out on a sixty fourth of a pixel, and the half pixel one
 * stray offset adds is thirty two times that.
 */
const PLACEMENT_LIMIT_PX = 1 / 64;

/**
 * The editor is dom over a canvas and the two agree only by construction. The
 * pixels are read in the e2e suite, which can resolve no less than the device
 * row a painted baseline rounds onto; the layout under that is read here.
 */
describe('the box the cell editor covers on the scene', () => {
  for (const zoomLevel of [1, 0.8]) {
    it(`is the box the scene drew the line in at zoom ${zoomLevel}`, async () => {
      const fixture = await setupStyled();
      await showEveryCell(fixture, zoomLevel);

      for (const cell of EDITED_CELLS) {
        await openCell(fixture, cell);

        const scene = sceneCellBox(fixture, cell);
        const box = inputOf(fixture.mounted).getBoundingClientRect();
        const key = String(cell.focusType);
        const offBy = (one: number, other: number) =>
          Math.abs(one - other) / zoomLevel;

        expect(offBy(box.top, scene.top), `${key} top`).toBeLessThan(
          PLACEMENT_LIMIT_PX
        );
        expect(offBy(box.left, scene.left), `${key} left`).toBeLessThan(
          PLACEMENT_LIMIT_PX
        );
        expect(offBy(box.height, scene.height), `${key} height`).toBeLessThan(
          PLACEMENT_LIMIT_PX
        );
        expect(offBy(box.width, scene.width), `${key} width`).toBeLessThan(
          PLACEMENT_LIMIT_PX
        );

        await closeEditor(fixture);
      }
    });

    it(`lands that line on the whole pixel the scene draws at zoom ${zoomLevel}`, async () => {
      const fixture = await setupStyled();
      await showEveryCell(fixture, zoomLevel);

      const baseline = getCellTextBaseline();
      expect(Number.isInteger(baseline)).toBe(true);

      for (const cell of EDITED_CELLS) {
        await openCell(fixture, cell);

        // The number both rasterisers are answerable for. A fraction here is
        // rounded by the device scale factor rather than by the zoom, so one
        // device pixel to a css pixel moves the line and a retina one does not.
        expect(
          editorBaselineOf(fixture.mounted, zoomLevel),
          `${String(cell.focusType)} whole pixel`
        ).toBeCloseTo(baseline, 3);

        await closeEditor(fixture);
      }
    });

    it(`puts its line on the baseline that box centres at zoom ${zoomLevel}`, async () => {
      const fixture = await setupStyled();
      await showEveryCell(fixture, zoomLevel);

      for (const cell of EDITED_CELLS) {
        await openCell(fixture, cell);

        // A padding, a border or a leading of its own would leave the box the
        // test above measures where it is and move the line inside it. Both
        // sides are laid out, never painted, so a headless run reads the same.
        const laid = editorBaselineOf(fixture.mounted, zoomLevel);
        expect(
          Math.abs(laid - bareLineBaseline(fixture.mounted)),
          `${String(cell.focusType)} baseline`
        ).toBeLessThan(PLACEMENT_LIMIT_PX);

        await closeEditor(fixture);
      }
    });
  }
});
