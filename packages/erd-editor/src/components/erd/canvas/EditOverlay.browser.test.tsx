import { createRef, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import {
  layoutMemoLines,
  MEMO_FONT_WEIGHT,
  MEMO_LINE_HEIGHT_PX,
} from '@/components/erd/canvas/memo/memoText';
import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';
import {
  COLUMN_TEXT_Y,
  getColumnCellSlots,
  HEADER_CELLS_X,
  HEADER_CELLS_Y,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import * as dataTypeStyles from '@/components/table-view/column/column-data-type/ColumnDataType.styles';
import { themeContext } from '@/components/themeContext';
import {
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
    lineHeight: `${MEMO_LINE_HEIGHT_PX}px`,
    letterSpacing: '0em',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  document.body.append(mirror);
  const count = Math.round(
    mirror.getBoundingClientRect().height / MEMO_LINE_HEIGHT_PX
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
