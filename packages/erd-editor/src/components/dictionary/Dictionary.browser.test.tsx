// The Dictionary tab in Chromium with real keys: the sheets, the search, the
// row buttons, a paste past the end, one undo per commit, a read-only document,
// the empty sheet, the editor's chords and what a peer's batch shows.

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
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
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

beforeAll(() => page.viewport(WIDTH + 200, HEIGHT + 200));

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
  vi.restoreAllMocks();
});

/** Records the text every canvas draws with its fill, and still draws it. */
function spyTexts() {
  texts = [];
  const original = CanvasRenderingContext2D.prototype.fillText;

  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      texts.push({ text, fill: String(this.fillStyle) });
      original.call(this, text, x, y, maxWidth);
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

  it('keeps every cell read-only and hides the row buttons in a read-only document', async () => {
    const fixture = await setup({ readonly: true });

    expect(buttonNamed(fixture, 'Add Row')).toBeNull();
    expect(buttonNamed(fixture, 'Delete Rows')).toBeNull();

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

  it("commits typing on the active cell before any gesture to the first row's id", async () => {
    const fixture = await setup();

    expect(fixture.shadow.activeElement).toBe(textarea(fixture));
    await press('Zed{Enter}');

    expect(fixture.app.store.state.collections.wordEntities.a.name).toBe('Zed');
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
