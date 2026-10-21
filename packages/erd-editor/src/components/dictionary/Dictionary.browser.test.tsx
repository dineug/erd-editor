// The Dictionary tab in Chromium with real keys: the sheets, the search, the
// row and file buttons, a paste past the end, one undo per commit, a read-only
// document, the empty sheet, the chords, a peer's batch, the checks and marks.

import { generateOrderKeyBetween } from '@dineug/erd-editor-schema';
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
import { cdp, page, userEvent } from 'vite-plus/test/browser/context';

import { createTestAppContext, flush } from '@/__test-utils__';
import { createTestI18n, provideI18n } from '@/__test-utils__/i18n';
import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import Dictionary from '@/components/dictionary/Dictionary';
import * as styles from '@/components/dictionary/Dictionary.styles';
import { dictionaryViewOf } from '@/components/dictionary/dictionaryView';
import { toGridTheme } from '@/components/dictionary/gridTheme';
import { DictionarySheet } from '@/components/dictionary/sheets';
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
import { listDictionaryChecks } from '@/engine/modules/dictionary/checks';
import { orderedDictionaryRows } from '@/engine/modules/dictionary/dictionaryIndex';
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
import { messagesOf } from '@/i18n/messages/index';
import { createI18n, type I18n } from '@/i18n/translate';
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

vi.mock('@/engine/modules/dictionary/checks', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/engine/modules/dictionary/checks')>();
  return {
    ...actual,
    listDictionaryChecks: vi.fn(actual.listDictionaryChecks),
  };
});

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
  /** The display language the tab reads, which a case switches in place as the element does. */
  i18n: I18n;
  /** Every batch the store took since the mount. */
  batches: AnyAction[][];
  /** Every chord the editor root's binder read. */
  shortcuts: KeyBindingName[];
  /** Every copy or paste the editor root handed its emitter. */
  clipboard: string[];
};

/** The one CDP command the spec sends, which the provider's session types only under its own config. */
type InputSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as InputSession;

const host = observable({ readonly: false, shown: true, width: WIDTH });
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

// Seeded rows carry keys in the order they are made, as every row a document
// or a generator lists does.
let seedKey: string | null = null;
const nextSeedKey = () => (seedKey = generateOrderKeyBetween(seedKey, null));

const word = (id: string, name: string, values: Record<string, string> = {}) =>
  addDictionaryAction({
    kind: DictionaryKind.word,
    id,
    values: { name, order: nextSeedKey(), ...values },
  });

const term = (id: string, values: Record<string, string>) =>
  addDictionaryAction({
    kind: DictionaryKind.term,
    id,
    values: { order: nextSeedKey(), ...values },
  });

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

/**
 * Mounts the tab over the rows seeded, on the word sheet most specs drive
 * unless another is given, or on the sheet a first visit opens with null.
 */
async function setup({
  seed = WORDS,
  readonly = false,
  sheet = DictionarySheet.word,
}: {
  seed?: AnyAction[];
  readonly?: boolean;
  sheet?: DictionarySheet | null;
} = {}): Promise<Fixture> {
  spyTexts();
  host.readonly = false;
  host.shown = true;
  host.width = WIDTH;

  const app = createTestAppContext({ getReadonly: () => host.readonly });
  if (seed.length) app.store.dispatchSync(seed);
  app.store.history.clear();
  if (sheet) dictionaryViewOf(app).sheet = sheet;
  host.readonly = readonly;

  const theme = observable<ThemeTokens>({ ...DARK }, { shallow: true });
  const i18n = createTestI18n('en');
  const fixture: Fixture = {
    app,
    shadow: null as unknown as ShadowRoot,
    theme,
    i18n,
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
        style={{ width: `${host.width}px`, height: `${HEIGHT}px` }}
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
    provideI18n(container, i18n),
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

/** A button by the name it reads out: a tool's label, else its text. */
const buttonNamed = ({ shadow }: Fixture, name: string) =>
  Array.from(shadow.querySelectorAll('button')).find(
    button =>
      (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name
  ) ?? null;

const sheetButtons = ({ shadow }: Fixture) =>
  Array.from(
    shadow.querySelectorAll<HTMLButtonElement>('[role="group"] button')
  );

/** A sheet button's name, without the count beside it. */
const sheetName = (button: Element) =>
  button.firstElementChild?.textContent?.trim();

const sheetButton = (fixture: Fixture, name: string) =>
  sheetButtons(fixture).find(
    button => sheetName(button) === name
  ) as HTMLButtonElement;

const pressedSheet = (fixture: Fixture) =>
  sheetButtons(fixture)
    .filter(button => button.getAttribute('aria-pressed') === 'true')
    .map(sheetName);

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

/** A sheet's names in the order it shows them. */
const names = ({ app }: Fixture, kind: DictionaryKind = DictionaryKind.word) =>
  orderedDictionaryRows(app.store.state, kind).map(({ name }) => name);

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

/** A real right click on the grid's scroller at a point of it. */
async function rightClickAt(
  { shadow }: Fixture,
  position: { x: number; y: number }
) {
  const scroller = shadow.querySelector(
    '.dineug-grid-scroller'
  ) as HTMLDivElement;
  await userEvent.click(scroller, { button: 'right', position });
  await drawn();
}

/** A real right click on a cell of the first column, which opens the tab's menu. */
const rightClick = (fixture: Fixture, row: number) =>
  rightClickAt(fixture, cellPoint(row));

const menu = ({ shadow }: Fixture) =>
  shadow.querySelector<HTMLElement>('.context-menu-content');

/** A menu row's name, without the chord shown beside it. */
const rowName = (row: Element) =>
  (row.textContent ?? '')
    .replace(row.querySelector('.kbd')?.textContent ?? '', '')
    .trim();

/** The rows of the open menu, by the name each shows. */
const menuRows = (fixture: Fixture) =>
  Array.from(menu(fixture)?.querySelectorAll('[data-id]') ?? [])
    .filter(row => row !== menu(fixture))
    .map(rowName);

const menuRow = (fixture: Fixture, name: string) =>
  Array.from(menu(fixture)?.querySelectorAll('[data-id]') ?? []).find(
    row => row !== menu(fixture) && rowName(row) === name
  ) ?? null;

/** The chord a menu row shows beside its name, if any. */
const menuChord = (fixture: Fixture, name: string) =>
  menuRow(fixture, name)?.querySelector('.kbd')?.textContent?.trim() ?? '';

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

    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(status(fixture)).toBe('2 rows 1 selected');
    drawnTexts();

    await click(sheetButton(fixture, 'Terms'));
    expect(pressedSheet(fixture)).toEqual(['Terms']);
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Term', 'Physical Name', 'Member Name', 'MBR_NM'])
    );
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await click(sheetButton(fixture, 'Domains'));
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Domain', 'Data Type', 'Short Text'])
    );

    await click(sheetButton(fixture, 'Checks'));
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

    await click(sheetButton(fixture, 'Words'));
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Word', 'Abbreviation', 'Member', 'MBR'])
    );
    await click(sheetButton(fixture, 'Words'));
    expect(pressedSheet(fixture)).toEqual(['Words']);
    expect(dictionaryViewOf(fixture.app).sheet).toBe(DictionaryKind.word);
  });

  it('lists the domains first, then the words, the terms and the checks, and opens on the domains', async () => {
    const fixture = await setup({
      seed: [
        ...WORDS,
        addDictionaryAction({
          kind: DictionaryKind.domain,
          id: 'd',
          values: { name: 'Short Text', dataType: 'VARCHAR(255)' },
        }),
      ],
      sheet: null,
    });

    expect(sheetButtons(fixture).map(sheetName)).toEqual([
      'Domains',
      'Words',
      'Terms',
      'Checks',
    ]);
    expect(pressedSheet(fixture)).toEqual(['Domains']);
    expect(textarea(fixture).getAttribute('aria-label')).toBe('Domains');
    expect(status(fixture)).toBe('1 row 1 selected');
  });

  it('switches between two empty sheets, the sheet shown taking the writes and the file', async () => {
    const fixture = await setup({ seed: [] });
    const saved = captureExports();
    drawnTexts();

    await click(sheetButton(fixture, 'Terms'));
    expect(pressedSheet(fixture)).toEqual(['Terms']);
    expect(textarea(fixture).getAttribute('aria-label')).toBe('Terms');
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Term', 'Physical Name'])
    );

    await click(sheetButton(fixture, 'Domains'));
    expect(pressedSheet(fixture)).toEqual(['Domains']);
    expect(textarea(fixture).getAttribute('aria-label')).toBe('Domains');
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Domain', 'Category', 'Data Type'])
    );

    await click(buttonNamed(fixture, 'Export CSV'));
    expect(saved[0].fileName).toMatch(/-domains\.csv$/);

    await paste(fixture, 'Short Text\tText\tVARCHAR(100)\n');
    expect(names(fixture, DictionaryKind.domain)).toEqual(['Short Text']);
    expect(names(fixture, DictionaryKind.term)).toEqual([]);
    expect(names(fixture)).toEqual([]);
    const [domainId] = fixture.app.store.state.doc.domainIds;
    expect(
      fixture.app.store.state.collections.domainEntities[domainId].dataType
    ).toBe('VARCHAR(100)');
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
    expect(store.sheetHistories.word.size).toBe(2);

    await undo();
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D', '']);
    await undo();
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('counts each sheet on its button, the checks once the browser is idle, in the colour of the loudest', async () => {
    const counts = (fixture: Fixture) =>
      sheetButtons(fixture).map(button => button.lastElementChild!);
    // The checks are counted over as many idle periods as the walk takes.
    const texts = (fixture: Fixture) =>
      counts(fixture).map(count => count.textContent);

    const fixture = await setup({ seed: [...WORDS, word('e', 'A')] });
    await expect.poll(() => texts(fixture)).toEqual(['0', '5', '0', '2']);
    // The count reads out with nothing, since the name is the button's name.
    expect(counts(fixture)[0].getAttribute('aria-hidden')).toBe('true');
    expect(
      counts(fixture)[3].classList.contains(String(styles.countError))
    ).toBe(true);

    await press('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    await click(buttonNamed(fixture, 'Delete Rows'));
    await expect.poll(() => texts(fixture)).toEqual(['0', '4', '0', '0']);
    expect(counts(fixture)[3].classList.contains(String(styles.count))).toBe(
      true
    );
  });

  it("colours the check sheet's count as a warning while every check is one", async () => {
    const counts = (fixture: Fixture) =>
      sheetButtons(fixture).map(button => button.lastElementChild!);

    // An unregistered word in a column's logical name is a warning alone.
    const warned = await setup({
      seed: [word('m', '회원'), ...memberTable('회원', '주소')],
    });
    await expect.poll(() => counts(warned)[3].textContent).toBe('1');
    expect(
      counts(warned)[3].classList.contains(String(styles.countWarning))
    ).toBe(true);

    // The check sheet counts from the walk it lists by, a frame after a batch
    // and with no idle wait: a word sharing a name makes two errors more.
    await click(sheetButtons(warned)[3]);
    warned.app.store.dispatchSync(word('e', '회원'));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await drawn();
    expect(counts(warned)[3].textContent).toBe('3');
    expect(
      counts(warned)[3].classList.contains(String(styles.countError))
    ).toBe(true);
  });

  it('clears the search by its button and by Escape, the field keeping the keyboard', async () => {
    const fixture = await setup();
    const clear = () => buttonNamed(fixture, 'Clear search');
    expect(clear()).toBeNull();

    await userEvent.click(search(fixture));
    await press('B');
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(clear()?.title).toBe('Clear search');

    await click(clear());
    expect(search(fixture).value).toBe('');
    expect(status(fixture)).toBe('4 rows 1 selected');
    expect(clear()).toBeNull();
    expect(fixture.shadow.activeElement).toBe(search(fixture));

    fixture.shortcuts.length = 0;
    await press('C{Escape}');
    expect(search(fixture).value).toBe('');
    expect(status(fixture)).toBe('4 rows 1 selected');
    expect(fixture.shortcuts).toEqual([]);
  });

  it('names each tool for the pointer and the reader, Delete with the chord that deletes in the grid', async () => {
    const fixture = await setup();
    const tools = ['Add Row', 'Delete Rows', 'Import CSV', 'Export CSV'].map(
      name => buttonNamed(fixture, name)
    );

    expect(tools.map(tool => tool?.title)).toEqual([
      'Add Row',
      expect.stringMatching(/^Delete Rows \(.+\)$/),
      'Import CSV',
      'Export CSV',
    ]);

    fixture.app.keyBindingMap.removeColumn = [];
    await drawn();
    expect(buttonNamed(fixture, 'Delete Rows')?.title).toBe('Delete Rows');
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

  it('inserts as many rows as the selection covers above it from the menu, in one dispatch and one undo', async () => {
    const fixture = await setup();

    await press('{ArrowDown}{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    await rightClick(fixture, 2);
    expect(status(fixture)).toBe('4 rows 3 selected');
    expect(menuRows(fixture)).toEqual([
      'Insert 3 rows above',
      'Insert 3 rows below',
      'Delete 3 rows',
      'Sort by Word, ascending',
      'Sort by Word, descending',
      'Import CSV',
      'Export CSV',
    ]);

    await click(menuRow(fixture, 'Insert 3 rows above'));
    expect(menu(fixture)).toBeNull();
    expect(names(fixture)).toEqual(['A', '', '', '', 'B', 'C', 'D']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(status(fixture)).toBe('7 rows 3 selected');
    expect(dictionaryViewOf(fixture.app).sheets.word.selection).toEqual({
      active: { row: 1, col: 0 },
      ranges: [{ startRow: 1, startCol: 0, endRow: 3, endCol: 0 }],
    });
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await press('E{Enter}');
    expect(names(fixture)).toEqual(['A', 'E', '', '', 'B', 'C', 'D']);

    await undo();
    await undo();
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('inserts rows below the last row the selection covers, and selects them', async () => {
    const fixture = await setup();

    await press('{ArrowDown}{Shift>}{ArrowDown}{/Shift}');
    await rightClick(fixture, 1);
    await click(menuRow(fixture, 'Insert 2 rows below'));

    expect(names(fixture)).toEqual(['A', 'B', 'C', '', '', 'D']);
    expect(dictionaryViewOf(fixture.app).sheets.word.selection).toEqual({
      active: { row: 3, col: 0 },
      ranges: [{ startRow: 3, startCol: 0, endRow: 4, endCol: 0 }],
    });
  });

  it("inserts as many rows below the selection as it covers on the add column chord, and deletes the rows it covers on the remove column chord's", async () => {
    const fixture = await setup();
    fixture.shortcuts.length = 0;

    await press('{ArrowDown}{Shift>}{ArrowDown}{/Shift}');
    await rightClick(fixture, 1);
    expect(menuChord(fixture, 'Insert 2 rows below')).toMatch(/Enter$/);
    expect(menuChord(fixture, 'Delete 2 rows')).toMatch(/⌫$/);
    expect(menuChord(fixture, 'Insert 2 rows above')).toMatch(/Enter$/);

    await press('{Alt>}{Enter}{/Alt}');
    expect(menu(fixture)).toBeNull();
    expect(names(fixture)).toEqual(['A', 'B', 'C', '', '', 'D']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(dictionaryViewOf(fixture.app).sheets.word.selection).toEqual({
      active: { row: 3, col: 0 },
      ranges: [{ startRow: 3, startCol: 0, endRow: 4, endCol: 0 }],
    });
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await press('{Alt>}{Delete}{/Alt}');
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);

    await press('{Alt>}{Backspace}{/Alt}');
    expect(names(fixture)).toEqual(['A', 'B', 'C']);
    expect(dictionaryBatches(fixture)).toHaveLength(3);
    expect(fixture.shortcuts).toEqual([]);
  });

  it("picks a term's domain from the domain sheet's names, None unlinking, and writes no text typed", async () => {
    const domain = (id: string, name: string) =>
      addDictionaryAction({
        kind: DictionaryKind.domain,
        id,
        values: { name, dataType: 'BIGINT', order: nextSeedKey() },
      });
    const fixture = await setup({
      seed: [
        domain('d1', '번호'),
        domain('d2', '금액'),
        term('t1', { name: '회원번호' }),
      ],
    });
    const linked = () =>
      fixture.app.store.state.collections.termEntities.t1.domainId;
    const picker = () =>
      fixture.shadow.querySelector('.dictionary-domain-editor');
    const options = () =>
      Array.from(
        fixture.shadow.querySelectorAll(
          '.dictionary-domain-editor [role="option"]'
        ),
        option => option.firstElementChild?.textContent?.trim()
      );
    const picked = () =>
      fixture.shadow
        .querySelector('.dictionary-domain-editor [aria-selected="true"]')
        ?.firstElementChild?.textContent?.trim();

    await click(sheetButton(fixture, 'Terms'));
    textarea(fixture).focus();
    await press('{ArrowRight}{ArrowRight}{Enter}');
    expect(options()).toEqual(['None', '번호', '금액']);
    expect(picked()).toBe('None');

    await press('{ArrowDown}{Enter}');
    expect(picker()).toBeNull();
    expect(linked()).toBe('d1');
    expect(dictionaryBatches(fixture)).toHaveLength(1);

    // Typing opens it searched by what was typed, and Escape writes nothing.
    await press('금');
    expect(options()).toEqual(['금액']);
    await press('{Escape}');
    expect(picker()).toBeNull();
    expect(linked()).toBe('d1');

    // It opens on the domain linked; a click picks, and None unlinks.
    await press('{Enter}');
    expect(picked()).toBe('번호');
    await click(
      fixture.shadow.querySelectorAll(
        '.dictionary-domain-editor [role="option"]'
      )[2]
    );
    expect(linked()).toBe('d2');
    await press('{Enter}{ArrowUp}{ArrowUp}{Tab}');
    expect(picker()).toBeNull();
    expect(linked()).toBe('');
    expect(dictionaryBatches(fixture)).toHaveLength(3);
  });

  it("opens a term's domain list above a cell near the grid's foot, round either end, and leaves on Tab or a press outside with no pick", async () => {
    const fixture = await setup({
      seed: [
        addDictionaryAction({
          kind: DictionaryKind.domain,
          id: 'd1',
          values: { name: '번호', order: nextSeedKey() },
        }),
        ...Array.from({ length: 12 }, (_, index) =>
          term(`t${index}`, { name: `용어${index}` })
        ),
      ],
    });
    const editor = () =>
      fixture.shadow.querySelector('.dictionary-domain-editor');
    const list = () =>
      fixture.shadow.querySelector<HTMLElement>(
        '.dictionary-domain-editor [role="listbox"]'
      );
    const picked = () =>
      fixture.shadow
        .querySelector('.dictionary-domain-editor [aria-selected="true"]')
        ?.firstElementChild?.textContent?.trim();

    await click(sheetButton(fixture, 'Terms'));
    textarea(fixture).focus();
    await press(`${'{ArrowDown}'.repeat(10)}{ArrowRight}{ArrowRight}{Enter}`);
    expect(list()?.style.bottom).toBe('100%');
    expect(picked()).toBe('None');
    await press('{ArrowUp}');
    expect(picked()).toBe('번호');
    await press('{ArrowDown}');
    expect(picked()).toBe('None');

    // A search nothing matches lists nothing, which Enter leaves open and Tab closes unwritten.
    await press('xyz');
    expect(list()).toBeNull();
    await press('{Enter}');
    expect(editor()).not.toBeNull();
    await press('{Tab}');
    expect(editor()).toBeNull();

    await press('{Enter}');
    expect(editor()).not.toBeNull();
    pointer(fixture, 'pointerdown', 100, rowY(1));
    pointer(fixture, 'pointerup', 100, rowY(1));
    await drawn();
    expect(editor()).toBeNull();
    expect(fixture.app.store.state.collections.termEntities.t10.domainId).toBe(
      ''
    );
    expect(dictionaryBatches(fixture)).toHaveLength(0);
  });

  it('inserts as many rows above the selection as it covers on the add column chord with Shift held', async () => {
    const fixture = await setup();
    fixture.shortcuts.length = 0;

    await press('{ArrowDown}{Shift>}{ArrowDown}{/Shift}');
    await press('{Alt>}{Shift>}{Enter}{/Shift}{/Alt}');
    expect(names(fixture)).toEqual(['A', '', '', 'B', 'C', 'D']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(dictionaryViewOf(fixture.app).sheets.word.selection).toEqual({
      active: { row: 1, col: 0 },
      ranges: [{ startRow: 1, startCol: 0, endRow: 2, endCol: 0 }],
    });
    expect(fixture.shortcuts).toEqual([]);
  });

  it('leaves the row chords to an open edit, and sends nothing for them in a read-only document or on the check sheet', async () => {
    const fixture = await setup();
    fixture.shortcuts.length = 0;

    await press('X{Alt>}{Enter}{/Alt}{Alt>}{Backspace}{/Alt}{Escape}');
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);

    // An insert clears the search first, so a search kept shows none ran.
    host.readonly = true;
    await drawn();
    await userEvent.click(search(fixture));
    await press('B');
    textarea(fixture).focus();
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));
    await press('{Alt>}{Enter}{/Alt}{Alt>}{Delete}{/Alt}');
    expect(search(fixture).value).toBe('B');

    host.readonly = false;
    await drawn();
    await click(sheetButton(fixture, 'Checks'));
    textarea(fixture).focus();
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));
    await press('{Alt>}{Enter}{/Alt}{Alt>}{Delete}{/Alt}');

    expect(fixture.app.store.state.doc.wordIds).toHaveLength(4);
    expect(dictionaryBatches(fixture)).toHaveLength(0);
    expect(fixture.shortcuts).toEqual([]);
  });

  it('moves the selection to a cell right clicked outside it, and deletes that one row from the menu', async () => {
    const fixture = await setup();

    await press('{Shift>}{ArrowDown}{/Shift}');
    await rightClick(fixture, 3);
    expect(status(fixture)).toBe('4 rows 1 selected');
    expect(menuRows(fixture).slice(0, 3)).toEqual([
      'Insert 1 row above',
      'Insert 1 row below',
      'Delete 1 row',
    ]);

    await click(menuRow(fixture, 'Delete 1 row'));
    expect(menu(fixture)).toBeNull();
    expect(names(fixture)).toEqual(['A', 'B', 'C']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
  });

  it('opens the menu below the rows and right of the columns on the selection as it stands, and on an empty sheet', async () => {
    const fixture = await setup({
      seed: [
        ...WORDS,
        addDictionaryAction({
          kind: DictionaryKind.domain,
          id: 'd',
          values: { name: 'Short Text', dataType: 'VARCHAR(255)' },
        }),
      ],
    });

    await press('{ArrowDown}{Shift>}{ArrowDown}{/Shift}');
    await rightClickAt(fixture, { x: 100, y: rowY(8) });
    expect(status(fixture)).toBe('4 rows 2 selected');
    expect(menuRows(fixture)).toEqual([
      'Insert 2 rows above',
      'Insert 2 rows below',
      'Delete 2 rows',
      'Sort by Word, ascending',
      'Sort by Word, descending',
      'Import CSV',
      'Export CSV',
    ]);
    await click(menuRow(fixture, 'Delete 2 rows'));
    expect(names(fixture)).toEqual(['A', 'D']);

    await userEvent.click(search(fixture));
    await press('zzz');
    await rightClickAt(fixture, { x: 100, y: rowY(0) });
    expect(menuRows(fixture)).toEqual([
      'Insert 1 row below',
      'Import CSV',
      'Export CSV',
    ]);
    await press('{Escape}');

    // The domain sheet's columns end short of the grid's right edge.
    await click(sheetButton(fixture, 'Domains'));
    await rightClickAt(fixture, { x: WIDTH - 60, y: rowY(0) });
    expect(menuRows(fixture)).toEqual([
      'Insert 1 row above',
      'Insert 1 row below',
      'Delete 1 row',
      'Import CSV',
      'Export CSV',
    ]);
    await press('{Escape}');

    await click(sheetButton(fixture, 'Terms'));
    expect(status(fixture)).toBe('0 rows');
    await rightClickAt(fixture, { x: 100, y: rowY(3) });
    expect(menuRows(fixture)).toEqual([
      'Insert 1 row below',
      'Import CSV',
      'Export CSV',
    ]);
    await click(menuRow(fixture, 'Insert 1 row below'));
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(fixture.app.store.state.doc.termIds).toHaveLength(1);
  });

  it('sorts the whole sheet by the column right clicked, for everyone in one dispatch, and one undo puts it back', async () => {
    const fixture = await setup({
      seed: [word('a', 'W10'), word('b', 'w2'), word('c', ''), word('d', 'W1')],
    });
    await userEvent.click(search(fixture));
    await press('w1');
    expect(status(fixture)).toBe('2 rows 1 selected');

    await rightClick(fixture, 0);
    await click(menuRow(fixture, 'Sort by Word, ascending'));
    expect(names(fixture)).toEqual(['W1', 'w2', 'W10', '']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    // The search stays, and shows its rows in the new order.
    expect(search(fixture).value).toBe('w1');
    expect(drawnTexts()).toEqual(expect.arrayContaining(['W1', 'W10']));

    await rightClick(fixture, 0);
    await click(menuRow(fixture, 'Sort by Word, descending'));
    expect(names(fixture)).toEqual(['W10', 'w2', 'W1', '']);

    await undo();
    expect(names(fixture)).toEqual(['W1', 'w2', 'W10', '']);
  });

  it('clears the search to insert rows from the menu, and scrolls a long sheet to them', async () => {
    const seed = Array.from({ length: 60 }, (_, index) =>
      word(`w${index}`, `W${index}`)
    );
    const fixture = await setup({ seed });
    await userEvent.click(search(fixture));
    await press('W5');
    await userEvent.click(
      fixture.shadow.querySelector('.dineug-grid-scroller') as HTMLDivElement,
      { position: cellPoint(0) }
    );
    await press('{Shift>}{ArrowDown}{/Shift}');

    await rightClick(fixture, 1);
    await click(menuRow(fixture, 'Insert 2 rows below'));
    expect(search(fixture).value).toBe('');
    expect(status(fixture)).toBe('62 rows 2 selected');
    expect(names(fixture).slice(49, 54)).toEqual(['W49', 'W50', '', '', 'W51']);

    const { selection, scroll } = dictionaryViewOf(fixture.app).sheets.word;
    expect(selection?.active).toEqual({ row: 51, col: 0 });
    expect(scroll?.row).toBeGreaterThan(30);
    expect(scroll?.row).toBeLessThanOrEqual(51);
  });

  it('shuts the menu on Escape, a press outside it, a selection change and a sheet switch', async () => {
    const fixture = await setup();

    await rightClick(fixture, 0);
    expect(menu(fixture)).not.toBeNull();
    await press('{Escape}');
    expect(menu(fixture)).toBeNull();
    expect(fixture.shortcuts).not.toContain('stop');

    await rightClick(fixture, 0);
    await press('{ArrowDown}');
    expect(menu(fixture)).toBeNull();

    await rightClick(fixture, 0);
    await userEvent.click(search(fixture));
    await drawn();
    expect(menu(fixture)).toBeNull();

    await rightClick(fixture, 0);
    await click(sheetButton(fixture, 'Terms'));
    expect(menu(fixture)).toBeNull();
    expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('keeps the keyboard in the grid on a press on the menu, so Escape still shuts it', async () => {
    const fixture = await setup();

    await rightClick(fixture, 0);
    await userEvent.click(
      menu(fixture)!.querySelector('[role="separator"]') as HTMLElement
    );
    await drawn();
    expect(menu(fixture)).not.toBeNull();
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await press('{Escape}');
    expect(menu(fixture)).toBeNull();
  });

  it('shuts the menu when the document turns read-only, and when a batch moves the rows it counted', async () => {
    const fixture = await setup();

    await rightClick(fixture, 0);
    host.readonly = true;
    await drawn();
    host.readonly = false;
    await drawn();
    expect(menu(fixture)).toBeNull();

    await rightClick(fixture, 0);
    fixture.app.store.dispatchSync(
      updateDictionaryAction({
        kind: DictionaryKind.word,
        id: 'b',
        values: { name: 'B2' },
      })
    );
    await drawn();
    expect(menu(fixture)).toBeNull();
  });

  it('leaves the browser its own menu on the check sheet and in a read-only document', async () => {
    const fixture = await setup({ readonly: true });
    const prevented: boolean[] = [];
    const record = (event: Event) => prevented.push(event.defaultPrevented);
    window.addEventListener('contextmenu', record);
    teardowns.push(() => window.removeEventListener('contextmenu', record));

    await rightClick(fixture, 0);
    expect(menu(fixture)).toBeNull();

    host.readonly = false;
    await drawn();
    await rightClick(fixture, 0);
    expect(menu(fixture)).not.toBeNull();
    await press('{Escape}');

    await click(sheetButton(fixture, 'Checks'));
    await rightClick(fixture, 0);
    expect(menu(fixture)).toBeNull();
    expect(prevented).toEqual([false, true, false]);
  });

  it('opens the file input and saves the sheet from the menu, as the file buttons do', async () => {
    const fixture = await setup();
    const saved = captureExports();
    const opened = vi
      .spyOn(fileInput(fixture)!, 'click')
      .mockImplementation(() => {});

    await rightClick(fixture, 0);
    await click(menuRow(fixture, 'Import CSV'));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(menu(fixture)).toBeNull();
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));

    await rightClick(fixture, 0);
    await click(menuRow(fixture, 'Export CSV'));
    expect(saved).toHaveLength(1);
    expect(saved[0].fileName).toMatch(/-words\.csv$/);
    expect(menu(fixture)).toBeNull();
    expect(fixture.shadow.activeElement).toBe(textarea(fixture));
  });

  it('opens the menu on the active cell from the keyboard', async () => {
    const fixture = await setup();

    await press('{ArrowDown}');
    textarea(fixture).dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
    await drawn();
    expect(menuRows(fixture)[0]).toBe('Insert 1 row above');
  });

  it('adds the rows a paste reaches past the end, all in one dispatch and one undo', async () => {
    const fixture = await setup({ seed: [word('a', 'A'), word('b', 'B')] });

    await press('{ArrowDown}');
    await paste(fixture, 'B2\nC\nD\n');
    expect(names(fixture)).toEqual(['A', 'B2', 'C', 'D']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(fixture.app.store.sheetHistories.word.size).toBe(1);
    expect(fixture.clipboard).toEqual([]);
    expect(drawnTexts()).toEqual(expect.arrayContaining(['B2', 'C', 'D']));

    await undo();
    expect(names(fixture)).toEqual(['A', 'B']);
  });

  it('writes the columns a paste reaches and says it left out those past the last', async () => {
    const fixture = await setup({ seed: [word('a', 'A')] });
    const toasts: Array<string | undefined> = [];
    teardowns.push(
      fixture.app.emitter.on({
        openToast: ({ payload }) => toasts.push(payload.key),
      })
    );

    await paste(fixture, 'A2\tAA\tAye\tFirst\t\t\tPast\tPast\tPast\n');
    expect(names(fixture)).toEqual(['A2']);
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(toasts).toEqual(['dictionary.toast.pasteBeyondColumns']);
  });

  describe('a paste past the last column that writes nothing', () => {
    const toastsOf = (fixture: Fixture) => {
      const toasts: Array<string | undefined> = [];
      teardowns.push(
        fixture.app.emitter.on({
          openToast: ({ payload }) => toasts.push(payload.key),
        })
      );
      return toasts;
    };
    const WIDE = 'X\tXX\tEx\tFirst\t\t\tPast\n';

    it('says nothing in a read-only document', async () => {
      const fixture = await setup({ readonly: true });
      const toasts = toastsOf(fixture);

      await paste(fixture, WIDE);
      expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
      expect(dictionaryBatches(fixture)).toEqual([]);
      expect(toasts).toEqual([]);
    });

    it('says nothing on the check sheet, whose columns are read-only', async () => {
      const fixture = await setup({ seed: [word('a', 'A'), word('b', 'A')] });
      await click(sheetButton(fixture, 'Checks'));
      const toasts = toastsOf(fixture);

      await paste(fixture, 'X\tY\tZ\tPast\n');
      expect(pressedSheet(fixture)).toEqual(['Checks']);
      expect(dictionaryBatches(fixture)).toEqual([]);
      expect(toasts).toEqual([]);
    });

    it('says only why a refused commit sent nothing', async () => {
      const fixture = await setup();
      const toasts = toastsOf(fixture);

      await paste(fixture, 'B\tBB\tBee\tFirst\t\t\tPast\n');
      expect(names(fixture)).toEqual(['A', 'B', 'C', 'D']);
      expect(dictionaryBatches(fixture)).toEqual([]);
      expect(toasts).toEqual(['dictionary.toast.duplicateNames:1:B']);
    });
  });

  it('sends one edit as one dispatch, which one undo takes back and one redo brings again', async () => {
    const fixture = await setup();

    await press('{ArrowRight}MB{Enter}');
    expect(
      fixture.app.store.state.collections.wordEntities.a.abbreviation
    ).toBe('MB');
    expect(dictionaryBatches(fixture)).toHaveLength(1);
    expect(fixture.app.store.sheetHistories.word.size).toBe(1);

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

  it('wraps its bar so every button stays inside the tab, in a narrow pane and a long language', async () => {
    const fixture = await setup();
    /** The bar's buttons any part of which lies past the tab's edges. */
    const clipped = () => {
      const { left, right } = tab(fixture).getBoundingClientRect();
      return Array.from(tab(fixture).querySelectorAll('button'))
        .filter(button => {
          const box = button.getBoundingClientRect();
          return box.left < left || box.right > right;
        })
        .map(button => button.getAttribute('aria-label') ?? sheetName(button));
    };

    host.width = 600;
    await drawn();
    expect(clipped()).toEqual([]);

    host.width = WIDTH;
    Object.assign(fixture.i18n, createI18n('fr-FR', messagesOf('fr-FR')));
    await drawn();
    expect(buttonNamed(fixture, 'Exporter au format CSV')).not.toBeNull();
    expect(clipped()).toEqual([]);

    host.width = 600;
    await drawn();
    expect(clipped()).toEqual([]);
    const sheet = textarea(fixture).closest('.dineug-grid') as HTMLElement;
    expect(sheet.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      buttonNamed(fixture, 'Exporter au format CSV')!.getBoundingClientRect()
        .bottom
    );
  });

  it('stops the editor chords at the tab but the palette, undo, redo and find, and leaves undo and redo to an open edit', async () => {
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
    expect(store.sheetHistories.word.size).toBe(2);
    expect(abbreviation()).toBe('');
    expect(fixture.shortcuts).toEqual([]);

    await press('{Escape}');
    await undo();
    expect(abbreviation()).toBe('MB');
    expect(fixture.shortcuts).toEqual(['undo']);
    fixture.shortcuts.length = 0;

    await press('xy');
    await redo();
    expect(abbreviation()).toBe('MB');
    expect(fixture.shortcuts).toEqual([]);

    await press('{Escape}');
    await redo();
    expect(abbreviation()).toBe('');
    expect(fixture.shortcuts).toEqual(['redo']);
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

  it('commits text inserted with no keydown, after an edit rows moved under was cancelled, to the row the cell shows', async () => {
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
    await press('{Escape}');

    // As the emoji picker or dictation inserts it: an input with no key before it.
    await session().send('Input.insertText', { text: 'Z' });
    await drawn();
    await press('{Enter}');

    expect(names(fixture)).toEqual(['B', 'C', 'Z']);
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
    await click(sheetButton(fixture, 'Checks'));
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

  it('searches the check sheet again in the language a switch shows it in', async () => {
    const fixture = await setup({
      seed: [word('a', 'Member'), word('b', 'Member')],
    });
    const rowCount = (count: number) =>
      fixture.i18n.t('dictionary.rowCount', { count });
    await click(sheetButton(fixture, 'Checks'));
    await userEvent.click(search(fixture));
    await press('duplicate');
    expect(status(fixture)).toBe('2 rows 1 selected');

    Object.assign(fixture.i18n, createI18n('ko-KR', messagesOf('ko-KR')));
    await drawn();
    expect(status(fixture)).toBe(rowCount(0));

    Object.assign(fixture.i18n, createI18n('en', messagesOf('en')));
    await drawn();
    expect(status(fixture)).toBe('2 rows 1 selected');
  });

  it("lists the checks again after a table's or a column's edit, while the check sheet shows", async () => {
    const fixture = await setup({
      seed: [word('member', '회원'), ...memberTable('회원', '회원')],
    });
    await click(sheetButton(fixture, 'Checks'));
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

  it("lists the checks once a frame while batches keep coming, as a peer's drag sends them", async () => {
    const fixture = await setup({
      seed: [word('member', '회원'), ...memberTable('회원', '회원')],
    });
    await click(sheetButton(fixture, 'Checks'));
    expect(status(fixture)).toBe('0 rows');
    const listChecks = vi.mocked(listDictionaryChecks);
    listChecks.mockClear();

    ['회원정보', '회원', '회원주소'].forEach(value =>
      fixture.app.store.dispatchSync(
        changeColumnLogicalNameAction({
          id: 'address',
          tableId: 'member',
          value,
        })
      )
    );
    expect(listChecks).not.toHaveBeenCalled();

    await nextFrame();
    expect(listChecks).toHaveBeenCalledTimes(1);
    await drawn();
    expect(status(fixture)).toBe('1 row 1 selected');
    expect(listChecks).toHaveBeenCalledTimes(1);
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

    await click(sheetButton(fixture, 'Checks'));
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

    await click(sheetButton(fixture, 'Checks'));
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
    await click(sheetButton(fixture, 'Checks'));
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
    await click(sheetButton(fixture, 'Checks'));
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
    await click(sheetButton(fixture, 'Terms'));

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
    await click(sheetButton(fixture, 'Terms'));
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
    // Each file is one undo on the sheet its header names, never the document's.
    expect(
      [DictionaryKind.word, DictionaryKind.term, DictionaryKind.domain].map(
        kind => store.sheetHistories[kind].size
      )
    ).toEqual([1, 1, 1]);
    expect(store.history.size).toBe(0);

    await undo();
    expect(names(fixture, DictionaryKind.term)).toEqual([]);
    expect(hint(fixture)).toBe('Import a CSV file or add a row');
    expect(names(fixture, DictionaryKind.domain)).toHaveLength(2);
    // The term sheet's history is spent; the others keep theirs.
    await undo();
    expect(names(fixture, DictionaryKind.domain)).toHaveLength(2);

    await click(sheetButton(fixture, 'Domains'));
    await undo();
    expect(names(fixture, DictionaryKind.domain)).toEqual([]);
    expect(names(fixture)).toHaveLength(3);
    await click(sheetButton(fixture, 'Words'));
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

    await click(sheetButton(fixture, 'Terms'));
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

  const sheetOf = (shadow: ShadowRoot, name: string) =>
    Array.from(
      shadow.querySelectorAll<HTMLButtonElement>('[role="group"] button')
    ).find(button => sheetName(button) === name) ?? null;

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
    await click(sheetOf(shadow, 'Checks'));
    expect(drawnTexts()).toEqual(
      expect.arrayContaining(['Unregistered word', 'users.name', 'Nickname'])
    );

    await press('{Enter}');
    expect(shadow.querySelector('.dictionary')).toBeNull();
    expect(document.activeElement).toBe(el);
    expect(shadow.activeElement).toBe(shadow.querySelector('.root'));
  });

  it('keeps an open edit through the find and palette chords, prevented, as a cell editor on the canvas keeps them', async () => {
    spyTexts();
    const { el, shadow } = await createEditor();
    await click(toolbarButton(shadow, 'Dictionary'));
    await click(sheetOf(shadow, 'Words'));
    await press('{ArrowRight}Draft');
    const prevented = vi.spyOn(Event.prototype, 'preventDefault');

    await press(`{${MOD}>}f{/${MOD}}{${MOD}>}k{/${MOD}}`);
    expect(shadow.querySelector('.dictionary')).not.toBeNull();
    expect(shadow.querySelector('.quick-search')).toBeNull();
    expect(
      prevented.mock.contexts
        .filter(event => event instanceof KeyboardEvent)
        .map(event => (event as KeyboardEvent).key)
    ).toEqual(['f', 'k']);

    await press('{Enter}');
    // A dictionary is written as its fields and then a row of values per entry.
    const { fields, rows } = JSON.parse(el.runtimeValue).collections
      .wordEntities as { fields: string[]; rows: string[][] };
    const member = rows.find(([id]) => id === SEED.memberWord);
    expect(member?.[fields.indexOf('abbreviation')]).toBe('Draft');
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

    // A first visit opens on the domain sheet, its grid taking the keyboard.
    await click(toolbarButton(shadow, 'Dictionary'));
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

  it("keeps a sheet's edit out of the ERD tab's undo, and undoes it from the toolbar on the Dictionary tab", async () => {
    spyTexts();
    const { el, shadow } = await createEditor();
    const tableIds = () =>
      Object.keys(JSON.parse(el.value).collections.tableEntities);
    const typeText = () =>
      Reflect.get(globalThis, '__erdStages')
        ?.canvas?.findOne(`#column-${SEED.userName}`)
        ?.findOne(`.${FocusType.columnDataType}`)
        ?.findOne('.cell-text')
        ?.text();
    const before = typeText();
    expect(before).not.toBe('TEXT');

    // A first visit opens on the domain sheet, its grid taking the keyboard.
    await click(toolbarButton(shadow, 'Dictionary'));
    await press('{ArrowRight}{ArrowRight}TEXT{Enter}');

    await click(toolbarButton(shadow, 'Entity Relationship Diagram'));
    expect(typeText()).toBe('TEXT');
    const tables = tableIds();
    await press('{Alt>}n{/Alt}');
    expect(tableIds()).toHaveLength(tables.length + 1);
    // The canvas's undo takes back the table, and only the table.
    await press(`{Escape}{${MOD}>}z{/${MOD}}`);
    expect(tableIds()).toEqual(tables);
    await press(`{${MOD}>}z{/${MOD}}`);
    expect(typeText()).toBe('TEXT');

    await click(toolbarButton(shadow, 'Dictionary'));
    const undoButton = shadow.querySelector<HTMLElement>(
      '.toolbar [title^="Undo"]'
    );
    expect(undoButton?.classList.contains('active')).toBe(true);
    await click(undoButton);

    // The press kept the keyboard in the grid, so its own redo still answers.
    await press(`{${MOD}>}{Shift>}z{/Shift}{/${MOD}}`);
    await click(toolbarButton(shadow, 'Entity Relationship Diagram'));
    expect(typeText()).toBe('TEXT');

    await click(toolbarButton(shadow, 'Dictionary'));
    await click(
      shadow.querySelector<HTMLElement>('.toolbar [title^="Undo"]') ?? null
    );
    await click(toolbarButton(shadow, 'Entity Relationship Diagram'));
    expect(typeText()).toBe(before);
  });
});
