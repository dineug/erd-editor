// The Dictionary tab in Chromium with real keys: the sheets, the search, the
// row and file buttons, a paste past the end, one undo per commit, a read-only
// document, the empty sheet, the chords, a peer's batch, the checks and marks.

import {
  addCSSHost,
  type AnyAction,
  createRef,
  type FC,
  observable,
  ref,
  render,
  useProvider,
} from '@dineug/r-html';
import { currentEpoch, whenDrawn } from '@dineug/r-html-konva';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser/context';

import { createTestAppContext, flush } from '@/__test-utils__';
import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import Dictionary from '@/components/dictionary/Dictionary';
import { dictionaryViewOf } from '@/components/dictionary/dictionaryView';
import { toGridTheme } from '@/components/dictionary/gridTheme';
import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Theme from '@/components/theme/Theme';
import { themeContext } from '@/components/themeContext';
import { CanvasType } from '@/constants/schema';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeCanvasTypeAction,
  changeDatabaseNameAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { createSharedStore } from '@/engine/shared-store';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';
import type { Theme as ThemeTokens } from '@/themes/tokens';
import { hasAppleDevice } from '@/utils/device-detect';
import { copyAction, pasteAction } from '@/utils/emitter';
import { setExportFileCallback } from '@/utils/file/exportFile';
import type { KeyBindingName } from '@/utils/keyboard-shortcut';

await import('@/components/erd-editor/ErdEditor');

/** The key $mod names in the browser the spec runs in, which the bindings read too. */
const MOD = hasAppleDevice() ? 'Meta' : 'Control';

const WIDTH = 900;
const HEIGHT = 560;

const DARK = createTheme({
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  appearance: Appearance.dark,
});

const LIGHT = createTheme({
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  appearance: Appearance.light,
});

type TextCall = { text: string; fill: string };

type Fixture = {
  app: AppContext;
  shadow: ShadowRoot;
  theme: ThemeTokens;
  /** Every batch the store took since the mount. */
  batches: AnyAction[][];
  /** Every chord the editor root's binder read. */
  shortcuts: KeyBindingName[];
  /** Every copy or paste the editor root handed its emitter. */
  clipboard: string[];
};

const host = observable({ readonly: false, shown: true });
const teardowns: Array<() => void> = [];
let texts: TextCall[] = [];
let fills: string[] = [];

beforeAll(() => page.viewport(WIDTH + 200, HEIGHT + 200));

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
  vi.restoreAllMocks();
});

/** Records the text every canvas draws with its fill, and each rectangle's fill, and still draws both. */
function spyTexts() {
  texts = [];
  fills = [];
  const { fillText, fillRect } = CanvasRenderingContext2D.prototype;

  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      texts.push({ text, fill: String(this.fillStyle) });
      fillText.call(this, text, x, y, maxWidth);
    }
  );
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect').mockImplementation(
    function (this: CanvasRenderingContext2D, x, y, width, height) {
      fills.push(String(this.fillStyle));
      fillRect.call(this, x, y, width, height);
    }
  );
}

/** Resolves on the next animation frame, behind any konva asked for before it. */
const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

/** Waits until the scene has drawn and stays drawn, as the grid's own specs do. */
async function drawn() {
  let before = -1;

  for (;;) {
    await flush();
    await whenDrawn();
    await nextFrame();

    const now = currentEpoch();
    if (now === before) return;
    before = now;
  }
}

/** The texts drawn since the last call, so a case reads what one change drew. */
function drawnTexts(): string[] {
  const found = texts.map(({ text }) => text);
  texts = [];
  return found;
}

const word = (id: string, name: string, values: Record<string, string> = {}) =>
  addDictionaryAction({
    kind: DictionaryKind.word,
    id,
    values: { name, ...values },
  });

const term = (id: string, values: Record<string, string>) =>
  addDictionaryAction({ kind: DictionaryKind.term, id, values });

/** A table member, its logical name the one given, with one column mbr_addr of its own. */
const memberTable = (tableName: string, columnName: string): AnyAction[] => [
  addTableAction({ id: 'member', ui: { x: 0, y: 0, zIndex: 1 } }),
  changeTableNameAction({ id: 'member', value: 'member' }),
  changeTableLogicalNameAction({ id: 'member', value: tableName }),
  addColumnAction({ id: 'address', tableId: 'member' }),
  changeColumnNameAction({
    id: 'address',
    tableId: 'member',
    value: 'mbr_addr',
  }),
  changeColumnLogicalNameAction({
    id: 'address',
    tableId: 'member',
    value: columnName,
  }),
];

const WORDS = [word('a', 'A'), word('b', 'B'), word('c', 'C'), word('d', 'D')];

async function setup({
  seed = WORDS,
  readonly = false,
}: { seed?: AnyAction[]; readonly?: boolean } = {}): Promise<Fixture> {
  spyTexts();
  host.readonly = false;
  host.shown = true;

  const app = createTestAppContext({ getReadonly: () => host.readonly });
  if (seed.length) app.store.dispatchSync(seed);
  app.store.history.clear();
  host.readonly = readonly;

  const theme = observable<ThemeTokens>({ ...DARK }, { shallow: true });
  const fixture: Fixture = {
    app,
    shadow: null as unknown as ShadowRoot,
    theme,
    batches: [],
    shortcuts: [],
    clipboard: [],
  };

  /** The part of ErdEditor that reads the keyboard and the clipboard, around the tab. */
  const Editor: FC = (_, ctx) => {
    const current = useAppContext(ctx);
    const root = createRef<HTMLDivElement>();
    useKeyBindingMap(ctx, root);

    return () => (
      <div
        class="root"
        use:ref={ref(root)}
        tabindex="-1"
        style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}
        on:keydown={(event: KeyboardEvent) =>
          current.value.keydown$.next(event)
        }
        on:copy={(event: ClipboardEvent) =>
          current.value.emitter.emit(copyAction({ event }))
        }
        on:paste={(event: ClipboardEvent) =>
          current.value.emitter.emit(pasteAction({ event }))
        }
      >
        {host.shown ? <Dictionary readonly={host.readonly} /> : null}
      </div>
    );
  };

  const element = document.createElement('div');
  document.body.append(element);
  const shadow = element.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const container = document.createElement('div');
  shadow.append(globals, container);
  fixture.shadow = shadow;

  const unsubscribe = app.store.subscribe(actions => {
    fixture.batches.push(actions);
  });
  const shortcut = app.shortcut$.subscribe(({ type }) => {
    fixture.shortcuts.push(type);
  });
  const off = app.emitter.on({
    copy: () => fixture.clipboard.push('copy'),
    paste: () => fixture.clipboard.push('paste'),
  });

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the casts; it is r-html's own, not a React hook.
  const providers = [
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, appContext, app),
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, themeContext, theme),
  ];
  render(
    globals,
    <>
      <GlobalStyles />
      <Theme theme={DARK} />
    </>
  );
  render(container, <Editor />);
  await drawn();

  teardowns.push(() => {
    render(container, null);
    render(globals, null);
    providers.forEach(provider => provider.destroy());
    unsubscribe();
    shortcut.unsubscribe();
    off();
    element.remove();
    app.store.destroy();
  });

  fixture.batches = [];
  return fixture;
}

const tab = ({ shadow }: Fixture) =>
  shadow.querySelector('.dictionary') as HTMLDivElement;

const textarea = ({ shadow }: Fixture) =>
  shadow.querySelector('.dineug-grid textarea') as HTMLTextAreaElement;

const buttonNamed = ({ shadow }: Fixture, name: string) =>
  Array.from(shadow.querySelectorAll('button')).find(
    button => button.textContent?.trim() === name
  ) ?? null;

const sheetButtons = ({ shadow }: Fixture) =>
  Array.from(
    shadow.querySelectorAll<HTMLButtonElement>('[role="group"] button')
  );

const pressedSheet = (fixture: Fixture) =>
  sheetButtons(fixture)
    .filter(button => button.getAttribute('aria-pressed') === 'true')
    .map(button => button.textContent?.trim());

const search = ({ shadow }: Fixture) =>
  shadow.querySelector('input[title="Search"]') as HTMLInputElement;

const fileInput = ({ shadow }: Fixture) =>
  shadow.querySelector<HTMLInputElement>('input[type="file"]');

/** The status line's parts, the row count and the rows selected, each read alone. */
const status = (fixture: Fixture) =>
  Array.from(tab(fixture).lastElementChild?.children ?? [], part =>
    part.textContent?.trim()
  ).join(' ');

const hint = ({ shadow }: Fixture) =>
  shadow.querySelector('.dictionary p')?.textContent ?? null;

const names = (
  { app }: Fixture,
  kind: DictionaryKind = DictionaryKind.word
) => {
  const { state } = app.store;
  const ids = state.doc[`${kind}Ids`];
  const entities = state.collections[`${kind}Entities`] as Record<
    string,
    { name: string }
  >;
  return ids.map(id => entities[id].name);
};

/** The batches that wrote a dictionary row, which a grid commit or a row button sends. */
const dictionaryBatches = ({ batches }: Fixture) =>
  batches.filter(actions =>
    actions.some(({ type }) => type.startsWith('dictionary.'))
  );

async function press(keys: string) {
  await userEvent.keyboard(keys);
  await drawn();
}

async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await userEvent.click(element!);
  await drawn();
}

/** The middle of a cell's row band, below the 28 px column header. */
const rowY = (row: number) => 28 + row * 28 + 14;

/** A pointer event on the grid's scroller at a point of it, as the grid's own specs send one. */
function pointer(
  { shadow }: Fixture,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
  init: PointerEventInit = {}
) {
  const scroller = shadow.querySelector(
    '.dineug-grid-scroller'
  ) as HTMLDivElement;
  const rect = scroller.getBoundingClientRect();

  scroller.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: rect.left + x,
      clientY: rect.top + y,
      ...init,
    })
  );
  return scroller;
}

/** Cmd or Ctrl with a press on a cell of the first column, which adds a range. */
async function addRange(fixture: Fixture, row: number) {
  const modifier = MOD === 'Meta' ? { metaKey: true } : { ctrlKey: true };
  pointer(fixture, 'pointerdown', 100, rowY(row), modifier);
  pointer(fixture, 'pointerup', 100, rowY(row), modifier);
  await drawn();
}

const undo = () => press(`{${MOD}>}z{/${MOD}}`);
const redo = () => press(`{${MOD}>}{Shift>}z{/Shift}{/${MOD}}`);

/**
 * Picks a CSV file in the input Import CSV opens, as the file dialog hands one
 * over, and waits for the toast the import opens, which names its outcome.
 */
async function pick(fixture: Fixture, name: string, ...records: string[]) {
  const input = fileInput(fixture);
  expect(input).not.toBeNull();

  const picked = new DataTransfer();
  picked.items.add(
    new File([`${records.join('\r\n')}\r\n`], name, { type: 'text/csv' })
  );
  const toasted = new Promise<string | undefined>(resolve => {
    const off = fixture.app.emitter.on({
      openToast: ({ payload }) => {
        off();
        resolve(payload.key);
      },
    });
  });

  input!.files = picked.files;
  input!.dispatchEvent(new Event('change', { bubbles: true }));
  const key = await toasted;
  await drawn();
  return key;
}

/** The scroller's point at the middle of a body row, in its first column. */
const cellPoint = (row: number) => ({ x: 100, y: rowY(row) });

/** A real double click on the grid's scroller, its two presses and the dblclick after. */
async function doubleClick(
  { shadow }: Fixture,
  position: { x: number; y: number }
) {
  const scroller = shadow.querySelector(
    '.dineug-grid-scroller'
  ) as HTMLDivElement;
  await userEvent.dblClick(scroller, { position });
  await drawn();
}

/** The fill a text was last drawn in, lower case as a canvas spells it. */
const fillOf = (text: string) =>
  texts.filter(call => call.text === text).pop()?.fill ?? null;

/** Every file the tab saved, its bytes and its name. */
function captureExports() {
  const saved: Array<{ bytes: Promise<Uint8Array>; fileName: string }> = [];
  setExportFileCallback((blob, { fileName }) =>
    saved.push({
      bytes: blob.arrayBuffer().then(buffer => new Uint8Array(buffer)),
      fileName,
    })
  );
  teardowns.push(() => setExportFileCallback(null));
  return saved;
}

/** A paste on the grid's textarea, as the browser fires one for Cmd or Ctrl with V. */
async function paste(fixture: Fixture, text: string) {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  textarea(fixture).dispatchEvent(
    new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData,
    })
  );
  await drawn();
}

describe('the Dictionary tab', () => {
  it('switches among its four sheets, each drawing its own columns and rows', async () => {
    const fixture = await setup({
      seed: [
        word('a', 'Member', { abbreviation: 'MBR' }),
        word('b', 'Member'),
        addDictionaryAction({
          kind: DictionaryKind.term,
          id: 't',
          values: { name: 'Member Name', physicalName: 'MBR_NM' },
        }),
        addDictionaryAction({
          kind: DictionaryKind.domain,
          id: 'd',
          values: { name: 'Short Text', dataType: 'VARCHAR(255)' },
        }),
      ],
    });

    expect(sheetButtons(fixture).map(button => button.textContent)).toEqual([
      'Words',
      'Terms',
      'Domains',
      'Checks',
    ]);
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(status(fixture)).toBe('2 rows 1 selected');
    drawnTexts();

    await click(sheetButtons(fixture)[1]);
    expect(pressedSheet(fixture)).toEqual(['Terms']);
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Term', 'Physical Name', 'Member Name', 'MBR_NM'])
    );
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await click(sheetButtons(fixture)[2]);
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Domain', 'Data Type', 'Short Text'])
    );

    await click(sheetButtons(fixture)[3]);
    expect(pressedSheet(fixture)).toEqual(['Checks']);
    expect(drawnTexts()).toEqual(
      expect.arrayContaining([
        'Type',
        'Target',
        'Detail',
        'Duplicate name',
        'Member',
        'Unregistered word',
        'Member Name',
        'Name',
      ])
    );
    expect(status(fixture)).toBe('3 rows 1 selected');
    expect(buttonNamed(fixture, 'Add Row')).toBeNull();
    expect(buttonNamed(fixture, 'Delete Rows')).toBeNull();
    expect(buttonNamed(fixture, 'Import CSV')).toBeNull();
    expect(buttonNamed(fixture, 'Export CSV')).toBeNull();
    expect(fileInput(fixture)).toBeNull();

    await click(sheetButtons(fixture)[0]);
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Word', 'Abbreviation', 'Member', 'MBR'])
    );
    await click(sheetButtons(fixture)[0]);
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(dictionaryViewOf(fixture.app).sheet).toBe(DictionaryKind.word);
  });

  it('filters the rows by the search, case and composition aside, the selection back on the first', async () => {
    const fixture = await setup({
      seed: [
        word('a', 'Member'),
        word('b', 'Name', { englishName: 'Label' }),
        word('c', 'Number'),
      ],
    });
    await press('{ArrowDown}{ArrowDown}');
    expect(status(fixture)).toBe('3 rows 1 selected');

    await userEvent.click(search(fixture));
    await press('NA');
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(drawnTexts()).toContain('Name');

    await press('{Backspace}{Backspace}lab');
    expect(status(fixture)).toBe('1 row 1 selected');

    await press('{Backspace}{Backspace}{Backspace}');
    expect(status(fixture)).toBe('3 rows 1 selected');
    expect(dictionaryViewOf(fixture.app).sheets.word.selection?.active).toEqual(
      { row: 0, col: 0 }
    );
  });

  it('clears the search to add a row, and scrolls a long sheet to it', async () => {
    const seed = Array.from({ length: 60 }, (_, index) =>
      word(`w${index}`, `W${index}`)
    );
    const fixture = await setup({ seed });
    await userEvent.click(search(fixture));
    await press('W1');
    expect(status(fixture)).toBe('11 rows 1 selected');

    await click(buttonNamed(fixture, 'Add Row'));
    expect(search(fixture).value).toBe('');
    expect(status(fixture)).toBe('61 rows 1 selected');
    expect(
      dictionaryViewOf(fixture.app).sheets.word.scroll?.row
    ).toBeGreaterThan(40);

    await press('New{Enter}');
    expect(names(fixture).slice(-1)).toEqual(['New']);
  });

  it('adds a row with no name at the end, takes typing into it, and one undo each', async () => {
    const fixture = await setup();
    const { store } = fixture.app;

    await click(buttonNamed(fixture, 'Add Row'));
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D', '']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(status(fixture)).toBe('5 rows 1 selected');
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await press('E{Enter}');
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(dictionaryBatches(fixture)).toHaveLength(2);
    expect(store.history.size).toBe(2);

    await undo();
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D', '']);
    await undo();
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('counts each row the ranges cover once, however they overlap', async () => {
    const fixture = await setup();

    await press('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(status(fixture)).toBe('4 rows 3 selected');

    await addRange(fixture, 1);
    expect(status(fixture)).toBe('4 rows 3 selected');
    await addRange(fixture, 3);
    expect(status(fixture)).toBe('4 rows 4 selected');
  });

  it('removes every row when the whole sheet is selected, and nothing from an empty one', async () => {
    const fixture = await setup();

    await press(`{${MOD}>}a{/${MOD}}`);
    await click(buttonNamed(fixture, 'Delete Rows'));
    expect(names(fixture)).toEqual([]);
    expect(status(fixture)).toBe('0 rows');
    expect(dictionaryBatches(fixture)).toHaveLength(1);

    await click(buttonNamed(fixture, 'Delete Rows'));
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(hint(fixture)).toBe('Import a CSV file or add a row');
  });

  it('removes the selected rows in one dispatch, which one undo lists again', async () => {
    const fixture = await setup();

    await press('{ArrowDown}{Shift>}{ArrowDown}{/Shift}');
    expect(status(fixture)).toBe('4 rows 2 selected');

    await click(buttonNamed(fixture, 'Delete Rows'));
    expect(names(fixture)).toEqual(['A', 'D']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(dictionaryBatches(fixture)[0].map(({ type }) => type)).toEqual([
      'dictionary.remove',
      'dictionary.remove',
    ]);
    expect(status(fixture)).toBe('2 rows 1 selected');

    await undo();
    expect([...names(fixture)].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(fixture.app.store.state.collections.wordEntities.b.name).toBe('B');
  });

  it('adds the rows a paste reaches past the end, all in one dispatch and one undo', async () => {
    const fixture = await setup({ seed: [word('a', 'A'), word('b', 'B')] });

    await press('{ArrowDown}');
    await paste(fixture, 'B2\nC\nD\n');
    expect(names(fixture)).toEqual(['A', 'B2', 'C', 'D']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(fixture.app.store.history.size).toBe(1);
    expect(fixture.clipboard).toEqual([]);
    expect(drawnTexts()).toEqual(expect.arrayContaining(['B2', 'C', 'D']));

    await undo();
    expect(names(fixture)).toEqual(['A', 'B']);
  });

  it('sends one edit as one dispatch, which one undo takes back and one redo brings again', async () => {
    const fixture = await setup();

    await press('{ArrowRight}MB{Enter}');
    expect(
      fixture.app.store.state.collections.wordEntities.a.abbreviation
    ).toBe('MB');
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(fixture.app.store.history.size).toBe(1);

    await undo();
    expect(
      fixture.app.store.state.collections.wordEntities.a.abbreviation
    ).toBe('');
    await redo();
    expect(
      fixture.app.store.state.collections.wordEntities.a.abbreviation
    ).toBe('MB');
  });

  it('keeps every cell read-only and hides the row and file buttons in a read-only document', async () => {
    const fixture = await setup({ readonly: true });

    expect(buttonNamed(fixture, 'Add Row')).toBeNull();
    expect(buttonNamed(fixture, 'Delete Rows')).toBeNull();
    expect(buttonNamed(fixture, 'Import CSV')).toBeNull();
    expect(buttonNamed(fixture, 'Export CSV')).toBeNull();
    expect(fileInput(fixture)).toBeNull();

    await press('Z{Enter}');
    await paste(fixture, 'Y\n');
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
    expect(dictionaryBatches(fixture)).toEqual([]);

    host.readonly = false;
    await drawn();
    expect(buttonNamed(fixture, 'Add Row')).not.toBeNull();
    await press('Z{Enter}');
    expect(names(fixture)).toEqual(['Z', 'B', 'C', 'D']);
  });

  it('says how to fill an empty sheet, until a row is added', async () => {
    const fixture = await setup({ seed: [] });

    expect(hint(fixture)).toBe('Import a CSV file or add a row');
    expect(status(fixture)).toBe('0 rows');

    await click(buttonNamed(fixture, 'Add Row'));
    expect(hint(fixture)).toBeNull();
    expect(status(fixture)).toBe('1 row 1 selected');

    await undo();
    expect(hint(fixture)).toBe('Import a CSV file or add a row');

    host.readonly = true;
    await drawn();
    expect(hint(fixture)).toBeNull();
  });

  it('stops the editor chords at the tab but the palette, undo, redo and find, and leaves undo to an open edit', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    const abbreviation = () =>
      store.state.collections.wordEntities.a.abbreviation;
    await press('{ArrowRight}MB{Enter}{ArrowUp}');
    fixture.shortcuts.length = 0;

    await press('{Alt>}n{/Alt}{Escape}{Delete}');
    expect(fixture.shortcuts).toEqual([]);
    expect(abbreviation()).toBe('');
    expect(store.state.doc.wordIds).toHaveLength(4);

    await press(`{${MOD}>}k{/${MOD}}{${MOD}>}f{/${MOD}}`);
    expect(fixture.shortcuts).toEqual(['search', 'findReplace']);
    fixture.shortcuts.length = 0;

    await press('xy');
    await undo();
    expect(store.history.size).toBe(2);
    expect(abbreviation()).toBe('');
    expect(fixture.shortcuts).toEqual([]);

    await press('{Escape}');
    await undo();
    expect(abbreviation()).toBe('MB');
    expect(fixture.shortcuts).toEqual(['undo']);
  });

  it('leaves undo to the search field, and keeps a copy from the editor root', async () => {
    const fixture = await setup();
    await press('{ArrowRight}MB{Enter}');

    await userEvent.click(search(fixture));
    await press(`x{${MOD}>}z{/${MOD}}`);
    expect(
      fixture.app.store.state.collections.wordEntities.a.abbreviation
    ).toBe('MB');

    const clipboardData = new DataTransfer();
    textarea(fixture).dispatchEvent(
      new ClipboardEvent('copy', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData,
      })
    );
    expect(clipboardData.getData('text/plain')).not.toBe('');
    expect(fixture.clipboard).toEqual([]);
  });

  it('draws the new value of a cell a peer batch wrote, received through a shared store', async () => {
    const fixture = await setup();
    const shared = createSharedStore(fixture.app.store, {
      getNickname: () => 'peer',
    });
    teardowns.push(shared.destroy);
    drawnTexts();

    shared.dispatchSync(
      updateDictionaryAction({
        kind: DictionaryKind.word,
        id: 'b',
        values: { name: 'Bee' },
      })
    );
    await drawn();

    expect(drawnTexts()).toContain('Bee');
  });

  it('commits an edit to the row it opened on when a peer removes a row above it meanwhile', async () => {
    const fixture = await setup();
    const shared = createSharedStore(fixture.app.store, {
      getNickname: () => 'peer',
    });
    teardowns.push(shared.destroy);

    await press('{ArrowDown}{ArrowDown}X');
    shared.dispatchSync(
      removeDictionaryAction({ kind: DictionaryKind.word, id: 'a' })
    );
    await drawn();
    await press('{Enter}');

    expect(names(fixture)).toEqual(['B', 'X', 'D']);
  });

  it('keeps the selection, the scroll and a resized width as the tab mounts again', async () => {
    const seed = Array.from({ length: 60 }, (_, index) =>
      word(`w${index}`, `W${index}`)
    );
    const fixture = await setup({ seed });
    await press('{ArrowDown}'.repeat(30));

    const edge = Array.from({ length: 200 }, (_, x) => x + 100).find(
      x =>
        pointer(fixture, 'pointermove', x, 14, { buttons: 0 }).style.cursor ===
        'col-resize'
    );
    expect(edge).toBeDefined();
    pointer(fixture, 'pointerdown', edge!, 14);
    pointer(fixture, 'pointermove', edge! + 60, 14);
    pointer(fixture, 'pointerup', edge! + 60, 14);
    await drawn();
    const { widths } = dictionaryViewOf(fixture.app).sheets.word;
    expect(widths.name).toBeGreaterThan(200);

    host.shown = false;
    await drawn();
    drawnTexts();
    host.shown = true;
    await drawn();

    const shown = drawnTexts();
    expect(shown).toContain('W30');
    expect(shown).not.toContain('W0');
    expect(dictionaryViewOf(fixture.app).sheets.word.widths).toBe(widths);
    await press('Q{Enter}');
    expect(fixture.app.store.state.collections.wordEntities.w30.name).toBe('Q');
  });

  it('searches the check sheet by what its cells show', async () => {
    const fixture = await setup({
      seed: [
        word('a', 'Member'),
        word('b', 'Member'),
        word('c', 'Name'),
        word('d', 'Name'),
      ],
    });
    await click(sheetButtons(fixture)[3]);
    expect(status(fixture)).toBe('4 rows 1 selected');

    await userEvent.click(search(fixture));
    await press('memb');
    expect(status(fixture)).toBe('2 rows 1 selected');

    fixture.app.store.dispatchSync(
      removeDictionaryAction({ kind: DictionaryKind.word, id: 'b' })
    );
    await drawn();
    expect(status(fixture)).toBe('0 rows');
  });

  it("lists the checks again after a table's or a column's edit, while the check sheet shows", async () => {
    const fixture = await setup({
      seed: [word('member', '회원'), ...memberTable('회원', '회원')],
    });
    await click(sheetButtons(fixture)[3]);
    expect(status(fixture)).toBe('0 rows');
    await press('{Enter}');
    expect(pressedSheet(fixture)).toEqual(['Checks']);
    drawnTexts();

    fixture.app.store.dispatchSync(
      changeColumnLogicalNameAction({
        id: 'address',
        tableId: 'member',
        value: '회원주소',
      })
    );
    await drawn();
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Unregistered word', 'member.mbr_addr', '주소'])
    );

    fixture.app.store.dispatchSync(
      changeTableLogicalNameAction({ id: 'member', value: '회원정보' })
    );
    await drawn();
    expect(status(fixture)).toBe('2 rows 1 selected');
    expect(drawnTexts()).toEqual(expect.arrayContaining(['member', '정보']));

    // An edit made on the ERD tab, while the tab is away, shows as it mounts.
    host.shown = false;
    await drawn();
    fixture.app.store.dispatchSync(
      changeColumnLogicalNameAction({
        id: 'address',
        tableId: 'member',
        value: '회원',
      })
    );
    host.shown = true;
    await drawn();
    expect(pressedSheet(fixture)).toEqual(['Checks']);
    expect(status(fixture)).toBe('1 row 1 selected');
  });

  it("goes to a word's row on its own sheet by Enter and by a double click, the search that hid it cleared", async () => {
    const seed = Array.from({ length: 60 }, (_, index) =>
      word(`w${index}`, [45, 50].includes(index) ? 'Twin' : `W${index}`)
    );
    const fixture = await setup({ seed });
    const view = dictionaryViewOf(fixture.app);

    await userEvent.click(search(fixture));
    await press('W1');
    expect(status(fixture)).toBe('11 rows 1 selected');

    await click(sheetButtons(fixture)[3]);
    expect(status(fixture)).toBe('2 rows 1 selected');
    drawnTexts();

    await press('{Enter}');
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(search(fixture).value).toBe('');
    expect(status(fixture)).toBe('60 rows 1 selected');
    expect(view.sheets.word.selection?.active).toEqual({ row: 45, col: 0 });
    expect(drawnTexts()).toEqual(expect.arrayContaining(['Twin', 'W46']));
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));
    await press('Pair{Enter}');
    expect(fixture.app.store.state.collections.wordEntities.w45.name).toBe(
      'Pair'
    );

    await click(sheetButtons(fixture)[3]);
    expect(status(fixture)).toBe('0 rows');
    fixture.app.store.dispatchSync(
      updateDictionaryAction({
        kind: DictionaryKind.word,
        id: 'w50',
        values: { name: 'Pair' },
      })
    );
    await drawn();
    await doubleClick(fixture, cellPoint(1));
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(view.sheets.word.selection?.active).toEqual({ row: 50, col: 0 });
    expect(view.sheets.check.selection?.active).toEqual({ row: 1, col: 0 });
  });

  it("goes to a table's and a column's cell on the ERD tab by Enter and by a double click", async () => {
    const fixture = await setup({
      seed: [
        word('member', '회원'),
        ...memberTable('회원정보', '회원주소'),
        changeCanvasTypeAction({ value: CanvasType.dictionary }),
      ],
    });
    const { store } = fixture.app;
    await click(sheetButtons(fixture)[3]);
    expect(status(fixture)).toBe('2 rows 1 selected');

    await press('{Enter}');
    expect(store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 'member',
      columnId: null,
      focusType: FocusType.tableName,
    });
    expect(store.state.editor.selectedMap).toEqual({ member: 'table' });

    await doubleClick(fixture, cellPoint(1));
    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 'member',
      columnId: 'address',
      focusType: FocusType.columnName,
    });
    expect(dictionaryBatches(fixture)).toEqual([]);
  });

  it('goes nowhere on a double click on a header, a column edge or below the rows', async () => {
    const fixture = await setup({
      seed: [word('member', '회원'), ...memberTable('회원정보', '회원주소')],
    });
    const { store } = fixture.app;
    await click(sheetButtons(fixture)[3]);
    const canvasType = store.state.settings.canvasType;

    const edge = Array.from({ length: 300 }, (_, x) => x + 40).find(
      x =>
        pointer(fixture, 'pointermove', x, 14, { buttons: 0 }).style.cursor ===
        'col-resize'
    );
    expect(edge).toBeDefined();
    await doubleClick(fixture, { x: edge!, y: 14 });
    await doubleClick(fixture, { x: 100, y: 14 });
    await doubleClick(fixture, cellPoint(6));

    expect(pressedSheet(fixture)).toEqual(['Checks']);
    expect(store.state.settings.canvasType).toBe(canvasType);
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('marks no cell while the sheets a check reads are empty', async () => {
    const fixture = await setup({
      seed: [term('t1', { name: '회원주소', domainId: 'gone' })],
    });
    await click(sheetButtons(fixture)[1]);

    expect(fillOf('회원주소')).toBe(toGridTheme(DARK).text.toLowerCase());
    expect(fills).not.toContain(DARK.dictionaryWarningBackground.toLowerCase());
    expect(fills).not.toContain(DARK.dictionaryErrorBackground.toLowerCase());
  });

  it('marks the cells the checks name, each level in its own text on its own fill, in a read-only document too', async () => {
    const errorText = DARK.dictionaryErrorForeground.toLowerCase();
    const errorFill = DARK.dictionaryErrorBackground.toLowerCase();
    const warningText = DARK.dictionaryWarningForeground.toLowerCase();
    const warningFill = DARK.dictionaryWarningBackground.toLowerCase();
    const plainText = toGridTheme(DARK).text.toLowerCase();

    const fixture = await setup({
      seed: [
        word('a', '회원', { abbreviation: 'MBR', synonyms: '멤버' }),
        word('b', '번호', { abbreviation: 'NO' }),
        word('c', '번호', { abbreviation: 'NUM' }),
        term('t1', { name: '회원주소', physicalName: 'MBR_ADDR' }),
        term('t2', { name: '멤버번호', physicalName: 'MBR_NO' }),
      ],
    });
    expect(fillOf('번호')).toBe(errorText);
    expect(fillOf('회원')).toBe(plainText);
    expect(fills).toContain(errorFill);

    fills = [];
    await click(sheetButtons(fixture)[1]);
    expect(fillOf('회원주소')).toBe(warningText);
    expect(fillOf('멤버번호')).toBe(warningText);
    expect(fillOf('MBR_ADDR')).toBe(plainText);
    expect(fills).toContain(warningFill);

    fixture.app.store.dispatchSync(
      updateDictionaryAction({
        kind: DictionaryKind.word,
        id: 'a',
        values: { synonyms: '', forbiddenWords: '멤버' },
      })
    );
    await drawn();
    expect(fillOf('멤버번호')).toBe(errorText);

    fixture.theme.dictionaryWarningForeground = '#123456';
    await drawn();
    expect(fillOf('회원주소')).toBe('#123456');

    host.readonly = true;
    await drawn();
    expect(fillOf('회원주소')).toBe('#123456');
  });

  it("commits typing on the active cell before any gesture to the first row's id", async () => {
    const fixture = await setup();

    expect(fixture.shadow.activeElement).toBe(textarea(fixture));
    await press('Zed{Enter}');

    expect(fixture.app.store.state.collections.wordEntities.a.name).toBe('Zed');
  });

  it("imports each sheet's file into the sheet its header names, one dispatch each, which one undo takes back whole", async () => {
    const fixture = await setup({ seed: [] });
    const { store } = fixture.app;
    const input = fileInput(fixture)!;
    const opened = vi.spyOn(input, 'click').mockImplementation(() => {});

    await click(buttonNamed(fixture, 'Import CSV'));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe('.csv');

    await pick(
      fixture,
      'words.csv',
      '공통표준단어명,공통표준단어영문약어명,공통표준단어 영문명,공통표준단어 설명',
      '회원,MBR,Member,',
      '이름,NM,Name,',
      '금액,AMT,Amount,'
    );
    expect(input.files).toHaveLength(0);
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(names(fixture)).toEqual(['회원', '이름', '금액']);
    expect(status(fixture)).toBe('3 rows 1 selected');
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    expect(
      await pick(
        fixture,
        'domains.csv',
        'name,category,dataType,description',
        'Short Text,Text,VARCHAR(100),',
        'Amount,Number,"NUMERIC(15,2)",'
      )
    ).toBe('dictionary.toast.imported:2:0:0:0:');
    expect(pressedSheet(fixture)).toEqual(['Domains']);
    expect(status(fixture)).toBe('2 rows 1 selected');
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Short Text', 'NUMERIC(15,2)'])
    );

    expect(
      await pick(
        fixture,
        'terms.csv',
        'name,physicalName,domain,description,synonyms',
        '회원이름,,Short Text,,',
        '결제금액,PAY_AMT,Amount,,',
        '회원번호,MBR_NO,Number,,'
      )
    ).toBe('dictionary.toast.imported:3:0:0:1:Number');
    expect(pressedSheet(fixture)).toEqual(['Terms']);
    expect(status(fixture)).toBe('3 rows 1 selected');
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['회원이름', 'MBR_NM', 'Short Text', 'Amount'])
    );
    expect(dictionaryBatches(fixture)).toHaveLength(3);
    expect(store.history.size).toBe(3);

    await undo();
    expect(names(fixture, DictionaryKind.term)).toEqual([]);
    expect(hint(fixture)).toBe('Import a CSV file or add a row');
    expect(names(fixture, DictionaryKind.domain)).toHaveLength(2);
    await undo();
    expect(names(fixture, DictionaryKind.domain)).toEqual([]);
    expect(names(fixture)).toHaveLength(3);
    await undo();
    expect(names(fixture)).toEqual([]);
  });

  it('refuses a file whose header names no sheet, sending nothing and staying on the sheet', async () => {
    const fixture = await setup();

    expect(await pick(fixture, 'people.csv', 'id,email', '1,a@b.c')).toBe(
      'dictionary.toast.unknownFormat'
    );
    expect(dictionaryBatches(fixture)).toEqual([]);
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
  });

  it("exports every row of the sheet shown, whatever the search shows, as its own file's bytes", async () => {
    const fixture = await setup({
      seed: [
        changeDatabaseNameAction({ value: 'shop' }),
        word('a', 'Member', { abbreviation: 'MBR' }),
        word('b', 'Name, "Full"'),
        addDictionaryAction({
          kind: DictionaryKind.domain,
          id: 'd',
          values: { name: 'Short Text', dataType: 'VARCHAR(100)' },
        }),
        addDictionaryAction({
          kind: DictionaryKind.term,
          id: 't',
          values: {
            name: 'Member Name',
            physicalName: 'MBR_NM',
            domainId: 'd',
          },
        }),
      ],
    });
    const saved = captureExports();
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true });

    await userEvent.click(search(fixture));
    await press('mem');
    expect(status(fixture)).toBe('1 row 1 selected');
    await click(buttonNamed(fixture, 'Export CSV'));

    const words = await saved[0].bytes;
    expect(Array.from(words.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(decoder.decode(words)).toBe(
      '\uFEFFname,abbreviation,englishName,description,synonyms,forbiddenWords\r\n' +
        'Member,MBR,,,,\r\n' +
        '"Name, ""Full""",,,,,\r\n'
    );
    expect(saved[0].fileName).toMatch(
      /^shop-\d{4}-\d\d-\d\dT\d\d_\d\d_\d\d-words\.csv$/
    );

    await click(sheetButtons(fixture)[1]);
    await click(buttonNamed(fixture, 'Export CSV'));
    expect(decoder.decode(await saved[1].bytes)).toBe(
      '\uFEFFname,physicalName,domain,description,synonyms\r\n' +
        'Member Name,MBR_NM,Short Text,,\r\n'
    );
    expect(saved[1].fileName).toMatch(/-terms\.csv$/);
    expect(dictionaryBatches(fixture)).toEqual([]);
  });

  it('hands the grid the light or dark palette the theme context holds, following a switch', async () => {
    const fixture = await setup();
    const darkText = toGridTheme(DARK).text.toLowerCase();
    expect(texts.some(({ fill }) => fill === darkText)).toBe(true);
    texts = [];

    Object.assign(fixture.theme, LIGHT);
    await drawn();

    const lightText = toGridTheme(LIGHT).text.toLowerCase();
    expect(lightText).not.toBe(darkText);
    expect(texts.some(({ fill }) => fill === lightText)).toBe(true);
    expect(texts.some(({ fill }) => fill === darkText)).toBe(false);
  });
});

describe('the Dictionary tab in the editor', () => {
  const editors: ErdEditorElement[] = [];

  afterEach(() => {
    editors.splice(0).forEach(el => el.remove());
  });

  /** An editor whose shadow root opens, so the spec presses its own buttons. */
  async function createEditor(): Promise<{
    el: ErdEditorElement;
    shadow: ShadowRoot;
  }> {
    const attachShadow = Element.prototype.attachShadow;
    vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
      this: Element,
      init: ShadowRootInit
    ) {
      return attachShadow.call(this, { ...init, mode: 'open' });
    });

    const el = document.createElement('erd-editor');
    el.setAttribute(
      'style',
      `display: block; width: ${WIDTH}px; height: ${HEIGHT}px;`
    );
    document.body.append(el);
    editors.push(el);
    await flush();
    el.setInitialValue(createSeedValue());
    await drawn();

    return { el, shadow: el.shadowRoot as ShadowRoot };
  }

  const toolbarButton = (shadow: ShadowRoot, title: string) =>
    shadow.querySelector(`.toolbar [title="${title}"]`) as HTMLElement;

  it("goes from a column's check to the ERD tab, the canvas taking the keyboard", async () => {
    spyTexts();
    const { el, shadow } = await createEditor();
    const sharedStore = el.getSharedStore();
    teardowns.push(sharedStore.destroy);

    sharedStore.dispatchSync(
      changeColumnLogicalNameAction({
        id: SEED.userName,
        tableId: SEED.users,
        value: 'Member Nickname',
      })
    );
    await click(toolbarButton(shadow, 'Dictionary'));
    const checks = Array.from(
      shadow.querySelectorAll<HTMLButtonElement>('[role="group"] button')
    ).find(button => button.textContent === 'Checks');
    await click(checks ?? null);
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Unregistered word', 'users.name', 'Nickname'])
    );

    await press('{Enter}');
    expect(shadow.querySelector('.dictionary')).toBeNull();
    expect(document.activeElement).toBe(el);
    expect(shadow.activeElement).toBe(shadow.querySelector('.root'));
  });

  it("writes a domain's new type to its columns in the same batch, which the ERD tab's type cell shows", async () => {
    spyTexts();
    const { el, shadow } = await createEditor();
    const batches: string[][] = [];
    const sharedStore = el.getSharedStore();
    const unsubscribe = sharedStore.subscribe(actions =>
      batches.push(actions.map(({ type }) => type))
    );
    teardowns.push(unsubscribe, sharedStore.destroy);

    await click(toolbarButton(shadow, 'Dictionary'));
    const domains = Array.from(
      shadow.querySelectorAll<HTMLButtonElement>('[role="group"] button')
    ).find(button => button.textContent === 'Domains');
    await click(domains ?? null);
    await press('{ArrowRight}{ArrowRight}TEXT{Enter}');

    const written = batches.filter(types =>
      types.includes('dictionary.update')
    );
    expect(written).toHaveLength(1);
    expect(written[0]).toEqual(
      expect.arrayContaining(['dictionary.update', 'column.changeDataType'])
    );

    await click(toolbarButton(shadow, 'Entity Relationship Diagram'));
    const stage = Reflect.get(globalThis, '__erdStages')?.canvas;
    const cell = stage
      ?.findOne(`#column-${SEED.userName}`)
      ?.findOne(`.${FocusType.columnDataType}`);
    expect(cell?.findOne('.cell-text')?.text()).toBe('TEXT');
  });
});
